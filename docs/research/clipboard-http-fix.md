# Clipboard Not Working on HTTP (VPN Server)

## Problem

`navigator.clipboard.writeText()` requires a secure context (HTTPS or localhost). On the VPN server (`http://192.168.87.58:8080`), the browser blocks all clipboard operations silently.

Affected locations:
- `src/components/ContextExport.tsx:34` — "Copy to Clipboard" button
- `src/components/BrainstormDialog.tsx:74` — copy brainstorm message
- `src/routes/app/index.tsx:280` — copy block content

## Options

### Option 1: HTTPS proxy

Add nginx or caddy in front of the frontend with a self-signed certificate. Browsers will warn about the cert but clipboard will work once accepted.

- Proper long-term fix
- More infra to maintain (cert, reverse proxy config, pm2 process or systemd)
- Could also benefit other browser APIs that require secure context

### Option 2: `document.execCommand('copy')` fallback

Create a utility function that tries `navigator.clipboard.writeText()` first, falls back to creating a temporary `<textarea>`, selecting its content, and running `document.execCommand('copy')`.

- Works on HTTP immediately
- `execCommand` is deprecated in spec but universally supported (too much of the web relies on it)
- One-time utility, swap all 3 call sites
- No functional disadvantage for text-only clipboard use
