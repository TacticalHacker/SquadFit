import "server-only";
import { ApiErrorSchema, type ApiErrorCode } from "@calci/shared";
import type { z } from "zod";
import { readAccessToken } from "./cookies";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | undefined,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Calls the AWS HTTP API from the server with the user's access token, and validates the response
 * against a shared zod schema. The browser never talks to the API (research R3).
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  opts: { method?: "GET" | "PUT" | "DELETE"; body?: unknown; schema: S },
): Promise<z.infer<S>> {
  // Read the cookie first: it marks this call as request-time, so `next build` doesn't try to run it
  // (and doesn't need API_URL) while prerendering the static shell.
  const token = await readAccessToken();
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set (see .env.example)");
  if (!token) throw new UnauthorizedError();

  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    cache: "no-store",
  });

  if (res.status === 401) throw new UnauthorizedError();
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      throw new ApiRequestError(res.status, code, message, fields);
    }
    throw new ApiRequestError(res.status, undefined, `${opts.method ?? "GET"} ${path} failed with ${res.status}`);
  }
  return opts.schema.parse(json);
}
