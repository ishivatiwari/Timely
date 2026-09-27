import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  normalizeTime,
  makeSession,
  normalizeRoom,
} from "./normalization";

describe("strict normalization", () => {
  it.each([
    "2026-02-30",
    "2026-02-29",
    "31-Apr-2026",
    "2026-13-01",
    "tomorrow",
    "2026",
    "09-15-26",
    "",
  ])("rejects malformed date %s", (value) =>
    expect(normalizeDate(value)).toBe(""),
  );
  it.each([
    "2026-09-15",
    "15-Sep-2026",
    "15 September 2026",
    "15/09/2026",
    46280,
  ])("accepts explicit date formats %s", (value) =>
    expect(normalizeDate(value)).toBe("2026-09-15"),
  );
  it("accepts leap years and rejects the Excel fictitious leap day", () => {
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDate(60)).toBe("");
  });
  it.each([
    "00:30 PM",
    "13:00 PM",
    "24:00",
    "10:60",
    "-01:00",
    "10:15:42",
    "7 PM",
    "",
  ])("rejects malformed time %s", (value) =>
    expect(normalizeTime(value)).toBe(""),
  );
  it("normalizes AM/PM and Excel fractional times", () => {
    expect(normalizeTime("12:00 AM")).toBe("00:00");
    expect(normalizeTime("12:00 PM")).toBe("12:00");
    expect(normalizeTime("9:05 am")).toBe("09:05");
    expect(normalizeTime(0.5)).toBe("12:00");
    expect(normalizeTime(1)).toBe("");
  });
  it("preserves originals while normalizing section, codes and known aliases", () => {
    const s = makeSession(
      {
        courseCode: " cs_201 ",
        section: "Section A",
        room: " Comp. Laboratory ",
        date: "15-Sep-2026",
        day: "Tues.",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
      },
      "one",
    );
    expect(s.courseCode).toBe("cs_201");
    expect(s.normalizedCourseCode).toBe("CS201");
    expect(s.normalizedSection).toBe("A");
    expect(s.room).toBe("Comp. Laboratory");
    expect(s.normalizedRoom).toBe("computer lab");
    expect(s.normalizedDay).toBe("tuesday");
    expect(normalizeRoom("Science Lab 2")).not.toBe(
      normalizeRoom("Science Lab 3"),
    );
  });
});
