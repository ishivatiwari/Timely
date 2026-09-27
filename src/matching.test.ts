import { describe, it, expect } from "vitest";
import { compareSessions, makeSession, fingerprint } from "./engine";
import { analyzeTimetables } from "./pipeline";
import type { MatchDecision, Session } from "./types";

const s = (id: string, patch: Record<string, unknown> = {}) =>
  makeSession(
    {
      courseCode: "CS201",
      section: "A",
      date: "2026-09-15",
      day: "Tuesday",
      startTime: "10:00",
      endTime: "11:00",
      room: "Room 204",
      ...patch,
    },
    id,
  );
const summarize = (
  old: Session[],
  next: Session[],
  decisions: MatchDecision[] = [],
) => compareSessions(old, next, decisions);

describe("matching acceptance and adversarial cases", () => {
  it("identical files have no changes", () =>
    expect(summarize([s("o")], [s("n")])[0].type).toBe("UNCHANGED"));
  it("consumes exact duplicates once, preserving multiplicity", () => {
    expect(
      summarize([s("o1"), s("o2")], [s("n")])
        .map((r) => r.type)
        .sort(),
    ).toEqual(["REMOVED", "UNCHANGED"]);
  });
  it("matches same-slot sessions by full equivalence before detecting changes", () => {
    const old = [s("o1"), s("o2", { room: "Room 305" })],
      next = [s("n2", { room: "Room 305" }), s("n1")];
    expect(summarize(old, next).every((r) => r.type === "UNCHANGED")).toBe(
      true,
    );
  });
  it.each([
    [{ room: "Room 305" }, ["Room"]],
    [{ startTime: "11:00", endTime: "12:00" }, ["Start time", "End time"]],
    [{ day: "Monday" }, ["Day"]],
  ])("classifies each differing field after matching", (patch, fields) => {
    const [r] = summarize([s("o")], [s("n", patch as Record<string, unknown>)]);
    expect(r.type).toBe("CHANGED");
    expect(r.requiresConfirmation).toBe(false);
    expect(r.changes?.map((c) => c.field)).toEqual(fields);
  });
  it("reports added and removed rows", () => {
    expect(summarize([], [s("n")])[0].type).toBe("ADDED");
    expect(summarize([s("o")], [])[0].type).toBe("REMOVED");
  });
  it("rescheduling needs a decision, then becomes one changed row", () => {
    const old = [s("o")],
      next = [
        s("n", {
          date: "2026-09-16",
          day: "Wednesday",
          startTime: "14:00",
          endTime: "15:00",
        }),
      ];
    const proposed = summarize(old, next);
    expect(proposed).toHaveLength(1);
    expect(proposed[0].requiresConfirmation).toBe(true);
    const confirmed = summarize(old, next, [
      { oldId: "o", newId: "n", action: "match" },
    ]);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].type).toBe("CHANGED");
    expect(confirmed[0].confirmed).toBe(true);
    expect(confirmed[0].changes).toHaveLength(4);
    expect(
      summarize(old, next, [{ oldId: "o", newId: "n", action: "separate" }])
        .map((r) => r.type)
        .sort(),
    ).toEqual(["ADDED", "REMOVED"]);
  });
  it("does not auto-match either side of duplicate competing candidates", () => {
    const old = [s("o1"), s("o2")],
      next = [s("n1", { room: "Room 305" }), s("n2", { room: "Room 405" })];
    const result = summarize(old, next);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.requiresConfirmation)).toBe(true);
    expect(result[0].alternatives).toHaveLength(2);
  });
  it("keeps alternatives available after rejection and removes claimed candidates after confirmation", () => {
    const old = [s("o1"), s("o2")],
      next = [s("n1", { room: "Room 305" }), s("n2", { room: "Room 405" })];
    const rejected = summarize(old, next, [
      { oldId: "o1", newId: "n1", action: "separate" },
    ]);
    expect(
      rejected
        .find((r) => r.oldSession?.id === "o1")
        ?.alternatives?.map((s) => s.id),
    ).toEqual(["n2"]);
    const confirmed = summarize(old, next, [
      { oldId: "o1", newId: "n1", action: "match" },
    ]);
    const claimed = confirmed
      .filter((r) => !r.requiresConfirmation)
      .map((r) => r.newSession?.id);
    expect(new Set(claimed).size).toBe(claimed.length);
  });
  it("proposes course corrections and section changes only with strong anchors", () => {
    for (const patch of [{ courseCode: "CS202" }, { section: "B" }]) {
      const old = [s("o")],
        next = [s("n", patch)];
      expect(summarize(old, next)[0].requiresConfirmation).toBe(true);
      expect(
        summarize(old, next, [{ oldId: "o", newId: "n", action: "match" }])[0]
          .changes,
      ).toHaveLength(1);
    }
    expect(
      summarize([s("o")], [s("n", { courseCode: "PH999" })])
        .map((r) => r.type)
        .sort(),
    ).toEqual(["ADDED", "REMOVED"]);
    expect(
      summarize([s("o")], [s("n", { courseCode: "CS202", room: "Lab 7" })])
        .map((r) => r.type)
        .sort(),
    ).toEqual(["ADDED", "REMOVED"]);
  });
  it("keeps matching outcomes invariant across input permutations", () => {
    const old = [
      s("o1"),
      s("o2", { room: "Room 305" }),
      s("o3", { startTime: "13:00", endTime: "14:00" }),
    ];
    const next = [
      s("n1", { room: "Room 405" }),
      s("n2", { room: "Room 305" }),
      s("n3", { startTime: "13:00", endTime: "14:00" }),
    ];
    const signature = (a: Session[], b: Session[]) =>
      summarize(a, b)
        .map((r) => [
          r.type,
          r.requiresConfirmation,
          r.oldSession && fingerprint(r.oldSession),
          r.newSession && fingerprint(r.newSession),
        ])
        .sort();
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        expect(
          signature(
            [...old.slice(i), ...old.slice(0, i)],
            [...next.slice(j), ...next.slice(0, j)].reverse(),
          ),
        ).toEqual(signature(old, next));
  });
  it("reports real pipeline completion and no fabricated timer", async () => {
    const completed: number[] = [];
    const result = await analyzeTimetables(
      { name: "a", sessions: [s("o")], warnings: [] },
      { name: "b", sessions: [s("n")], warnings: [] },
      (step) => completed.push(step),
    );
    expect(completed).toEqual([2, 3, 4, 5]);
    expect(result[0].type).toBe("UNCHANGED");
  });
});
