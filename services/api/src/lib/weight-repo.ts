import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

/**
 * Feature 014: one weigh-in. Key `USER#<sub>` / `WEIGHT#<date>#<entryId>`; the id starts with the save time, so key
 * order is date then save time and the latest entry is one descending query (specs/014-bodyweight-tracker/data-model.md).
 */
export interface WeightItem {
  userId: string;
  entryId: string;
  date: string;
  weightKg: number;
  recordedAt: string;
}

export interface WeightRepo {
  create(item: WeightItem): Promise<void>;
  /** Idempotent; only ever touches the caller's partition. */
  delete(userId: string, date: string, entryId: string): Promise<void>;
  /** Entries with from ≤ date ≤ to, oldest first. */
  listRange(userId: string, from: string, to: string): Promise<WeightItem[]>;
  /** Latest by date, then save time. */
  latest(userId: string): Promise<WeightItem | null>;
  countDay(userId: string, date: string): Promise<number>;
}

const pk = (userId: string) => `USER#${userId}`;
const sk = (date: string, entryId: string) => `WEIGHT#${date}#${entryId}`;

const fromItem = (i: Record<string, unknown>): WeightItem => ({
  userId: i.userId as string,
  entryId: i.entryId as string,
  date: i.date as string,
  weightKg: i.weightKg as number,
  recordedAt: i.recordedAt as string,
});

export class DynamoWeightRepo implements WeightRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async create(item: WeightItem) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: pk(item.userId), sk: sk(item.date, item.entryId), ...item },
        ConditionExpression: "attribute_not_exists(sk)",
      }),
    );
  }

  async delete(userId: string, date: string, entryId: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: sk(date, entryId) } }));
  }

  async listRange(userId: string, from: string, to: string) {
    const out: WeightItem[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res: QueryCommandOutput = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND sk BETWEEN :a AND :b",
          ExpressionAttributeValues: { ":pk": pk(userId), ":a": `WEIGHT#${from}`, ":b": `WEIGHT#${to}#~` },
          ExclusiveStartKey: start,
        }),
      );
      out.push(...(res.Items ?? []).map(fromItem));
      start = res.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async latest(userId: string) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":pk": pk(userId), ":p": "WEIGHT#" },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const item = res.Items?.[0];
    return item ? fromItem(item) : null;
  }

  async countDay(userId: string, date: string) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":pk": pk(userId), ":p": `WEIGHT#${date}#` },
        Select: "COUNT",
      }),
    );
    return res.Count ?? 0;
  }
}
