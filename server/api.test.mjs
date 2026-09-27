import { describe, it, expect, vi } from "vitest";
import http from "node:http";
import { createApiHandler, normalizeLabels } from "./api.mjs";

const suggestion = {
  equivalent: true,
  normalizedA: "computer lab",
  normalizedB: "computer lab",
  confidence: 0.96,
  reason: "Same lab label.",
};
describe("label API", () => {
  it("works offline with a clear missing-key response", async () =>
    expect((await normalizeLabels("A", "B")).status).toBe(503));
  it("uses structured output and sends no session data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            content: [
              { type: "output_text", text: JSON.stringify(suggestion) },
            ],
          },
        ],
      }),
    });
    const result = await normalizeLabels("Computing Suite", "Computer Lab", {
      apiKey: "test-only",
      fetchImpl,
    });
    expect(result.body).toEqual(suggestion);
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(request.store).toBe(false);
    expect(request.text.format.strict).toBe(true);
    expect(JSON.parse(request.input)).toEqual({
      labelA: "Computing Suite",
      labelB: "Computer Lab",
    });
  });
  it.each(["throw", "refusal", "incomplete", "invalid", "http"])(
    "fails closed for %s",
    async (mode) => {
      const fetchImpl = vi.fn(async () => {
        if (mode === "throw") throw new Error("network");
        return {
          ok: mode !== "http",
          json: async () => ({
            status: mode === "incomplete" ? "incomplete" : "completed",
            output: [
              {
                content: [
                  mode === "refusal"
                    ? { type: "refusal", refusal: "No" }
                    : { type: "output_text", text: "{}" },
                ],
              },
            ],
          }),
        };
      });
      expect(
        (await normalizeLabels("Suite", "Lab", { apiKey: "test", fetchImpl }))
          .status,
      ).toBe(502);
    },
  );
  it("rejects row payloads and foreign origins on the actual HTTP handler", async () => {
    const handler = createApiHandler();
    const server = http.createServer(
      (req, res) =>
        void handler(req, res, () => {
          res.writeHead(404);
          res.end();
        }),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
      expect(await (await fetch(base + "/api/status")).json()).toEqual({
        semanticAI: false,
      });
      const post = (body, headers = {}) =>
        fetch(base + "/api/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
        });
      expect((await post({ a: "Lab", b: "Suite", rows: [] })).status).toBe(400);
      expect(
        (
          await post(
            { a: "Lab", b: "Suite" },
            { Origin: "https://unrelated.example" },
          )
        ).status,
      ).toBe(403);
      expect((await post({ a: "Lab", b: "Suite" })).status).toBe(503);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
