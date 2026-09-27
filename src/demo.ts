import { makeSession } from "./engine";
import type { Session } from "./types";

const base = [
  ["CS201", "A", "2026-09-15", "Tuesday", "10:00", "11:00", "Room 204"],
  ["CS305", "B", "2026-09-14", "Monday", "10:00", "11:00", "Room 204"],
  ["CS220", "B", "2026-09-18", "Friday", "14:00", "15:00", "Room 101"],
  ["MA201", "A", "2026-09-14", "Monday", "09:00", "10:00", "Lecture Hall 1"],
  ["PH210", "A", "2026-09-14", "Monday", "11:00", "12:00", "Physics Lab"],
  ["EC230", "C", "2026-09-15", "Tuesday", "09:00", "10:00", "Room 110"],
  ["ME240", "A", "2026-09-15", "Tuesday", "13:00", "14:00", "Workshop 2"],
  ["HU105", "D", "2026-09-16", "Wednesday", "10:00", "11:00", "Seminar Hall"],
  ["CS250", "A", "2026-09-16", "Wednesday", "11:00", "12:00", "Computer Lab"],
  ["MA250", "B", "2026-09-16", "Wednesday", "13:00", "14:00", "Room 306"],
  ["PH260", "A", "2026-09-17", "Thursday", "09:00", "10:00", "Room 202"],
  ["EC270", "B", "2026-09-17", "Thursday", "10:00", "11:00", "Electronics Lab"],
  ["ME280", "C", "2026-09-17", "Thursday", "14:00", "15:00", "Room 118"],
  ["HU205", "A", "2026-09-18", "Friday", "09:00", "10:00", "Room 205"],
  ["CS320", "C", "2026-09-18", "Friday", "10:00", "11:00", "Comp. Laboratory"],
  ["MA310", "A", "2026-09-18", "Friday", "11:00", "12:00", "Room 307"],
  ["PH315", "B", "2026-09-19", "Saturday", "09:00", "10:00", "Physics Lab"],
  ["EC330", "A", "2026-09-19", "Saturday", "10:00", "11:00", "Room 212"],
  ["ME350", "B", "2026-09-19", "Saturday", "11:00", "12:00", "Design Studio"],
] as const;
const session = (v: readonly string[], id: string) =>
  makeSession(
    {
      courseCode: v[0],
      section: v[1],
      date: v[2],
      day: v[3],
      startTime: v[4],
      endTime: v[5],
      room: v[6],
    },
    id,
  );
export const oldDemo: Session[] = base.map((v, i) => session(v, `old-${i}`));
const revised = base
  .filter((v) => v[0] !== "CS220")
  .map((v) => {
    if (v[0] === "CS201") return [...v.slice(0, 6), "Room 305"];
    if (v[0] === "CS305")
      return [
        "CS305",
        "B",
        "2026-09-15",
        "Tuesday",
        "14:00",
        "15:00",
        "Room 204",
      ];
    if (v[0] === "CS250") return [...v.slice(0, 6), "Comp. Laboratory"];
    return [...v];
  });
revised.push([
  "CS410",
  "A",
  "2026-09-16",
  "Wednesday",
  "09:00",
  "10:00",
  "Computer Lab",
]);
const order = [
  8, 2, 13, 0, 17, 6, 11, 4, 15, 1, 7, 12, 3, 18, 9, 5, 14, 10, 16,
];
export const newDemo: Session[] = order.map((i) =>
  session(revised[i], `new-${i}`),
);
