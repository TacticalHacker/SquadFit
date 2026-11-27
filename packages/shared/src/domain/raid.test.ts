import { describe, expect, it } from "vitest";
import {
  capKg,
  countedKg,
  isCounting,
  lockedChanges,
  pickRaidCard,
  raidContribution,
  raidDays,
  raidStatus,
  suggestTarget,
  validateRaid,
  zonedInstant,
  type Raid,
} from "./raid";

const TZ = "Asia/Kolkata";
const START = "2026-11-30T18:30:00.000Z"; // Mon 1 Dec 00:00 IST
const END = "2026-12-07T18:30:00.000Z"; // Mon 8 Dec 00:00 IST
const at = (iso: string) => new Date(iso);

function raid(over: Partial<Raid> = {}): Raid {
  return {
    raidId: "rd-1",
    squadId: "global",
    name: "Leg Day Siege",
    startsAt: START,
    endsAt: END,
    targetKg: 40_000,
    metric: "volume_kg",
    filter: null,
    capPct: 40,
    lateJoiners: true,
    showContributors: true,
    stickerId: "raid_cleared",
    draft: false,
    totalKg: 0,
    createdBy: "admin",
    createdAt: "2026-11-27T00:00:00.000Z",
    updatedBy: "admin",
    updatedAt: "2026-11-27T00:00:00.000Z",
    ...over,
  };
}

const set = (weightKg: number, reps: number, completed = true) => ({ weightKg, reps, completed });
const gym = (date: string, workoutId: string, sets: ReturnType<typeof set>[], muscleGroup: "chest" | "legs" | "cardio" = "chest", exerciseKind: "strength" | "cardio" = "strength") => ({
  date,
  workoutId,
  kind: "gym" as const,
  exerciseKind,
  muscleGroup,
  sets,
});
const ctx = { timezone: TZ, held: {}, memberCreatedAt: "2026-01-01T00:00:00.000Z" };

describe("raid status and window", () => {
  it("derives every state from the clock", () => {
    expect(raidStatus(raid(), at("2026-11-29T00:00:00Z"))).toBe("scheduled");
    expect(raidStatus(raid(), at("2026-12-03T00:00:00Z"))).toBe("live");
    expect(raidStatus(raid(), at("2026-12-09T00:00:00Z"))).toBe("ended");
    expect(raidStatus(raid({ wonAt: "2026-12-04T00:00:00Z" }), at("2026-12-09T00:00:00Z"))).toBe("won");
    expect(raidStatus(raid({ draft: true }), at("2026-12-03T00:00:00Z"))).toBe("draft");
    expect(raidStatus(raid({ cancelledAt: "2026-12-02T00:00:00Z" }), at("2026-12-03T00:00:00Z"))).toBe("cancelled");
  });

  it("uses squad-timezone days and a 12-hour grace", () => {
    expect(raidDays(raid(), TZ)).toEqual({ from: "2026-12-01", to: "2026-12-07" });
    expect(isCounting(raid(), at("2026-12-08T04:30:00Z"))).toBe(true); // Mon 8 Dec 10:00 IST
    expect(isCounting(raid(), at("2026-12-08T07:30:00Z"))).toBe(false); // Mon 8 Dec 13:00 IST
    expect(zonedInstant("2026-12-01", "00:00", TZ)).toBe(START);
  });
});

describe("raidContribution", () => {
  it("counts ticked strength sets on raid days", () => {
    const entries = [
      gym("2026-12-02", "gx-bench-press", [set(80, 8), set(80, 8), set(80, 8)]),
      gym("2026-12-02", "gx-row", [set(50, 10, false)]),
      gym("2026-12-03", "gx-pull-ups", [set(0, 10)]),
      gym("2026-12-03", "gx-treadmill", [], "cardio", "cardio"),
      gym("2026-11-30", "gx-bench-press", [set(100, 5)]),
    ];
    expect(raidContribution(entries, raid(), ctx)).toEqual({ rawKg: 1920, setCount: 4 });
  });

  it("skips held sets, filtered exercises and excluded late joiners", () => {
    const entries = [gym("2026-12-02", "gx-bench-press", [set(80, 8), set(140, 3)]), gym("2026-12-02", "gx-squat", [set(100, 5)], "legs")];
    expect(raidContribution(entries, raid(), { ...ctx, held: { "2026-12-02|gx-bench-press": [1] } }).rawKg).toBe(1140);
    expect(raidContribution(entries, raid({ filter: { groups: ["legs"], exerciseIds: [] } }), ctx).rawKg).toBe(500);
    expect(raidContribution(entries, raid({ lateJoiners: false }), { ...ctx, memberCreatedAt: "2026-12-02T00:00:00Z" })).toEqual({ rawKg: 0, setCount: 0 });
  });

  it("caps what fills the bar", () => {
    expect(capKg(raid())).toBe(16_000);
    expect(countedKg(18_000, raid())).toBe(16_000);
    expect(countedKg(6_200, raid())).toBe(6_200);
  });
});

