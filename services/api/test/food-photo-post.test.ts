import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/food-photo-post";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { jpegB64 } from "./photo-helpers";

const body = (over: Record<string, unknown> = {}) => ({ meal: "lunch", caption: "dal and rotis", contentType: "image/jpeg", dataBase64: jpegB64(), ...over });
const post = (deps: Parameters<typeof handle>[1], b: unknown, date = "2026-11-11", sub = "user-1") =>
  handle(makeEvent({ sub, pathParameters: { date }, body: b }), deps).then(parse);

async function setup() {
  const ctx = makeDeps();
  await seedProfile(ctx.profiles);
  return ctx;
}

describe("POST /food/photos/{date}", () => {
  it("creates a pending photo entry under the meal, stores the picture and leaves totals alone", async () => {
    const { deps, photos, food } = await setup();
    const r = await post(deps, body());
    expect(r.status).toBe(200);
    const lunch = r.body.meals.find((m: { meal: string }) => m.meal === "lunch");
    expect(lunch.entries).toHaveLength(1);
    expect(lunch.entries[0]).toMatchObject({
      source: "photo", name: "dal and rotis", calories: 0, macros: null,
      photo: { status: "pending", caption: "dal and rotis" },
    });
    expect(lunch.entries[0].photo.url).toMatch(/^https:\/\/fake\.s3\/food-photos\/user-1\//);
    expect(lunch.subtotal).toBe(0);
    expect(r.body.ledger).toMatchObject({ eaten: 0, net: 0, pending: 1 });
    expect(photos.objects.size).toBe(1);
    expect([...photos.objects.keys()][0]).toMatch(/^food-photos\/user-1\/\d{13}-[0-9a-f]{6}\.jpg$/);
    expect((await food.listEntriesForDay("user-1", "2026-11-11"))[0]).toMatchObject({ photoKey: expect.any(String) });
  });

  it("accepts WebP and a missing caption (name falls back to 'Photo meal')", async () => {
    const { deps } = await setup();
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(4)]).toString("base64");
    const r = await post(deps, { meal: "snacks", contentType: "image/webp", dataBase64: webp });
    expect(r.status).toBe(200);
    expect(r.body.meals.find((m: { meal: string }) => m.meal === "snacks").entries[0]).toMatchObject({ name: "Photo meal", photo: { caption: "" } });
  });

  it.each([
    ["caption over 200 chars", body({ caption: "a".repeat(201) }), 400],
    ["bad meal", body({ meal: "brunch" }), 400],
    ["unsupported content type", body({ contentType: "image/png" }), 400],
    ["PNG bytes declared as JPEG (bytes decide)", body({ dataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).toString("base64") }), 400],
    ["over 1.5 MB", body({ dataBase64: jpegB64(1.5 * 1024 * 1024) }), 413],
  ])("rejects %s and stores nothing", async (_n, b, status) => {
    const { deps, photos, food } = await setup();
    const r = await post(deps, b);
    expect(r.status).toBe(status);
    expect(photos.objects.size).toBe(0);
    expect(await food.listEntriesForDay("user-1", "2026-11-11")).toHaveLength(0);
  });

  it("refuses locked and future days and a missing profile", async () => {
    const { deps } = await setup();
    expect((await post(deps, body(), "2026-11-08")).body.error.code).toBe("DAY_LOCKED");
    expect((await post(deps, body(), "2026-11-12")).status).toBe(400);
    expect((await post(deps, body(), "2026-11-11", "nobody")).status).toBe(409);
  });

  it("removes the stored picture if the entry cannot be saved", async () => {
    const { deps, photos, food } = await setup();
    food.putEntry = async () => {
      throw new Error("dynamo down");
    };
    await expect(post(deps, body())).rejects.toThrow("dynamo down");
    expect(photos.objects.size).toBe(0);
  });

  it("never logs the caption or the picture", async () => {
    const { deps } = await setup();
    const seen: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) => {
      const orig = console[k];
      console[k] = (...a: unknown[]) => void seen.push(a.map(String).join(" "));
      return () => (console[k] = orig);
    });
    await post(deps, body({ caption: "SECRET-CAPTION" }));
    spies.forEach((restore) => restore());
    expect(seen.join("\n")).not.toContain("SECRET-CAPTION");
  });
});
