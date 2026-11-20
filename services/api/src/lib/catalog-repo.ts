import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { exerciseNameKey, type CatalogExercise, type CatalogGroup } from "@calci/shared";

/**
 * Feature 015: admin-managed gym exercises. Items `GYMCATALOG / EX#<id>` plus a name guard
 * `GYMCATALOGNAME#<normalized name> / N` written in the same transaction (data-model.md). No deletes: retired
 * exercises keep their guard so the name stays reserved.
 */
export type CatalogPatch = { name?: string; group?: CatalogGroup; status?: "active" | "retired" };
export type CatalogUpdateResult = { ok: true; item: CatalogExercise } | { ok: false; reason: "not_found" | "stale" | "duplicate" };

export interface CatalogRepo {
  list(): Promise<CatalogExercise[]>;
  create(item: CatalogExercise): Promise<"ok" | "duplicate" | "id_taken">;
  /** Conditional on the `updatedAt` the admin read. */
  update(id: string, expectedUpdatedAt: string, patch: CatalogPatch, by: string, nowIso: string): Promise<CatalogUpdateResult>;
}

const PK = "GYMCATALOG";
const sk = (id: string) => `EX#${id}`;
const guardPk = (name: string) => `GYMCATALOGNAME#${exerciseNameKey(name)}`;

function toCatalog(i: Record<string, unknown>): CatalogExercise {
  return {
    exerciseId: i.exerciseId as string,
    name: i.name as string,
    group: i.group as CatalogGroup,
    kind: "strength",
    status: i.status === "retired" ? "retired" : "active",
    createdAt: i.createdAt as string,
    createdBy: i.createdBy as string,
    updatedAt: i.updatedAt as string,
    updatedBy: i.updatedBy as string,
  };
}

/** Index of the failed item in a cancelled transaction, or -1 when it was not a condition failure. */
function failedIndex(err: unknown): number {
  if (!(err instanceof Error) || err.name !== "TransactionCanceledException") return -1;
  const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
  return reasons.findIndex((r) => r.Code === "ConditionalCheckFailed");
}

export class DynamoCatalogRepo implements CatalogRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async list() {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": PK, ":p": "EX#" },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(res.Items ?? []));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items.map(toCatalog);
  }

  async create(item: CatalogExercise) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: this.tableName, Item: { pk: PK, sk: sk(item.exerciseId), ...item }, ConditionExpression: "attribute_not_exists(pk)" } },
            {
              Put: {
                TableName: this.tableName,
                Item: { pk: guardPk(item.name), sk: "N", exerciseId: item.exerciseId },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
      return "ok" as const;
    } catch (err) {
      const i = failedIndex(err);
      if (i === 0) return "id_taken" as const;
      if (i === 1) return "duplicate" as const;
      throw err;
    }
  }

  async update(id: string, expectedUpdatedAt: string, patch: CatalogPatch, by: string, nowIso: string): Promise<CatalogUpdateResult> {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: PK, sk: sk(id) } }));
    if (!res.Item) return { ok: false, reason: "not_found" };
    const current = toCatalog(res.Item);
    if (current.updatedAt !== expectedUpdatedAt) return { ok: false, reason: "stale" };
    const next: CatalogExercise = { ...current, ...patch, updatedAt: nowIso, updatedBy: by };

    const names: Record<string, string> = { "#n": "name", "#g": "group", "#s": "status" };
    const update = {
      TableName: this.tableName,
      Key: { pk: PK, sk: sk(id) },
      ConditionExpression: "updatedAt = :expected",
      UpdateExpression: "SET #n = :n, #g = :g, #s = :s, updatedAt = :now, updatedBy = :by",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ":n": next.name, ":g": next.group, ":s": next.status, ":now": nowIso, ":by": by, ":expected": expectedUpdatedAt },
    };
    const renamed = guardPk(next.name) !== guardPk(current.name);
    try {
      if (renamed) {
        await this.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              { Update: update },
              {
                Put: {
                  TableName: this.tableName,
                  Item: { pk: guardPk(next.name), sk: "N", exerciseId: id },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              { Delete: { TableName: this.tableName, Key: { pk: guardPk(current.name), sk: "N" } } },
            ],
          }),
        );
      } else {
        await this.doc.send(new UpdateCommand(update));
      }
      return { ok: true, item: next };
    } catch (err) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") return { ok: false, reason: "stale" };
      const i = failedIndex(err);
      if (i === 0) return { ok: false, reason: "stale" };
      if (i === 1) return { ok: false, reason: "duplicate" };
      throw err;
    }
  }
}
