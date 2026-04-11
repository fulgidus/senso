import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: { "*.{ts,tsx,js,jsx}": "vp check --fix" },
});
