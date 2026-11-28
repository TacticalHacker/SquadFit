"use server";

import { refresh } from "next/cache";
import { NotificationsSeenResultSchema } from "@calci/shared";
import { z } from "zod";
import { apiFetch } from "../api";

/**
 * Feature 022: the notifications list was opened; everything up to `upTo` (the newest shown) is read. Best effort:
 * a failure only leaves the badge until the next visit. `refresh()` re-renders the header badge.
 */
export async function markNotificationsSeen(upTo: string): Promise<void> {
  if (!z.iso.datetime().safeParse(upTo).success) return;
  try {
    await apiFetch("/me/notifications/seen", { method: "PUT", body: { upTo }, schema: NotificationsSeenResultSchema });
  } catch {
    return;
  }
  refresh();
}
