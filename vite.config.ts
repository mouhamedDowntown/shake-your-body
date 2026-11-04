/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true lets Codespaces forward the dev server port to your browser
  server: { host: true, port: 5173 },
  test: { environment: "node" },
});
