import "server-only";
import { ApiErrorSchema } from "@calci/shared";
import type { z } from "zod";
import { ApiRequestError } from "./api";

/**
 * Calls the anonymous `/public/*` routes (feature 009) from the Next server, without a token.
 * The browser still never talks to the API (feature 001 research R3).
 */
export async function publicFetch<S extends z.ZodType>(
  path: `/public/${string}`,
  opts: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string>; schema: S },
): Promise<z.infer<S>> {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set (see .env.example)");
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...opts.headers,
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    cache: "no-store",
  });
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
