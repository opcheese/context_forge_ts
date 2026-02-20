# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities through [GitHub Security Advisories](https://github.com/opcheese/context_forge_ts/security/advisories/new).

**Do not** open a public issue for security vulnerabilities.

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

## Response

We'll acknowledge your report within 7 days and aim to release a fix within 30 days for confirmed vulnerabilities. We'll credit you in the fix unless you prefer to remain anonymous.

## Scope

This policy covers the ContextForge application code and the hosted instance at convexforgets.com. It does not cover third-party services (Convex, Vercel, OpenRouter) — please report vulnerabilities in those services directly to their maintainers.

## Important Note

ContextForge stores LLM API keys (OpenRouter) in your browser's localStorage. This is by design — keys never touch our servers. However, this means any XSS vulnerability could expose user API keys. We treat XSS as a critical severity issue.
