/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true lets Codespaces forward the dev server port to your browser;
  // strictPort because the desktop app (Tauri) expects exactly 5173
  server: { host: true, port: 5173, strictPort: true },
  clearScreen: false,
  build: {
    // index.html = the app, pill.html = the desktop floating pill
    rollupOptions: { input: { main: "index.html", pill: "pill.html" } },
  },
  test: { environment: "node" },
});
