import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { ActivitySource, ActivityValues } from "@calci/shared";

/** One synced day. Key layout: specs/012-health-activity-sync/data-model.md (`USER#<sub>` / `ACTIVITY#<date>`). */
export interface ActivityItem extends ActivityValues {
  userId: string;
  source: ActivitySource;
  syncedAt: string;
  updatedAt: string;
}

export interface ActivityRepo {
  /** Replace each day's whole item (latest write wins, never added), all days in one transaction. */
  putDays(userId: string, days: readonly ActivityValues[], source: ActivitySource, nowIso: string): Promise<ActivityItem[]>;
  /** Synced days in [from, to], oldest first. */
  listRange(userId: string, from: string, to: string): Promise<ActivityItem[]>;
}

const pk = (userId: string) => `USER#${userId}`;
const sk = (date: string) => `ACTIVITY#${date}`;

export const toActivityItem = (userId: string, d: ActivityValues, source: ActivitySource, nowIso: string): ActivityItem => ({
  userId,
  date: d.date,
  steps: d.steps,
  activeKcal: d.activeKcal,
  distanceKm: d.distanceKm,
  source,
  syncedAt: nowIso,
  updatedAt: nowIso,
});

function fromItem(i: Record<string, unknown>): ActivityItem {
  return {
    userId: i.userId as string,
    date: i.date as string,
    steps: i.steps as number,
    activeKcal: typeof i.activeKcal === "number" ? i.activeKcal : null,
    distanceKm: typeof i.distanceKm === "number" ? i.distanceKm : null,
    source: i.source as ActivitySource,
    syncedAt: i.syncedAt as string,
    updatedAt: i.updatedAt as string,
  };
}

export class DynamoActivityRepo implements ActivityRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async putDays(userId: string, days: readonly ActivityValues[], source: ActivitySource, nowIso: string) {
    const items = days.map((d) => toActivityItem(userId, d, source, nowIso));
    if (!items.length) return items;
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: items.map((item) => ({
          Put: {
            TableName: this.tableName,
            // Unknown optional values are left off the item, so a re-send without them clears them.
            Item: {
              pk: pk(userId),
              sk: sk(item.date),
              ...item,
              activeKcal: item.activeKcal ?? undefined,
              distanceKm: item.distanceKm ?? undefined,
            },
          },
        })),
      }),
    );
    return items;
  }

  async listRange(userId: string, from: string, to: string) {
    const out: ActivityItem[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res: QueryCommandOutput = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND sk BETWEEN :a AND :b",
          ExpressionAttributeValues: { ":pk": pk(userId), ":a": sk(from), ":b": sk(to) },
          ExclusiveStartKey: start,
        }),
      );
      out.push(...(res.Items ?? []).map(fromItem));
      start = res.LastEvaluatedKey;
    } while (start);
    return out;
  }
}
