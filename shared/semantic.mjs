export const schema = {
  type: "object",
  properties: {
    equivalent: { type: ["boolean", "null"] },
    normalizedA: { type: ["string", "null"] },
    normalizedB: { type: ["string", "null"] },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: [
    "equivalent",
    "normalizedA",
    "normalizedB",
    "confidence",
    "reason",
  ],
  additionalProperties: false,
};

export function validSuggestion(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 5 &&
    [true, false, null].includes(value.equivalent) &&
    ["normalizedA", "normalizedB"].every(
      (k) =>
        value[k] === null ||
        (typeof value[k] === "string" && value[k].length <= 200),
    ) &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    typeof value.reason === "string" &&
    value.reason.length > 0 &&
    value.reason.length <= 400 &&
    (value.equivalent !== true ||
      (typeof value.normalizedA === "string" &&
        value.normalizedA.length > 0 &&
        value.normalizedA === value.normalizedB))
  );
}

export const differentNumbers = (a, b) =>
  JSON.stringify(a.match(/\d+/g) ?? []) !==
  JSON.stringify(b.match(/\d+/g) ?? []);
