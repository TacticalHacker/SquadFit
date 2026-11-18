import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { StoredCustomWorkout, StoredEntry } from "@calci/shared";

/** Key layout: see specs/002-workout-tracker/data-model.md. */
export interface EntryItem extends StoredEntry {
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** Gym fields carried by feature 006 entries in the same key space; absent on plain workout entries. */
export function gymFields(i: Record<string, unknown>): Partial<StoredEntry> {
  if (i.kind !== "gym") return {};
  return {
    kind: "gym",
    muscleGroup: i.muscleGroup as NonNullable<StoredEntry["muscleGroup"]>,
    exerciseKind: i.exerciseKind as NonNullable<StoredEntry["exerciseKind"]>,
    ...(Array.isArray(i.sets) ? { sets: i.sets as NonNullable<StoredEntry["sets"]> } : {}),
    ...(typeof i.volumeKg === "number" ? { volumeKg: i.volumeKg } : {}),
  };
}

export interface CustomWorkoutItem extends StoredCustomWorkout {
  createdAt: string;
  updatedAt: string;
  removedAt?: string;
}

export interface WorkoutRepo {
  listEntriesForDay(userId: string, date: string): Promise<EntryItem[]>;
  listEntriesInRange(userId: string, from: string, to: string): Promise<EntryItem[]>;
  getEntry(userId: string, date: string, workoutId: string): Promise<EntryItem | null>;
  /** Creates the entry unless one exists. Returns true if it created it. */
  putEntryIfAbsent(userId: string, entry: EntryItem): Promise<boolean>;
  /** Returns false if the entry does not exist. */
  updateEntryMinutes(
    userId: string,
    date: string,
    workoutId: string,
    minutes: number,
    calories: number,
    nowIso: string,
  ): Promise<boolean>;
  /**
   * Feature 007: the AI's calorie/duration adjustment with its reason. Applied only while the entry is still the
   * version the agent read (`updatedAt`), so a newer member edit is never overwritten (research R4).
   */
  setAiAdjustment(
    userId: string,
    date: string,
    workoutId: string,
    fields: { minutes: number; calories: number; aiNote: string },
    expectedUpdatedAt: string,
    nowIso: string,
  ): Promise<"ok" | "missing" | "conflict">;
  /**
   * Feature 010: the member confirmed an unusual jump ("Looks right"). Conditional on the `updatedAt` they saw;
   * does not change `updatedAt`, so a later edit (a full save) drops the confirmation.
   */
  confirmJump(userId: string, date: string, workoutId: string, expectedUpdatedAt: string, nowIso: string): Promise<"ok" | "missing" | "conflict">;
  deleteEntry(userId: string, date: string, workoutId: string): Promise<void>;
  /** Active (non-removed) custom workouts. */
  listCustomWorkouts(userId: string): Promise<CustomWorkoutItem[]>;
  getCustomWorkout(userId: string, workoutId: string): Promise<CustomWorkoutItem | null>;
  putCustomWorkout(userId: string, item: CustomWorkoutItem): Promise<void>;
  /** Returns false if it does not exist or is removed. */
  updateCustomWorkout(
    userId: string,
    workoutId: string,
    fields: Pick<StoredCustomWorkout, "name" | "defaultMinutes" | "defaultCalories">,
    nowIso: string,
  ): Promise<boolean>;
  /** Soft remove. Returns false if it does not exist. Idempotent. */
  markCustomRemoved(userId: string, workoutId: string, nowIso: string): Promise<boolean>;
}

const pk = (userId: string) => `USER#${userId}`;
const entrySk = (date: string, workoutId: string) => `ENTRY#${date}#${workoutId}`;
const workoutSk = (workoutId: string) => `WORKOUT#${workoutId}`;

const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

export function toEntry(i: Record<string, unknown>): EntryItem {
  return {
    date: i.date as string,
    workoutId: i.workoutId as string,
    name: i.name as string,
    rateMinutes: i.rateMinutes as number,
    rateCalories: i.rateCalories as number,
    minutes: i.minutes as number,
    calories: i.calories as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
    ...(typeof i.aiNote === "string" ? { aiNote: i.aiNote } : {}),
    ...(typeof i.jumpConfirmedAt === "string" ? { jumpConfirmedAt: i.jumpConfirmedAt } : {}),
    ...gymFields(i),
  };
}

function toWorkout(i: Record<string, unknown>): CustomWorkoutItem {
  return {
    workoutId: i.workoutId as string,
    name: i.name as string,
    defaultMinutes: i.defaultMinutes as number,
    defaultCalories: i.defaultCalories as number,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
    ...(typeof i.removedAt === "string" ? { removedAt: i.removedAt } : {}),
  };
}

export class DynamoWorkoutRepo implements WorkoutRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  private async queryAll(userId: string, condition: string, values: Record<string, unknown>) {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: `pk = :pk AND ${condition}`,
          ExpressionAttributeValues: { ":pk": pk(userId), ...values },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(res.Items ?? []));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  async listEntriesForDay(userId: string, date: string) {
    return (await this.queryAll(userId, "begins_with(sk, :p)", { ":p": `ENTRY#${date}#` })).map(toEntry);
  }

