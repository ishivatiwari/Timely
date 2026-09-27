import { classifyPlan, matchSessions } from "./engine";
import type { MatchDecision, ParsedFile } from "./types";

export async function analyzeTimetables(
  previous: ParsedFile,
  revised: ParsedFile,
  onStep: (completed: number) => void,
  yieldToUI: () => Promise<void> = () => Promise.resolve(),
  decisions: MatchDecision[] = [],
) {
  if (!previous.sessions.length || !revised.sessions.length)
    throw new Error("Both timetables must contain validated sessions.");
  // Parsing and normalization were completed at upload; report facts, not timers.
  onStep(2);
  await yieldToUI();
  const plan = matchSessions(previous.sessions, revised.sessions, decisions);
  onStep(3);
  await yieldToUI();
  const results = classifyPlan(plan);
  onStep(4);
  await yieldToUI();
  const consumed = new Set<string>();
  for (const result of results.filter(
    (r) => !r.requiresConfirmation && r.newSession,
  )) {
    if (consumed.has(result.newSession!.id))
      throw new Error("A session was matched more than once.");
    consumed.add(result.newSession!.id);
  }
  onStep(5);
  await yieldToUI();
  return results;
}
