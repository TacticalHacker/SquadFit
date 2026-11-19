import { describe, expect, it } from "vitest";
import { buildHallOfFame, buildSquadBoards, monthDates, type SquadBoard, type SquadBoardMember } from "../src/domain/boards";
import { buildMemberStats, type SquadEntry } from "../src/domain/squad";

const NOW = "2026-12-01T10:00:00.000Z";

const lift = (date: string, weightKg: number, id = "gx-bench-press"): SquadEntry => ({
  date,
  workoutId: id,
  name: id,
  kind: "gym",
  exerciseKind: "strength",
  sets: [{ weightKg, reps: 1, completed: true }],
});
const activity = (date: string): SquadEntry => ({ date, workoutId: "c-walk", name: "Walk" });

function member(userId: string, entries: SquadEntry[], today = "2026-12-01", extra: Partial<SquadBoardMember> = {}): SquadBoardMember {
  const { stats } = buildMemberStats(entries, null, { weeklyTarget: 1, today, nowIso: NOW });
  return { userId, displayName: userId, avatarUrl: null, today, weeklyTarget: 1, visible: true, stats, ...extra };
}
const boards = (members: SquadBoardMember[], month = "2026-12", viewerId = "a") =>
  buildSquadBoards({ members, viewerId, month, steps: new Map(), protein: new Map() });
const board = <Id extends SquadBoard["id"]>(b: SquadBoard[], id: Id) => b.find((x): x is Extract<SquadBoard, { id: Id }> => x.id === id)!;

describe("monthly boards", () => {
  const a = member("a", [activity("2026-11-23"), activity("2026-11-30"), activity("2026-12-01"), lift("2026-11-30", 50), lift("2026-12-01", 52.5)]);
  const b = member("b", [activity("2026-11-29"), activity("2026-11-30")]);

  it("count only the current month and reset on the 1st", () => {
    const dec = boards([a, b]);
    expect(board(dec, "workouts").rows.map((r) => [r.member.userId, r.days])).toEqual([["a", 1]]);
    expect(board(dec, "improved").rows.map((r) => [r.member.userId, r.count])).toEqual([["a", 1]]);
    expect(board(boards([a, b], "2026-11"), "improved").rows).toEqual([]); // 30 Nov was the first session
    const nov = boards([a, b], "2026-11");
    expect(board(nov, "workouts").rows.map((r) => r.member.userId)).toEqual(["a", "b"]);
  });

  it("does not reset the streak", () => {
    const rows = board(boards([a, b]), "streak").rows;
    expect(rows.find((r) => r.member.userId === "a")).toMatchObject({ weeks: 2, rank: 1 });
  });

  it("ranks members without a completed week by this week's progress", () => {
    // Weekly target 3, so one or two days this week is not a completed week yet.
    const c = member("c", [activity("2026-12-01")], "2026-12-02", { weeklyTarget: 3 });
    const d = member("d", [activity("2026-12-01"), activity("2026-12-02")], "2026-12-02", { weeklyTarget: 3 });
    const rows = board(boards([c, d]), "streak").rows;
    expect(rows.map((r) => [r.member.userId, r.weeks, r.weekDays, r.rank])).toEqual([["d", 0, 2, 1], ["c", 0, 1, 2]]);
  });

  it("ranks protein days only for members who hit their goal at least once", () => {
    const protein = new Map([["a", { hitDays: 3, loggedDays: 5 }], ["b", { hitDays: 0, loggedDays: 4 }]]);
    const rows = board(buildSquadBoards({ members: [a, b], viewerId: "a", month: "2026-12", steps: new Map(), protein }), "protein").rows;
    expect(rows.map((r) => [r.member.userId, r.hitDays, r.loggedDays, r.rank])).toEqual([["a", 3, 5, 1]]);
  });

  it("drops hidden members and gives a hidden viewer an unranked row", () => {
    const hidden = { ...b, visible: false };
    expect(board(boards([a, hidden]), "streak").rows.map((r) => r.member.userId)).toEqual(["a"]);
    const asHidden = board(boards([a, hidden], "2026-12", "b"), "streak").rows;
    expect(asHidden.map((r) => [r.member.userId, r.rank])).toEqual([["a", 1], ["b", null]]);
  });
});

describe("steps", () => {
  it("ranks only members with 3+ synced days this month; the rest are listed unranked", () => {
    const a = member("a", []);
    const b = member("b", []);
    const c = member("c", []);
    const steps = new Map([["a", { avgSteps: 5000, syncedDays: 3 }], ["b", { avgSteps: 20000, syncedDays: 2 }], ["c", { avgSteps: 8000, syncedDays: 9 }]]);
    const rows = board(buildSquadBoards({ members: [a, b, c], viewerId: "a", month: "2026-12", steps, protein: new Map() }), "steps").rows;
    expect(rows.map((r) => [r.member.userId, r.rank])).toEqual([["c", 1], ["a", 2], ["b", null]]);
  });
});

