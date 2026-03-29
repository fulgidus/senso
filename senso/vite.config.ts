import path from "path"
import fs from "fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const rootConfigPath = path.resolve(__dirname, "../config.json")
const rootConfig = fs.existsSync(rootConfigPath)
    ? (JSON.parse(fs.readFileSync(rootConfigPath, "utf-8")) as { api?: { backendUrl?: string } })
    : {}
const backendUrl =
    process.env.VITE_BACKEND_URL ??
    rootConfig.api?.backendUrl ??
    "http://localhost:8000"

const gitSha = process.env.VITE_GIT_SHA ?? "unknown"

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        "import.meta.env.VITE_BACKEND_URL": JSON.stringify(backendUrl),
        "import.meta.env.VITE_GIT_SHA": JSON.stringify(gitSha),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
