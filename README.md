# Spindle

A daily scripture study companion for members of The Church of Jesus Christ of Latter-day Saints — named for the spindle of the Liahona, which pointed the way.

Pick any passage in the standard works with a few taps, and Spindle prepares a Christ-centered study personalized to you: where the passage sits, its background, the people and principles in it and where they echo across all four standard works, how it testifies of the Savior, questions to ponder, and one invitation to act. Every study is saved to a journal that syncs across your devices and stays readable offline.

**This app exists to build faith** — its content is devotional, drawn from the standard works and the teachings of living prophets, and it never surfaces controversy or criticism.

## Stack

Next.js (App Router) on Vercel · Supabase (auth + Postgres with RLS) · Anthropic API (server-side only, structured outputs) · PWA with an IndexedDB journal cache · iOS shell via [Plug and Play](https://github.com/davidcblake/plug-and-play).

## Develop

```bash
cp .env.example .env.local   # fill in Supabase + Anthropic values (see SETUP.md)
pnpm install
pnpm dev
```

`pnpm test` runs the unit tests (reference building, selection validation, response parsing).

## Deploy

Push to `main` — Vercel's git integration builds and ships. First-time operator setup (Supabase project, Google OAuth, Vercel env vars) is in [SETUP.md](./SETUP.md). Build docs for agents in [CLAUDE.md](./CLAUDE.md); product spec in [docs/spindle-prd.md](./docs/spindle-prd.md).
