import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside the Next.js server build; stub it for unit tests.
      "server-only": path.resolve(__dirname, "test-support/server-only.ts"),
    },
  },
  test: { environment: "node" },
});
