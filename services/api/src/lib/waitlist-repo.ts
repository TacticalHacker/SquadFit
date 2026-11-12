import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { WaitlistGoal } from "@calci/shared";

/** Key layout: see specs/009-public-landing-page/data-model.md. Operator-only data; never logged. */
export interface WaitlistEntry {
  name: string;
  email: string;
  primaryGoal: WaitlistGoal;
  createdAt: string;
}

export interface WaitlistRepo {
  /** One entry per (already normalized) email, atomically. */
  add(entry: Omit<WaitlistEntry, "createdAt">, nowIso: string): Promise<"created" | "exists">;
  /** Count one submission against `key` in `hour` (epoch hours); returns the new count. Counters expire on their own. */
  hit(key: string, hour: number): Promise<number>;
  /** Newest first. */
  list(): Promise<WaitlistEntry[]>;
}

export const WAITLIST_LIMIT_PER_ADDRESS = 5;
export const WAITLIST_LIMIT_OVERALL = 30;

export class DynamoWaitlistRepo implements WaitlistRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async add(entry: Omit<WaitlistEntry, "createdAt">, nowIso: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { pk: `WAITLISTEMAIL#${entry.email}`, sk: "E", createdAt: nowIso },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: { pk: "WAITLIST", sk: `${nowIso}#${entry.email}`, ...entry, createdAt: nowIso },
              },
            },
          ],
        }),
      );
      return "created" as const;
    } catch (err) {
      const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
      if (err instanceof Error && err.name === "TransactionCanceledException" && reasons?.[0]?.Code === "ConditionalCheckFailed") {
        return "exists" as const;
      }
      throw err;
    }
  }

  async hit(key: string, hour: number) {
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `PUBRATE#${key}#${hour}`, sk: "C" },
        UpdateExpression: "ADD #c :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": (hour + 1) * 3600 + 7200 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return Number(res.Attributes?.count ?? 1);
  }

  async list() {
    const out: WaitlistEntry[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :p",
          ExpressionAttributeValues: { ":p": "WAITLIST" },
          ScanIndexForward: false,
          ExclusiveStartKey: startKey,
        }),
      );
      for (const i of res.Items ?? []) {
        out.push({
          name: i.name as string,
          email: i.email as string,
          primaryGoal: i.primaryGoal as WaitlistGoal,
          createdAt: i.createdAt as string,
        });
      }
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return out;
  }
}
