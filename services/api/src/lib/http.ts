import type { APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiErrorCode } from "@calci/shared";
import type { z } from "zod";

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown): APIGatewayProxyResultV2 => json(200, body);

export function apiError(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
): APIGatewayProxyResultV2 {
  return json(statusCode, { error: { code, message, ...(fields ? { fields } : {}) } });
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: APIGatewayProxyResultV2 };

/** Parse and validate a JSON body. Never logs the body (constitution VI). */
export function parseBody<S extends z.ZodType>(rawBody: string | undefined, schema: S): Parsed<z.infer<S>> {
  let value: unknown;
  try {
    value = JSON.parse(rawBody ?? "");
  } catch {
    return { ok: false, response: apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON") };
  }
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return { ok: false, response: apiError(400, "VALIDATION_FAILED", "Some fields are invalid", fields) };
}