describe("biggest PR jump", () => {
  it("compares this month's best with the best before it, and ignores lifts first logged this month", () => {
    const a = member("a", [lift("2026-10-05", 100), lift("2026-11-05", 110), lift("2026-12-01", 115), lift("2026-12-01", 60, "gx-barbell-row")]);
    const b = member("b", [lift("2026-11-05", 40, "gx-overhead-press"), lift("2026-12-01", 45, "gx-overhead-press")]);
    const rows = board(boards([a, b]), "prJump").rows;
    // b: 46.5 vs 41.3 → +5.2 kg (+13%); a: 118.8 vs 113.7 → +5.1 kg (+4%). The first-ever row is no jump.
    expect(rows.map((r) => [r.member.userId, r.kg, r.pct, r.rank, r.pctRank])).toEqual([
      ["b", 5.2, 13, 1, 1],
      ["a", 5.1, 4, 2, 2],
    ]);
    expect(rows[1]).toMatchObject({ liftName: "Bench Press" });
  });

  it("does not list a jump of zero or less", () => {
    const a = member("a", [lift("2026-11-05", 110), lift("2026-12-01", 100)]);
    expect(board(boards([a]), "prJump").rows).toEqual([]);
  });
});

describe("current strength", () => {
  const all = (u: string, b: number, s: number, d: number, o?: number) =>
    member(u, [lift("2026-11-02", b), lift("2026-11-02", s, "gx-barbell-squat"), lift("2026-11-02", d, "gx-deadlift"), ...(o ? [lift("2026-11-02", o, "gx-overhead-press")] : [])]);

  it("ranks the Big 3, puts members missing a lift last and unranked, and ranks Big 4 separately", () => {
    const rows = board(boards([all("a", 100, 100, 100), all("b", 90, 90, 90, 60), member("c", [lift("2026-11-02", 200)])]), "strength").rows;
    expect(rows.map((r) => [r.member.userId, r.rank, r.big4Rank])).toEqual([
      ["a", 1, null],
      ["b", 2, 1],
      ["c", null, null],
    ]);
    expect(rows[2]).toMatchObject({ big3: null, missing: ["Barbell Squat", "Deadlift", "Overhead Press"] });
  });
});

describe("monthDates", () => {
  it("runs from the 1st to today, and is empty when the member is still in the previous month", () => {
    expect(monthDates("2026-12", "2026-12-03")).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(monthDates("2026-11", "2026-12-03")).toHaveLength(30);
    expect(monthDates("2026-12", "2026-11-30")).toEqual([]);
  });
});

describe("hall of fame", () => {
  it("names the holder, value and date; earliest wins a tie; hidden members never hold a record", () => {
    const a = member("a", [lift("2026-11-02", 100), activity("2026-10-01"), activity("2026-10-02")]);
    const b = member("b", [lift("2026-11-09", 100), lift("2026-10-01", 50, "gx-deadlift")]);
    const c = member("c", [lift("2026-11-01", 300)], "2026-12-01", { visible: false });
    const records = buildHallOfFame({ members: [a, b, c], viewerId: "a", stepMonths: new Map([["b", { "2026-10": 9000 }]]) });
    const rec = (id: string) => records.find((r) => r.id === id)!;
    expect(rec("liftBench")).toMatchObject({ holderId: "a", value: 103.3, date: "2026-11-02" });
    expect(rec("liftDeadlift")).toMatchObject({ holderId: "b", value: 51.7 });
    expect(rec("monthWorkouts")).toMatchObject({ holderId: "a", value: 2, month: "2026-10" });
    expect(rec("monthSteps")).toMatchObject({ holderId: "b", value: 9000, month: "2026-10" });
    expect(rec("big3")).toMatchObject({ holderId: null });
  });

  it("records the biggest single-month PR jump", () => {
    const a = member("a", [lift("2026-09-01", 100), lift("2026-10-01", 110), lift("2026-11-01", 112)]);
    expect(buildHallOfFame({ members: [a], viewerId: "a", stepMonths: new Map() }).find((r) => r.id === "monthPrJump")).toMatchObject({
      holderId: "a",
      value: 10.4,
      month: "2026-10",
      liftName: "Bench Press",
    });
    expect(buildHallOfFame({ members: [a], viewerId: "a", stepMonths: new Map() }).find((r) => r.id === "monthImproved")).toMatchObject({ value: 1, month: "2026-10" });
  });
});
