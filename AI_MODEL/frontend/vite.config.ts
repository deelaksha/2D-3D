import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Client-only design app. Core geometry/assembly logic lives in framework-independent
// TypeScript modules under src/core so a C++/WASM engine can replace it later.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { port: 5555, strictPort: true, open: false },
  build: { target: "es2020", sourcemap: true },
});
