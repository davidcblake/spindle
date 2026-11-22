# 0007 — Reading Stackd's meal photos on this server

**Date:** 2026-11-22
**Status:** Accepted. Asked for by Dave ("reuse Spindle's server"); written by the Builder.

## The problem

Stackd, Dave's personal health tracker (`davidcblake/stackd-ios`), logs a meal from a
photo. That needs Claude, and the Anthropic key must never be on a phone. Stackd has no
server of its own. This one already holds a key, already proves requests come from a
genuine install with App Attest (decisions 0002–0004), and already alerts Dave.

## The decision

Two routes for Stackd, beside Spindle's:

- `POST /api/stackd/register` — registers a Stackd install's App Attest key, checked
  against **Stackd's App ID** (`TEAMID.com.wpv.stackd`). The challenge comes from the
  existing `/api/app/challenge`, which is the same for both apps.
- `POST /api/stackd/meal` — a photo in, an estimate out: the plate's name, items, calories,
  protein, sugar, a calorie range and a confidence. 30 an hour per install.

Keys share `device_keys`. A key attested for one app fails every assertion checked for
the other (the App ID is inside what Apple signs), so Spindle and Stackd cannot spend
each other's allowance or reach each other's routes.

## The rules carried over

- **No words from the phone reach the prompt.** Only the photo is sent — the same
  principle as studies (CLAUDE.md rule 3).
- **The photo is not kept.** It goes to the model and is discarded.
- **Estimates are labelled as estimates** on the phone, with the range, and nothing is
  logged until Dave confirms.
- The faith guardrail in `prompt.ts` is for doctrinal content; describing a plate of food
  is not, so it does not apply here. The meal prompt has its own rule: describe the food,
  never give medical or dietary advice.

## The model

Claude Opus 5.5 by default (`MEAL_MODEL` in `lib/server/meal.ts`), at medium effort.
One short request per photo for one person is cents a month, and accuracy is the point.
`STACKD_MEAL_MODEL` in Vercel switches it — `claude-haiku-5-5` is roughly forty times
cheaper — without a deploy of the app.

## What Dave does

Run `supabase/migrations/0007_meal_photos.sql` in the Supabase SQL editor (it allows the
new `meal` use), then redeploy. `APPLE_TEAM_ID` and `APP_SERVER_SECRET` are already set
for Spindle and are shared. SETUP.md §8.
