import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createApiHandler } from "./api.mjs";

const root = resolve("dist");
const api = createApiHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
});
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const server = http.createServer((req, res) => {
  void api(req, res, async () => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let target = resolve(root, "." + pathname);
      if (target !== root && !target.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (target === root || !extname(target))
        target = resolve(root, "index.html");
      if (!(await stat(target)).isFile()) throw new Error("Missing file");
      const body = await readFile(target);
      res.writeHead(200, {
        "Content-Type": types[extname(target)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log("Timely: http://127.0.0.1:" + (process.env.PORT || 4173)),
);
