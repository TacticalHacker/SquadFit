import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Raid, RaidFilter, RaidStickerId } from "@calci/shared";

/**
 * Feature 021 storage (specs/021-squad-volume-raid/data-model.md):
 * - raid `RAID#<id> / META`, listed by `gsi1pk = SQUADRAIDS#<squad>`, `gsi1sk = <startsAt>#<id>`
 * - contribution `RAID#<id> / CONTRIB#<sub>` (the card reads the whole partition in one query)
 * - sticker `USER#<sub> / RAIDSTICKER#<raidId>`
 * Never log item contents (constitution VI).
 */
export interface RaidContribution {
  raidId: string;
  userId: string;
  rawKg: number;
  setCount: number;
  /** Last rebuild that added kg or sets (avatar order, newest first). */
  lastCountedAt: string | null;
  /** SQUADSTATS version the entries were read for; writes only move forward (research R4). */
  statsVersion: number;
  updatedAt: string;
}
export interface RaidSticker {
  raidId: string;
  stickerId: RaidStickerId;
  awardedAt: string;
}
/** What an admin edit may set; `null` removes an optional attribute. */
export type RaidPatch = Partial<
  Pick<Raid, "name" | "startsAt" | "endsAt" | "targetKg" | "filter" | "capPct" | "lateJoiners" | "showContributors" | "stickerId" | "draft" | "cancelledAt">
> & { tagline?: string | null; cancelReason?: string | null; updatedAt: string; updatedBy: string };

export interface RaidRepo {
  listRaids(squadId: string): Promise<Raid[]>;
  getRaid(raidId: string): Promise<Raid | null>;
  createRaid(raid: Raid): Promise<void>;
  /** Conditional on the `updatedAt` the admin read. Never touches `wonAt` or `totalKg`. */
  updateRaid(raidId: string, patch: RaidPatch, expectedUpdatedAt: string): Promise<"ok" | "stale">;
  deleteRaid(raidId: string, expectedUpdatedAt: string): Promise<"ok" | "stale">;
  /** Strongly consistent, so the last writer always sees every earlier contribution (research R4). */
  listContributions(raidId: string): Promise<RaidContribution[]>;
  getContribution(raidId: string, userId: string): Promise<RaidContribution | null>;
  /** "stale" when a newer rebuild of this member already wrote. */
  putContribution(c: RaidContribution): Promise<"ok" | "stale">;
  /** Sets `wonAt` once; false if it was already set. Leaves `updatedAt` alone. */
  markWon(raidId: string, wonAt: string): Promise<boolean>;
  setTotal(raidId: string, totalKg: number): Promise<void>;
  putSticker(userId: string, sticker: RaidSticker): Promise<void>;
  listStickers(userId: string): Promise<RaidSticker[]>;
}

const raidPk = (id: string) => `RAID#${id}`;
const META = "META";
const contribSk = (userId: string) => `CONTRIB#${userId}`;
const listPk = (squadId: string) => `SQUADRAIDS#${squadId}`;

function toRaid(i: Record<string, unknown>): Raid {
  return {
    raidId: i.raidId as string,
    squadId: i.squadId as string,
    name: i.name as string,
    ...(typeof i.tagline === "string" ? { tagline: i.tagline } : {}),
    startsAt: i.startsAt as string,
    endsAt: i.endsAt as string,
    targetKg: i.targetKg as number,
    metric: "volume_kg",
    filter: (i.filter as RaidFilter | undefined) ?? null,
    capPct: i.capPct as number,
    lateJoiners: i.lateJoiners !== false,
    showContributors: i.showContributors !== false,
    stickerId: (i.stickerId as RaidStickerId | undefined) ?? "raid_cleared",
    draft: i.draft === true,
    ...(typeof i.wonAt === "string" ? { wonAt: i.wonAt } : {}),
    ...(typeof i.cancelledAt === "string" ? { cancelledAt: i.cancelledAt } : {}),
    ...(typeof i.cancelReason === "string" ? { cancelReason: i.cancelReason } : {}),
    totalKg: typeof i.totalKg === "number" ? i.totalKg : 0,
    createdBy: i.createdBy as string,
    createdAt: i.createdAt as string,
    updatedBy: i.updatedBy as string,
    updatedAt: i.updatedAt as string,
  };
}

