export type SemanticNormalization = {
  equivalent: boolean | null;
  normalizedA: string | null;
  normalizedB: string | null;
  confidence: number;
  reason: string;
};
export function validSuggestion(value: unknown): value is SemanticNormalization;
export function differentNumbers(a: string, b: string): boolean;
export const schema: object;
