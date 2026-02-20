# Privacy Policy

*Last updated: February 2026*

## What ContextForge Is

ContextForge is an open-source context management tool for LLM interactions. This policy covers the hosted version at convexforgets.com.

## What Data We Collect

### Account Data
- **Email and password** when you create an account (password is hashed, never stored in plain text)
- **GitHub or Google profile info** (name, email, avatar) if you sign in via OAuth when available

### Content You Create
- Context blocks, templates, sessions, projects, and workflows you build in the app
- Marketplace submissions if you choose to publish content publicly

### What Stays on Your Device (We Never See It)
- Your OpenRouter API key
- Your Ollama server URL and model preferences
- UI preferences and session state

## Third-Party Services

| Service | What it does | Their privacy policy |
|---------|-------------|---------------------|
| [Convex](https://www.convex.dev) | Database and backend | [convex.dev/legal/privacy](https://www.convex.dev/legal/privacy) |
| [Vercel](https://vercel.com) | Hosting | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |

**LLM providers**: ContextForge does not proxy your LLM calls through our servers. When you use OpenRouter, your browser communicates directly using your own API key. When you use Ollama, everything stays on your machine. We have no access to your prompts or LLM responses.

## What We Don't Do

- We don't sell your data
- We don't use cookies (we use localStorage, which never leaves your browser)
- We don't train AI models on your content

## Data Deletion

You can request deletion of your account and all associated data by [opening a GitHub issue](https://github.com/opcheese/context_forge_ts/issues/new?template=data-deletion.yml).

## Contact

For privacy questions, [open an issue on GitHub](https://github.com/opcheese/context_forge_ts/issues).

## Changes

We'll update this policy as the product evolves. Changes are tracked in the git history of this file.
