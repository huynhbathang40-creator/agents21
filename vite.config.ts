import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "netlify/functions/**/*.test.ts", "shared/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
