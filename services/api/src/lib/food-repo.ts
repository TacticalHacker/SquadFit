import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { FoodEntry, Macros } from "@calci/shared";

/** Key layout: see specs/003-nutrition-tracker/data-model.md. */
export interface FoodEntryItem extends FoodEntry {
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnFoodItem {
  foodId: string;
  name: string;
  serving: string;
  calories: number;
  macros: Macros | null;
  createdAt: string;
  updatedAt: string;
}

export type EntryUpdate = Partial<Pick<FoodEntry, "name" | "meal" | "servings" | "calories" | "macros" | "rate">>;

export interface FoodRepo {
  listEntriesForDay(userId: string, date: string): Promise<FoodEntryItem[]>;
  listEntriesInRange(userId: string, from: string, to: string): Promise<FoodEntryItem[]>;
  getEntry(userId: string, date: string, entryId: string): Promise<FoodEntryItem | null>;
  /** Creates the entry; returns false if the key already exists. */
  putEntry(userId: string, entry: FoodEntryItem): Promise<boolean>;
  /** Returns false if the entry does not exist. */
  updateEntry(userId: string, date: string, entryId: string, fields: EntryUpdate, nowIso: string): Promise<boolean>;
  deleteEntry(userId: string, date: string, entryId: string): Promise<void>;
  listOwnFoods(userId: string): Promise<OwnFoodItem[]>;
  getOwnFood(userId: string, foodId: string): Promise<OwnFoodItem | null>;
  putOwnFood(userId: string, item: OwnFoodItem): Promise<void>;
  /** Returns false if it does not exist. */
  updateOwnFood(
    userId: string,
    foodId: string,
    fields: Pick<OwnFoodItem, "name" | "serving" | "calories" | "macros">,
    nowIso: string,
  ): Promise<boolean>;
  /** Returns whether it existed. */
  deleteOwnFood(userId: string, foodId: string): Promise<boolean>;
}

/** `<13-digit epoch ms>-<6 hex>`: sorts by time added (research R3). */
export function newEntryId(nowMs: number, randomHex: string): string {
  return `${String(nowMs).padStart(13, "0")}-${randomHex}`;
}
export const ENTRY_ID_PATTERN = /^\d{13}-[0-9a-f]{6}$/;

const pk = (userId: string) => `USER#${userId}`;
const entrySk = (date: string, entryId: string) => `FOODLOG#${date}#${entryId}`;
const foodSk = (foodId: string) => `FOOD#${foodId}`;
const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

function toEntry(i: Record<string, unknown>): FoodEntryItem {
  const rate = i.rate as { calories: number; macros?: Macros | null };
  return {
    entryId: i.entryId as string,
    date: i.date as string,
    meal: i.meal as FoodEntry["meal"],
    source: i.source as FoodEntry["source"],
    ...(typeof i.foodId === "string" ? { foodId: i.foodId } : {}),
    name: i.name as string,
    ...(typeof i.serving === "string" ? { serving: i.serving } : {}),
    servings: i.servings as number,
    calories: i.calories as number,
    macros: (i.macros as Macros | null | undefined) ?? null,
    rate: { calories: rate.calories, macros: rate.macros ?? null },
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  };
}

function toFood(i: Record<string, unknown>): OwnFoodItem {
  return {
    foodId: i.foodId as string,
    name: i.name as string,
    serving: i.serving as string,
    calories: i.calories as number,
    macros: (i.macros as Macros | null | undefined) ?? null,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  };
}

export class DynamoFoodRepo implements FoodRepo {
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
    return (await this.queryAll(userId, "begins_with(sk, :p)", { ":p": `FOODLOG#${date}#` })).map(toEntry);
  }

  async listEntriesInRange(userId: string, from: string, to: string) {
    // "~" sorts after every character used in ids, so it closes the upper bound for the last day.
    return (
      await this.queryAll(userId, "sk BETWEEN :a AND :b", { ":a": `FOODLOG#${from}`, ":b": `FOODLOG#${to}~` })
    ).map(toEntry);
  }

  async getEntry(userId: string, date: string, entryId: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, entryId) } }),
    );
    return res.Item ? toEntry(res.Item) : null;
  }

  async putEntry(userId: string, entry: FoodEntryItem) {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: pk(userId), sk: entrySk(entry.date, entry.entryId), ...entry },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async updateEntry(userId: string, date: string, entryId: string, fields: EntryUpdate, nowIso: string) {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = { ":now": nowIso };
    const sets = ["updatedAt = :now"];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      names[`#${key}`] = key;
      values[`:${key}`] = value;
      sets.push(`#${key} = :${key}`);
    }
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: entrySk(date, entryId) },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: `SET ${sets.join(", ")}`,
          ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
          ExpressionAttributeValues: values,
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  async deleteEntry(userId: string, date: string, entryId: string) {
    await this.doc.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: entrySk(date, entryId) } }),
    );
  }

  async listOwnFoods(userId: string) {
    return (await this.queryAll(userId, "begins_with(sk, :p)", { ":p": "FOOD#" })).map(toFood);
  }

  async getOwnFood(userId: string, foodId: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: foodSk(foodId) } }),
    );
    return res.Item ? toFood(res.Item) : null;
  }

  async putOwnFood(userId: string, item: OwnFoodItem) {
    await this.doc.send(
      new PutCommand({ TableName: this.tableName, Item: { pk: pk(userId), sk: foodSk(item.foodId), ...item } }),
    );
  }

  async updateOwnFood(
    userId: string,
    foodId: string,
    fields: Pick<OwnFoodItem, "name" | "serving" | "calories" | "macros">,
    nowIso: string,
  ) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: foodSk(foodId) },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: "SET #n = :n, serving = :s, calories = :c, macros = :m, updatedAt = :now",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":n": fields.name,
            ":s": fields.serving,
            ":c": fields.calories,
            ":m": fields.macros,
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

  async deleteOwnFood(userId: string, foodId: string) {
    const res = await this.doc.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: pk(userId), sk: foodSk(foodId) },
        ReturnValues: "ALL_OLD",
      }),
    );
    return res.Attributes !== undefined;
  }
}
