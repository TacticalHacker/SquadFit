import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQUAD_DEFAULT_TIMEZONE, notificationTtl, type ReactionRecord, type ReactionType, type SquadEventKind, type SquadStats, type StoredNotification } from "@calci/shared";

/**
 * Feature 010 storage. Key layout: specs/010-squad-leaderboard/data-model.md.
 * Never log item contents (constitution VI).
 */
export interface FeedItem {
  /** Author. */
  userId: string;
  squadId: string;
  eventId: string;
  kind: SquadEventKind;
  eventDate: string;
  payload: Record<string, unknown>;
  /** Feature 013: reaction counts (stored flat as rxFire / rxMuscle / rxCrown). */
  reactions: ReactionCounts;
  createdAt: string;
  /** false = a reaction target that never appears in the squad feed (feature 011 day cards); default true. */
  listed?: boolean;
  /** Feature 016: a workout day the member posted to the feed (first post time); absent = not posted. */
  postedAt?: string;
  /** Feature 016: `share-photos/<sub>/<date>.<ext>` while posted with a photo. */
  photoKey?: string;
}

export type FeedKey = { userId: string; eventId: string };
export type ReactionCounts = Record<ReactionType, number>;
export const NO_REACTIONS: ReactionCounts = { fire: 0, muscle: 0, crown: 0 };
const RX_ATTR: Record<ReactionType, string> = { fire: "rxFire", muscle: "rxMuscle", crown: "rxCrown" };
/** `<author>~<eventId>#<type>`: one of the viewer's reactions, as returned by `myReactions`. */
export const reactionKey = (userId: string, eventId: string, type: ReactionType) => `${userId}~${eventId}#${type}`;

export interface SquadRepo {
  getStats(userId: string): Promise<SquadStats | null>;
  /** Writes `stats` with version `expectedVersion + 1`; "conflict" if another rebuild wrote first (research R13). */
  putStats(userId: string, stats: SquadStats, expectedVersion: number | null): Promise<"ok" | "conflict">;
  batchGetStats(userIds: readonly string[]): Promise<Map<string, SquadStats>>;
  listMemberFeed(userId: string): Promise<FeedItem[]>;
  getFeed(userId: string, eventId: string): Promise<FeedItem | null>;
  /** `ifAbsent`: write only if no item exists (the lazy day-card target must never overwrite a post). */
  putFeed(item: FeedItem, opts?: { ifAbsent?: boolean }): Promise<void>;
  /**
   * Feature 016: list `day#<date>` in the squad feed, creating the item if needed. Keeps the first post time,
   * reactions and `createdAt`. `photoKey`: a key sets it, null removes it, "keep" leaves it. Returns the item.
   */
  postDay(userId: string, squadId: string, date: string, nowIso: string, photoKey: string | null | "keep"): Promise<FeedItem>;
  /** Feature 016: take `day#<date>` out of the squad feed (reactions kept); returns the item before, or null. */
  unpostDay(userId: string, date: string): Promise<FeedItem | null>;
  /** Updates the shown figures only; keeps `createdAt` and the reaction counts. */
  updateFeed(userId: string, eventId: string, eventDate: string, payload: Record<string, unknown>): Promise<void>;
  /** Removes the item and every reaction on it. */
  deleteFeed(userId: string, eventId: string): Promise<void>;
  /** Newest first. `startKey` is the `lastKey` of the previous page. */
  listSquadFeed(squadId: string, pageSize: number, startKey?: Record<string, unknown>): Promise<{ items: FeedItem[]; lastKey?: Record<string, unknown> }>;
  /** Idempotent. Returns the new counts, or null if the feed item does not exist. */
  addReaction(author: FeedKey, type: ReactionType, reactorId: string, nowIso: string): Promise<ReactionCounts | null>;
  removeReaction(author: FeedKey, type: ReactionType, reactorId: string): Promise<ReactionCounts | null>;
  /** The viewer's reactions on `items`, as `reactionKey(...)` strings. */
  myReactions(viewerId: string, items: readonly FeedKey[]): Promise<Set<string>>;
  /** Feature 022: who reacted to an item (`RX#` items), in no particular order. */
  listReactors(author: FeedKey): Promise<ReactionRecord[]>;
  /** Feature 022: the given feed items that exist. */
  batchGetFeed(keys: readonly FeedKey[]): Promise<FeedItem[]>;
  /** Feature 022: add `type` to the owner's (item, reactor) notification, bumping `latestAt`. */
  notify(owner: FeedKey, reactorId: string, type: ReactionType, nowIso: string): Promise<void>;
  /** Feature 022: drop `type`; the notification goes when no type remains. */
  unnotify(owner: FeedKey, reactorId: string, type: ReactionType): Promise<void>;
  /** Feature 022: every notification of the owner (expired ones may still be present) and the seen marker. */
  listNotifications(ownerId: string): Promise<{ items: StoredNotification[]; seenAt: string | null }>;
  /** Feature 022: move the seen marker forward to `upTo` (never back). */
  markNotificationsSeen(ownerId: string, upTo: string): Promise<void>;
  /** Feature 013: the squad's settings (absent item = defaults). */
  getSquadSettings(squadId: string): Promise<{ timezone: string }>;
  putSquadSettings(squadId: string, settings: { timezone: string }, nowIso: string): Promise<void>;
}

