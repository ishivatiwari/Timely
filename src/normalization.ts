import type { Session } from "./types";

export const clean = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
const key = (value: unknown) => clean(value).toLowerCase();
const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const aliases: Record<string, string> = {
  sun: "sunday",
  mon: "monday",
  tue: "tuesday",
  tues: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  fri: "friday",
  sat: "saturday",
};

export function normalizeDay(value: unknown) {
  const v = key(value).replace(/\.$/, "");
  return aliases[v] ?? (weekdays.includes(v) ? v : "");
}

export function normalizeRoom(value: unknown) {
  return key(value)
    .replace(/\./g, "")
    .replace(/\blaboratory\b/g, "lab")
    .replace(/\bcomp\b/g, "computer")
    .replace(/\brm\b/g, "room")
    .replace(/\s+/g, " ");
}

function calendarDate(y: number, m: number, d: number) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date.toISOString().slice(0, 10)
    : "";
}

export function normalizeDate(value: unknown): string {
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? ""
      : calendarDate(
          value.getUTCFullYear(),
          value.getUTCMonth() + 1,
          value.getUTCDate(),
        );
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1 || value > 73415 || value === 60)
      return "";
    const date = new Date(
      Date.UTC(1899, 11, 31) + (value > 60 ? value - 1 : value) * 86400000,
    );
    return calendarDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }
  const raw = clean(value);
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return calendarDate(+match[1], +match[2], +match[3]);
  match = raw.match(/^(\d{1,2})[- /]([a-zA-Z]{3,9})[- /](\d{4})$/);
  if (match) {
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const name = match[2].toLowerCase();
    const month = months.findIndex((m) => name === m || name === m.slice(0, 3));
    return month < 0 ? "" : calendarDate(+match[3], month + 1, +match[1]);
  }
  // Slash dates always use DD/MM/YYYY, never browser-dependent parsing.
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? calendarDate(+match[3], +match[2], +match[1]) : "";
}

export function normalizeTime(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value >= 1) return "";
    const total = value * 1440,
      mins = Math.round(total);
    if (Math.abs(total - mins) > 0.00001 || mins >= 1440) return "";
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  const match = clean(value).match(/^(\d{1,2}):(\d{2})(?::00)?\s*([ap]m)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return "";
  if (match[3]) hour = (hour % 12) + (/pm/i.test(match[3]) ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function makeSession(raw: Record<string, unknown>, id: string): Session {
  return {
    id,
    courseCode: clean(raw.courseCode),
    section: clean(raw.section),
    date: clean(raw.date),
    day: clean(raw.day),
    startTime: clean(raw.startTime),
    endTime: clean(raw.endTime),
    room: clean(raw.room),
    normalizedCourseCode: clean(raw.courseCode)
      .replace(/[\s_-]/g, "")
      .toUpperCase(),
    normalizedSection: clean(raw.section)
      .replace(/^(section|sec)\.?\s+/i, "")
      .toUpperCase(),
    normalizedDate: normalizeDate(raw.date),
    normalizedDay: normalizeDay(raw.day),
    normalizedStartTime: normalizeTime(raw.startTime),
    normalizedEndTime: normalizeTime(raw.endTime),
    normalizedRoom: normalizeRoom(raw.room),
  };
}

export function calendarDay(date: string) {
  return weekdays[new Date(date + "T00:00:00Z").getUTCDay()];
}
