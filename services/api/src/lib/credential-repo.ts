import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/** Key layout: see specs/004-ai-coach-mcp/data-model.md. Only SHA-256 hashes are stored. */
export interface CredentialRepo {
  /** The member a key hash belongs to, or null if unknown or revoked. */
  findUserId(tokenHash: string): Promise<string | null>;
  /** Make `tokenHash` the member's only key (rotating any previous one). */
  issue(userId: string, tokenHash: string, nowIso: string): Promise<void>;
  /** Returns whether the member had a key. */
  revoke(userId: string): Promise<boolean>;
  get(userId: string): Promise<{ tokenHash: string; createdAt: string } | null>;
  /** Count this request in the member's current minute (atomic); returns the new count. */
  hit(userId: string, nowMs: number): Promise<number>;
}

export const RATE_LIMIT_PER_MINUTE = 60;

const lookupKey = (hash: string) => ({ pk: `MCPTOKEN#${hash}`, sk: "MCPTOKEN" });
const credKey = (userId: string) => ({ pk: `USER#${userId}`, sk: "MCPCRED" });

export class DynamoCredentialRepo implements CredentialRepo {
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
    return res.Item ? { tokenHash: res.Item.tokenHash as string, createdAt: res.Item.createdAt as string } : null;
  }

  async issue(userId: string, tokenHash: string, nowIso: string) {
    const previous = await this.get(userId);
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: { ...lookupKey(tokenHash), userId, createdAt: nowIso } } },
          { Put: { TableName: this.tableName, Item: { ...credKey(userId), tokenHash, createdAt: nowIso } } },
          ...(previous && previous.tokenHash !== tokenHash
            ? [{ Delete: { TableName: this.tableName, Key: lookupKey(previous.tokenHash) } }]
            : []),
        ],
      }),
    );
  }

  async revoke(userId: string) {
    const previous = await this.get(userId);
    if (!previous) return false;
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.tableName, Key: lookupKey(previous.tokenHash) } },
          { Delete: { TableName: this.tableName, Key: credKey(userId) } },
        ],
      }),
    );
    return true;
  }

  async hit(userId: string, nowMs: number) {
    const minute = Math.floor(nowMs / 60_000);
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `MCPRATE#${userId}#${minute}`, sk: "C" },
        UpdateExpression: "ADD #c :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": (minute + 1) * 60 + 120 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return Number(res.Attributes?.count ?? 1);
  }
}
