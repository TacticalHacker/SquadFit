import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/me-avatar-put";
import { makeDeps, makeEvent, parse, validProfile, webpBytes } from "./fakes";

const b64 = (b: Buffer) => b.toString("base64");
const upload = (b: Buffer) => ({ contentType: "image/webp", dataBase64: b64(b) });

async function withProfile() {
  const ctx = makeDeps();
  await ctx.profiles.upsert("user-1", "alice", validProfile, "2026-11-11T10:00:00.000Z");
  return ctx;
}

describe("PUT /me/avatar", () => {
  it("stores a valid WebP and returns a presigned URL", async () => {
    const { deps, avatars, profiles } = await withProfile();
    const { status, body } = parse(await handle(makeEvent({ body: upload(webpBytes(100)) }), deps));
    expect(status).toBe(200);
    expect(body.profile.avatarUrl).toMatch(/^https:\/\/fake\.s3\/avatars\/user-1\//);
    expect(avatars.objects.size).toBe(1);
    expect((await profiles.get("user-1"))?.avatarKey).toBeDefined();
  });

  it("deletes the previous object when replaced", async () => {
    const { deps, avatars } = await withProfile();
    await handle(makeEvent({ body: upload(webpBytes(1)) }), deps);
    const first = [...avatars.objects.keys()][0];
    await handle(makeEvent({ body: upload(webpBytes(2)) }), deps);
    expect(avatars.objects.size).toBe(1);
    expect(avatars.objects.has(first!)).toBe(false);
  });

  it("rejects > 300 KB with 413", async () => {
    const { deps, avatars } = await withProfile();
    const { status, body } = parse(await handle(makeEvent({ body: upload(webpBytes(300 * 1024)) }), deps));
    expect(status).toBe(413);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(avatars.objects.size).toBe(0);
  });

  it("rejects bytes that are not WebP", async () => {
    const { deps } = await withProfile();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parse(await handle(makeEvent({ body: upload(png) }), deps)).status).toBe(400);
  });

  it("rejects a wrong content type", async () => {
    const { deps } = await withProfile();
    const { status } = parse(await handle(makeEvent({ body: { contentType: "image/png", dataBase64: b64(webpBytes()) } }), deps));
    expect(status).toBe(400);
  });

  it("409 PROFILE_REQUIRED without a profile, and stores nothing", async () => {
    const { deps, avatars } = makeDeps();
    const { status, body } = parse(await handle(makeEvent({ body: upload(webpBytes()) }), deps));
    expect(status).toBe(409);
    expect(body.error.code).toBe("PROFILE_REQUIRED");
    expect(avatars.objects.size).toBe(0);
  });
});
