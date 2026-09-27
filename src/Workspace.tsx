import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileSpreadsheet,
  HelpCircle,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";

type Stage = "upload" | "analyzing" | "results";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      timely<span className="brand-period">.</span>
    </span>
  );
}

export function Workspace({
  children,
  stage,
  reviewCount = 0,
}: {
  children: ReactNode;
  stage: Stage;
  reviewCount?: number;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    if (guideOpen) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [guideOpen]);
  useEffect(() => {
    if (stage === "results") content.current?.focus({ preventScroll: true });
  }, [stage]);
  const revealEvidence = () => {
    const evidence = document.getElementById("comparison-evidence");
    if (evidence instanceof HTMLDetailsElement) evidence.open = true;
  };
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
      <div className="workspace-main">
        <header className="topbar">
          <a
            href="#workspace-content"
            className="mobile-brand"
            aria-label="Timely workspace"
          >
            <Brand />
          </a>
          <div className="breadcrumb">
            <Layers3 />
            <span>Workspace</span>
            <ChevronRight />
            <strong>Timetable comparison</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-status">
              <span /> Local processing
            </span>
            <span className="topbar-divider" />
            <button
              className="guide-button"
              aria-label="Open format guide"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle />
              <span>Format guide</span>
            </button>
          </div>
        </header>
        {stage === "results" && (
          <nav className="result-jump-nav" aria-label="Comparison sections">
            {reviewCount > 0 && (
              <a href="#match-review">
                Review matches <span>{reviewCount}</span>
              </a>
            )}
            <a href="#changes">Detected changes</a>
            <a href="#comparison-evidence" onClick={revealEvidence}>
              Evidence
            </a>
          </nav>
        )}
        <main
          id="workspace-content"
          ref={content}
          tabIndex={-1}
          className={`workspace-content ${stage}-workspace`}
        >
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            <ShieldCheck /> Made for clarity. Built on trust.
          </span>
          <span>
            Timely <span className="footer-dot">·</span> What Changed?
          </span>
        </footer>
      </div>
      <dialog
        className="guide-dialog"
        ref={dialog}
        onCancel={() => setGuideOpen(false)}
        onClose={() => setGuideOpen(false)}
        aria-labelledby="guide-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) setGuideOpen(false);
        }}
      >
        <div className="guide-content">
          <div className="dialog-top">
            <span className="icon-tile">
              <FileSpreadsheet />
            </span>
            <button
              className="icon-button"
              aria-label="Close format guide"
              onClick={() => setGuideOpen(false)}
            >
              <X />
            </button>
          </div>
          <span className="step-kicker">A smooth start</span>
          <h2 id="guide-title">Get your files comparison-ready.</h2>
          <p>
            Use one worksheet with these seven column headers in the first row.
            XLSX and CSV files are supported.
          </p>
          <div className="column-chips">
            {[
              "Course Code",
              "Section",
              "Date",
              "Day",
              "Start Time",
              "End Time",
              "Room",
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <dl className="format-specs">
            <div>
              <dt>Dates</dt>
              <dd>YYYY-MM-DD, DD-Mon-YYYY, DD/MM/YYYY, or Excel dates</dd>
            </div>
            <div>
              <dt>Times</dt>
              <dd>HH:mm, h:mm AM/PM, or Excel times</dd>
            </div>
            <div>
              <dt>File limits</dt>
              <dd>500 sessions · 5 MB per file</dd>
            </div>
          </dl>
          <p className="guide-hint">
            <Check /> Extra whitespace, capitalization and reordered rows are
            handled automatically.
          </p>
          <div className="guide-downloads">
            <a
              className="outline"
              href="/demo/previous-timetable.xlsx"
              download
            >
              Previous demo <ArrowRight />
            </a>
            <a className="outline" href="/demo/revised-timetable.xlsx" download>
              Revised demo <ArrowRight />
            </a>
          </div>
          <p className="dialog-privacy">
            <LockKeyhole /> Uploaded files are processed in your browser.
          </p>
        </div>
      </dialog>
    </div>
  );
}

export function Workflow({
  stage,
  pending = false,
}: {
  stage: Stage;
  pending?: boolean;
}) {
  const active = stage === "upload" ? 0 : stage === "analyzing" ? 1 : 2;
  return (
    <ol className="workflow" aria-label="Comparison progress">
      {[
        ["Upload", "Add your two versions"],
        ["Compare", "Find meaningful differences"],
        [
          "Review",
          pending ? "Confirm uncertain matches" : "Understand what changed",
        ],
      ].map(([label, description], i) => (
        <li
          key={label}
          className={i < active ? "complete" : i === active ? "current" : ""}
          aria-current={i === active ? "step" : undefined}
        >
          <span className="workflow-number">
            {i < active ? <Check /> : String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <strong>{label}</strong>
            <span>{description}</span>
          </div>
          {i < 2 && <ChevronRight className="workflow-arrow" />}
        </li>
      ))}
    </ol>
  );
}
