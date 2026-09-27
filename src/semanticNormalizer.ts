import { normalizeRoom } from "./normalization";
import { differentNumbers, validSuggestion } from "../shared/semantic.mjs";
import type { SemanticNormalization } from "../shared/semantic.mjs";
export type { SemanticNormalization };

export class SemanticNormalizer {
  constructor(private fetchImpl: typeof fetch = fetch) {}
  async compareLabels(a: string, b: string): Promise<SemanticNormalization> {
    const normalizedA = normalizeRoom(a),
      normalizedB = normalizeRoom(b);
    if (normalizedA === normalizedB)
      return {
        equivalent: true,
        normalizedA,
        normalizedB,
        confidence: 1,
        reason: "Equivalent by deterministic normalization.",
      };
    if (differentNumbers(a, b))
      return {
        equivalent: false,
        normalizedA,
        normalizedB,
        confidence: 1,
        reason: "Room numbers differ.",
      };
    const response = await this.fetchImpl("/api/normalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a, b }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "AI assistance is unavailable. You can still decide whether these labels mean the same room.",
      );
    const value: unknown = await response.json();
    if (!validSuggestion(value))
      throw new Error(
        "AI returned an invalid suggestion. Original room values are unchanged.",
      );
    return value;
  }
}
