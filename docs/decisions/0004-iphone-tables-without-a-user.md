# 0004 — Reaching the iPhone's tables when there is no user

**Date:** 2026-10-08
**Status:** Accepted. Written by the Builder; open to challenge in an issue.
**Answers:** the question `0003` left open.

## The problem

This repository's rule is that RLS *is* the authorization layer and the app runtime holds
no service-role key. Both rest on there being a signed-in user for RLS to check. An iPhone
caller has no user (`0001`), so there is no `auth.uid()`, and owner-only policies have no
owner. Yet the server has to record attested keys, used challenges and usage counts.

## The decision

**Tables with RLS on and no policies, reached only through `security definer` functions,
each of which first checks a secret only the Vercel server holds** (`APP_SERVER_SECRET`).
Migration `0005`.

- Through the API, the four tables are unreachable by anybody: no policy means no rows.
- The five functions are callable with the anon key — the same key the web app already
  ships to every browser — but each refuses unless handed the secret, whose SHA-256 is all
  the database keeps.
- Each function does one narrow thing: issue a challenge, use one up, register a key, read
  a key, spend a key. Nothing in them can read a journal, a profile or another table.

## Why not the service-role key

It bypasses every RLS policy on every table, including the web app's journals. A leak of
it is a leak of everybody's journal. A leak of `APP_SERVER_SECRET` lets somebody register
fake keys and spend Spindle's Anthropic budget — bad, but bounded, and fixed by changing
one value in Vercel and one row in Postgres.

## Why not leave the functions open to the anon key

Then anybody could call `app_register_key` directly and skip attestation entirely, which
would make `0002` decoration.

## What it costs

A second secret to keep: in Vercel's environment, and its hash in `app_server_secret`.
`SETUP.md` says how.

## Revisit when

Supabase offers a narrower credential than the service-role key for server-only work, or
the iPhone app gains accounts.
