import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import wasm from "vite-plugin-wasm";
import { VitePWA } from "vite-plugin-pwa";

const rootConfigPath = path.resolve(__dirname, "../config.json");
const rootConfig = fs.existsSync(rootConfigPath)
    ? (JSON.parse(fs.readFileSync(rootConfigPath, "utf-8")) as { api?: { backendUrl?: string } })
    : {};
const backendUrl =
    process.env.VITE_BACKEND_URL ?? rootConfig.api?.backendUrl ?? "http://localhost:8000";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        wasm(),
        VitePWA({
            registerType: "autoUpdate",
            // Use injectManifest to keep our existing manifest.webmanifest
            // Use generateSW for zero-config service worker
            strategies: "generateSW",
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
                navigateFallback: "index.html",
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                // Exclude argon2 wasm from precaching to avoid build errors
                globIgnores: ["**/*.wasm"],
            },
            manifest: false, // use existing public/manifest.webmanifest
            manifestFilename: "manifest.webmanifest",
            devOptions: {
                enabled: false, // disable in dev to avoid caching issues
            },
        }),
    ],
    define: {
        "import.meta.env.VITE_BACKEND_URL": JSON.stringify(backendUrl),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    optimizeDeps: {
        // argon2-browser ships WASM - must be excluded from esbuild pre-bundling
        // so that vite-plugin-wasm can handle it at build time.
        exclude: ["argon2-browser"],
    },
    build: {
        rollupOptions: {
            // The argon2.wasm module imports a runtime glue module internally.
            // Treat it as an external to avoid Rollup resolution failure.
            external: [/argon2\.wasm$/],
        },
    },
});
