import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose root is site/.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
