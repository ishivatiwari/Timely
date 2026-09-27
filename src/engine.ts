import type {
  ChangeResult,
  FieldChange,
  Session,
  MatchDecision,
} from "./types";
export {
  makeSession,
  normalizeDay,
  normalizeRoom,
  normalizeDate,
  normalizeTime,
} from "./normalization";

export const comparedFields: [keyof Session, keyof Session, string][] = [
  ["normalizedCourseCode", "courseCode", "Course"],
  ["normalizedSection", "section", "Section"],
  ["normalizedDate", "date", "Date"],
  ["normalizedDay", "day", "Day"],
  ["normalizedStartTime", "startTime", "Start time"],
  ["normalizedEndTime", "endTime", "End time"],
  ["normalizedRoom", "room", "Room"],
];
export const fingerprint = (s: Session) =>
  JSON.stringify(comparedFields.map(([field]) => s[field]));
const stableKey = (s: Session) => fingerprint(s) + s.id;
const daysApart = (a: string, b: string) =>
  Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

export function detectChanges(
  oldSession: Session,
  newSession: Session,
): FieldChange[] {
  return comparedFields
    .filter(([normalized]) => oldSession[normalized] !== newSession[normalized])
    .map(([, original, field]) => ({
      field,
      oldValue: oldSession[original],
      newValue: newSession[original],
    }));
}

function similarCode(a: string, b: string) {
  return (
    a.length === b.length &&
    a.length >= 4 &&
    [...a].filter((v, i) => v !== b[i]).length === 1 &&
    a.slice(0, 2) === b.slice(0, 2)
  );
}

export function candidateScore(a: Session, b: Session) {
  const course = a.normalizedCourseCode === b.normalizedCourseCode,
    section = a.normalizedSection === b.normalizedSection;
  const date = a.normalizedDate === b.normalizedDate,
    start = a.normalizedStartTime === b.normalizedStartTime;
  const end = a.normalizedEndTime === b.normalizedEndTime,
    room = !!a.normalizedRoom && a.normalizedRoom === b.normalizedRoom;
  const day = a.normalizedDay === b.normalizedDay;
  // Changed course or section is only a proposal with all remaining anchors equal.
  if (!course || !section)
    return date &&
      start &&
      end &&
      room &&
      day &&
      ((course && !section) ||
        (section &&
          similarCode(a.normalizedCourseCode, b.normalizedCourseCode)))
      ? 0.78
      : 0;
  if (date && start && end) return 0.99;
  if (date) return 0.92;
  if (daysApart(a.normalizedDate, b.normalizedDate) <= 14)
    return 0.74 + (start ? 0.05 : 0) + (end ? 0.03 : 0) + (room ? 0.03 : 0);
  return 0;
}

export type MatchPlan = {
  pairs: {
    oldSession: Session;
    newSession: Session;
    confidence: number;
    confirmed: boolean;
  }[];
  reviews: ChangeResult[];
  removed: Session[];
  added: Session[];
};

export function matchSessions(
  oldSessions: Session[],
  newSessions: Session[],
  decisions: MatchDecision[] = [],
): MatchPlan {
  const old = [...oldSessions].sort((a, b) =>
    stableKey(a).localeCompare(stableKey(b)),
  );
  const next = [...newSessions].sort((a, b) =>
    stableKey(a).localeCompare(stableKey(b)),
  );
  const oldLeft = new Set(old),
    newLeft = new Set(next);
  const pairs: MatchPlan["pairs"] = [];
  const allowed = (a: Session, b: Session) =>
    !decisions.some(
      (d) => d.oldId === a.id && d.newId === b.id && d.action === "separate",
    );
  const pair = (
    a: Session,
    b: Session,
    confidence: number,
    confirmed = false,
  ) => {
    oldLeft.delete(a);
    newLeft.delete(b);
    pairs.push({ oldSession: a, newSession: b, confidence, confirmed });
  };
  for (const decision of decisions.filter((d) => d.action === "match")) {
    const a = old.find((s) => s.id === decision.oldId),
      b = next.find((s) => s.id === decision.newId);
    if (a && b && oldLeft.has(a) && newLeft.has(b))
      pair(a, b, candidateScore(a, b), true);
  }
  // Full normalized equality first: duplicate occurrences form a multiset.
  for (const a of oldLeft) {
    const b = [...newLeft].find(
      (b) => fingerprint(a) === fingerprint(b) && allowed(a, b),
    );
    if (b) pair(a, b, 1);
  }
  const edges = [...oldLeft]
    .flatMap((a) =>
      [...newLeft]
        .filter((b) => allowed(a, b))
        .map((b) => ({ a, b, score: candidateScore(a, b) })),
    )
    .filter((c) => c.score >= 0.7);
  // Margins use the complete graph; consuming a row must not manufacture certainty.
  const automatic = edges.filter(
    (c) =>
      c.score >= 0.9 &&
      !edges.some(
        (other) =>
          other !== c &&
          (other.a === c.a || other.b === c.b) &&
          other.score >= c.score - 0.08,
      ),
  );
  for (const c of automatic)
    if (oldLeft.has(c.a) && newLeft.has(c.b)) pair(c.a, c.b, c.score);
  const pendingNew = new Set<Session>(),
    pendingOld = new Set<Session>();
  const reviews: ChangeResult[] = [];
  for (const a of oldLeft) {
    const choices = edges
      .filter((c) => c.a === a && newLeft.has(c.b))
      .sort(
        (x, y) =>
          y.score - x.score || stableKey(x.b).localeCompare(stableKey(y.b)),
      );
    if (!choices.length) continue;
    pendingOld.add(a);
    choices.forEach((c) => pendingNew.add(c.b));
    reviews.push({
      id: `review:${a.id}`,
      type: "CHANGED",
      oldSession: a,
      newSession: choices[0].b,
      alternatives: choices.map((c) => c.b),
      confidence: choices[0].score,
      requiresConfirmation: true,
    });
  }
  return {
    pairs,
    reviews,
    removed: [...oldLeft].filter((s) => !pendingOld.has(s)),
    added: [...newLeft].filter((s) => !pendingNew.has(s)),
  };
}

export function classifyPlan(plan: MatchPlan): ChangeResult[] {
  const paired = plan.pairs.map(
    ({ oldSession, newSession, confidence, confirmed }): ChangeResult => {
      const changes = detectChanges(oldSession, newSession);
      return {
        id: `pair:${oldSession.id}:${newSession.id}`,
        type: changes.length ? "CHANGED" : "UNCHANGED",
        oldSession,
        newSession,
        changes,
        confidence,
        requiresConfirmation: false,
        confirmed,
      };
    },
  );
  return [
    ...paired,
    ...plan.reviews,
    ...plan.removed.map((s): ChangeResult => ({
      id: `removed:${s.id}`,
      type: "REMOVED",
      oldSession: s,
      confidence: 1,
      requiresConfirmation: false,
    })),
    ...plan.added.map((s): ChangeResult => ({
      id: `added:${s.id}`,
      type: "ADDED",
      newSession: s,
      confidence: 1,
      requiresConfirmation: false,
    })),
  ];
}

export function compareSessions(
  old: Session[],
  next: Session[],
  decisions: MatchDecision[] = [],
) {
  return classifyPlan(matchSessions(old, next, decisions));
}
