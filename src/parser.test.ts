import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseTimetable,
  parseWorkbook,
  expectedColumns,
  TimetableValidationError,
} from "./parser";

const row = [
  "CS201",
  "A",
  "2026-09-15",
  "Tuesday",
  "10:00",
  "11:00",
  "Room 204",
];
function workbook(rows: unknown[][] = [row], headers = expectedColumns) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([headers, ...rows]),
    "Timetable",
  );
  return book;
}
function file(book: XLSX.WorkBook, name = "test.xlsx") {
  const data = XLSX.write(book, {
    type: "array",
    bookType: name.endsWith(".csv") ? "csv" : "xlsx",
  });
  return new File([data], name);
}
describe("spreadsheet validation", () => {
  it("reads real XLSX and CSV files", async () => {
    for (const name of ["test.xlsx", "test.csv"])
      expect(
        (await parseTimetable(file(workbook(), name))).sessions,
      ).toHaveLength(1);
  });
  it("recognizes harmless header variations", () => {
    expect(
      parseWorkbook(
        workbook(
          [row],
          [
            "course_code",
            "section",
            "Date",
            "Day",
            "start_time",
            "end_time",
            "Room",
          ],
        ),
        "a",
      ).sessions,
    ).toHaveLength(1);
  });
  it("stops for missing and duplicate columns", () => {
    expect(() =>
      parseWorkbook(workbook([row], expectedColumns.slice(0, 6)), "a"),
    ).toThrow("required columns");
    expect(() =>
      parseWorkbook(workbook([row], [...expectedColumns, "Course"]), "a"),
    ).toThrow("required columns");
  });
  it("reports actual sheet row numbers and prevents partial comparison", () => {
    const invalid = [...row];
    invalid[2] = "2026-02-30";
    try {
      parseWorkbook(workbook([row, [], invalid]), "a");
      expect.fail("Expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(TimetableValidationError);
      expect((error as TimetableValidationError).issues[0]).toContain("Row 4:");
    }
  });
  it("retains duplicates and warns about missing rooms and weekday conflicts", () => {
    const changed = [...row];
    changed[3] = "Monday";
    changed[6] = "";
    const parsed = parseWorkbook(workbook([row, [], row, changed]), "a");
    expect(parsed.sessions).toHaveLength(3);
    expect(parsed.warnings.join(" ")).toMatch(/duplicate/);
    expect(parsed.warnings.join(" ")).toMatch(/weekday/);
    expect(parsed.warnings.join(" ")).toMatch(/room is blank/);
  });
  it("reads formatted Excel dates and times without losing displayed values", () => {
    const book = workbook(),
      sheet = book.Sheets.Timetable;
    sheet.C2 = { t: "n", v: 46280, z: "dd-mmm-yyyy" };
    sheet.E2 = { t: "n", v: 10 / 24, z: "h:mm AM/PM" };
    sheet.F2 = { t: "n", v: 11 / 24, z: "h:mm AM/PM" };
    const s = parseWorkbook(book, "a").sessions[0];
    expect(s.normalizedDate).toBe("2026-09-15");
    expect(s.normalizedStartTime).toBe("10:00");
    expect(s.startTime).toBe("10:00 AM");
  });
  it("handles the Excel 1904 date system", () => {
    const book = workbook();
    book.Workbook = { WBProps: { date1904: true } };
    book.Sheets.Timetable.C2 = { t: "n", v: 46280 - 1462 };
    expect(parseWorkbook(book, "a").sessions[0].normalizedDate).toBe(
      "2026-09-15",
    );
  });
  it.each([0, 1, 3, 4, 5])(
    "rejects missing required values in column %s",
    (index) => {
      const invalid = [...row];
      invalid[index] = "";
      expect(() => parseWorkbook(workbook([invalid]), "a")).toThrow(
        "require attention",
      );
    },
  );
  it("rejects end-before-start and formulas", () => {
    const invalid = [...row];
    invalid[5] = "09:00";
    expect(() => parseWorkbook(workbook([invalid]), "a")).toThrow(
      "require attention",
    );
    const book = workbook();
    book.Sheets.Timetable.E2.f = "NOW()";
    expect(() => parseWorkbook(book, "a")).toThrow("require attention");
  });
  it("rejects empty, unsupported and unreadable uploads", async () => {
    await expect(parseTimetable(new File([], "empty.csv"))).rejects.toThrow(
      "empty",
    );
    await expect(
      parseTimetable(new File(["not excel"], "test.xlsx")),
    ).rejects.toThrow("not a readable");
    await expect(
      parseTimetable(new File(["text"], "test.pdf")),
    ).rejects.toThrow("Choose");
    expect(() => parseWorkbook(workbook([]), "a")).toThrow("does not contain");
  });
  it("rejects extra worksheets instead of ignoring them", () => {
    const book = workbook();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([row]), "Other");
    expect(() => parseWorkbook(book, "a")).toThrow("one worksheet");
  });
});
