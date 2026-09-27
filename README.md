# Timely — What Changed?

A focused timetable comparison prototype. Upload the previous and revised
timetables, review uncertain matches, and filter the confirmed changes.

## Run

Node.js 22.12+ is required (verified with Node 24).

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local address printed by Vite, usually http://127.0.0.1:5173.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

The production server serves the built application at http://127.0.0.1:4173.
Both development and production servers bind to localhost. No database,
authentication, or cloud services are needed for comparison.

## Demo

Click **Try the demo**, then **Compare timetables**. The demo has 19 sessions
in each file (20 distinct session identities across both versions):

- 1 added: CS410
- 1 removed: CS220
- 1 automatic room change: CS201, Room 204 → Room 305
- 1 proposed reschedule: CS305, Monday 10:00 → Tuesday 14:00
- 16 unchanged, including reordered rows and Computer Lab / Comp. Laboratory

The initial counts are provisional. Confirm CS305 to get **1 Added, 1 Removed,
2 Changed, 16 Unchanged**. Reject it to get **2 Added, 2 Removed, 1 Changed,
16 Unchanged**.

Download real XLSX files from the format help on the upload page.
`public/demo` also contains CSV versions, a reorder-only file, and a
multi-candidate ambiguity example. Regenerate these synthetic files with
`npm.cmd run demo`.

Suggested judge flow:

1. Upload the two downloadable demo spreadsheets.
2. Compare, show the provisional counts and exact room difference.
3. Confirm the proposed reschedule and show the final counts.
4. Filter CS201, then section B, then Removed.
5. Open comparison evidence to inspect unchanged original values.
6. Start a new comparison using previous-timetable and reordered-only; show zero changes.
7. Use ambiguous-previous / ambiguous-revised to select between two candidates.

## Interface and review controls

The interface uses compact top navigation and a three-stage upload / compare /
review indicator. A shorter intro and tighter card spacing keep the comparison
controls higher on the page. Blue and emerald accents distinguish the previous
and revised versions. Upload cards stack on small screens; before-and-after
session panels, filters, and review actions adapt for narrow widths. Results
include quick links to review matches, detected changes, and evidence.

- Open **Format guide** from any stage without losing your comparison.
- Remove or replace either uploaded file independently. Removing a file
  invalidates any pending parse for that slot.
- Use **Clear filters** to return to all confirmed changes.
- Use **Undo last decision** to reverse a session match, a rejected pairing,
  or a room-equivalence decision. Undo history stays only in memory.
- Status notices distinguish confirmed results from sessions awaiting review.
- Keyboard focus indicators, a skip link, labelled controls, native modal
  dialogs, reduced-motion styles, and larger touch targets support navigation.

The design uses local system fonts and does not fetch fonts from an external
service. Browser screenshots and actual-device layout checks remain pending
because the connected browser tool is unavailable. DOM tests verify the new
controls; the test environment shims native dialog open/close behavior and
does not verify browser focus trapping.

## Supported input

One worksheet, with a header in row 1:

```text
Course Code | Section | Date | Day | Start Time | End Time | Room
```

XLSX and CSV are accepted, up to 5 MB and 500 data rows per file.
Capitalization, spaces, underscores, and the Course / Course Code alias are
accepted. Arbitrary timetable layouts, merged layouts, formula cells, PDF,
and OCR are unsupported.

Dates: YYYY-MM-DD, DD-Mon-YYYY, DD Month YYYY, DD/MM/YYYY, or native Excel dates.
Slash dates always mean day/month/year. Times use 24-hour HH:mm, h:mm AM/PM,
or native Excel time values. Sessions must end after they start on the same day.

Malformed rows block comparison and show exact row numbers. No valid subset is
silently compared. Empty rows are ignored with a note. Duplicate occurrences are
retained and reported. Blank rooms are allowed and shown as not specified.
Inconsistent date/weekday values produce a warning; neither value is invented
or overwritten. Displayed spreadsheet values remain visible alongside separate
normalized comparison keys.

## Matching and uncertainty

1. Match full normalized equality first, preserving duplicate multiplicity.
2. Score remaining candidates deterministically, heavily weighting course
   and section. A unique same-date candidate can match automatically.
3. Use the complete candidate graph to check competing candidates. An
   ambiguous match cannot become certain just because another row was reserved.
4. Nearby-date reschedules are proposed for human review. Distant or unrelated
   rows stay separate. Narrow course-code corrections or section changes require
   identical date, day, time and nonempty room anchors, plus human confirmation.
5. Show every candidate for an uncertain old session. Confirming consumes the
   chosen pair once; rejecting excludes only that pair and exposes remaining
   alternatives. Recompute after each decision.
6. Classify field differences with ordinary code. Unresolved rows do not count
   as confirmed changes, additions, removals, or unchanged sessions.

Scores are heuristic confidence bands, not calibrated probabilities. Inputs
have no stable session ID, so some reschedules and course changes cannot be
inferred confidently. The UI exposes that uncertainty instead of inventing
identity. Matching, filtering and classification never call an AI model.

## Optional AI label assistance

The app works without an API key. For real AI suggestions, copy
`.env.example` to `.env`, set your own `OPENAI_API_KEY`, and restart the
server. Never prefix the key with `VITE_`. `OPENAI_MODEL` is configurable;
the default is `gpt-4o-mini`.

In a room-change card, expand **Could these be two names for the same room?**
and click **Ask AI about these two labels**. The UI discloses exactly what is
sent. Deterministic aliases and conflicting numbers are handled locally first.
Only the two unresolved room labels can reach the API—no files, rows, dates,
times, course codes, or sections. The server rejects additional fields.

The server uses the OpenAI Responses API with a strict JSON schema and
`store:false`. It validates the returned values independently. Refusals,
malformed output, low confidence, timeouts, and upstream failures leave original
values untouched. AI output is a suggestion; a human must explicitly confirm
equivalence before the deterministic diff excludes that room difference.
The original labels remain in the evidence view.

No live model request has been verified in this workspace because no API key
was configured. Tests exercise the provider boundary using synthetic responses,
including failure cases. Provider access and billing depend on your account.

Implementation reference:
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Privacy and dependency notes

Uploaded workbooks are parsed only in browser memory. Timely does not store
uploads or send them to a server. Resetting the comparison clears application
references. Optional label requests are not logged or persisted by this app;
the external provider's data policies still apply.

The patched SheetJS 0.20.3 package is installed from its
[official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
The older npm registry release was removed. Versions and lockfile make builds
reproducible. The server includes small payload limits, same-origin checks,
concurrency limits, request limits, and a provider timeout for local demo use.

## Verification

Run `npm.cmd test` for normalization, parsing of actual XLSX/CSV bytes, matching,
pipeline stages, React interactions, and server API tests. React interaction
tests use a DOM environment; they do not replace visual browser inspection.
The connected browser tool was unavailable during implementation, so screenshot
and physical-device layout checks remain unverified.
