// pm2 ecosystem config for local VPN deployment
// Copy to ~/contextforge/ on the server and fill in .env values
//
// Usage:
//   cp ecosystem.config.cjs ~/contextforge/
//   cp .env.example ~/contextforge/.env
//   # Edit ~/contextforge/.env with real values
//   cd ~/contextforge && pm2 start ecosystem.config.cjs

const path = require("path")

// Simple .env parser (avoids dotenv dependency)
const fs = require("fs")
const envPath = path.join(__dirname, ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const INSTANCE_SECRET = process.env.CONVEX_INSTANCE_SECRET
const SERVER_IP = process.env.SERVER_IP || "192.168.87.58"
const BASE_DIR = process.env.BASE_DIR || path.join(require("os").homedir(), "contextforge")

if (!INSTANCE_SECRET) {
  console.error("ERROR: CONVEX_INSTANCE_SECRET not set in .env")
  process.exit(1)
}

module.exports = {
  apps: [
    {
      name: "convex-backend",
      script: path.join(BASE_DIR, "bin/convex-local-backend"),
      args: [
        "--instance-name", "contextforge",
        "--instance-secret", INSTANCE_SECRET,
        "--local-storage", path.join(BASE_DIR, "convex-data"),
        "--port", "3210",
        "--site-proxy-port", "3211",
        "--convex-origin", `http://${SERVER_IP}:3210`,
        "--convex-site", `http://${SERVER_IP}:3211`,
        "--disable-beacon",
        path.join(BASE_DIR, "convex-data/db.sqlite3"),
      ].join(" "),
      cwd: BASE_DIR,
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      env: {
        ACTIONS_USER_TIMEOUT_SECS: "120",
        HTTP_SERVER_TIMEOUT_SECONDS: "120",
      },
    },
    {
      name: "contextforge-frontend",
      script: "pnpm",
      args: "preview --host 0.0.0.0 --port 8080",
      cwd: path.join(BASE_DIR, "ContextForgeTS"),
      interpreter: "none",
      autorestart: true,
      env: {
        PATH: process.env.PATH,
      },
    },
    {
      name: "convex-dashboard",
      script: "docker",
      args: [
        "run", "--rm",
        "--name", "convex-dashboard",
        "-p", "6791:6791",
        "-e", `NEXT_PUBLIC_DEPLOYMENT_URL=http://${SERVER_IP}:3210`,
        "ghcr.io/get-convex/convex-dashboard:latest",
      ].join(" "),
      interpreter: "none",
      autorestart: true,
    },
  ],
}
