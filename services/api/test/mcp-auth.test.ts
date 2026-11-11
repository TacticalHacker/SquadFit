import { describe, expect, it } from "vitest";
import { generateToken } from "@calci/shared/ai-credential";
import { RATE_LIMIT_PER_MINUTE } from "../src/lib/credential-repo";
import { makeDeps, seedProfile } from "./fakes";
import { call, mcpEvent, rpc, seedKey } from "./mcp-helpers";

describe("POST /mcp authentication and gating", () => {
  it("rejects missing, malformed, unknown and revoked keys with the same 401", async () => {
    const { deps, profiles, credentials } = makeDeps();
    await seedProfile(profiles);
    const good = await seedKey(deps);
    const cases = [
      mcpEvent({ body: {} }),
      mcpEvent({ authorization: "Bearer nope", body: {} }),
      mcpEvent({ authorization: `Basic ${good}`, body: {} }),
      mcpEvent({ token: generateToken(), body: {} }),
    ];
    const bodies = new Set<string>();
    for (const e of cases) {
      const r = await call(deps, e);
      expect(r.status).toBe(401);
      expect(r.json.error.code).toBe("UNAUTHORIZED");
      bodies.add(r.body ?? "");
    }
    expect(bodies.size).toBe(1);
    await credentials.revoke("user-1");
    expect((await call(deps, mcpEvent({ token: good, body: {} }))).status).toBe(401);
  });

  it("answers 409 PROFILE_REQUIRED when the member has no profile", async () => {
    const { deps } = makeDeps();
    const token = await seedKey(deps);
    const r = await rpc(deps, token, "tools/list");
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("PROFILE_REQUIRED");
  });

  it("lists exactly the three tools for a valid key", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    const r = await rpc(deps, token, "tools/list");
    expect(r.status).toBe(200);
    const names = r.json.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["get_user_history", "post_daily_coach_note", "update_user_targets"]);
  });

  it("rate limits at 60 requests a minute with Retry-After", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i++) {
      expect((await rpc(deps, token, "tools/list")).status).toBe(200);
    }
    const r = await rpc(deps, token, "tools/list");
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("RATE_LIMITED");
    expect(r.headers["retry-after"]).toBeDefined();
  });

  it("rejects bodies over 64 KB with 413", async () => {
    const { deps, profiles } = makeDeps();
    await seedProfile(profiles);
    const token = await seedKey(deps);
    const r = await call(deps, mcpEvent({ token, rawBody: "x".repeat(65 * 1024) }));
    expect(r.status).toBe(413);
    expect(r.json.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers 405 to GET and DELETE and CORS to OPTIONS", async () => {
    const { deps } = makeDeps();
    expect((await call(deps, mcpEvent({ method: "GET" }))).status).toBe(405);
    expect((await call(deps, mcpEvent({ method: "DELETE" }))).status).toBe(405);
    const o = await call(deps, mcpEvent({ method: "OPTIONS" }));
    expect(o.status).toBe(204);
    expect(o.headers["access-control-allow-origin"]).toBe("*");
    expect(String(o.headers["access-control-allow-headers"])).toContain("Authorization");
  });
});
