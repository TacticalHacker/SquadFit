import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Health sync tokens (feature 012, research R2/R3). One per member, issued by the member from Settings; only a SHA-256
 * hash is stored. Key layout: specs/012-health-activity-sync/data-model.md.
 */
export interface HealthTokenRepo {
  /** The member a token hash belongs to, or null if unknown or revoked. */
  findUserId(tokenHash: string): Promise<string | null>;
  get(userId: string): Promise<{ tokenHash: string; createdAt: string; lastUsedAt: string | null } | null>;
  /** Make `tokenHash` the member's only token (the previous one stops working at once). */
  issue(userId: string, tokenHash: string, nowIso: string): Promise<void>;
  /** Idempotent. */
  revoke(userId: string): Promise<void>;
  touch(userId: string, nowIso: string): Promise<void>;
  /** Count a request in the member's current UTC hour (atomic); returns the new count. */
  hit(userId: string, nowMs: number): Promise<number>;
}

export const HEALTH_RATE_LIMIT_PER_HOUR = 60;

const lookupKey = (hash: string) => ({ pk: `HEALTHTOKEN#${hash}`, sk: "HEALTHTOKEN" });
const credKey = (userId: string) => ({ pk: `USER#${userId}`, sk: "HEALTHCRED" });

export class DynamoHealthTokenRepo implements HealthTokenRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async findUserId(tokenHash: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: lookupKey(tokenHash) }));
    return typeof res.Item?.userId === "string" ? res.Item.userId : null;
  }

  async get(userId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: credKey(userId) }));
    if (!res.Item) return null;
    return {
      tokenHash: res.Item.tokenHash as string,
      createdAt: res.Item.createdAt as string,
      lastUsedAt: typeof res.Item.lastUsedAt === "string" ? res.Item.lastUsedAt : null,
    };
  }

  async issue(userId: string, tokenHash: string, nowIso: string) {
    const previous = await this.get(userId);
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: { ...lookupKey(tokenHash), userId, createdAt: nowIso } } },
          { Put: { TableName: this.tableName, Item: { ...credKey(userId), tokenHash, createdAt: nowIso } } },
          ...(previous && previous.tokenHash !== tokenHash ? [{ Delete: { TableName: this.tableName, Key: lookupKey(previous.tokenHash) } }] : []),
        ],
      }),
    );
  }

  async revoke(userId: string) {
    const previous = await this.get(userId);
    if (!previous) return;
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.tableName, Key: lookupKey(previous.tokenHash) } },
          { Delete: { TableName: this.tableName, Key: credKey(userId) } },
        ],
      }),
    );
  }

  async touch(userId: string, nowIso: string) {
    // Only while the credential still exists, so a revoke racing a sync never resurrects a half item.
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: credKey(userId),
          UpdateExpression: "SET lastUsedAt = :now",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: { ":now": nowIso },
        }),
      );
    } catch (err) {
      if (!(err instanceof Error && err.name === "ConditionalCheckFailedException")) throw err;
    }
  }

  async hit(userId: string, nowMs: number) {
    const hour = Math.floor(nowMs / 3_600_000);
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `HEALTHRATE#${userId}#${hour}`, sk: "C" },
        UpdateExpression: "ADD #c :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": (hour + 1) * 3600 + 120 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return Number(res.Attributes?.count ?? 1);
  }
}
