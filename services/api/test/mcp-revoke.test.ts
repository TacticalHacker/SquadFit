import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "@calci/shared/ai-credential";
import { makeDeps, seedProfile } from "./fakes";
import { call, mcpEvent, rpc, seedKey } from "./mcp-helpers";

describe("revocation and rotation", () => {
  it("revoked key fails on the very next request", async () => {
    const { deps, profiles, credentials } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    expect((await rpc(deps, token, "tools/list")).status).toBe(200);
    await credentials.revoke("user-1");
    expect((await call(deps, mcpEvent({ token, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }))).status).toBe(401);
  });

  it("issuing again rotates: old key dies, new key works", async () => {
    const { deps, profiles, credentials } = makeDeps();
    await seedProfile(profiles);
    const old = await seedKey(deps);
    const fresh = generateToken();
    await credentials.issue("user-1", hashToken(fresh), "2026-02-01T00:00:00.000Z");
    expect((await rpc(deps, old, "tools/list")).status).toBe(401);
    expect((await rpc(deps, fresh, "tools/list")).status).toBe(200);
  });
});
