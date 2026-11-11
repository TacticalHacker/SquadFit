import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/** Key layout: see specs/004-ai-coach-mcp/data-model.md. */
export interface CoachNoteItem {
  date: string;
  summaryMarkdown: string;
  recommendations: string[];
  generatedBy: "AI";
  createdAt: string;
  updatedAt: string;
}

export interface CoachRepo {
  get(userId: string, date: string): Promise<CoachNoteItem | null>;
  /** One note per member per date; replaces any existing note and keeps its `createdAt`. */
  put(userId: string, note: Pick<CoachNoteItem, "date" | "summaryMarkdown" | "recommendations">, nowIso: string): Promise<void>;
}

const key = (userId: string, date: string) => ({ pk: `USER#${userId}`, sk: `COACH#${date}` });

export class DynamoCoachRepo implements CoachRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async get(userId: string, date: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: key(userId, date) }));
    const i = res.Item;
    if (!i) return null;
    return {
      date: i.date as string,
      summaryMarkdown: i.summaryMarkdown as string,
      recommendations: i.recommendations as string[],
      generatedBy: "AI" as const,
      createdAt: i.createdAt as string,
      updatedAt: i.updatedAt as string,
    };
  }

  async put(userId: string, note: Pick<CoachNoteItem, "date" | "summaryMarkdown" | "recommendations">, nowIso: string) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key(userId, note.date),
        UpdateExpression:
          "SET #d = :d, summaryMarkdown = :s, recommendations = :r, generatedBy = :g, updatedAt = :now, createdAt = if_not_exists(createdAt, :now)",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: {
          ":d": note.date,
          ":s": note.summaryMarkdown,
          ":r": note.recommendations,
          ":g": "AI",
          ":now": nowIso,
        },
      }),
    );
  }
}
