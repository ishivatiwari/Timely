import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { parseTimetable } from "./parser";
import { compareSessions } from "./engine";

async function load(name: string) {
  const buffer = await readFile(
    new URL("../public/demo/" + name, import.meta.url),
  );
  return parseTimetable(new File([buffer], name));
}
describe("downloadable judge fixtures", () => {
  it.each(["xlsx", "csv"])(
    "produces expected totals from the actual %s downloads",
    async (extension) => {
      const previous = await load("previous-timetable." + extension),
        revised = await load("revised-timetable." + extension);
      const proposal = compareSessions(
        previous.sessions,
        revised.sessions,
      ).find((r) => r.requiresConfirmation)!;
      expect(proposal.oldSession?.courseCode).toBe("CS305");
      const result = compareSessions(previous.sessions, revised.sessions, [
        {
          oldId: proposal.oldSession!.id,
          newId: proposal.newSession!.id,
          action: "match",
        },
      ]);
      expect(
        ["ADDED", "REMOVED", "CHANGED", "UNCHANGED"].map(
          (type) => result.filter((r) => r.type === type).length,
        ),
      ).toEqual([1, 1, 2, 16]);
    },
  );
  it("reordered fixture is unchanged and ambiguity fixture has two candidates", async () => {
    const previous = await load("previous-timetable.xlsx"),
      reordered = await load("reordered-only.xlsx");
    expect(
      compareSessions(previous.sessions, reordered.sessions).every(
        (r) => r.type === "UNCHANGED",
      ),
    ).toBe(true);
    const old = await load("ambiguous-previous.xlsx"),
      revised = await load("ambiguous-revised.xlsx");
    expect(
      compareSessions(old.sessions, revised.sessions)[0].alternatives,
    ).toHaveLength(2);
  });
});
