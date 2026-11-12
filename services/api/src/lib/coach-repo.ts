import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CoachStatus, OverallNoteInput } from "@calci/shared";

/**
 * Overall coach note, one per member per day at `USER#<sub>/COACH#<date>` (specs/007-ai-coach-v2/data-model.md).
 * `format: 2` marks the structured note; feature 004 markdown items without it read as "no note".
 */
export interface CoachNoteItem {
  date: string;
  headline: string;
  status: CoachStatus;
  highlights: string[];
  actions: { text: string; done: boolean }[];
  generatedBy: "AI";
  createdAt: string;
  /** The note's version: set on every post, never by a tick. */
  updatedAt: string;
}

export type TickResult = "ok" | "missing" | "conflict";

export interface CoachRepo {
  get(userId: string, date: string): Promise<CoachNoteItem | null>;
  /** v2 notes for `from`..`to` inclusive, oldest first. */
  listInRange(userId: string, from: string, to: string): Promise<CoachNoteItem[]>;
  /** Replaces the day's note (markdown or v2); all actions start unticked (FR-015). */
  put(userId: string, note: OverallNoteInput, nowIso: string): Promise<void>;
  /** Ticks/unticks action `index` only if the note is still the version `expectedUpdatedAt` (research R6). */
  setActionDone(userId: string, date: string, index: number, done: boolean, expectedUpdatedAt: string): Promise<TickResult>;
}

const pk = (userId: string) => `USER#${userId}`;
const sk = (date: string) => `COACH#${date}`;

export function toCoachNote(i: Record<string, unknown> | undefined): CoachNoteItem | null {
  if (!i || i.format !== 2) return null;
  return {
    date: i.date as string,
    headline: i.headline as string,
    status: i.status as CoachStatus,
    highlights: i.highlights as string[],
    actions: (i.actions as { text: string; done: boolean }[]).map((a) => ({ text: a.text, done: a.done === true })),
    generatedBy: "AI",
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  };
}

export function newCoachItem(note: OverallNoteInput, nowIso: string) {
  return {
    format: 2 as const,
    date: note.date,
    headline: note.headline,
    status: note.status,
    highlights: note.highlights,
    actions: note.actionItems.map((text) => ({ text, done: false })),
    generatedBy: "AI" as const,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export class DynamoCoachRepo implements CoachRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async get(userId: string, date: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: pk(userId), sk: sk(date) } }));
    return toCoachNote(res.Item);
  }

  async listInRange(userId: string, from: string, to: string) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :a AND :b",
        ExpressionAttributeValues: { ":pk": pk(userId), ":a": sk(from), ":b": sk(to) },
      }),
    );
    // At most 31 small items: one page.
    return (res.Items ?? []).map(toCoachNote).filter((n): n is CoachNoteItem => n !== null);
  }

  async put(userId: string, note: OverallNoteInput, nowIso: string) {
    await this.doc.send(
      new PutCommand({ TableName: this.tableName, Item: { pk: pk(userId), sk: sk(note.date), ...newCoachItem(note, nowIso) } }),
    );
  }

  async setActionDone(userId: string, date: string, index: number, done: boolean, expectedUpdatedAt: string): Promise<TickResult> {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: pk(userId), sk: sk(date) },
          ConditionExpression: "#f = :two AND updatedAt = :seen AND size(actions) > :i",
          UpdateExpression: `SET actions[${index}].done = :d`,
          ExpressionAttributeNames: { "#f": "format" },
          ExpressionAttributeValues: { ":two": 2, ":seen": expectedUpdatedAt, ":i": index, ":d": done },
        }),
      );
      return "ok";
    } catch (err) {
      if (!(err instanceof Error && err.name === "ConditionalCheckFailedException")) throw err;
      return (await this.get(userId, date)) ? "conflict" : "missing";
    }
  }
}
