import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_SQUAD_SETTINGS, type ProfileInput, type SquadSettings } from "@calci/shared";

/** A stored profile. Key layout: see specs/001-user-accounts/data-model.md. */
export interface ProfileItem {
  userId: string;
  username: string;
  displayName: string;
  timezone: string;
  dailyCalorieTarget: number;
  dailyProteinTarget?: number;
  /** Feature 007; absent means the 75 kg default. */
  bodyWeightKg?: number;
  /** Feature 010; absent attributes mean the defaults (3 / visible / not sharing). */
  weeklyTarget?: number;
  leaderboardVisible?: boolean;
  shareBodyWeight?: boolean;
  avatarKey?: string;
  createdAt: string;
  updatedAt: string;
}

/** A member's squad settings with defaults applied. */
export function squadSettingsOf(p: Pick<ProfileItem, "weeklyTarget" | "leaderboardVisible" | "shareBodyWeight">): SquadSettings {
  return {
    weeklyTarget: p.weeklyTarget ?? DEFAULT_SQUAD_SETTINGS.weeklyTarget,
    leaderboardVisible: p.leaderboardVisible ?? DEFAULT_SQUAD_SETTINGS.leaderboardVisible,
    shareBodyWeight: p.shareBodyWeight ?? DEFAULT_SQUAD_SETTINGS.shareBodyWeight,
  };
}

export class ProfileMissingError extends Error {
  constructor() {
    super("Profile does not exist");
  }
}

export interface ProfileRepo {
  get(userId: string): Promise<ProfileItem | null>;
  /** Create on first call (joins the community), otherwise update editable fields. `createdAt` never changes. */
  upsert(userId: string, username: string, input: ProfileInput, nowIso: string): Promise<ProfileItem>;
  /** Update only the given targets (protein null clears it). Returns null if there is no profile. */
  setTargets(
    userId: string,
    targets: { dailyCalorieTarget?: number; dailyProteinTarget?: number | null },
    nowIso: string,
  ): Promise<ProfileItem | null>;
  /** Feature 010: save the three squad settings. Returns null if there is no profile. */
  setSquadSettings(userId: string, settings: SquadSettings, nowIso: string): Promise<ProfileItem | null>;
  /** Set or clear the avatar key; returns the previous key. Throws ProfileMissingError if no profile. */
  setAvatarKey(userId: string, key: string | null, nowIso: string): Promise<string | null>;
  /** Everyone with a completed profile, in join order. */
  listCommunity(): Promise<ProfileItem[]>;
}

const pk = (userId: string) => `USER#${userId}`;

