import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { MAX_PHOTO_BYTES, SQUAD_ID, SharePostInputSchema, SharePostResultSchema, sniffImage } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { canPost, loadOwnWorkoutDay, postState } from "../lib/share-summary";

const TOO_BIG = "Photo is too large (max 1.5 MB)";

/**
 * PUT /squad/posts/{date} : put one of the caller's workout days in the squad feed (feature 016). Idempotent: one
 * item per day (`day#<date>`), keeping its first post time and reactions. The photo is optional and replaced each
 * time. Members hidden from the leaderboard cannot post. Never log photos or entries.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const day = await loadOwnWorkoutDay(caller, event.pathParameters?.date, deps);
  if (!day.ok) return day.response;
  const { profile, date } = day;
  if (!canPost(profile)) return apiError(403, "HIDDEN", "You're hidden from the squad, so you can't post.");
  const body = parseBody(event.body, SharePostInputSchema);
  if (!body.ok) return body.response;

  const before = await deps.squad.getFeed(caller.userId, `day#${date}`);
  let photo: string | null | "keep" = "keep";
  const { photo: input } = body.data;
  if (input === "remove") photo = null;
  else if (input !== "keep") {
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.length > MAX_PHOTO_BYTES) return apiError(413, "PAYLOAD_TOO_LARGE", TOO_BIG);
    // The real type comes from the bytes, never from the client.
    const contentType = sniffImage(bytes);
    if (!contentType) return apiError(400, "VALIDATION_FAILED", "Photo must be a JPEG or WebP image", { photo: "Not a JPEG or WebP image" });
    photo = await deps.sharePhotos.put(caller.userId, date, bytes, contentType);
  }

  const item = await deps.squad.postDay(caller.userId, SQUAD_ID, date, deps.now().toISOString(), photo);
  // A replaced or removed picture is deleted (same key = already overwritten).
  if (photo !== "keep" && before?.photoKey && before.photoKey !== photo) await deps.sharePhotos.delete(before.photoKey);
  return ok(SharePostResultSchema.parse({ post: postState(profile, item) }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
