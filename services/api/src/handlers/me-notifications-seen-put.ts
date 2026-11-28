import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { NotificationsSeenInputSchema, NotificationsSeenResultSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { ok, parseBody } from "../lib/http";
import { unreadFor } from "../lib/notifications";

/** PUT /me/notifications/seen (feature 022): `{ upTo }` moves the seen marker forward (clamped to now). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const input = parseBody(event.body, NotificationsSeenInputSchema);
  if (!input.ok) return input.response;
  const now = deps.now().toISOString();
  const upTo = new Date(input.data.upTo).toISOString();
  await deps.squad.markNotificationsSeen(caller.userId, upTo > now ? now : upTo);
  return ok(NotificationsSeenResultSchema.parse({ unreadCount: await unreadFor(caller.userId, deps) }));
}
