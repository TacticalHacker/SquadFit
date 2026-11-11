import { randomBytes } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { MAX_PHOTO_BYTES, PhotoEntryCreateSchema, photoEntryName, sniffImage } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveWriteDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { loadFoodDay } from "../lib/food-day-loader";
import { newEntryId, type FoodEntryItem } from "../lib/food-repo";
import { apiError, ok, parseBody } from "../lib/http";

const MAX_BASE64_CHARS = Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 8;
const TOO_BIG = "Photo must be at most 1.5 MB";

/** POST /food/photos/{date} : add a pending photo entry (feature 005). Never logs the caption or picture. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveWriteDate(event.pathParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const body = parseBody(event.body, PhotoEntryCreateSchema);
  if (!body.ok) return body.response;

  const { meal, caption = "", dataBase64 } = body.data;
  if (dataBase64.length > MAX_BASE64_CHARS) return apiError(413, "PAYLOAD_TOO_LARGE", TOO_BIG);
  const bytes = Buffer.from(dataBase64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES) return apiError(413, "PAYLOAD_TOO_LARGE", TOO_BIG);
  // The picture's real type comes from its bytes, never from what the client declared.
  const contentType = sniffImage(bytes);
  if (!contentType) {
    return apiError(400, "VALIDATION_FAILED", "Photo must be a JPEG or WebP image", { dataBase64: "Not a JPEG or WebP image" });
  }

  const nowIso = deps.now().toISOString();
  const entryId = newEntryId(deps.now().getTime(), randomBytes(3).toString("hex"));
  const photoKey = await deps.photos.put(caller.userId, entryId, bytes, contentType);
  const entry: FoodEntryItem = {
    entryId,
    date: d.date,
    meal,
    source: "photo",
    name: photoEntryName(caption),
    servings: 1,
    calories: 0,
    macros: null,
    rate: { calories: 0, macros: null },
    photoKey,
    photo: { status: "pending", caption },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  try {
    if (!(await deps.food.putEntry(caller.userId, entry))) throw new Error("entry id clash");
  } catch (err) {
    await deps.photos.delete(photoKey).catch(() => undefined); // don't leave an unreferenced picture behind
    throw err;
  }
  return ok(await loadFoodDay(caller.userId, c.ctx, d.date, deps));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
