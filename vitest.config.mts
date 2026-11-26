import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/contexts/**", "src/platform/**", "src/shared/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/__tests__/**", "**/index.ts"],
      thresholds: {
        statements: 75,
        lines: 75,
        "src/contexts/footage/domain/**": { statements: 90, lines: 90 },
        "src/contexts/footage/workflows/**": { statements: 85, lines: 85 },
        "src/contexts/footage/adapters/**": { statements: 70, lines: 70 },
        "src/contexts/footage/ui/**": { statements: 60, lines: 60 },
        "src/contexts/composition/domain/**": { statements: 80, lines: 80 },
        "src/contexts/composition/workflows/**": { statements: 85, lines: 85 },
        "src/contexts/composition/ui/**": { statements: 60, lines: 60 },
        "src/contexts/rendering/adapters/**": { statements: 70, lines: 70 },
        "src/contexts/rendering/workflows/**": { statements: 85, lines: 85 },
        "src/contexts/rendering/ui/**": { statements: 60, lines: 60 },
        "src/contexts/access/domain/**": { statements: 90, lines: 90 },
        "src/contexts/access/workflows/**": { statements: 85, lines: 85 },
        "src/contexts/access/adapters/**": { statements: 70, lines: 70 },
        "src/contexts/access/ui/**": { statements: 60, lines: 60 },
        "src/contexts/workspace/ui/**": { statements: 70, lines: 70 },
      },
    },
  },
});
