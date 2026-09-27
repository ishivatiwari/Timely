import { describe, it, expect, vi } from "vitest";
import { SemanticNormalizer } from "./semanticNormalizer";
const suggestion = {
  equivalent: true,
  normalizedA: "computer lab",
  normalizedB: "computer lab",
  confidence: 0.96,
  reason: "Equivalent laboratory names.",
};
describe("SemanticNormalizer boundary", () => {
  it("does not call AI for deterministic equivalence or conflicting room numbers", async () => {
    const fetcher = vi.fn(),
      normalizer = new SemanticNormalizer(fetcher);
    expect(
      (await normalizer.compareLabels("Comp. Laboratory", "Computer Lab"))
        .equivalent,
    ).toBe(true);
    expect((await normalizer.compareLabels("Lab 2", "Lab 3")).equivalent).toBe(
      false,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends only the two labels and returns validated structured data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => suggestion });
    expect(
      await new SemanticNormalizer(fetcher).compareLabels(
        "Computing Suite",
        "Computer Lab",
      ),
    ).toEqual(suggestion);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      a: "Computing Suite",
      b: "Computer Lab",
    });
  });
  it.each([
    { ...suggestion, confidence: 1.2 },
    { ...suggestion, equivalent: "yes" },
    { ...suggestion, normalizedB: "Invented" },
    { ...suggestion, session: { course: "CS201" } },
    null,
  ])("rejects malformed model data", async (value) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => value });
    await expect(
      new SemanticNormalizer(fetcher).compareLabels(
        "Computing Suite",
        "Computer Lab",
      ),
    ).rejects.toThrow("invalid suggestion");
  });
  it("preserves low confidence and handles service failure", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...suggestion,
        equivalent: null,
        normalizedA: null,
        normalizedB: null,
        confidence: 0.41,
      }),
    });
    expect(
      (
        await new SemanticNormalizer(fetcher).compareLabels(
          "Science",
          "Physics",
        )
      ).equivalent,
    ).toBe(null);
    fetcher.mockResolvedValue({ ok: false });
    await expect(
      new SemanticNormalizer(fetcher).compareLabels("Science", "Physics"),
    ).rejects.toThrow("unavailable");
  });
});
