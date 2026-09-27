export type Session = {
  id: string;
  courseCode: string;
  section: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  normalizedCourseCode: string;
  normalizedSection: string;
  normalizedDate: string;
  normalizedDay: string;
  normalizedStartTime: string;
  normalizedEndTime: string;
  normalizedRoom: string;
};

export type FieldChange = { field: string; oldValue: string; newValue: string };
export type ResultType = "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
export type ChangeResult = {
  id: string;
  type: ResultType;
  oldSession?: Session;
  newSession?: Session;
  changes?: FieldChange[];
  confidence: number;
  requiresConfirmation: boolean;
  alternatives?: Session[];
  confirmed?: boolean;
  roomConfirmed?: boolean;
};

export type MatchDecision = {
  oldId: string;
  newId: string;
  action: "match" | "separate";
};

export type ParsedFile = {
  name: string;
  sessions: Session[];
  warnings: string[];
};
