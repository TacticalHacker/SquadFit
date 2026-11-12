import type { z } from "zod";
import type { Deps } from "../deps";

/** The member the key belongs to, resolved by the handler; tools never take a user id (FR-012). */
export interface ToolContext {
  userId: string;
  timezone: string;
  today: string;
  calorieTarget: number;
  proteinTarget: number | null;
  /** Feature 007: stored body weight, or the 75 kg default. */
  bodyWeight: { kg: number; isDefault: boolean };
  deps: Deps;
}

export interface ToolResult {
  text: string;
  isError?: true;
  /** An MCP image content item (base64), returned before the text. */
  image?: { data: string; mimeType: string };
}

export interface Tool {
  name: string;
  description: string;
  /** Raw zod shape the SDK registers and advertises through tools/list. */
  shape: z.ZodRawShape;
  run(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

export const fail = (text: string): ToolResult => ({ text, isError: true });

/** Human-readable validation message from a zod error, never echoing the input values. */
export function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}


/** The SDK already drops unknown keys; do the same for direct callers so a stray `userId` is ignored. */
export function stripUnknown(args: unknown, shape: z.ZodRawShape): unknown {
  if (typeof args !== "object" || args === null) return args;
  return Object.fromEntries(Object.entries(args).filter(([k]) => k in shape));
}

