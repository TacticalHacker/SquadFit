import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SquadEventKind, SquadStats } from "@calci/shared";

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
  hi5Count: number;
  createdAt: string;
  /** false = a high-five target that never appears in the squad feed (feature 011 day cards); default true. */
  listed?: boolean;
}

export type FeedKey = { userId: string; eventId: string };

export interface SquadRepo {
  getStats(userId: string): Promise<SquadStats | null>;
  /** Writes `stats` with version `expectedVersion + 1`; "conflict" if another rebuild wrote first (research R13). */
  putStats(userId: string, stats: SquadStats, expectedVersion: number | null): Promise<"ok" | "conflict">;
  batchGetStats(userIds: readonly string[]): Promise<Map<string, SquadStats>>;
  listMemberFeed(userId: string): Promise<FeedItem[]>;
  getFeed(userId: string, eventId: string): Promise<FeedItem | null>;
  putFeed(item: FeedItem): Promise<void>;
  /** Updates the shown figures only; keeps `createdAt` and the high-five count. */
  updateFeed(userId: string, eventId: string, eventDate: string, payload: Record<string, unknown>): Promise<void>;
  /** Removes the item and every high-five on it. */
  deleteFeed(userId: string, eventId: string): Promise<void>;
  /** Newest first. `startKey` is the `lastKey` of the previous page. */
  listSquadFeed(squadId: string, pageSize: number, startKey?: Record<string, unknown>): Promise<{ items: FeedItem[]; lastKey?: Record<string, unknown> }>;
  /** Idempotent. Returns the new count, or null if the feed item does not exist. */
  addHighFive(author: FeedKey, reactorId: string, nowIso: string): Promise<number | null>;
  removeHighFive(author: FeedKey, reactorId: string): Promise<number | null>;
  /** Which of `items` the viewer has high-fived, as `"<userId>~<eventId>"`. */
  myHighFives(viewerId: string, items: readonly FeedKey[]): Promise<Set<string>>;
}

const pk = (userId: string) => `USER#${userId}`;
const STATS_SK = "SQUADSTATS";
const feedSk = (eventId: string) => `FEED#${eventId}`;
const hi5Sk = (eventId: string, reactor: string) => `HI5#${eventId}#${reactor}`;
export const feedGsiPk = (squadId: string) => `SQUADFEED#${squadId}`;
export const feedId = (userId: string, eventId: string) => `${userId}~${eventId}`;

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
    hi5Count: (i.hi5Count as number | undefined) ?? 0,
    createdAt: i.createdAt as string,
    ...(i.gsi1pk === undefined ? { listed: false } : {}),
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

  async putFeed(item: FeedItem) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: pk(item.userId),
          sk: feedSk(item.eventId),
          ...item,
          ...(item.listed === false
            ? {}
            : { gsi1pk: feedGsiPk(item.squadId), gsi1sk: `${item.createdAt}#${item.userId}#${item.eventId}` }),
        },
      }),
    );
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
        ExpressionAttributeValues: { ":pk": pk(userId), ":p": `HI5#${eventId}#` },
      }),
    );
    await Promise.all(
      (reactions.Items ?? []).map((r) => this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: r.pk, sk: r.sk } }))),
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

  async addHighFive(author: FeedKey, reactorId: string, nowIso: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { pk: pk(author.userId), sk: hi5Sk(author.eventId, reactorId), createdAt: nowIso },
                ConditionExpression: "attribute_not_exists(sk)",
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: feedSk(author.eventId) },
                ConditionExpression: "attribute_exists(sk)",
                UpdateExpression: "ADD hi5Count :one",
                ExpressionAttributeValues: { ":one": 1 },
              },
            },
          ],
        }),
      );
    } catch (err) {
      if (cancelledAt(err, 1)) return null;
      if (!cancelledAt(err, 0)) throw err; // already high-fived: fall through to the current count
    }
    return (await this.getFeed(author.userId, author.eventId))?.hi5Count ?? null;
  }

  async removeHighFive(author: FeedKey, reactorId: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: hi5Sk(author.eventId, reactorId) },
                ConditionExpression: "attribute_exists(sk)",
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: pk(author.userId), sk: feedSk(author.eventId) },
                ConditionExpression: "attribute_exists(sk) AND hi5Count > :zero",
                UpdateExpression: "ADD hi5Count :minus",
                ExpressionAttributeValues: { ":zero": 0, ":minus": -1 },
              },
            },
          ],
        }),
      );
    } catch (err) {
      if (!cancelledAt(err, 0) && !cancelledAt(err, 1)) throw err; // nothing to remove: report the current count
    }
    return (await this.getFeed(author.userId, author.eventId))?.hi5Count ?? null;
  }

  async myHighFives(viewerId: string, items: readonly FeedKey[]) {
    const out = new Set<string>();
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100);
      let keys: Record<string, unknown>[] = chunk.map((k) => ({ pk: pk(k.userId), sk: hi5Sk(k.eventId, viewerId) }));
      while (keys.length) {
        const res = await this.doc.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }));
        for (const item of res.Responses?.[this.tableName] ?? []) {
          const author = (item.pk as string).slice("USER#".length);
          const eventId = (item.sk as string).slice("HI5#".length, -(viewerId.length + 1));
          out.add(feedId(author, eventId));
        }
        keys = (res.UnprocessedKeys?.[this.tableName]?.Keys as Record<string, unknown>[] | undefined) ?? [];
      }
    }
    return out;
  }
}
