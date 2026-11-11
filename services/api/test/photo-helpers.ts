import { Buffer } from "node:buffer";
import { handle as postPhoto } from "../src/handlers/food-photo-post";
import { makeEvent, parse } from "./fakes";
import type { Deps } from "../src/lib/deps";

export const jpegBytes = (extra = 8) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(extra, 1)]);
export const jpegB64 = (extra = 8) => jpegBytes(extra).toString("base64");

/** Add a pending photo entry through the real handler; returns its entry id. */
export async function addPhoto(deps: Deps, over: Record<string, unknown> = {}, sub = "user-1", date = "2026-11-11") {
  const before = new Set((await deps.food.listEntriesForDay(sub, date)).map((e) => e.entryId));
  const res = parse(
    await postPhoto(
      makeEvent({
        sub,
        pathParameters: { date },
        body: { meal: "lunch", caption: "dal and rotis", contentType: "image/jpeg", dataBase64: jpegB64(), ...over },
      }),
      deps,
    ),
  );
  // The clock is fixed in tests, so ids are not ordered: find the new one by difference.
  const added = (await deps.food.listEntriesForDay(sub, date)).find((e) => !before.has(e.entryId));
  return { res, entryId: added?.entryId as string };
}