function fromItem(item: Record<string, unknown>): ProfileItem {
  return {
    userId: item.userId as string,
    username: item.username as string,
    displayName: item.displayName as string,
    timezone: item.timezone as string,
    dailyCalorieTarget: item.dailyCalorieTarget as number,
    ...(typeof item.dailyProteinTarget === "number" ? { dailyProteinTarget: item.dailyProteinTarget } : {}),
    ...(typeof item.bodyWeightKg === "number" ? { bodyWeightKg: item.bodyWeightKg } : {}),
    ...(typeof item.weeklyTarget === "number" ? { weeklyTarget: item.weeklyTarget } : {}),
    ...(typeof item.leaderboardVisible === "boolean" ? { leaderboardVisible: item.leaderboardVisible } : {}),
    ...(typeof item.shareBodyWeight === "boolean" ? { shareBodyWeight: item.shareBodyWeight } : {}),
    ...(typeof item.avatarKey === "string" ? { avatarKey: item.avatarKey } : {}),
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

export class DynamoProfileRepo implements ProfileRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async get(userId: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: "PROFILE" } }),
    );
    return res.Item ? fromItem(res.Item) : null;
  }

  async upsert(userId: string, username: string, input: ProfileInput, nowIso: string) {
    // if_not_exists keeps createdAt/gsi keys stable after the first write, atomically.
    const protein = input.dailyProteinTarget ?? null;
    const weight = input.bodyWeightKg;
    // Protein: absent or null clears it (feature 004). Body weight: null clears, absent keeps it (feature 007).
    const removes = [...(protein === null ? ["dailyProteinTarget"] : []), ...(weight === null ? ["bodyWeightKg"] : [])];
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: pk(userId), sk: "PROFILE" },
        UpdateExpression:
          "SET userId = :uid, username = :un, displayName = :dn, #tz = :tz, dailyCalorieTarget = :t, updatedAt = :now, " +
          "createdAt = if_not_exists(createdAt, :now), gsi1pk = :community, gsi1sk = if_not_exists(gsi1sk, :gsi1sk)" +
          (protein === null ? "" : ", dailyProteinTarget = :pt") +
          (typeof weight === "number" ? ", bodyWeightKg = :bw" : "") +
          (removes.length ? ` REMOVE ${removes.join(", ")}` : ""),
        ExpressionAttributeNames: { "#tz": "timezone" },
        ExpressionAttributeValues: {
          ":uid": userId,
          ":un": username,
          ":dn": input.displayName,
          ":tz": input.timezone,
          ":t": input.dailyCalorieTarget,
          ":now": nowIso,
          ":community": "COMMUNITY",
          ":gsi1sk": `JOINED#${nowIso}#${userId}`,
          ...(protein === null ? {} : { ":pt": protein }),
          ...(typeof weight === "number" ? { ":bw": weight } : {}),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return fromItem(res.Attributes ?? {});
  }

  async setTargets(
    userId: string,
    targets: { dailyCalorieTarget?: number; dailyProteinTarget?: number | null },
    nowIso: string,
  ) {
    const sets = ["updatedAt = :now"];
    const removes: string[] = [];
    const values: Record<string, unknown> = { ":now": nowIso };
    if (targets.dailyCalorieTarget !== undefined) {
      sets.push("dailyCalorieTarget = :cal");
      values[":cal"] = targets.dailyCalorieTarget;
    }
    if (targets.dailyProteinTarget === null) removes.push("dailyProteinTarget");
    else if (targets.dailyProteinTarget !== undefined) {
      sets.push("dailyProteinTarget = :pt");
      values[":pt"] = targets.dailyProteinTarget;
    }
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: "PROFILE" },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: `SET ${sets.join(", ")}${removes.length ? ` REMOVE ${removes.join(", ")}` : ""}`,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      return fromItem(res.Attributes ?? {});
    } catch (err) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") return null;
      throw err;
    }
  }

  async setSquadSettings(userId: string, settings: SquadSettings, nowIso: string) {
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: "PROFILE" },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: "SET weeklyTarget = :w, leaderboardVisible = :v, shareBodyWeight = :s, updatedAt = :now",
          ExpressionAttributeValues: {
            ":w": settings.weeklyTarget,
            ":v": settings.leaderboardVisible,
            ":s": settings.shareBodyWeight,
            ":now": nowIso,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      return fromItem(res.Attributes ?? {});
    } catch (err) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") return null;
      throw err;
    }
  }

  async setAvatarKey(userId: string, key: string | null, nowIso: string) {
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: "PROFILE" },
          ConditionExpression: "attribute_exists(pk)",
          UpdateExpression: key ? "SET avatarKey = :k, updatedAt = :now" : "REMOVE avatarKey SET updatedAt = :now",
          ExpressionAttributeValues: key ? { ":k": key, ":now": nowIso } : { ":now": nowIso },
          ReturnValues: "UPDATED_OLD",
        }),
      );
      return typeof res.Attributes?.avatarKey === "string" ? res.Attributes.avatarKey : null;
    } catch (err) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") throw new ProfileMissingError();
      throw err;
    }
  }

  async listCommunity() {
    const items: ProfileItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "gsi1",
          KeyConditionExpression: "gsi1pk = :c",
          ExpressionAttributeValues: { ":c": "COMMUNITY" },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...(res.Items ?? []).map(fromItem));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}
