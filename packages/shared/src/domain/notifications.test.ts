import { describe, expect, it } from "vitest";
import { groupReactors, pickNotifications, unreadCount, type StoredNotification } from "./notifications";

const n = (reactorId: string, latestAt: string, ttl = 2_000_000_000): StoredNotification => ({ eventId: "day#2026-11-26", reactorId, types: ["fire"], latestAt, ttl });
const NOW = 1_800_000_000;

describe("notifications", () => {
  it("counts unread after the seen marker, ignoring expired", () => {
    const items = [n("a", "2026-11-27T10:00:00.000Z"), n("b", "2026-11-28T10:00:00.000Z"), n("c", "2026-11-28T11:00:00.000Z", NOW - 1)];
    expect(unreadCount(items, null, NOW)).toBe(2);
    expect(unreadCount(items, "2026-11-27T12:00:00.000Z", NOW)).toBe(1);
    expect(unreadCount(items, "2026-11-28T10:00:00.000Z", NOW)).toBe(0);
  });

  it("picks the newest unexpired, capped", () => {
    const items = [n("a", "2026-11-27T10:00:00.000Z"), n("b", "2026-11-28T10:00:00.000Z"), n("c", "2026-11-28T11:00:00.000Z", NOW - 1)];
    expect(pickNotifications(items, NOW).map((i) => i.reactorId)).toEqual(["b", "a"]);
    expect(pickNotifications(items, NOW, 1).map((i) => i.reactorId)).toEqual(["b"]);
  });

  it("groups reactors: viewer first, then reaction order; unnamed only counted", () => {
    const rx = [
      { type: "fire" as const, reactorId: "b", createdAt: "2026-11-28T09:00:00.000Z" },
      { type: "fire" as const, reactorId: "me", createdAt: "2026-11-28T10:00:00.000Z" },
      { type: "fire" as const, reactorId: "a", createdAt: "2026-11-28T08:00:00.000Z" },
      { type: "muscle" as const, reactorId: "hidden", createdAt: "2026-11-28T08:00:00.000Z" },
    ];
    const g = groupReactors(rx, "me", (id) => id !== "hidden");
    expect(g.fire).toEqual({ ids: ["me", "a", "b"], others: 0 });
    expect(g.muscle).toEqual({ ids: [], others: 1 });
    expect(g.crown).toEqual({ ids: [], others: 0 });
  });
});
