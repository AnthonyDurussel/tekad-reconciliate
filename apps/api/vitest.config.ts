import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["test/**/*.test.ts"],
    globals: true,
    env: {
      DATABASE_URL: "",
    },
  },
});
