# TrendScope

Find trending videos on TikTok, Instagram and YouTube, powered by the [Scrape Creators API](https://docs.scrapecreators.com). Built with React + TypeScript + Tailwind and deployed on Netlify.

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements and milestone plan.

## How deployment works

You only ever push to GitHub. Netlify watches this repo and builds and deploys everything from there. You never upload to Netlify, and you don't need the Netlify command-line tool.

- **Server code** lives in the repo under `netlify/functions/` (for example `netlify/functions/health.ts`). Netlify builds and hosts it together with the website, so there's no separate server to deploy.
- **Every push to `main`** goes live. Pull requests get temporary preview links.
- **GitHub checks (CI)** only verify quality (lint, type checks, tests, build, secret scan). They never deploy anything.
- **The API key never goes through GitHub.** It lives only in Netlify's environment variables.

### One-time Netlify setup

1. In Netlify, choose **Add new project → Import an existing project → GitHub**, then pick `huynhbathang40-creator/agents21`.
2. Set the branch to `main`. Leave the build settings alone, because `netlify.toml` supplies them.
3. Under **Environment variables**, add `SCRAPECREATORS_API_KEY` and, optionally, `APP_PASSWORD`. If Netlify shows a **Scopes** option, choose **Functions** only.

After your first deploy, open `/api/health` on the site. It should return `"status": "ok"` and `"apiKeyConfigured": true`.

## Local development

Requires Node 22.

```bash
npm install
cp .env.example .env   # fill in your values; .env is gitignored
npx netlify dev        # runs the site and /api functions together
```

`npm run dev` runs the website only (no `/api`).

| Command | What it does |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build into `dist/` |
| `npm run check:secrets` | Fails if `dist/` references the API key or password |

## Project layout

```
src/                 React app
shared/types.ts      Shared video data model (used by the app and the functions)
netlify/functions/   Server code, served at /api/* via netlify.toml
docs/PRD.md          Product requirements
.claude/agents/      Expert subagents used while building
```
