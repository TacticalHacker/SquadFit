import { HealthResponseSchema, type HealthResponse } from "@calci/shared";
import type { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Fetch a JSON endpoint on the AWS HTTP API and validate it against a shared contract. */
export async function apiGet<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set (see .env.example)");
  const res = await fetch(`${API_URL}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return schema.parse(await res.json());
}

export const getHealth = (): Promise<HealthResponse> => apiGet("/health", HealthResponseSchema);
