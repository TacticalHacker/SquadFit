import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { buildLibrary, findGymExercise } from "@calci/shared";
import { DynamoCatalogRepo } from "../../services/api/src/lib/catalog-repo";
import { DynamoGymRepo } from "../../services/api/src/lib/gym-repo";
import { mergeInto, type MergeCounts } from "../../services/api/src/lib/gym-merge";
import { DynamoProfileRepo } from "../../services/api/src/lib/profile-repo";
import { DynamoSquadRepo } from "../../services/api/src/lib/squad-repo";
import { refreshSquadStats } from "../../services/api/src/lib/squad-stats";
import { DynamoWorkoutRepo } from "../../services/api/src/lib/workout-repo";

/**
 * `pnpm admin gym merge <gx-id> <gc-id>... [--dry-run]`: folds members' own exercises into a library exercise
 * (built-in or admin catalog). A thin wrapper over the shared merge service (feature 015, research R7) that the
 * admin panel uses too; squad stats are rebuilt like the backfill (no new feed items). Prints counts only.
 */
export async function mergeOwnExercises(
  client: DynamoDBClient,
  table: string,
  targetId: string,
  sourceIds: string[],
  dryRun: boolean,
): Promise<MergeCounts & { missing: string[] }> {
  const library = buildLibrary(await new DynamoCatalogRepo(table, client).list());
  const target = findGymExercise(targetId, library);
  if (!target || target.kind !== "strength") throw new Error(`${targetId} is not a library strength exercise`);
  if (sourceIds.length === 0 || sourceIds.some((id) => !id.startsWith("gc-"))) throw new Error("Give one or more gc-... ids");

  const owners = await findOwners(DynamoDBDocumentClient.from(client), table, sourceIds);
  const sources = [...owners].map(([exerciseId, pk]) => ({ userId: pk.slice("USER#".length), exerciseId }));
  const statsDeps = { profiles: new DynamoProfileRepo(table, client), workouts: new DynamoWorkoutRepo(table, client), squad: new DynamoSquadRepo(table, client), now: () => new Date() };
  const counts = await mergeInto(target, sources, { gym: new DynamoGymRepo(table, client), now: () => new Date() }, {
    dryRun,
    refresh: (userId) => refreshSquadStats(userId, statsDeps, { seed: true }),
  });
  return { ...counts, missing: sourceIds.filter((id) => !owners.has(id)) };
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
