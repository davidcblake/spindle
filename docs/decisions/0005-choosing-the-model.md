# 0005 — Choosing the model, and changing it without code

**Date:** 2026-10-10
**Status:** Accepted. Asked for by Dave; written by the Builder.

## The problem

Every study and plan was prepared by one model named in code (`claude-sonnet-5`), and the
two web routes each carried their own copy of the call. Changing the model meant a code
change in three places. Meanwhile the cheapest current model, Claude Haiku 5.5, costs about
a twentieth of what Sonnet 5 does — roughly 0.15¢ a study instead of 3¢ — and nobody had
looked at whether its studies are good enough.

## The decision

**The model is a setting, per task, in Vercel.**

| Setting | Means |
|---|---|
| `SPINDLE_STUDY_MODEL` | the model that prepares studies |
| `SPINDLE_PLAN_MODEL` | the model that prepares plans |
| `ANTHROPIC_MODEL` | both, where the two above are unset (what it always meant) |
| `SPINDLE_STEP_UP_MODEL` | what a failed first try steps up to (default `claude-sonnet-5-5`) |
| `SPINDLE_STUDY_EFFORT`, `SPINDLE_PLAN_EFFORT` | how hard it thinks: `low`, `medium` (default), `high`, `xhigh`, `max` |

Changing one is: Vercel → Settings → Environment Variables → edit → Redeploy. No code.

Every caller — the website and the iPhone — goes through `lib/server/generate.ts`, so one
setting changes both. Each generation logs one line in Vercel's logs naming the model and
the tokens in and out, which is what the bill is made of.

**By default Spindle picks the model per request** — Dave's decision on 2026-10-10, after
the first plan on Claude Sonnet 5 cost about 6¢:

| Request | First try | If it fails |
|---|---|---|
| a study | Claude Haiku 5.5 | Claude Sonnet 5.5 |
| a plan about talks, speakers or conference | Claude Sonnet 5.5 | — |
| any other plan | Claude Haiku 5.5 | Claude Sonnet 5.5 |

"Fails" means cut off, declined, the wrong shape, or the model service erroring; a broken
connection is not retried, since the next model would hit it too. "About talks" is a
deliberately generous keyword test (`isAboutTalks` in `lib/server/models.ts`): a scripture
plan caught by mistake costs a few cents more, a talk plan missed risks an invented title.

**Why not an AI router** that reads each request and picks a model: Spindle has two kinds of
request, not hundreds, and a router would add a second call — delay and cost — to every
one, to make a choice simple rules make instantly.

**Why the step-up cannot catch everything:** a model that confidently invents a talk title
returns a perfectly shaped answer, and no check of shape notices. That risk is met by
putting the stronger model on talk-heavy plans, and by people reading.

Any Vercel setting above still overrides the choice: a task's own setting is always tried
first, and `SPINDLE_STEP_UP_MODEL` changes what a failure steps up to.

## What to watch

Price is not the only thing a study has to get right. The General Conference section asks
the model to cite talks it is confident exist, and smaller models misremember more. A
wrong talk title in a study about faith is worse than a slow or costly one. That has to be
read, not assumed: compare Haiku's studies and plans with the Sonnet ones already in the
journal, and check conference talk titles against Gospel Library. If they slip, set
`SPINDLE_STUDY_MODEL` (or `SPINDLE_PLAN_MODEL`) back to `claude-sonnet-5` for just that task.

## Why per task

A plan is recall and ordering; a study is synthesis and testimony. They may well want
different models, and it costs nothing to be able to say so.

## What this does not do

- **Automatic fallback** to a second model when the first refuses or fails. Studies are
  short single calls; a failure shows a plain message and the person taps again.
- **A model per person**, or letting anybody but Dave choose.
- **Price tables in code.** The logged token counts and Anthropic's price page are enough,
  and prices in code go out of date silently.

## How to change it

1. Vercel → spindle → Settings → Environment Variables.
2. Add `ANTHROPIC_MODEL` (both tasks), or `SPINDLE_STUDY_MODEL` / `SPINDLE_PLAN_MODEL`
   (one task), with the model's ID — `claude-sonnet-5` to go back.
3. Redeploy.

## Revisit when

A new model generation is released, or Anthropic's prices change enough to matter.
