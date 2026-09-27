import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import { createServer } from "vite";
import * as XLSX from "xlsx";
XLSX.set_fs(fs);

// These are synthetic fixtures only. Uploaded data is never written to disk.
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { oldDemo, newDemo } = await vite.ssrLoadModule("/src/demo.ts");
  const { makeSession } = await vite.ssrLoadModule("/src/normalization.ts");
  const folder = new URL("../public/demo/", import.meta.url);
  await mkdir(folder, { recursive: true });
  const headers = [
    "Course Code",
    "Section",
    "Date",
    "Day",
    "Start Time",
    "End Time",
    "Room",
  ];
  const fields = [
    "courseCode",
    "section",
    "date",
    "day",
    "startTime",
    "endTime",
    "room",
  ];
  const save = (name, sessions) => {
    const sheet = XLSX.utils.aoa_to_sheet([
      headers,
      ...sessions.map((s) => fields.map((f) => s[f])),
    ]);
    sheet["!cols"] = [16, 12, 18, 16, 14, 14, 24].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Timetable");
    XLSX.writeFile(workbook, fileURLToPath(new URL(name + ".xlsx", folder)));
    XLSX.writeFile(workbook, fileURLToPath(new URL(name + ".csv", folder)), {
      bookType: "csv",
    });
  };
  save("previous-timetable", oldDemo);
  save("revised-timetable", newDemo);
  save("reordered-only", [...oldDemo].reverse());
  const ambiguousOld = oldDemo.slice(0, 1);
  const ambiguousNew = ["11:00", "13:00"].map((startTime, i) =>
    makeSession(
      {
        courseCode: "CS201",
        section: "A",
        date: "2026-09-16",
        day: "Wednesday",
        startTime,
        endTime: i ? "14:00" : "12:00",
        room: "Room 204",
      },
      "ambiguous-" + i,
    ),
  );
  save("ambiguous-previous", ambiguousOld);
  save("ambiguous-revised", ambiguousNew);
  console.log("Generated XLSX and CSV demo fixtures in public/demo.");
} finally {
  await vite.close();
}
