import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Download,
  GitCompareArrows,
  ListFilter,
  MapPin,
  Minus,
  Plus,
  Undo2,
} from "lucide-react";
import { compareSessions, comparedFields } from "./engine";
import { Workspace, Workflow } from "./Workspace";
import { analyzeTimetables } from "./pipeline";
import { oldDemo, newDemo } from "./demo";
import { SemanticNormalizer } from "./semanticNormalizer";
import type { SemanticNormalization } from "./semanticNormalizer";
import type { ChangeResult, MatchDecision, ParsedFile, Session } from "./types";

type UploadError = { message: string; issues: string[] };
type Side = "old" | "new";
const emptyCounts = { ADDED: 0, REMOVED: 0, CHANGED: 0, UNCHANGED: 0 };
const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const expectedColumns =
  "Course Code · Section · Date · Day · Start Time · End Time · Room";

export default function App() {
  const [files, setFiles] = useState<Record<Side, ParsedFile | null>>({
    old: null,
    new: null,
  });
  const [busy, setBusy] = useState<Record<Side, boolean>>({
    old: false,
    new: false,
  });
  const [errors, setErrors] = useState<Partial<Record<Side, UploadError>>>({});
  const [results, setResults] = useState<ChangeResult[] | null>(null);
  const [phase, setPhase] = useState<"upload" | "analyzing" | "results">(
      "upload",
    ),
    [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState<MatchDecision[]>([]);
  const [roomPairs, setRoomPairs] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState("");
  const [history, setHistory] = useState<
    { decisions: MatchDecision[]; roomPairs: string[] }[]
  >([]);
  const [notice, setNotice] = useState("");
  const [aiAvailable, setAiAvailable] = useState(false);
  const [course, setCourse] = useState(""),
    [section, setSection] = useState(""),
    [kind, setKind] = useState("");
  const versions = useRef({ old: 0, new: 0 });
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (alive) setAiAvailable(v?.semanticAI === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const upload = async (side: Side, file: File) => {
    const version = ++versions.current[side];
    setFiles((f) => ({ ...f, [side]: null }));
    setErrors((e) => ({ ...e, [side]: undefined }));
    setBusy((b) => ({ ...b, [side]: true }));
    setAnalysisError("");
    try {
      const { parseTimetable } = await import("./parser");
      const value = await parseTimetable(file);
      if (versions.current[side] === version)
        setFiles((f) => ({ ...f, [side]: value }));
    } catch (error) {
      if (versions.current[side] === version) {
        const value = error as Error & { issues?: string[] };
        setErrors((e) => ({
          ...e,
          [side]: {
            message: value.message || "This file could not be read.",
            issues: value.issues ?? [],
          },
        }));
      }
    } finally {
      if (versions.current[side] === version)
        setBusy((b) => ({ ...b, [side]: false }));
    }
  };

  const removeFile = (side: Side) => {
    versions.current[side]++;
    setFiles((f) => ({ ...f, [side]: null }));
    setBusy((b) => ({ ...b, [side]: false }));
    setErrors((e) => ({ ...e, [side]: undefined }));
  };
  const run = async () => {
    if (!files.old || !files.new || busy.old || busy.new) return;
    setAnalysisError("");
    setPhase("analyzing");
    setStep(2);
    setDecisions([]);
    setRoomPairs([]);
    setHistory([]);
    setNotice("");
    try {
      const next = await analyzeTimetables(
        files.old,
        files.new,
        setStep,
        nextPaint,
      );
      setResults(next);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setAnalysisError((error as Error).message);
      setPhase("upload");
    }
  };
  const useDemo = () => {
    versions.current.old++;
    versions.current.new++;
    setBusy({ old: false, new: false });
    setErrors({});
    setAnalysisError("");
    setFiles({
      old: { name: "previous-timetable.xlsx", sessions: oldDemo, warnings: [] },
      new: { name: "revised-timetable.xlsx", sessions: newDemo, warnings: [] },
    });
  };
  const reset = () => {
    versions.current.old++;
    versions.current.new++;
    setFiles({ old: null, new: null });
    setBusy({ old: false, new: false });
    setErrors({});
    setResults(null);
    setPhase("upload");
    setDecisions([]);
    setRoomPairs([]);
    setCourse("");
    setSection("");
    setKind("");
    setAnalysisError("");
    setHistory([]);
    setNotice("");
  };
  const applyRooms = (items: ChangeResult[], pairs: string[]) =>
    items.map((r) => {
      if (!pairs.includes(r.id) || r.requiresConfirmation) return r;
      const changes = r.changes?.filter((c) => c.field !== "Room") ?? [];
      return {
        ...r,
        changes,
        type: changes.length ? ("CHANGED" as const) : ("UNCHANGED" as const),
        roomConfirmed: true,
      };
    });
  const resolveMatch = (
    oldId: string,
    newId: string,
    action: MatchDecision["action"],
  ) => {
    if (!files.old || !files.new) return;
    setHistory((h) => [...h, { decisions, roomPairs }]);
    setNotice(
      action === "match"
        ? "Session match confirmed. Your results are updated."
        : "Sessions kept separate. Remaining candidates have been updated.",
    );
    const next = [...decisions, { oldId, newId, action }];
    setDecisions(next);
    setResults(
      applyRooms(
        compareSessions(files.old.sessions, files.new.sessions, next),
        roomPairs,
      ),
    );
    setCourse("");
    setSection("");
    setKind("");
  };
  const sameRoom = (id: string) => {
    setHistory((h) => [...h, { decisions, roomPairs }]);
    setNotice(
      "Room equivalence confirmed. Original labels remain in comparison evidence.",
    );
    setCourse("");
    setSection("");
    setKind("");
    const next = [...roomPairs, id];
    setRoomPairs(next);
    setResults((current) => (current ? applyRooms(current, next) : current));
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous || !files.old || !files.new) return;
    setDecisions(previous.decisions);
    setRoomPairs(previous.roomPairs);
    setHistory((h) => h.slice(0, -1));
    setResults(
      applyRooms(
        compareSessions(
          files.old.sessions,
          files.new.sessions,
          previous.decisions,
        ),
        previous.roomPairs,
      ),
    );
    setNotice("Last review decision undone.");
    setCourse("");
    setSection("");
    setKind("");
  };
  if (phase === "analyzing") return <Analyzing step={step} />;
  if (phase === "results" && results && files.old && files.new)
    return (
      <Results
        results={results}
        files={{ old: files.old, new: files.new }}
        resolve={resolveMatch}
        sameRoom={sameRoom}
        aiAvailable={aiAvailable}
        course={course}
        setCourse={setCourse}
        section={section}
        setSection={setSection}
        kind={kind}
        setKind={setKind}
        reset={reset}
        canUndo={history.length > 0}
        undo={undo}
        notice={notice}
      />
    );

  const readyCount = Number(!!files.old) + Number(!!files.new);
  return (
    <Workspace stage="upload">
      <section className="page-intro">
        <div>
          <div className="eyebrow">
            <span /> CLARITY FOR YOUR NEXT CLASS
          </div>
          <h1>
            Every change. <em>Clearly understood.</em>
          </h1>
          <p>
            Compare two versions. See exactly what moved, what’s new, and what
            stayed the same.
          </p>
        </div>
      </section>
      <Workflow stage="upload" />
      <div className="upload-layout">
        <section className="upload-shell" aria-label="Compare timetables">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="icon-tile">
                <FileSpreadsheet />
              </span>
              <div>
                <h2>Add your timetables</h2>
                <p>Start with the original and the latest version.</p>
              </div>
            </div>
            <span
              className={`ready-badge ${readyCount === 2 ? "complete" : ""}`}
            >
              {readyCount === 2 ? <Check /> : <span className="small-dot" />}
              {readyCount}/2 ready
            </span>
          </div>
          <div className="upload-grid">
            <UploadCard
              label="Previous timetable"
              caption="The original version"
              value={files.old}
              error={errors.old}
              busy={busy.old}
              onFile={(f) => void upload("old", f)}
              onRemove={() => removeFile("old")}
              number="01"
            />
            <div className="between" aria-hidden="true">
              <ArrowRight />
            </div>
            <UploadCard
              label="Revised timetable"
              caption="The latest version"
              value={files.new}
              error={errors.new}
              busy={busy.new}
              onFile={(f) => void upload("new", f)}
              onRemove={() => removeFile("new")}
              number="02"
            />
          </div>
          <div className="demo-banner">
            <span className="demo-icon">
              <Sparkles />
            </span>
            <div>
              <strong>Take a look with sample data</strong>
              <p>See room changes, rescheduling, and a match to review.</p>
            </div>
            <button className="text-button" onClick={useDemo}>
              Try the demo <ArrowUpRight size={15} />
            </button>
          </div>
          {analysisError && (
            <p role="alert" className="error">
              {analysisError}
            </p>
          )}
          <div className="comparison-action">
            <div className="readiness-copy" role="status">
              <span
                className={
                  readyCount === 2 ? "readiness-icon ready" : "readiness-icon"
                }
              >
                {readyCount === 2 ? <Check /> : <FileSpreadsheet />}
              </span>
              <div>
                <strong>
                  {busy.old || busy.new
                    ? "Checking your files…"
                    : readyCount === 2
                      ? "All set. Let’s find what changed."
                      : "Your comparison starts here"}
                </strong>
                <p>
                  {readyCount === 2
                    ? "Both timetables have passed validation."
                    : "Add both files to enable comparison."}
                </p>
              </div>
            </div>
            <button
              className="primary"
              disabled={readyCount !== 2 || busy.old || busy.new}
              onClick={() => void run()}
            >
              <span>Compare timetables</span>
              <ArrowRight size={18} />
            </button>
          </div>
          <p className="privacy">
            <LockKeyhole size={13} /> Your files stay on this device. No
            permanent storage.
          </p>
        </section>
        <aside className="upload-context" aria-label="Comparison guidance">
          <section className="trust-card">
            <div className="trust-card-top">
              <ShieldCheck />
              <span>BUILT FOR CONFIDENCE</span>
            </div>
            <h2>
              Less noise.
              <br />
              More certainty.
            </h2>
            <p>
              Know exactly what moved, what’s new, and what stayed the same.
            </p>
            <div className="trust-points">
              <div>
                <Check />
                <span>Row reordering is ignored</span>
              </div>
              <div>
                <Check />
                <span>Every change is explained</span>
              </div>
              <div>
                <Check />
                <span>Uncertain matches come to you</span>
              </div>
            </div>
            <div className="trust-card-bottom">
              <span className="small-dot" /> You make the final call.
            </div>
          </section>
          <details className="format-help" id="format-guide">
            <summary>
              <FileSpreadsheet />
              <span>File requirements</span>
              <ChevronDown />
            </summary>
            <div className="format-body">
              <p>One worksheet. Headers in the first row:</p>
              <div className="column-chips">
                {expectedColumns.split(" · ").map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <p>
                Dates: YYYY-MM-DD, DD-Mon-YYYY, or DD/MM/YYYY. Times: HH:mm or
                h:mm AM/PM. Excel date and time cells are supported.
              </p>
            </div>
          </details>
          <div className="sample-downloads">
            <span className="nav-label">NEED AN EXAMPLE?</span>
            <a href="/demo/previous-timetable.xlsx" download>
              <FileSpreadsheet /> Previous demo <Download />
            </a>
            <a href="/demo/revised-timetable.xlsx" download>
              <FileSpreadsheet /> Revised demo <Download />
            </a>
          </div>
        </aside>
      </div>
      <div className="confidence-strip">
        <span>
          <ShieldCheck /> Explainable by design
        </span>
        <span>
          <GitCompareArrows /> Order-independent matching
        </span>
        <span>
          <LockKeyhole /> Files processed locally
        </span>
      </div>
    </Workspace>
  );
}

function UploadCard({
  label,
  caption,
  value,
  error,
  busy,
  onFile,
  onRemove,
  number,
}: {
  label: string;
  caption: string;
  value: ParsedFile | null;
  error?: UploadError;
  busy: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
  number: string;
}) {
  const input = useRef<HTMLInputElement>(null),
    [drag, setDrag] = useState(false);
  return (
    <div
      className={`upload-card ${drag ? "dragging" : ""} ${value ? "ready" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="card-top">
        <div>
          <span className="upload-number">{number}</span>
          <span>{label}</span>
        </div>
        {(value || busy || error) && (
          <button
            className="icon-button remove-file"
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={onRemove}
          >
            <X />
          </button>
        )}
      </div>
      <p className="card-caption">{caption}</p>
      <input
        ref={input}
        type="file"
        aria-label={label}
        accept=".xlsx,.csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <button
        className="dropzone"
        aria-label={`Upload ${label.toLowerCase()}`}
        onClick={() => input.current?.click()}
        aria-busy={busy}
      >
        {busy ? (
          <>
            <span className="file-icon loading">
              <FileSpreadsheet />
            </span>
            <strong>Reading and validating…</strong>
            <small>Checking every row</small>
          </>
        ) : value ? (
          <>
            <span className="file-icon success">
              <Check />
            </span>
            <strong>{value.name}</strong>
            <small className="validated-label">
              <Check size={13} />
              {value.sessions.length} sessions · Validated
            </small>
            <span className="replace">Replace file</span>
          </>
        ) : (
          <>
            <span className="file-icon">
              <Upload />
            </span>
            <strong>Drag & drop your file</strong>
            <span className="browse-file">
              or <span>browse files</span>
            </span>
            <small>
              XLSX or CSV <span>·</span> Up to 5 MB
            </small>
          </>
        )}
      </button>
      {!!value?.warnings.length && (
        <details className="warning">
          <summary>
            {value.warnings.length} validation note
            {value.warnings.length === 1 ? "" : "s"} <ChevronDown size={12} />
          </summary>
          <ul>
            {value.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <div role="alert" className="upload-error">
          <p>
            <CircleAlert size={15} />
            {error.message}
          </p>
          {!!error.issues.length && (
            <ul>
              {error.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
          <small>Expected: {expectedColumns}</small>
        </div>
      )}
    </div>
  );
}

function Analyzing({ step }: { step: number }) {
  const labels = [
    "Reading spreadsheets",
    "Normalizing timetable data",
    "Matching sessions",
    "Detecting changes",
    "Checking uncertain matches",
  ];
  return (
    <Workspace stage="analyzing">
      <Workflow stage="analyzing" />
      <section className="analysis-page">
        <div className="analysis-card" role="status" aria-live="polite">
          <div className="scan-icon">
            <FileSpreadsheet />
            <span />
          </div>
          <span className="step-kicker">Timely is comparing</span>
          <h2>Finding what actually changed</h2>
          <p>Row order won’t affect your results.</p>
          <div className="steps">
            {labels.map((label, i) => (
              <div
                className={i < step ? "done" : i === step ? "active" : ""}
                key={label}
              >
                <span>{i < step ? <Check /> : i + 1}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    </Workspace>
  );
}

type ResultsProps = {
  results: ChangeResult[];
  files: { old: ParsedFile; new: ParsedFile };
  resolve: (
    oldId: string,
    newId: string,
    action: MatchDecision["action"],
  ) => void;
  sameRoom: (id: string) => void;
  aiAvailable: boolean;
  course: string;
  setCourse: (s: string) => void;
  section: string;
  setSection: (s: string) => void;
  kind: string;
  setKind: (s: string) => void;
  reset: () => void;
  canUndo: boolean;
  undo: () => void;
  notice: string;
};
function Results({
  results,
  files,
  resolve,
  sameRoom,
  aiAvailable,
  course,
  setCourse,
  section,
  setSection,
  kind,
  setKind,
  reset,
  canUndo,
  undo,
  notice,
}: ResultsProps) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) feedback.current?.focus({ preventScroll: true });
  }, [notice, results]);
  const review = results.filter((r) => r.requiresConfirmation),
    settled = results.filter((r) => !r.requiresConfirmation),
    counts = { ...emptyCounts };
  settled.forEach((r) => counts[r.type]++);
  const changed = settled.filter((r) => r.type !== "UNCHANGED");
  const allSessions = changed.flatMap(
    (r) => [r.oldSession, r.newSession].filter(Boolean) as Session[],
  );
  const courses = [
      ...new Set(allSessions.map((s) => s.normalizedCourseCode)),
    ].sort(),
    sections = [...new Set(allSessions.map((s) => s.normalizedSection))].sort();
  const visible = changed
    .filter((r) =>
      [r.oldSession, r.newSession].some(
        (s) => s && (!course || s.normalizedCourseCode === course),
      ),
    )
    .filter((r) =>
      [r.oldSession, r.newSession].some(
        (s) => s && (!section || s.normalizedSection === section),
      ),
    )
    .filter((r) => !kind || r.type === kind)
    .sort(
      (a, b) =>
        (a.newSession ?? a.oldSession)!.normalizedDate.localeCompare(
          (b.newSession ?? b.oldSession)!.normalizedDate,
        ) ||
        (a.newSession ?? a.oldSession)!.normalizedCourseCode.localeCompare(
          (b.newSession ?? b.oldSession)!.normalizedCourseCode,
        ),
    );
  const meaningful = counts.ADDED + counts.REMOVED + counts.CHANGED;
  const heading = review.length
    ? "Your comparison needs a review."
    : meaningful
      ? "Your timetable changed."
      : "No timetable changes detected";
  return (
    <Workspace stage="results" reviewCount={review.length}>
      <div className="results-wrap">
        <Workflow stage="results" pending={review.length > 0} />
        <div className="results-head">
          <div>
            <span className="step-kicker">
              <span className="small-dot" />{" "}
              {review.length
                ? "COMPARISON READY · REVIEW PENDING"
                : "COMPARISON COMPLETE"}
            </span>
            <h1>{heading}</h1>
            <p>
              {review.length ? (
                <>
                  {meaningful} confirmed changes so far. Final counts depend on
                  your decisions below.
                </>
              ) : meaningful ? (
                <>
                  We found <strong>{meaningful} meaningful changes</strong>.
                </>
              ) : (
                "The two timetables contain the same sessions. Row ordering differences were ignored."
              )}
            </p>
          </div>
          <button className="outline" onClick={reset}>
            <RotateCcw /> New comparison
          </button>
        </div>
        <div className="file-pair">
          <div>
            <span className="file-label">PREVIOUS</span>
            <FileSpreadsheet />
            <span title={files.old.name}>{files.old.name}</span>
            <small>{files.old.sessions.length} sessions</small>
          </div>
          <ArrowRight className="file-pair-arrow" />
          <div>
            <span className="file-label">REVISED</span>
            <FileSpreadsheet />
            <span title={files.new.name}>{files.new.name}</span>
            <small>{files.new.sessions.length} sessions</small>
          </div>
        </div>
        {notice && (
          <div
            className="decision-notice"
            role="status"
            ref={feedback}
            tabIndex={-1}
          >
            <Check />
            <span>{notice}</span>
            {canUndo && (
              <button className="text-button" onClick={undo}>
                <Undo2 /> Undo last decision
              </button>
            )}
          </div>
        )}
        <div
          className="stats"
          aria-label={
            review.length
              ? "Provisional comparison counts"
              : "Comparison counts"
          }
        >
          <Stat n={counts.ADDED} label="Added" tone="green" />
          <Stat n={counts.REMOVED} label="Removed" tone="red" />
          <Stat n={counts.CHANGED} label="Changed" tone="blue" />
          <Stat n={counts.UNCHANGED} label="Unchanged" tone="gray" />
        </div>
        {!!review.length && (
          <section
            className="review"
            aria-label="Review required"
            id="match-review"
          >
            <div className="review-title">
              <span>
                <CircleAlert />
              </span>
              <div>
                <small>Review required</small>
                <h2>
                  {review.length} session{review.length === 1 ? "" : "s"} need
                  confirmation
                </h2>
                <p>
                  Select the revised session, then confirm the match or keep
                  that pair separate.
                </p>
              </div>
            </div>
            {review.map((r) => (
              <ReviewCard
                key={r.id + ":" + r.alternatives?.map((s) => s.id).join("|")}
                result={r}
                resolve={resolve}
              />
            ))}
          </section>
        )}
        <section
          className="changes-section"
          id="changes"
          aria-label="Confirmed changes"
        >
          <div className="changes-title">
            <div>
              <span className="step-kicker">THE DETAILS THAT MATTER</span>
              <h2>
                {visible.length} change{visible.length === 1 ? "" : "s"} to
                review
              </h2>
            </div>
            <span className="results-count">
              {changed.length} total confirmed changes
            </span>
          </div>
          <div className="filter-bar">
            <div className="filter-label">
              <ListFilter /> Filter changes
            </div>
            <div className="filters">
              <Select
                label="Course"
                value={course}
                set={setCourse}
                values={courses}
                all="All Courses"
              />
              <Select
                label="Section"
                value={section}
                set={setSection}
                values={sections}
                all="All Sections"
              />
              <Select
                label="Change type"
                value={kind}
                set={setKind}
                values={["ADDED", "REMOVED", "CHANGED"]}
                all="All Changes"
              />
            </div>
            {(course || section || kind) && (
              <button
                className="clear-filters"
                onClick={() => {
                  setCourse("");
                  setSection("");
                  setKind("");
                }}
              >
                <X /> Clear filters
              </button>
            )}
          </div>
          <div className="filter-summary" aria-live="polite">
            Showing {visible.length} of {changed.length} confirmed changes
            {review.length > 0 && (
              <span>{review.length} awaiting confirmation</span>
            )}
          </div>
          <div className="change-list">
            {visible.map((r) => (
              <ChangeCard
                key={r.id}
                result={r}
                aiAvailable={aiAvailable}
                sameRoom={() => sameRoom(r.id)}
              />
            ))}
            {!visible.length && (
              <div className="filtered-empty">
                <ShieldCheck />
                <h3>
                  {review.length && !meaningful
                    ? "Resolve the possible matches above"
                    : !meaningful
                      ? "You’re all caught up."
                      : "No changes match these filters"}
                </h3>
                <p>
                  {!meaningful
                    ? review.length
                      ? "Uncertain sessions are excluded from the counts until you decide."
                      : "Reordered rows and equivalent formatting did not create changes."
                    : "Try a different course, section, or change type."}
                </p>
              </div>
            )}
          </div>
        </section>
        <details className="audit" id="comparison-evidence">
          <summary>
            Comparison evidence · {counts.UNCHANGED} unchanged sessions{" "}
            <ChevronDown size={14} />
          </summary>
          <p>
            Matching uses normalized fields. Original spreadsheet values remain
            below, including harmless label variations.
          </p>
          {settled
            .filter((r) => r.type === "UNCHANGED")
            .map((r) => (
              <div className="audit-row" key={r.id}>
                <SessionView label="Previous" session={r.oldSession!} />
                <SessionView label="Revised" session={r.newSession!} />
                {r.roomConfirmed && (
                  <small>Room equivalence confirmed by you.</small>
                )}
              </div>
            ))}
        </details>
        {files.old.warnings.length + files.new.warnings.length > 0 && (
          <details className="audit">
            <summary>
              Validation notes <ChevronDown size={14} />
            </summary>
            {[files.old, files.new].map((f, i) => (
              <div key={i}>
                <h3>{f.name}</h3>
                <ul>
                  {f.warnings.map((w, j) => (
                    <li key={j}>{w}</li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        )}
      </div>
    </Workspace>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`stat ${tone}`} aria-label={`${n} ${label}`}>
      <div className="stat-header">
        <span className="stat-icon">
          {label === "Added" ? (
            <Plus />
          ) : label === "Removed" ? (
            <Minus />
          ) : label === "Changed" ? (
            <GitCompareArrows />
          ) : (
            <Check />
          )}
        </span>
        <small>{label}</small>
      </div>
      <div className="stat-number">
        <strong>{String(n).padStart(2, "0")}</strong>
        <span>
          {label === "Unchanged"
            ? "Nothing to act on"
            : label === "Changed"
              ? "Details updated"
              : label === "Added"
                ? "New sessions"
                : "No longer scheduled"}
        </span>
      </div>
    </div>
  );
}
function Select({
  label,
  value,
  set,
  values,
  all,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  values: string[];
  all: string;
}) {
  return (
    <label className="select">
      <span className="select-label">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{all}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v === "ADDED"
              ? "Added"
              : v === "REMOVED"
                ? "Removed"
                : v === "CHANGED"
                  ? "Changed"
                  : v}
          </option>
        ))}
      </select>
      <ChevronDown />
    </label>
  );
}
function SessionView({
  label,
  session: s,
}: {
  label: string;
  session: Session;
}) {
  return (
    <div
      className={`review-session ${label.toLowerCase().includes("new") || label === "Revised" ? "revised-session" : "previous-session"}`}
    >
      <small className="session-version">{label}</small>
      <strong>
        {s.courseCode} <span>Section {s.section}</span>
      </strong>
      <span className="session-detail">
        <CalendarDays />
        {s.day}
        <span className="session-separator">·</span>
        {s.date}
      </span>
      <span className="session-detail">
        <Clock3 />
        {s.startTime}–{s.endTime}
      </span>
      <span className="session-detail">
        <MapPin />
        {s.room || "Room not specified"}
      </span>
    </div>
  );
}

function ReviewCard({
  result,
  resolve,
}: {
  result: ChangeResult;
  resolve: ResultsProps["resolve"];
}) {
  const [selected, setSelected] = useState(result.newSession!.id),
    options = result.alternatives ?? [result.newSession!];
  const candidate = options.find((s) => s.id === selected) ?? options[0];
  return (
    <article
      className="review-card"
      aria-label={`Possible match for ${result.oldSession!.courseCode}`}
    >
      <SessionView label="Previous session" session={result.oldSession!} />
      <ArrowRight className="review-arrow" />
      <div>
        {options.length > 1 && (
          <label className="candidate-label">
            Possible revised sessions
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseCode} · {s.date} · {s.startTime} · {s.room}
                </option>
              ))}
            </select>
          </label>
        )}
        <SessionView label="Possible new session" session={candidate} />
      </div>
      <div className="review-actions">
        <button
          className="confirm"
          onClick={() => resolve(result.oldSession!.id, candidate.id, "match")}
        >
          <Check /> Confirm match
        </button>
        <button
          onClick={() =>
            resolve(result.oldSession!.id, candidate.id, "separate")
          }
        >
          <X /> Keep separate
        </button>
      </div>
    </article>
  );
}
function ChangeCard({
  result: r,
  aiAvailable,
  sameRoom,
}: {
  result: ChangeResult;
  aiAvailable: boolean;
  sameRoom: () => void;
}) {
  const session = r.newSession ?? r.oldSession!,
    temporal =
      r.changes?.filter((c) =>
        ["Date", "Day", "Start time", "End time"].includes(c.field),
      ) ?? [];
  const label =
    r.type === "CHANGED"
      ? temporal.length >= 2
        ? "RESCHEDULED"
        : r.changes?.length === 1
          ? `${r.changes[0].field.toUpperCase()} CHANGED`
          : "DETAILS CHANGED"
      : r.type;
  return (
    <article
      className={`change-card ${r.type.toLowerCase()}`}
      aria-label={`${session.courseCode} ${label}`}
    >
      <div className="change-side">
        <span className="change-icon">
          {r.type === "ADDED" ? (
            <Plus />
          ) : r.type === "REMOVED" ? (
            <Minus />
          ) : temporal.length ? (
            <Clock3 />
          ) : (
            <MapPin />
          )}
        </span>
        <span>{label}</span>
        <small>
          {r.confirmed
            ? "Match confirmed by you"
            : r.type === "CHANGED"
              ? "High-confidence match"
              : "Session record"}
        </small>
      </div>
      <div className="change-body">
        <div className="course-line">
          <h3>
            {session.courseCode} <span>· Section {session.section}</span>
          </h3>
          <span className={`pill ${r.type.toLowerCase()}`}>{label}</span>
        </div>
        {r.type === "CHANGED" ? (
          <>
            <div className="session-comparison">
              <SessionView label="Previous" session={r.oldSession!} />
              <SessionView label="Revised" session={r.newSession!} />
            </div>
            <div className="diffs">
              {r.changes?.map((c) => (
                <div className="diff" key={c.field}>
                  <small>{c.field}</small>
                  <div>
                    <span>{c.oldValue || "Not specified"}</span>
                    <ArrowRight />
                    <strong>{c.newValue || "Not specified"}</strong>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="single-session">
            <SessionView
              label={r.type === "ADDED" ? "Revised" : "Previous"}
              session={session}
            />
          </div>
        )}
        {r.changes?.some((c) => c.field === "Room") && (
          <RoomReview
            a={r.oldSession!.room}
            b={r.newSession!.room}
            aiAvailable={aiAvailable}
            sameRoom={sameRoom}
          />
        )}
        {r.roomConfirmed && (
          <p className="room-note">
            Room equivalence confirmed by you; original labels are preserved.
          </p>
        )}
        <details>
          <summary>
            Why was this classified this way?
            <ChevronDown />
          </summary>
          {r.oldSession && r.newSession ? (
            <>
              <p>
                {r.confirmed
                  ? "You confirmed this session match."
                  : "The strongest candidate had no close competing match. Confidence bands are rules, not statistical probabilities."}
              </p>
              <ul>
                {comparedFields.map(([normalized, , label]) => (
                  <li key={label}>
                    {label}:{" "}
                    {label === "Room" && r.roomConfirmed
                      ? "equivalent (confirmed by you)"
                      : r.oldSession![normalized] === r.newSession![normalized]
                        ? "equivalent"
                        : "different"}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              No corresponding session remains in the{" "}
              {r.type === "ADDED" ? "previous" : "revised"} timetable after
              matching and your review decisions.
            </p>
          )}
        </details>
      </div>
    </article>
  );
}
function RoomReview({
  a,
  b,
  aiAvailable,
  sameRoom,
}: {
  a: string;
  b: string;
  aiAvailable: boolean;
  sameRoom: () => void;
}) {
  const [suggestion, setSuggestion] = useState<SemanticNormalization | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    setError("");
    try {
      setSuggestion(await new SemanticNormalizer().compareLabels(a, b));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="room-review">
      <summary>
        Could these be two names for the same room?
        <ChevronDown />
      </summary>
      <p>
        Original labels: “{a || "Not specified"}” → “{b || "Not specified"}”.
        Only confirm equivalence if you know they refer to the same place.
      </p>
      {aiAvailable && a && b && (
        <>
          <p>
            Optional AI help sends only these two room labels to OpenAI. Timely
            does not save them; provider data policies apply.
          </p>
          <button
            className="outline"
            disabled={busy}
            onClick={() => void ask()}
          >
            <Sparkles size={14} />
            {busy ? "Checking labels…" : "Ask AI about these two labels"}
          </button>
        </>
      )}
      {suggestion && (
        <p role="status">
          AI suggestion:{" "}
          {suggestion.equivalent === null || suggestion.confidence < 0.9
            ? "Uncertain — your judgment is needed."
            : suggestion.equivalent
              ? "Likely the same room."
              : "Likely different rooms."}{" "}
          {suggestion.reason} No values have been changed.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="text-button room-confirm" onClick={sameRoom}>
        Confirm these labels mean the same room
      </button>
    </details>
  );
}
