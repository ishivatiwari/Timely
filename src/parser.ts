import * as XLSX from "xlsx";
import { calendarDay, clean, makeSession } from "./normalization";
import { fingerprint } from "./engine";
import type { ParsedFile, Session } from "./types";

export const expectedColumns = [
  "Course Code",
  "Section",
  "Date",
  "Day",
  "Start Time",
  "End Time",
  "Room",
];
const columnAliases: Record<string, string[]> = {
  courseCode: ["course code", "course", "coursecode"],
  section: ["section"],
  date: ["date"],
  day: ["day"],
  startTime: ["start time", "start"],
  endTime: ["end time", "end"],
  room: ["room"],
};
const headerKey = (v: unknown) =>
  clean(v).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

export class TimetableValidationError extends Error {
  constructor(
    message: string,
    public issues: string[] = [],
  ) {
    super(message);
    this.name = "TimetableValidationError";
  }
}

export function parseWorkbook(
  workbook: XLSX.WorkBook,
  name: string,
): ParsedFile {
  if (workbook.SheetNames.length !== 1)
    throw new TimetableValidationError(
      "Use one worksheet with the timetable header in row 1.",
    );
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"])
    throw new TimetableValidationError("The spreadsheet is empty.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (range.e.r > 500 || range.e.c > 49)
    throw new TimetableValidationError(
      "Use at most 500 timetable rows and 50 columns per file.",
    );
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: true,
  });
  if (range.s.r !== 0)
    throw new TimetableValidationError(
      "Place the timetable column headers in row 1.",
    );
  const headers = rows[0] ?? [],
    mapping: Record<string, number> = {},
    issues: string[] = [];
  for (const [target, aliases] of Object.entries(columnAliases)) {
    const indices = headers.flatMap((v, i) =>
      aliases.includes(headerKey(v)) ? [i + range.s.c] : [],
    );
    if (!indices.length) issues.push(`Missing column: ${aliases[0]}`);
    if (indices.length > 1) issues.push(`Duplicate column: ${aliases[0]}`);
    mapping[target] = indices[0];
  }
  if (issues.length)
    throw new TimetableValidationError(
      "We couldn't analyze this timetable. Check the required columns.",
      issues,
    );
  const sessions: Session[] = [],
    warnings: string[] = [],
    seen = new Map<string, number>();
  for (let row = 1; row <= range.e.r; row++) {
    if (!(rows[row] ?? []).some((v) => clean(v))) {
      warnings.push(`Row ${row + 1}: empty row ignored.`);
      continue;
    }
    const raw: Record<string, unknown> = {},
      display: Record<string, string> = {};
    let formula = false;
    for (const [field, column] of Object.entries(mapping)) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      raw[field] = cell?.v ?? "";
      display[field] = cell ? (cell.w ?? XLSX.utils.format_cell(cell)) : "";
      if (cell?.f) formula = true;
    }
    if (workbook.Workbook?.WBProps?.date1904 && typeof raw.date === "number")
      raw.date += 1462;
    const session = makeSession(raw, `${name}:row:${row + 1}`),
      problems: string[] = [];
    if (!session.normalizedCourseCode) problems.push("missing course code");
    if (!session.normalizedSection) problems.push("missing section");
    if (!session.normalizedDate)
      problems.push(
        "invalid date (use YYYY-MM-DD, DD-Mon-YYYY, or DD/MM/YYYY)",
      );
    if (!session.normalizedDay) problems.push("invalid or missing weekday");
    if (!session.normalizedStartTime) problems.push("invalid start time");
    if (!session.normalizedEndTime) problems.push("invalid end time");
    if (
      session.normalizedStartTime &&
      session.normalizedEndTime &&
      session.normalizedEndTime <= session.normalizedStartTime
    )
      problems.push("end time must be after start time");
    if (formula)
      problems.push("formula cells are unsupported; paste values first");
    if (Object.values(display).some((v) => v.length > 200))
      problems.push("a cell exceeds 200 characters");
    if (problems.length) {
      issues.push(`Row ${row + 1}: ${problems.join("; ")}.`);
      continue;
    }
    Object.assign(session, display);
    if (!session.normalizedRoom)
      warnings.push(
        `Row ${row + 1}: room is blank; displayed as not specified.`,
      );
    if (session.normalizedDay !== calendarDay(session.normalizedDate))
      warnings.push(
        `Row ${row + 1}: weekday does not agree with the date. Both original values are preserved.`,
      );
    const duplicate = seen.get(fingerprint(session));
    if (duplicate)
      warnings.push(
        `Row ${row + 1}: duplicate of row ${duplicate}; both occurrences retained.`,
      );
    seen.set(fingerprint(session), row + 1);
    sessions.push(session);
  }
  if (issues.length)
    throw new TimetableValidationError(
      `${issues.length} row${issues.length === 1 ? "" : "s"} require attention. Fix these rows and upload again; no partial comparison was made.`,
      issues,
    );
  if (!sessions.length)
    throw new TimetableValidationError(
      "The spreadsheet does not contain any timetable sessions.",
    );
  return { name, sessions, warnings };
}

export async function parseTimetable(file: File): Promise<ParsedFile> {
  if (!/\.(xlsx|csv)$/i.test(file.name))
    throw new TimetableValidationError(
      "Choose an .xlsx or .csv timetable file.",
    );
  if (!file.size) throw new TimetableValidationError("The file is empty.");
  if (file.size > 5 * 1024 * 1024)
    throw new TimetableValidationError("Choose a file smaller than 5 MB.");
  const bytes = await file.arrayBuffer();
  if (/\.xlsx$/i.test(file.name) && new Uint8Array(bytes)[0] !== 0x50)
    throw new TimetableValidationError(
      "This is not a readable XLSX workbook. Export it again or use CSV.",
    );
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      raw: true,
      cellDates: false,
      cellText: true,
      cellFormula: true,
    });
  } catch {
    throw new TimetableValidationError(
      "This file could not be read. Export it again as XLSX or CSV.",
    );
  }
  return parseWorkbook(workbook, file.name);
}