describe("pickRaidCard", () => {
  it("shows live first, finished for 3 days, cancelled for 1, else the next one", () => {
    const next = raid({ raidId: "rd-2", startsAt: "2026-12-14T18:30:00Z", endsAt: "2026-12-21T18:30:00Z" });
    expect(pickRaidCard([raid(), next], at("2026-12-03T00:00:00Z"))).toMatchObject({ card: { raidId: "rd-1" }, next: { raidId: "rd-2" } });
    expect(pickRaidCard([raid(), next], at("2026-12-10T00:00:00Z")).card?.raidId).toBe("rd-1");
    expect(pickRaidCard([raid(), next], at("2026-12-11T00:00:00Z"))).toMatchObject({ card: { raidId: "rd-2" }, next: null });
    const cancelled = raid({ cancelledAt: "2026-12-03T00:00:00Z" });
    expect(pickRaidCard([cancelled], at("2026-12-04T01:00:00Z")).card).toBeNull();
    expect(pickRaidCard([raid({ draft: true })], at("2026-12-03T00:00:00Z")).card).toBeNull();
  });
});

describe("validateRaid", () => {
  const now = at("2026-11-27T00:00:00Z");
  const input = (over: Partial<Raid> = {}) => ({ name: "Push Week", startsAt: "2026-12-04T18:30:00Z", endsAt: "2026-12-11T18:30:00Z", draft: false, ...over });

  it("refuses overlaps, long raids and a full schedule", () => {
    expect(validateRaid(input(), [raid()], now)).toEqual([{ field: "startsAt", message: "Dates overlap Leg Day Siege" }]);
    expect(validateRaid(input({ startsAt: START, endsAt: "2027-01-09T18:30:00Z" }), [], now)[0]?.message).toBe("A raid can last at most 31 days");
    const three = [1, 2, 3].map((i) => raid({ raidId: `rd-${i}`, startsAt: `2027-0${i}-01T00:00:00Z`, endsAt: `2027-0${i}-08T00:00:00Z` }));
    expect(validateRaid(input(), three, now)[0]?.message).toBe("At most 3 raids can be scheduled");
    expect(validateRaid(input({ draft: true }), [raid()], now)).toEqual([]);
  });

  it("allows only one live raid", () => {
    const live = raid({ startsAt: "2026-11-26T00:00:00Z", endsAt: "2026-12-03T00:00:00Z" });
    expect(validateRaid(input({ startsAt: now.toISOString(), endsAt: "2026-12-04T00:00:00Z" }), [live], now)[0]?.message).toBe("Another raid is live (Leg Day Siege)");
  });
});

describe("lockedChanges", () => {
  const live = at("2026-12-03T00:00:00Z");
  it("locks fairness fields and the target floor while live", () => {
    expect(lockedChanges(raid(), raid({ capPct: 50 }), live, 28_400).map((i) => i.field)).toEqual(["capPct"]);
    expect(lockedChanges(raid(), raid({ targetKg: 20_000 }), live, 28_400)[0]?.message).toBe("Target can't be below current progress (28,400 kg)");
    expect(lockedChanges(raid(), raid({ name: "Renamed", targetKg: 50_000 }), live, 28_400)).toEqual([]);
    expect(lockedChanges(raid({ wonAt: "2026-12-02T00:00:00Z" }), raid({ name: "x" }), at("2026-12-09T00:00:00Z"), 0)).toHaveLength(1);
  });
});

describe("suggestTarget", () => {
  it("scales the weekly average, adds 10% and rounds to 500 kg", () => {
    expect(suggestTarget(120_000, 28, 7)).toBe(33_000);
    expect(suggestTarget(0, 0, 7)).toBeNull();
  });
});