  async listEntriesInRange(userId: string, from: string, to: string) {
    // "~" sorts after every character used in ids, so it closes the upper bound for the last day.
    return (
      await this.queryAll(userId, "sk BETWEEN :a AND :b", { ":a": `ENTRY#${from}`, ":b": `ENTRY#${to}~` })
    ).map(toEntry);
  }

  async getEntry(userId: string, date: string, workoutId: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, workoutId) } }),
    );
    return res.Item ? toEntry(res.Item) : null;
  }

  async putEntryIfAbsent(userId: string, entry: EntryItem) {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: pk(userId), sk: entrySk(entry.date, entry.workoutId), ...entry },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async updateEntryMinutes(
    userId: string,
    date: string,
    workoutId: string,
    minutes: number,
    calories: number,
    nowIso: string,
  ) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: entrySk(date, workoutId) },
          ConditionExpression: "attribute_exists(pk)",
          // A member's change replaces any AI adjustment (feature 007, FR-013).
          UpdateExpression: "SET minutes = :m, calories = :c, updatedAt = :now REMOVE aiNote",
          ExpressionAttributeValues: { ":m": minutes, ":c": calories, ":now": nowIso },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async setAiAdjustment(
    userId: string,
    date: string,
    workoutId: string,
    fields: { minutes: number; calories: number; aiNote: string },
    expectedUpdatedAt: string,
    nowIso: string,
  ) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: entrySk(date, workoutId) },
          ConditionExpression: "attribute_exists(pk) AND updatedAt = :seen",
          UpdateExpression: "SET minutes = :m, calories = :c, aiNote = :n, updatedAt = :now",
          ExpressionAttributeValues: {
            ":m": fields.minutes,
            ":c": fields.calories,
            ":n": fields.aiNote,
            ":seen": expectedUpdatedAt,
            ":now": nowIso,
          },
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      return (await this.getEntry(userId, date, workoutId)) ? ("conflict" as const) : ("missing" as const);
    }
  }

  async confirmJump(userId: string, date: string, workoutId: string, expectedUpdatedAt: string, nowIso: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: entrySk(date, workoutId) },
          ConditionExpression: "attribute_exists(pk) AND updatedAt = :seen",
          UpdateExpression: "SET jumpConfirmedAt = :now",
          ExpressionAttributeValues: { ":seen": expectedUpdatedAt, ":now": nowIso },
        }),
      );
      return "ok" as const;
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      return (await this.getEntry(userId, date, workoutId)) ? ("conflict" as const) : ("missing" as const);
    }
  }

  async deleteEntry(userId: string, date: string, workoutId: string) {
    await this.doc.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, workoutId) } }),
    );
  }

  async listCustomWorkouts(userId: string) {
    return (await this.queryAll(userId, "begins_with(sk, :p)", { ":p": "WORKOUT#" }))
      .map(toWorkout)
      .filter((w) => !w.removedAt);
  }

  async getCustomWorkout(userId: string, workoutId: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: workoutSk(workoutId) } }),
    );
    return res.Item ? toWorkout(res.Item) : null;
  }

  async putCustomWorkout(userId: string, item: CustomWorkoutItem) {
    await this.doc.send(
      new PutCommand({ TableName: this.tableName, Item: { pk: pk(userId), sk: workoutSk(item.workoutId), ...item } }),
    );
  }

  async updateCustomWorkout(
    userId: string,
    workoutId: string,
    fields: Pick<StoredCustomWorkout, "name" | "defaultMinutes" | "defaultCalories">,
    nowIso: string,
  ) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: workoutSk(workoutId) },
          ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(removedAt)",
          UpdateExpression: "SET #n = :n, defaultMinutes = :m, defaultCalories = :c, updatedAt = :now",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":n": fields.name,
            ":m": fields.defaultMinutes,
            ":c": fields.defaultCalories,
            ":now": nowIso,
          },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async markCustomRemoved(userId: string, workoutId: string, nowIso: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: workoutSk(workoutId) },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: "SET removedAt = if_not_exists(removedAt, :now), updatedAt = :now",
          ExpressionAttributeValues: { ":now": nowIso },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }
}
