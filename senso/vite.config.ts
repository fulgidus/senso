import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import wasm from "vite-plugin-wasm";

const rootConfigPath = path.resolve(__dirname, "../config.json");
const rootConfig = fs.existsSync(rootConfigPath)
  ? (JSON.parse(fs.readFileSync(rootConfigPath, "utf-8")) as { api?: { backendUrl?: string } })
  : {};
const backendUrl =
  process.env.VITE_BACKEND_URL ?? rootConfig.api?.backendUrl ?? "http://localhost:8000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  define: {
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify(backendUrl),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
