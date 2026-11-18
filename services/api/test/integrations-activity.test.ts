import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { generateHealthToken, hashToken } from "@calci/shared/ai-credential";
import { handle } from "../src/handlers/integrations-activity-post";
import { handle as issue } from "../src/handlers/me-health-token-post";
import type { Deps } from "../src/lib/deps";
import { makeDeps, makeEvent, parse, seedProfile } from "./fakes";
import { call, mcpEvent } from "./mcp-helpers";

// 2026-11-18T20:00Z is already 2026-11-19 in Asia/Kolkata (UTC+5:30).
const NOW = "2026-11-18T20:00:00.000Z";

const syncEvent = (token: string | undefined, body: unknown) =>
  ({
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    requestContext: { http: { method: "POST", path: "/integrations/activity" } },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  }) as unknown as APIGatewayProxyEventV2;

async function setup() {
  const ctx = makeDeps(NOW);
  await seedProfile(ctx.profiles);
  const token = generateHealthToken();
  await ctx.healthTokens.issue("user-1", hashToken(token), NOW);
  return { ...ctx, token };
}

const sync = async (deps: Deps, token: string | undefined, body: unknown) => parse(await handle(syncEvent(token, body), deps));

describe("POST /integrations/activity", () => {
  it("saves Shortcut days on the member's local date and replaces, never adds", async () => {
    const { deps, token, activity, healthTokens } = await setup();
    const first = await sync(deps, token, { days: [{ date: "2026-11-19", steps: "4,100" }], source: "shortcut" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ saved: [{ date: "2026-11-19", steps: 4100, goalHit: false }], stepGoal: 8000, source: "shortcut" });

    const again = await sync(deps, token, { date: "2026-11-19", steps: "8,423.0", active_kcal: "512" });
    expect(again.body.saved[0]).toMatchObject({ steps: 8423, activeKcal: 512, goalHit: true });
    const stored = await activity.listRange("user-1", "2026-11-19", "2026-11-19");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ steps: 8423, source: "shortcut" });
    expect((await healthTokens.get("user-1"))?.lastUsedAt).toBe(NOW);
  });

  it("keeps the latest write when a second source sends the same day", async () => {
    const { deps, token, activity } = await setup();
    await sync(deps, token, { days: [{ date: "2026-11-18", steps: 9000 }] });
    const hae = { data: { metrics: [{ name: "step_count", units: "count", data: [{ date: "2026-11-18 10:00:00 +0530", qty: 7000 }] }] } };
    expect((await sync(deps, token, hae)).status).toBe(200);
    expect((await activity.listRange("user-1", "2026-11-18", "2026-11-18"))[0]).toMatchObject({ steps: 7000, source: "health_auto_export" });
  });

  it("refuses the whole request with a readable 422 and saves nothing", async () => {
    const { deps, token, activity } = await setup();
    const r = await sync(deps, token, { days: [{ date: "2026-11-18", steps: 10 }, { date: "2026-11-20", steps: 200000 }] });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("20 Nov: date is in the future; 20 Nov: steps must be between 0 and 100,000");
    expect(await activity.listRange("user-1", "2026-10-01", "2026-12-01")).toHaveLength(0);
  });

  it("rejects wrong, revoked and AI-key credentials, and a sync token cannot use the AI connection", async () => {
    const { deps, token, healthTokens, credentials } = await setup();
    expect((await sync(deps, undefined, { date: "2026-11-18", steps: 1 })).status).toBe(401);
    expect((await sync(deps, generateHealthToken(), { date: "2026-11-18", steps: 1 })).status).toBe(401);

    // A sync token is not an AI key, even if its hash were registered as one.
    await credentials.issue("user-1", hashToken(token), NOW);
    expect((await call(deps, mcpEvent({ token, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }))).status).toBe(401);

    // Regenerating invalidates the old token at once.
    const fresh = parse(await issue(makeEvent({}), deps));
    expect(fresh.status).toBe(201);
    expect((await sync(deps, token, { date: "2026-11-18", steps: 1 })).status).toBe(401);
    expect((await sync(deps, fresh.body.token, { date: "2026-11-18", steps: 1 })).status).toBe(200);

    await healthTokens.revoke("user-1");
    expect((await sync(deps, fresh.body.token, { date: "2026-11-18", steps: 1 })).status).toBe(401);
  });
});
