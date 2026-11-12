import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle } from "../src/handlers/public-waitlist-post";
import { makeDeps, parse } from "./fakes";

const valid = { name: "Sam", email: "sam@example.com", primaryGoal: "get_stronger" };
const post = (deps: Parameters<typeof handle>[1], body: unknown, ip = "203.0.113.7") =>
  handle(
    {
      body: JSON.stringify(body),
      headers: { "x-sf-client-ip": ip },
      requestContext: { http: { sourceIp: "10.0.0.1" } },
    } as unknown as APIGatewayProxyEventV2,
    deps,
  ).then(parse);

describe("POST /public/waitlist", () => {
  it("stores one request per email and answers the same either way", async () => {
    const { deps, waitlist } = makeDeps();
    const first = await post(deps, valid);
    const again = await post(deps, { ...valid, email: "  SAM@Example.com " });
    expect(first).toEqual({ status: 202, body: { status: "received" } });
    expect(again).toEqual(first);
    expect(waitlist.entries).toEqual([{ ...valid, createdAt: "2026-11-11T10:00:00.000Z" }]);
  });

  it("silently drops honeypot submissions", async () => {
    const { deps, waitlist } = makeDeps();
    expect(await post(deps, { ...valid, website: "spam.example" })).toEqual({ status: 202, body: { status: "received" } });
    expect(waitlist.entries).toHaveLength(0);
  });

  it("refuses the 6th submission from one address in an hour", async () => {
    const { deps, waitlist } = makeDeps();
    for (let i = 0; i < 5; i++) expect((await post(deps, { ...valid, email: `s${i}@example.com` })).status).toBe(202);
    const sixth = await post(deps, { ...valid, email: "s6@example.com" });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("RATE_LIMITED");
    expect(waitlist.entries).toHaveLength(5);
    // Another address is still fine.
    expect((await post(deps, { ...valid, email: "other@example.com" }, "198.51.100.9")).status).toBe(202);
  });
});
