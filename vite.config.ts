import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

// VPN/self-hosted builds use base "/" and output to dist/
// Vercel builds use base "/app/" and output to site/public/app/
const isStandalone = process.env.VITE_STANDALONE === "true"

// https://vite.dev/config/
export default defineConfig({
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
