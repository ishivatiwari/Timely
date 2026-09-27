import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApiHandler } from "./server/api.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      {
        name: "timely-label-api",
        configureServer(server) {
          server.middlewares.use(
            createApiHandler({
              apiKey: env.OPENAI_API_KEY,
              model: env.OPENAI_MODEL,
            }),
          );
        },
        configurePreviewServer(server) {
          server.middlewares.use(
            createApiHandler({
              apiKey: env.OPENAI_API_KEY,
              model: env.OPENAI_MODEL,
            }),
          );
        },
      },
    ],
    server: { host: "127.0.0.1" },
  };
});
