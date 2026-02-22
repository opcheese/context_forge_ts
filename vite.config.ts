import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { execSync } from "child_process"

// VPN/self-hosted builds use base "/" and output to dist/
// Vercel builds use base "/app/" and output to site/public/app/
const isStandalone = process.env.VITE_STANDALONE === "true"

const gitCommit = execSync("git rev-parse --short HEAD").toString().trim()
const buildTime = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  base: isStandalone ? "/" : "/app/",
  build: {
    outDir: isStandalone ? "dist" : "site/public/app",
    emptyOutDir: true,
  },
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
