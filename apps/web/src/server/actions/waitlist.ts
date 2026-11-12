"use server";

import { headers } from "next/headers";
import { WaitlistRequestSchema, WaitlistResponseSchema } from "@calci/shared";
import { ApiRequestError } from "../api";
import { publicFetch } from "../public-api";
import type { ActionState } from "./state";

const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");

/** The visitor's address as the hosting edge reports it; the API rate-limits on it (research R4). Never logged. */
async function clientAddress(): Promise<string | undefined> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || undefined;
}

/** "Request Squad Invite" (feature 009). Success looks the same whether or not the email was already listed. */
export async function requestInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = WaitlistRequestSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    primaryGoal: str(formData, "primaryGoal"),
    website: str(formData, "website"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".")] ??= issue.message;
    if (fields.primaryGoal) fields.primaryGoal = "Pick a goal";
    return { fields };
  }

  const address = await clientAddress();
  try {
    await publicFetch("/public/waitlist", {
      method: "POST",
      body: parsed.data,
      ...(address ? { headers: { "x-sf-client-ip": address } } : {}),
      schema: WaitlistResponseSchema,
    });
    return { message: "received" };
  } catch (err) {
    if (err instanceof ApiRequestError) {
      if (err.code === "RATE_LIMITED") return { error: "Too many requests. Please try again later." };
      if (err.fields) return { fields: err.fields };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
