import { TransactionCanceledException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { findGymExercise } from "@calci/shared";
import { gymGsiPk } from "../../services/api/src/lib/gym-repo";

/**
 * `pnpm admin gym merge <gx-id> <gc-id>... [--dry-run]`: folds members' own exercises into a built-in one.
 * Each logged day moves from `ENTRY#<date>#<gc-id>` to `ENTRY#<date>#<gx-id>` with sets, dates, `updatedAt`,
 * `aiNote` and `jumpConfirmedAt` unchanged; only the id, name and muscle group follow the built-in. A day where the
 * member already logged the built-in is left alone and reported (and the own exercise is then kept). Safe to re-run.
 * Prints counts only (constitution VI).
 */
export interface MergeResult {
  members: Set<string>;
  moved: number;
  conflicts: number;
  removed: number;
  missing: string[];
}

export async function mergeOwnExercises(
  client: DynamoDBClient,
  table: string,
  targetId: string,
  sourceIds: string[],
  dryRun: boolean,
): Promise<MergeResult> {
  const target = findGymExercise(targetId);
  if (!target || target.kind !== "strength") throw new Error(`${targetId} is not a built-in strength exercise`);
  if (sourceIds.length === 0 || sourceIds.some((id) => !id.startsWith("gc-"))) throw new Error("Give one or more gc-... ids");

  const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  const owners = await findOwners(doc, table, sourceIds);
  const result: MergeResult = { members: new Set(), moved: 0, conflicts: 0, removed: 0, missing: sourceIds.filter((id) => !owners.has(id)) };

  for (const [sourceId, pk] of owners) {
    const userId = pk.slice("USER#".length);
    result.members.add(userId);
    const entries = await queryAll(doc, table, gymGsiPk(userId, sourceId));
    let conflicts = 0;
    for (const e of entries) {
      const date = e.date as string;
      if (dryRun) {
        result.moved++;
        continue;
      }
      const { pk: _pk, sk: oldSk, gsi1pk: _g, gsi1sk: _s, ...rest } = e;
      const moved = {
        ...rest,
        pk,
        sk: `ENTRY#${date}#${targetId}`,
        gsi1pk: gymGsiPk(userId, targetId),
        gsi1sk: date,
        workoutId: targetId,
        name: target.name,
        muscleGroup: target.group,
      };
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              { Put: { TableName: table, Item: moved, ConditionExpression: "attribute_not_exists(pk)" } },
              { Delete: { TableName: table, Key: { pk, sk: oldSk }, ConditionExpression: "attribute_exists(pk)" } },
            ],
          }),
        );
        result.moved++;
      } catch (err) {
        if (!(err instanceof TransactionCanceledException)) throw err;
        conflicts++;
      }
    }
    result.conflicts += conflicts;
    // Keep the own exercise while any of its days could not move, so nothing is stranded.
    if (conflicts === 0) {
      if (!dryRun) {
        await doc.send(
          new UpdateCommand({
            TableName: table,
            Key: { pk, sk: `GYMEX#${sourceId}` },
            UpdateExpression: "SET removedAt = if_not_exists(removedAt, :now), mergedInto = :t",
            ExpressionAttributeValues: { ":now": new Date().toISOString(), ":t": targetId },
          }),
        );
      }
      result.removed++;
    }
  }
  return result;
}

async function findOwners(doc: DynamoDBDocumentClient, table: string, ids: string[]) {
  const owners = new Map<string, string>();
  const wanted = new Set(ids);
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "begins_with(sk, :p)",
        ExpressionAttributeValues: { ":p": "GYMEX#" },
        ProjectionExpression: "pk, exerciseId",
        ExclusiveStartKey: startKey,
      }),
    );
    for (const i of res.Items ?? []) if (wanted.has(i.exerciseId as string)) owners.set(i.exerciseId as string, i.pk as string);
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return owners;
}

async function queryAll(doc: DynamoDBDocumentClient, table: string, gsi1pk: string) {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: table,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": gsi1pk },
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...(res.Items ?? []));
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return items;
}