function toContribution(i: Record<string, unknown>): RaidContribution {
  return {
    raidId: i.raidId as string,
    userId: i.userId as string,
    rawKg: i.rawKg as number,
    setCount: i.setCount as number,
    lastCountedAt: typeof i.lastCountedAt === "string" ? i.lastCountedAt : null,
    statsVersion: i.statsVersion as number,
    updatedAt: i.updatedAt as string,
  };
}

const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

export class DynamoRaidRepo implements RaidRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  private async queryAll(input: Omit<ConstructorParameters<typeof QueryCommand>[0], "TableName" | "ExclusiveStartKey">) {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(new QueryCommand({ TableName: this.tableName, ...input, ExclusiveStartKey: startKey }));
      items.push(...(res.Items ?? []));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  async listRaids(squadId: string) {
    const items = await this.queryAll({ IndexName: "gsi1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": listPk(squadId) } });
    return items.map(toRaid);
  }

  async getRaid(raidId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: raidPk(raidId), sk: META } }));
    return res.Item ? toRaid(res.Item) : null;
  }

  async createRaid(raid: Raid) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: raidPk(raid.raidId), sk: META, gsi1pk: listPk(raid.squadId), gsi1sk: `${raid.startsAt}#${raid.raidId}`, ...raid },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async updateRaid(raidId: string, patch: RaidPatch, expectedUpdatedAt: string) {
    const sets: string[] = [];
    const removes: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = { ":expected": expectedUpdatedAt };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      names[`#${k}`] = k;
      if (v === null) removes.push(`#${k}`);
      else {
        sets.push(`#${k} = :${k}`);
        values[`:${k}`] = v;
      }
    }
    if (patch.startsAt) {
      sets.push("gsi1sk = :gsi1sk");
      values[":gsi1sk"] = `${patch.startsAt}#${raidId}`;
    }
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: raidPk(raidId), sk: META },
          ConditionExpression: "updatedAt = :expected",
          UpdateExpression: `SET ${sets.join(", ")}${removes.length ? ` REMOVE ${removes.join(", ")}` : ""}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (isConditionFailure(err)) return "stale" as const;
      throw err;
    }
  }

  async deleteRaid(raidId: string, expectedUpdatedAt: string) {
    try {
      await this.doc.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: raidPk(raidId), sk: META },
          ConditionExpression: "updatedAt = :expected",
          ExpressionAttributeValues: { ":expected": expectedUpdatedAt },
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (isConditionFailure(err)) return "stale" as const;
      throw err;
    }
  }

  async listContributions(raidId: string) {
    const items = await this.queryAll({
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":pk": raidPk(raidId), ":p": "CONTRIB#" },
      ConsistentRead: true,
    });
    return items.map(toContribution);
  }

  async getContribution(raidId: string, userId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: raidPk(raidId), sk: contribSk(userId) } }));
    return res.Item ? toContribution(res.Item) : null;
  }

  async putContribution(c: RaidContribution) {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: raidPk(c.raidId), sk: contribSk(c.userId), ...c, lastCountedAt: c.lastCountedAt ?? undefined },
          ConditionExpression: "attribute_not_exists(pk) OR statsVersion < :v",
          ExpressionAttributeValues: { ":v": c.statsVersion },
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (isConditionFailure(err)) return "stale" as const;
      throw err;
    }
  }

  async markWon(raidId: string, wonAt: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: raidPk(raidId), sk: META },
          ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(wonAt) AND attribute_not_exists(cancelledAt)",
          UpdateExpression: "SET wonAt = :w",
          ExpressionAttributeValues: { ":w": wonAt },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async setTotal(raidId: string, totalKg: number) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: raidPk(raidId), sk: META },
        ConditionExpression: "attribute_exists(pk)",
        UpdateExpression: "SET totalKg = :t",
        ExpressionAttributeValues: { ":t": totalKg },
      }),
    ).catch((err: unknown) => {
      if (!isConditionFailure(err)) throw err;
    });
  }

  async putSticker(userId: string, sticker: RaidSticker) {
    await this.doc
      .send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: `USER#${userId}`, sk: `RAIDSTICKER#${sticker.raidId}`, ...sticker },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      )
      .catch((err: unknown) => {
        if (!isConditionFailure(err)) throw err;
      });
  }

  async listStickers(userId: string) {
    const items = await this.queryAll({
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":p": "RAIDSTICKER#" },
    });
    return items.map((i) => ({ raidId: i.raidId as string, stickerId: i.stickerId as RaidStickerId, awardedAt: i.awardedAt as string }));
  }
}