const pk = (userId: string) => `USER#${userId}`;
const STATS_SK = "SQUADSTATS";
const feedSk = (eventId: string) => `FEED#${eventId}`;
const rxSk = (eventId: string, type: ReactionType, reactor: string) => `RX#${eventId}#${type}#${reactor}`;
const notifSk = (eventId: string, reactor: string) => `NOTIF#${eventId}#${reactor}`;
const NOTIF_SEEN_SK = "NOTIFSEEN";
const settingsKey = (squadId: string) => ({ pk: `SQUAD#${squadId}`, sk: "SETTINGS" });
export const feedGsiPk = (squadId: string) => `SQUADFEED#${squadId}`;
export const feedId = (userId: string, eventId: string) => `${userId}~${eventId}`;

/** Feature 013 migration: `HI5#<eventId>#<reactor>`; event ids contain "#", reactor ids (Cognito subs) never do. */
export function parseHighFiveSk(sk: string): { eventId: string; reactor: string } {
  const rest = sk.slice("HI5#".length);
  const cut = rest.lastIndexOf("#");
  return { eventId: rest.slice(0, cut), reactor: rest.slice(cut + 1) };
}

const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

function toStats(i: Record<string, unknown>): SquadStats {
  const { pk: _pk, sk: _sk, ...rest } = i;
  return rest as unknown as SquadStats;
}

function toFeed(i: Record<string, unknown>): FeedItem {
  return {
    userId: i.userId as string,
    squadId: i.squadId as string,
    eventId: i.eventId as string,
    kind: i.kind as SquadEventKind,
    eventDate: i.eventDate as string,
    payload: (i.payload ?? {}) as Record<string, unknown>,
    reactions: {
      fire: (i.rxFire as number | undefined) ?? 0,
      muscle: (i.rxMuscle as number | undefined) ?? 0,
      crown: (i.rxCrown as number | undefined) ?? 0,
    },
    createdAt: i.createdAt as string,
    ...(i.gsi1pk === undefined ? { listed: false } : {}),
    ...(typeof i.postedAt === "string" ? { postedAt: i.postedAt } : {}),
    ...(typeof i.photoKey === "string" ? { photoKey: i.photoKey } : {}),
  };
}

/** Which transaction item failed: DynamoDB reports one reason per item, in order. */
function cancelledAt(err: unknown, index: number): boolean {
  if (!(err instanceof Error) || err.name !== "TransactionCanceledException") return false;
  const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
  return reasons[index]?.Code === "ConditionalCheckFailed";
}

