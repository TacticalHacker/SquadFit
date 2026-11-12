import { describe, expect, it } from "vitest";
import { initDrawer, drawerReducer } from "@calci/shared";
import { clearDraft, draftKey, listDraftExerciseIds, loadDraft, pruneDrafts, saveDraft } from "./gym-draft";

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const state = () => drawerReducer(initDrawer({ exercise: { kind: "strength" } }), { type: "toggleDone", index: 0 });

describe("gym drafts", () => {
  it("round-trips a draft per member, day and exercise", () => {
    const s = new MemoryStorage() as unknown as Storage;
    saveDraft(s, "alice", "2026-11-11", "gx-deadlift", state(), "2026-11-11T08:00:00Z", "now");
    expect(draftKey("alice", "2026-11-11", "gx-deadlift")).toBe("sf:gymdraft:v1:alice:2026-11-11:gx-deadlift");
    const d = loadDraft(s, "alice", "2026-11-11", "gx-deadlift");
    expect(d?.state.rows[0]?.completed).toBe(true);
    expect(d?.baseUpdatedAt).toBe("2026-11-11T08:00:00Z");
    expect(loadDraft(s, "bob", "2026-11-11", "gx-deadlift")).toBeNull();
    expect(loadDraft(s, "alice", "2026-11-10", "gx-deadlift")).toBeNull();
  });

  it("drops corrupt drafts", () => {
    const s = new MemoryStorage() as unknown as Storage;
    s.setItem(draftKey("alice", "2026-11-11", "gx-deadlift"), "{nope");
    expect(loadDraft(s, "alice", "2026-11-11", "gx-deadlift")).toBeNull();
    expect(s.length).toBe(0);
    s.setItem(draftKey("alice", "2026-11-11", "gx-deadlift"), JSON.stringify({ v: 1, state: { rows: "x" } }));
    expect(loadDraft(s, "alice", "2026-11-11", "gx-deadlift")).toBeNull();
  });

  it("lists draft exercise ids for one member and day; clear removes", () => {
    const s = new MemoryStorage() as unknown as Storage;
    saveDraft(s, "alice", "2026-11-11", "gx-deadlift", state(), null, "now");
    saveDraft(s, "alice", "2026-11-11", "gc-1", state(), null, "now");
    saveDraft(s, "alice", "2026-11-10", "gx-leg-press", state(), null, "now");
    saveDraft(s, "bob", "2026-11-11", "gx-bench-press", state(), null, "now");
    expect(listDraftExerciseIds(s, "alice", "2026-11-11").sort()).toEqual(["gc-1", "gx-deadlift"]);
    clearDraft(s, "alice", "2026-11-11", "gc-1");
    expect(listDraftExerciseIds(s, "alice", "2026-11-11")).toEqual(["gx-deadlift"]);
  });

  it("prunes drafts older than the edit window, keeps others' keys alone otherwise", () => {
    const s = new MemoryStorage() as unknown as Storage;
    s.setItem("unrelated", "1");
    saveDraft(s, "alice", "2026-11-08", "gx-deadlift", state(), null, "now");
    saveDraft(s, "alice", "2026-11-09", "gx-deadlift", state(), null, "now");
    saveDraft(s, "bob", "2026-11-01", "gx-deadlift", state(), null, "now");
    pruneDrafts(s, "2026-11-11");
    expect(loadDraft(s, "alice", "2026-11-08", "gx-deadlift")).toBeNull();
    expect(loadDraft(s, "alice", "2026-11-09", "gx-deadlift")).not.toBeNull();
    expect(loadDraft(s, "bob", "2026-11-01", "gx-deadlift")).toBeNull();
    expect(s.getItem("unrelated")).toBe("1");
  });

  it("is a no-op without storage", () => {
    expect(loadDraft(null, "alice", "2026-11-11", "gx-deadlift")).toBeNull();
    expect(() => saveDraft(null, "alice", "2026-11-11", "x", state(), null, "now")).not.toThrow();
    expect(listDraftExerciseIds(null, "alice", "2026-11-11")).toEqual([]);
  });

  it("swallows storage errors (quota, private mode)", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => {}, key: () => null, length: 0 } as unknown as Storage;
    expect(() => saveDraft(broken, "alice", "2026-11-11", "x", state(), null, "now")).not.toThrow();
    expect(loadDraft(broken, "alice", "2026-11-11", "x")).toBeNull();
  });
});
