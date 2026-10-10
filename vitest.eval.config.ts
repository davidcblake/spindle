import { defineConfig } from "vitest/config";
import path from "path";

/** The standing test set (evals/), run on purpose with `pnpm eval`, never by
 *  `pnpm test`: it calls the real model and costs real money. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "evals/server-only-stub.ts"),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 30 * 60 * 1000,
  },
});
