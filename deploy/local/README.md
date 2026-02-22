# Local VPN Deployment

Deploy ContextForge on a local VPN server for PM team usage.

## Prerequisites

- Ubuntu server with Node 20+ (nvm), pnpm, git
- Docker (for Convex dashboard only)
- pm2: `npm i -g pm2`
- Claude Code CLI (for AI agent features)

## Quick Setup

```bash
# 1. Create directory structure
mkdir -p ~/contextforge/{bin,convex-data}

# 2. Download Convex backend binary
cd ~/contextforge/bin
curl -L -o convex-local-backend.zip \
  "https://github.com/get-convex/convex-backend/releases/download/precompiled-2026-02-10-4ef979b/convex-local-backend-x86_64-unknown-linux-gnu.zip"
unzip convex-local-backend.zip && chmod +x convex-local-backend && rm convex-local-backend.zip

# 3. Generate secrets
INSTANCE_SECRET=$(openssl rand -hex 32)
echo "Save this secret: $INSTANCE_SECRET"

ADMIN_KEY=$(docker run --rm --entrypoint ./generate_key \
  ghcr.io/get-convex/convex-backend:latest contextforge "$INSTANCE_SECRET")
echo "Save this admin key: $ADMIN_KEY"

# 4. Clone and build
cd ~/contextforge
git clone https://github.com/opcheese/context_forge_ts.git ContextForgeTS
cd ContextForgeTS
pnpm install
VITE_CONVEX_URL=http://192.168.87.58:3210 pnpm build:standalone

# 5. Copy deployment config
cp deploy/local/ecosystem.config.cjs ~/contextforge/
cp deploy/local/.env.example ~/contextforge/.env
# Edit ~/contextforge/.env — fill in CONVEX_INSTANCE_SECRET and CONVEX_ADMIN_KEY

# 6. Pull dashboard image
docker pull ghcr.io/get-convex/convex-dashboard:latest

# 7. Start services
cd ~/contextforge
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # auto-start on reboot (run the generated sudo command)

# 8. Push Convex functions
cd ~/contextforge/ContextForgeTS
export CONVEX_SELF_HOSTED_URL=http://192.168.87.58:3210
export CONVEX_SELF_HOSTED_ADMIN_KEY=<ADMIN_KEY>
npx convex deploy --yes

# 9. Set Convex environment variables
npx convex env set AUTH_ISSUER_URL http://192.168.87.58:3211
npx convex env set SITE_URL http://192.168.87.58:8080
npx convex env set CLAUDE_CODE_ENABLED true
npx convex env set CLAUDE_CODE_PATH /home/ubuntu/.local/bin/claude
npx convex env set OAUTH_ENABLED false
npx convex env set SKILL_SCAN_ENABLED false

# 10. Seed marketplace categories
npx convex run marketplace:seedCategories
```

## Updating

```bash
cd ~/contextforge/ContextForgeTS
git pull
pnpm install
VITE_CONVEX_URL=http://192.168.87.58:3210 pnpm build:standalone
pm2 restart contextforge-frontend

# If backend functions changed:
export CONVEX_SELF_HOSTED_URL=http://192.168.87.58:3210
export CONVEX_SELF_HOSTED_ADMIN_KEY=<ADMIN_KEY>
npx convex deploy --admin-key $CONVEX_SELF_HOSTED_ADMIN_KEY --url $CONVEX_SELF_HOSTED_URL --yes
```

**Important:** Use `pnpm build:standalone` (not `pnpm build`). The standalone build outputs to `dist/` which pm2 serves. The regular `pnpm build` outputs to `site/public/app/` for Vercel and won't update the VPN deployment.

## Verifying Deployment

After deploying, check **Settings > About** (bottom of page) to confirm the correct git commit hash and build time.

## Access

- App: http://192.168.87.58:8080 (requires VPN)
- Convex Dashboard: http://192.168.87.58:6791 (requires VPN)

### Test Account

- Email: `test@contextforge.com`
- Password: `TestUser123!`
- Name: `Test User`

## Logs

```bash
pm2 logs                         # all logs
pm2 logs convex-backend          # backend only
pm2 logs contextforge-frontend   # frontend only
pm2 logs convex-dashboard        # dashboard only
```

## Troubleshooting

```bash
pm2 status           # check process status
pm2 restart all      # restart everything
pm2 delete all       # stop and remove all processes
```
