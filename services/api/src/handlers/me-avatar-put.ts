import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AvatarUploadSchema, type MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { ProfileMissingError } from "../lib/profile-repo";
import { toOwnProfile } from "../lib/views";

export const MAX_AVATAR_BYTES = 300 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 8;

const isWebp = (b: Buffer) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";

export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, AvatarUploadSchema);
  if (!parsed.ok) return parsed.response;

  const { dataBase64 } = parsed.data;
  if (dataBase64.length > MAX_BASE64_CHARS) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Avatar must be at most 300 KB");
  }
  const bytes = Buffer.from(dataBase64, "base64");
  if (bytes.length > MAX_AVATAR_BYTES) return apiError(413, "PAYLOAD_TOO_LARGE", "Avatar must be at most 300 KB");
  if (!isWebp(bytes)) return apiError(400, "VALIDATION_FAILED", "Avatar must be a WebP image", { dataBase64: "Not a WebP image" });

  const existing = await deps.profiles.get(caller.userId);
  if (!existing) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const key = await deps.avatars.put(caller.userId, bytes);
  let previous: string | null;
  try {
    previous = await deps.profiles.setAvatarKey(caller.userId, key, deps.now().toISOString());
  } catch (err) {
    await deps.avatars.delete(key); // don't leak the object we just wrote
    if (err instanceof ProfileMissingError) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
    throw err;
  }
  if (previous) await deps.avatars.delete(previous);

  const updated = await deps.profiles.get(caller.userId);
  const body: MeResponse = {
    username: caller.username, userId: caller.userId, unreadNotifications: 0,
    isAdmin: caller.isAdmin,
    profile: updated ? await toOwnProfile(updated, deps.avatars) : null,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