export class DynamoSquadRepo implements SquadRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async getStats(userId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: STATS_SK } }));
    return res.Item ? toStats(res.Item) : null;
  }

  async putStats(userId: string, stats: SquadStats, expectedVersion: number | null) {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: pk(userId), sk: STATS_SK, ...stats, version: (expectedVersion ?? 0) + 1 },
          ...(expectedVersion === null
            ? { ConditionExpression: "attribute_not_exists(sk)" }
            : { ConditionExpression: "#v = :v", ExpressionAttributeNames: { "#v": "version" }, ExpressionAttributeValues: { ":v": expectedVersion } }),
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (isConditionFailure(err)) return "conflict" as const;
      throw err;
    }
  }

  async batchGetStats(userIds: readonly string[]) {
    const out = new Map<string, SquadStats>();
    for (let i = 0; i < userIds.length; i += 100) {
      let keys: Record<string, unknown>[] = userIds.slice(i, i + 100).map((u) => ({ pk: pk(u), sk: STATS_SK }));
      while (keys.length) {
        const res = await this.doc.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }));
        for (const item of res.Responses?.[this.tableName] ?? []) out.set((item.pk as string).slice("USER#".length), toStats(item));
        keys = (res.UnprocessedKeys?.[this.tableName]?.Keys as Record<string, unknown>[] | undefined) ?? [];
      }
    }
    return out;
  }

  async listMemberFeed(userId: string) {
    const items: FeedItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk(userId), ":p": "FEED#" },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(res.Items ?? []).map(toFeed));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  async getFeed(userId: string, eventId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: feedSk(eventId) } }));
    return res.Item ? toFeed(res.Item) : null;
  }

  async putFeed(item: FeedItem, opts: { ifAbsent?: boolean } = {}) {
    const { reactions, ...rest } = item;
    try {
      await this.put(item, rest, reactions, opts.ifAbsent === true);
    } catch (err) {
      if (!(opts.ifAbsent && isConditionFailure(err))) throw err;
    }
  }

  private async put(item: FeedItem, rest: Omit<FeedItem, "reactions">, reactions: ReactionCounts, ifAbsent: boolean) {
    await this.doc.send(
      new PutCommand({
        ...(ifAbsent ? { ConditionExpression: "attribute_not_exists(sk)" } : {}),
        TableName: this.tableName,
        Item: {
          pk: pk(item.userId),
          sk: feedSk(item.eventId),
          ...rest,
          rxFire: reactions.fire,
          rxMuscle: reactions.muscle,
          rxCrown: reactions.crown,
          ...(item.listed === false
            ? {}
            : { gsi1pk: feedGsiPk(item.squadId), gsi1sk: `${item.createdAt}#${item.userId}#${item.eventId}` }),
        },
      }),
    );
  }

  async postDay(userId: string, squadId: string, date: string, nowIso: string, photoKey: string | null | "keep") {
    const eventId = `day#${date}`;
    const sets = [
      "squadId = if_not_exists(squadId, :sq)",
      "userId = if_not_exists(userId, :u)",
      "eventId = if_not_exists(eventId, :e)",
      "#k = if_not_exists(#k, :kind)",
      "eventDate = :d",
      "payload = if_not_exists(payload, :empty)",
      "createdAt = if_not_exists(createdAt, :now)",
      "rxFire = if_not_exists(rxFire, :zero)",
      "rxMuscle = if_not_exists(rxMuscle, :zero)",
      "rxCrown = if_not_exists(rxCrown, :zero)",
      "postedAt = if_not_exists(postedAt, :now)",
      "gsi1pk = :gpk",
      "gsi1sk = if_not_exists(gsi1sk, :gsk)",
      ...(typeof photoKey === "string" && photoKey !== "keep" ? ["photoKey = :photo"] : []),
    ];
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: pk(userId), sk: feedSk(eventId) },
        UpdateExpression: `SET ${sets.join(", ")}${photoKey === null ? " REMOVE photoKey" : ""}`,
        ExpressionAttributeNames: { "#k": "kind" },
        ExpressionAttributeValues: {
          ":sq": squadId,
          ":u": userId,
          ":e": eventId,
          ":kind": "workout_day",
          ":d": date,
          ":empty": {},
          ":now": nowIso,
          ":zero": 0,
          ":gpk": feedGsiPk(squadId),
          ":gsk": `${nowIso}#${userId}#${eventId}`,
          ...(typeof photoKey === "string" && photoKey !== "keep" ? { ":photo": photoKey } : {}),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return toFeed(res.Attributes ?? {});
  }

  async unpostDay(userId: string, date: string) {
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: feedSk(`day#${date}`) },
          ConditionExpression: "attribute_exists(sk)",
          UpdateExpression: "REMOVE gsi1pk, gsi1sk, postedAt, photoKey",
          ReturnValues: "ALL_OLD",
        }),
      );
      return res.Attributes ? toFeed(res.Attributes) : null;
    } catch (err) {
      if (isConditionFailure(err)) return null;
      throw err;
    }
  }

  async updateFeed(userId: string, eventId: string, eventDate: string, payload: Record<string, unknown>) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: feedSk(eventId) },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: "SET eventDate = :d, payload = :p",
          ExpressionAttributeValues: { ":d": eventDate, ":p": payload },
        }),
      );
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
    }
  }

  async deleteFeed(userId: string, eventId: string) {
    const reactions = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":pk": pk(userId), ":p": `RX#${eventId}#` },
      }),
    );
    // Feature 022: the item's notifications go with it.
    const notifications = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":pk": pk(userId), ":p": `NOTIF#${eventId}#` },
        ProjectionExpression: "pk, sk",
      }),
    );
    await Promise.all(
      [...(reactions.Items ?? []), ...(notifications.Items ?? [])].map((r) => this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: r.pk, sk: r.sk } }))),
    );
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: feedSk(eventId) } }));
  }

  async listSquadFeed(squadId: string, pageSize: number, startKey?: Record<string, unknown>) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": feedGsiPk(squadId) },
        ScanIndexForward: false,
        Limit: pageSize,
        ExclusiveStartKey: startKey,
      }),
    );
    return { items: (res.Items ?? []).map(toFeed), ...(res.LastEvaluatedKey ? { lastKey: res.LastEvaluatedKey } : {}) };
  }

  private async counts(author: FeedKey) {
    return (await this.getFeed(author.userId, author.eventId))?.reactions ?? null;
  }

  async addReaction(author: FeedKey, type: ReactionType, reactorId: string, nowIso: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { pk: pk(author.userId), sk: rxSk(author.eventId, type, reactorId), createdAt: nowIso },
                ConditionExpression: "attribute_not_exists(sk)",
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: feedSk(author.eventId) },
                ConditionExpression: "attribute_exists(sk)",
                UpdateExpression: "ADD #c :one",
                ExpressionAttributeNames: { "#c": RX_ATTR[type] },
                ExpressionAttributeValues: { ":one": 1 },
              },
            },
          ],
        }),
      );
    } catch (err) {
      if (cancelledAt(err, 1)) return null;
      if (!cancelledAt(err, 0)) throw err; // already given: fall through to the current counts
    }
    return this.counts(author);
  }

  async removeReaction(author: FeedKey, type: ReactionType, reactorId: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: rxSk(author.eventId, type, reactorId) },
                ConditionExpression: "attribute_exists(sk)",
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: feedSk(author.eventId) },
                ConditionExpression: "attribute_exists(sk) AND #c > :zero",
                UpdateExpression: "ADD #c :minus",
                ExpressionAttributeNames: { "#c": RX_ATTR[type] },
                ExpressionAttributeValues: { ":zero": 0, ":minus": -1 },
              },
            },
          ],
        }),
      );
    } catch (err) {
      if (!cancelledAt(err, 0) && !cancelledAt(err, 1)) throw err; // nothing to remove: report the current counts
    }
    return this.counts(author);
  }

  async myReactions(viewerId: string, items: readonly FeedKey[]) {
    const out = new Set<string>();
    const all = items.flatMap((k) => (["fire", "muscle", "crown"] as const).map((type) => ({ ...k, type })));
    for (let i = 0; i < all.length; i += 100) {
      let keys: Record<string, unknown>[] = all.slice(i, i + 100).map((k) => ({ pk: pk(k.userId), sk: rxSk(k.eventId, k.type, viewerId) }));
      while (keys.length) {
        const res = await this.doc.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }));
        for (const item of res.Responses?.[this.tableName] ?? []) {
          const author = (item.pk as string).slice("USER#".length);
          // RX#<eventId>#<type>#<viewer>; event ids contain "#", so cut the known tail.
          const rest = (item.sk as string).slice("RX#".length, -(viewerId.length + 1));
          const cut = rest.lastIndexOf("#");
          out.add(reactionKey(author, rest.slice(0, cut), rest.slice(cut + 1) as ReactionType));
        }
        keys = (res.UnprocessedKeys?.[this.tableName]?.Keys as Record<string, unknown>[] | undefined) ?? [];
      }
    }
    return out;
  }

  async listReactors(author: FeedKey) {
    const out: ReactionRecord[] = [];
    const prefix = `RX#${author.eventId}#`;
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk(author.userId), ":p": prefix },
          ExclusiveStartKey: startKey,
        }),
      );
      for (const item of res.Items ?? []) {
        // RX#<eventId>#<type>#<reactor>: the event id is known, so the rest is "<type>#<reactor>".
        const rest = (item.sk as string).slice(prefix.length);
        const cut = rest.indexOf("#");
        const type = rest.slice(0, cut) as ReactionType;
        if (type !== "fire" && type !== "muscle" && type !== "crown") continue; // a longer event id sharing the prefix
        out.push({ type, reactorId: rest.slice(cut + 1), createdAt: (item.createdAt as string | undefined) ?? "" });
      }
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return out;
  }

  async batchGetFeed(keys: readonly FeedKey[]) {
    const out: FeedItem[] = [];
    const unique = [...new Map(keys.map((k) => [`${k.userId}~${k.eventId}`, k])).values()];
    for (let i = 0; i < unique.length; i += 100) {
      let batch: Record<string, unknown>[] = unique.slice(i, i + 100).map((k) => ({ pk: pk(k.userId), sk: feedSk(k.eventId) }));
      while (batch.length) {
        const res = await this.doc.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: batch } } }));
        out.push(...(res.Responses?.[this.tableName] ?? []).map(toFeed));
        batch = (res.UnprocessedKeys?.[this.tableName]?.Keys as Record<string, unknown>[] | undefined) ?? [];
      }
    }
    return out;
  }

  async notify(owner: FeedKey, reactorId: string, type: ReactionType, nowIso: string) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: pk(owner.userId), sk: notifSk(owner.eventId, reactorId) },
        UpdateExpression: "ADD #types :t SET eventId = :e, reactorId = :r, latestAt = :now, firstAt = if_not_exists(firstAt, :now), #ttl = :ttl",
        ExpressionAttributeNames: { "#types": "types", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":t": new Set([type]), ":e": owner.eventId, ":r": reactorId, ":now": nowIso, ":ttl": notificationTtl(nowIso) },
      }),
    );
  }

  async unnotify(owner: FeedKey, reactorId: string, type: ReactionType) {
    const key = { pk: pk(owner.userId), sk: notifSk(owner.eventId, reactorId) };
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: key,
          ConditionExpression: "attribute_exists(sk)",
          UpdateExpression: "DELETE #types :t",
          ExpressionAttributeNames: { "#types": "types" },
          ExpressionAttributeValues: { ":t": new Set([type]) },
          ReturnValues: "ALL_NEW",
        }),
      );
      if (res.Attributes?.types !== undefined) return;
      // An empty set is removed by DynamoDB: no reaction left, so the notification goes (unless one was re-added).
      await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: key, ConditionExpression: "attribute_not_exists(#types)", ExpressionAttributeNames: { "#types": "types" } }));
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
    }
  }

  async listNotifications(ownerId: string) {
    const items: StoredNotification[] = [];
    let seenAt: string | null = null;
    let startKey: Record<string, unknown> | undefined;
    do {
      // "NOTIF" covers both NOTIF#<eventId>#<reactor> items and the NOTIFSEEN marker (data-model.md).
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk(ownerId), ":p": "NOTIF" },
          ExclusiveStartKey: startKey,
        }),
      );
      for (const i of res.Items ?? []) {
        if (i.sk === NOTIF_SEEN_SK) seenAt = (i.seenAt as string | undefined) ?? null;
        else if (i.types instanceof Set && i.types.size > 0) {
          items.push({ eventId: i.eventId as string, reactorId: i.reactorId as string, types: [...(i.types as Set<ReactionType>)], latestAt: i.latestAt as string, ttl: i.ttl as number });
        }
      }
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return { items, seenAt };
  }

  async markNotificationsSeen(ownerId: string, upTo: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(ownerId), sk: NOTIF_SEEN_SK },
          ConditionExpression: "attribute_not_exists(seenAt) OR seenAt < :t",
          UpdateExpression: "SET seenAt = :t",
          ExpressionAttributeValues: { ":t": upTo },
        }),
      );
    } catch (err) {
      if (!isConditionFailure(err)) throw err; // already seen up to a later time
    }
  }

  async getSquadSettings(squadId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: settingsKey(squadId) }));
    return { timezone: (res.Item?.timezone as string | undefined) ?? SQUAD_DEFAULT_TIMEZONE };
  }

  async putSquadSettings(squadId: string, settings: { timezone: string }, nowIso: string) {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...settingsKey(squadId), timezone: settings.timezone, updatedAt: nowIso } }));
  }

  /**
   * Feature 013 operator migration (research R5): every `HI5#<eventId>#<reactor>` becomes `RX#<eventId>#muscle#<reactor>`,
   * the item's `rxMuscle` is recounted from its RX items, then the HI5 items and `hi5Count` are removed. Safe to re-run.
   */
  async migrateHighFives(): Promise<{ highFives: number; items: number }> {
    const hi5: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "begins_with(sk, :p)",
          ExpressionAttributeValues: { ":p": "HI5#" },
          ExclusiveStartKey: startKey,
        }),
      );
      hi5.push(...(res.Items ?? []));
      startKey = res.LastEvaluatedKey;
    } while (startKey);

    const touched = new Map<string, FeedKey>();
    for (const h of hi5) {
      const userId = (h.pk as string).slice("USER#".length);
      const { eventId, reactor } = parseHighFiveSk(h.sk as string);
      await this.doc.send(
        new PutCommand({ TableName: this.tableName, Item: { pk: h.pk, sk: rxSk(eventId, "muscle", reactor), createdAt: h.createdAt } }),
      );
      touched.set(`${userId}~${eventId}`, { userId, eventId });
    }
    for (const key of touched.values()) {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk(key.userId), ":p": `RX#${key.eventId}#muscle#` },
          Select: "COUNT",
        }),
      );
      try {
        await this.doc.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { pk: pk(key.userId), sk: feedSk(key.eventId) },
            ConditionExpression: "attribute_exists(sk)",
            UpdateExpression: "SET rxMuscle = :n REMOVE hi5Count",
            ExpressionAttributeValues: { ":n": res.Count ?? 0 },
          }),
        );
      } catch (err) {
        if (!isConditionFailure(err)) throw err; // the feed item is gone; its reactions go below
      }
    }
    for (const h of hi5) await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: h.pk, sk: h.sk } }));
    return { highFives: hi5.length, items: touched.size };
  }
}
