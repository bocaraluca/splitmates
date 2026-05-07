import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ["./src/test-db/global-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/app/page.tsx",
        "src/app/layout.tsx",
        "src/app/globals.css",
        "src/lib/splitmates/model/**",
        "src/lib/splitmates/**/types.ts",
        "src/lib/splitmates/services/auth/index.ts",
        "src/lib/splitmates/services/generator/index.ts",
      ],
    },
  },
});
