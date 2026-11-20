import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/admin-user-post";
import { makeDeps, makeEvent, parse } from "./fakes";

type D = Parameters<typeof handle>[1];
const create = (deps: D, body: unknown, groups = "[admin]") => handle(makeEvent({ groups, body }), deps).then(parse);

describe("POST /admin/users (feature 015, Story 5)", () => {
  it("admins create an account and get a one-time temporary password; names are unique ignoring case", async () => {
    const { deps, users } = makeDeps();
    const r = await create(deps, { username: "alice" });
    expect(r.status).toBe(201);
    expect(r.body.username).toBe("alice");
    expect(r.body.temporaryPassword).toHaveLength(16);
    expect(users.users.get("alice")).toBe(r.body.temporaryPassword);
    expect((await create(deps, { username: "ALICE" })).body.error.code).toBe("USERNAME_TAKEN");
  });

  it("refuses non-admins and bad usernames", async () => {
    const { deps, users } = makeDeps();
    expect((await create(deps, { username: "bob" }, "")).status).toBe(403);
    expect((await create(deps, { username: "a b" })).status).toBe(400);
    expect(users.users.size).toBe(0);
  });
});
