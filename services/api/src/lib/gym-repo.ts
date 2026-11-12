import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { MuscleGroup } from "@calci/shared";
import { toEntry, type EntryItem } from "./workout-repo";

/**
 * Feature 006 storage. Gym entries live in feature 002's `ENTRY#<date>#<id>` key space with `kind: "gym"`
 * so every day total includes them (research R1); `gsi1` finds the latest earlier entry per exercise (R5).
 * Never log item contents (constitution VI).
 */
export interface GymEntryItem extends EntryItem {
  kind: "gym";
}

export interface OwnExerciseItem {
  exerciseId: string;
  name: string;
  group: MuscleGroup;
  createdAt: string;
  updatedAt: string;
  removedAt?: string;
}

export interface GymRepo {
  getGymEntry(userId: string, date: string, exerciseId: string): Promise<EntryItem | null>;
  /** Full replace of one (member, exercise, day) slot. */
  putGymEntry(userId: string, entry: GymEntryItem): Promise<void>;
  deleteGymEntry(userId: string, date: string, exerciseId: string): Promise<void>;
  /** Most recent gym entry for the exercise strictly before `date`. */
  lastBefore(userId: string, exerciseId: string, date: string): Promise<EntryItem | null>;
  /** Non-removed own exercises. */
  listOwnExercises(userId: string): Promise<OwnExerciseItem[]>;
  getOwnExercise(userId: string, exerciseId: string): Promise<OwnExerciseItem | null>;
  putOwnExercise(userId: string, item: OwnExerciseItem): Promise<void>;
  /** False if it does not exist or is removed. */
  updateOwnExercise(userId: string, exerciseId: string, fields: { name: string; group: MuscleGroup }, nowIso: string): Promise<boolean>;
  /** Soft remove; false if it does not exist. Idempotent. */
  markOwnRemoved(userId: string, exerciseId: string, nowIso: string): Promise<boolean>;
}

const pk = (userId: string) => `USER#${userId}`;
const entrySk = (date: string, id: string) => `ENTRY#${date}#${id}`;
const exerciseSk = (id: string) => `GYMEX#${id}`;
export const gymGsiPk = (userId: string, exerciseId: string) => `GYM#${userId}#${exerciseId}`;

const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

function toExercise(i: Record<string, unknown>): OwnExerciseItem {
  return {
    exerciseId: i.exerciseId as string,
    name: i.name as string,
    group: i.group as MuscleGroup,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
    ...(typeof i.removedAt === "string" ? { removedAt: i.removedAt } : {}),
  };
}

export class DynamoGymRepo implements GymRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async getGymEntry(userId: string, date: string, exerciseId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, exerciseId) } }));
    return res.Item ? toEntry(res.Item) : null;
  }

  async putGymEntry(userId: string, entry: GymEntryItem) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: pk(userId),
          sk: entrySk(entry.date, entry.workoutId),
          gsi1pk: gymGsiPk(userId, entry.workoutId),
          gsi1sk: entry.date,
          ...entry,
        },
      }),
    );
  }

  async deleteGymEntry(userId: string, date: string, exerciseId: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, exerciseId) } }));
  }

  async lastBefore(userId: string, exerciseId: string, date: string) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p AND gsi1sk < :d",
        ExpressionAttributeValues: { ":p": gymGsiPk(userId, exerciseId), ":d": date },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const item = res.Items?.[0];
    return item ? toEntry(item) : null;
  }

  async listOwnExercises(userId: string) {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk(userId), ":p": "GYMEX#" },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(res.Items ?? []));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items.map(toExercise).filter((e) => !e.removedAt);
  }

  async getOwnExercise(userId: string, exerciseId: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: exerciseSk(exerciseId) } }));
    return res.Item ? toExercise(res.Item) : null;
  }

  async putOwnExercise(userId: string, item: OwnExerciseItem) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: pk(userId), sk: exerciseSk(item.exerciseId), ...item },
        ConditionExpression: "attribute_not_exists(sk)",
      }),
    );
  }

  async updateOwnExercise(userId: string, exerciseId: string, fields: { name: string; group: MuscleGroup }, nowIso: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: exerciseSk(exerciseId) },
          ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(removedAt)",
          UpdateExpression: "SET #n = :n, #g = :g, updatedAt = :now",
          ExpressionAttributeNames: { "#n": "name", "#g": "group" },
          ExpressionAttributeValues: { ":n": fields.name, ":g": fields.group, ":now": nowIso },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async markOwnRemoved(userId: string, exerciseId: string, nowIso: string) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: exerciseSk(exerciseId) },
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
