// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { oldDemo, newDemo } from "./demo";
import * as parser from "./parser";
import type { Session } from "./types";

// jsdom has no native dialog rendering. These shims verify our open/close
// state; browser focus trapping and backdrop layout still need visual QA.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});

const csv = (sessions: Session[]) =>
  [
    parser.expectedColumns.join(","),
    ...sessions.map((s) =>
      [
        s.courseCode,
        s.section,
        s.date,
        s.day,
        s.startTime,
        s.endTime,
        s.room,
      ].join(","),
    ),
  ].join("\n");
function uploadFile(text: string, name = "timetable.csv") {
  const file = new File([text], name, { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(text).buffer,
  });
  return file;
}
const compareButton = () =>
  screen.getByRole("button", { name: "Compare timetables" });
async function loadDemo() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Try the demo" }));
  await user.click(compareButton());
  await screen.findByRole("heading", {
    name: "Your comparison needs a review.",
  });
  return user;
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ semanticAI: false }),
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Timely user flows", () => {
  it("removes either uploaded file without discarding the other", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try the demo" }));
    await user.click(
      screen.getByRole("button", { name: "Remove previous timetable" }),
    );
    expect(screen.queryByText("previous-timetable.xlsx")).toBeNull();
    expect(screen.getByText("revised-timetable.xlsx")).toBeTruthy();
    expect((compareButton() as HTMLButtonElement).disabled).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Remove revised timetable" }),
    );
    expect(screen.queryByText("revised-timetable.xlsx")).toBeNull();
  });
  it("opens and closes the format guide without resetting uploads", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try the demo" }));
    await user.click(screen.getByRole("button", { name: "Open format guide" }));
    const guide = screen.getByRole("dialog", {
      name: "Get your files comparison-ready.",
    });
    expect(within(guide).getByText("Course Code")).toBeTruthy();
    expect(
      within(guide)
        .getByRole("link", { name: "Previous demo" })
        .getAttribute("href"),
    ).toBe("/demo/previous-timetable.xlsx");
    await user.click(
      within(guide).getByRole("button", { name: "Close format guide" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("previous-timetable.xlsx")).toBeTruthy();
    expect((compareButton() as HTMLButtonElement).disabled).toBe(false);
  });
  it("can undo a match, rejection, and room equivalence without losing uploaded files", async () => {
    const user = await loadDemo();
    await user.click(screen.getByRole("button", { name: "Confirm match" }));
    expect(screen.getByLabelText("2 Changed")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Undo last decision" }),
    );
    expect(screen.getByRole("button", { name: "Confirm match" })).toBeTruthy();
    expect(screen.getByLabelText("1 Changed")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep separate" }));
    expect(screen.getByLabelText("2 Added")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Undo last decision" }),
    );
    expect(screen.getByLabelText("1 Added")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm match" }));
    const card = screen.getByRole("article", { name: "CS201 ROOM CHANGED" });
    await user.click(
      within(card).getByText("Could these be two names for the same room?"),
    );
    await user.click(
      within(card).getByRole("button", {
        name: "Confirm these labels mean the same room",
      }),
    );
    expect(screen.getByLabelText("17 Unchanged")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Undo last decision" }),
    );
    expect(screen.getByLabelText("16 Unchanged")).toBeTruthy();
    expect(
      screen.getByRole("article", { name: "CS201 ROOM CHANGED" }),
    ).toBeTruthy();
  });
  it("clears all filters and restores the full change list", async () => {
    const user = await loadDemo();
    await user.click(screen.getByRole("button", { name: "Confirm match" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course" }),
      "CS201",
    );
    expect(screen.getByText("Showing 1 of 4 confirmed changes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Showing 4 of 4 confirmed changes")).toBeTruthy();
    expect(
      screen.getByRole("article", { name: "CS305 RESCHEDULED" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
  it("loads, confirms the demo, filters and resets", async () => {
    const user = await loadDemo();
    expect(screen.getByLabelText("1 Added")).toBeTruthy();
    expect(screen.getByLabelText("1 Removed")).toBeTruthy();
    expect(screen.getByLabelText("1 Changed")).toBeTruthy();
    expect(screen.getByLabelText("16 Unchanged")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm match" }));
    await screen.findByRole("heading", { name: "Your timetable changed." });
    expect(screen.getByLabelText("2 Changed")).toBeTruthy();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course" }),
      "CS201",
    );
    expect(
      screen.getByRole("article", { name: "CS201 ROOM CHANGED" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("article", { name: "CS305 RESCHEDULED" }),
    ).toBeNull();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Course" }),
      "",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Section" }),
      "B",
    );
    expect(
      screen.getByRole("article", { name: "CS305 RESCHEDULED" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("article", { name: "CS201 ROOM CHANGED" }),
    ).toBeNull();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Change type" }),
      "REMOVED",
    );
    expect(screen.getByRole("article", { name: "CS220 REMOVED" })).toBeTruthy();
    expect(
      screen.queryByRole("article", { name: "CS305 RESCHEDULED" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "New comparison" }));
    expect((compareButton() as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps a rejected match separate with correct totals", async () => {
    const user = await loadDemo();
    await user.click(screen.getByRole("button", { name: "Keep separate" }));
    expect(screen.getByLabelText("2 Added")).toBeTruthy();
    expect(screen.getByLabelText("2 Removed")).toBeTruthy();
    expect(screen.getByLabelText("1 Changed")).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Review required" }),
    ).toBeNull();
  });
  it("does not describe a pending-only comparison as unchanged", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile(csv([oldDemo[1]]), "old.csv"),
    );
    await user.upload(
      screen.getByLabelText("Revised timetable"),
      uploadFile(
        csv(newDemo.filter((s) => s.courseCode === "CS305")),
        "new.csv",
      ),
    );
    await waitFor(() =>
      expect((compareButton() as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(compareButton());
    await screen.findByRole("heading", {
      name: "Your comparison needs a review.",
    });
    expect(
      screen.queryByRole("heading", { name: "No timetable changes detected" }),
    ).toBeNull();
    expect(screen.getByLabelText("0 Changed")).toBeTruthy();
  });
  it("uploads reordered files and displays the correct no-change state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile(csv(oldDemo), "old.csv"),
    );
    await user.upload(
      screen.getByLabelText("Revised timetable"),
      uploadFile(csv([...oldDemo].reverse()), "new.csv"),
    );
    await waitFor(() =>
      expect((compareButton() as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(compareButton());
    await screen.findByRole("heading", {
      name: "No timetable changes detected",
    });
    expect(screen.getByLabelText("19 Unchanged")).toBeTruthy();
    expect(screen.getByLabelText("0 Added")).toBeTruthy();
    expect(screen.getByText("You’re all caught up.")).toBeTruthy();
  });
  it("invalid replacement clears the prior valid file and disables compare", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try the demo" }));
    expect((compareButton() as HTMLButtonElement).disabled).toBe(false);
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile("Name,Grade\nAlex,A", "wrong.csv"),
    );
    await screen.findByRole("alert");
    expect((compareButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("previous-timetable.xlsx")).toBeNull();
  });
  it("shows exact invalid rows and keeps comparison disabled", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile(csv(oldDemo).replace("2026-09-15", "2026-02-30")),
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Row 2: invalid date");
    expect((compareButton() as HTMLButtonElement).disabled).toBe(true);
  });
  it("a late upload completion cannot overwrite a newer selection", async () => {
    const user = userEvent.setup(),
      original = parser.parseTimetable;
    let finish: (
      value: Awaited<ReturnType<typeof original>>,
    ) => void = () => {};
    vi.spyOn(parser, "parseTimetable")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(original);
    render(<App />);
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile(csv(oldDemo), "slow.csv"),
    );
    await user.upload(
      screen.getByLabelText("Previous timetable"),
      uploadFile(csv(oldDemo), "latest.csv"),
    );
    await screen.findByText("latest.csv");
    finish({ name: "slow.csv", sessions: oldDemo, warnings: [] });
    await waitFor(() => expect(screen.queryByText("slow.csv")).toBeNull());
  });
  it("room-label confirmation preserves originals in the audit trail", async () => {
    const user = await loadDemo();
    await user.click(screen.getByRole("button", { name: "Confirm match" }));
    const card = screen.getByRole("article", { name: "CS201 ROOM CHANGED" });
    await user.click(
      within(card).getByText("Could these be two names for the same room?"),
    );
    await user.click(
      within(card).getByRole("button", {
        name: "Confirm these labels mean the same room",
      }),
    );
    expect(
      screen.queryByRole("article", { name: "CS201 ROOM CHANGED" }),
    ).toBeNull();
    expect(screen.getByLabelText("17 Unchanged")).toBeTruthy();
    expect(screen.getByText("Room equivalence confirmed by you.")).toBeTruthy();
  });
});
