import { describe, expect, it } from "vitest";
import { compareSessions, makeSession } from "./engine";
import { oldDemo, newDemo } from "./demo";
const s = (
  courseCode: string,
  date = "2026-09-15",
  startTime = "10:00",
  room = "Room 204",
  id = courseCode,
) =>
  makeSession(
    {
      courseCode,
      section: "A",
      date,
      day: "Tuesday",
      startTime,
      endTime: "11:00",
      room,
    },
    id,
  );
describe("comparison engine", () => {
  it("ignores row reordering", () => {
    const old = [s("CS201"), s("CS305")],
      newer = [s("CS305"), s("CS201")];
    expect(
      compareSessions(old, newer).filter((r) => r.type !== "UNCHANGED"),
    ).toHaveLength(0);
  });
  it("detects room changes", () => {
    const r = compareSessions(
      [s("CS201")],
      [s("CS201", "2026-09-15", "10:00", "Room 305")],
    );
    expect(r[0].type).toBe("CHANGED");
    expect(r[0].changes?.[0].field).toBe("Room");
  });
  it("keeps unrelated courses separate", () => {
    const r = compareSessions([s("CS201")], [s("CS999")]);
    expect(r.map((x) => x.type).sort()).toEqual(["ADDED", "REMOVED"]);
  });
  it("normalizes equivalent room labels", () => {
    const r = compareSessions(
      [s("CS201", "2026-09-15", "10:00", "Computer Lab")],
      [s("CS201", "2026-09-15", "10:00", "Comp. Laboratory")],
    );
    expect(r[0].type).toBe("UNCHANGED");
  });
  it("produces the intended demo after confirming the reschedule", () => {
    const proposed = compareSessions(oldDemo, newDemo);
    const review = proposed.filter((x) => x.requiresConfirmation);
    expect(review).toHaveLength(1);
    const r = compareSessions(oldDemo, newDemo, [
      {
        oldId: review[0].oldSession!.id,
        newId: review[0].newSession!.id,
        action: "match",
      },
    ]);
    const counts = (type: string) =>
      r.filter((x) => x.type === type && !x.requiresConfirmation).length;
    expect({
      added: counts("ADDED"),
      removed: counts("REMOVED"),
      changed: counts("CHANGED"),
      unchanged: counts("UNCHANGED"),
    }).toEqual({ added: 1, removed: 1, changed: 2, unchanged: 16 });
  });
});
