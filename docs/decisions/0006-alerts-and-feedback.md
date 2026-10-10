# 0006 — Alerts to Dave's phone, and feedback from the app

**Date:** 2026-10-10
**Status:** Accepted. Asked for by Dave; written by the Builder.

## The problem

Dave found out that Spindle had run out of Anthropic credit only because a study failed
on his own phone. Nothing tells him when a study fails for someone else, when credit
runs out, or when somebody new starts using the app. The people using it also have
nowhere to suggest a feature.

## The decision

**Alerts go to Dave's phone through ntfy** (ntfy.sh). It is a free, open-source push
service with an iPhone app, and it needs no account. The server sends an alert with one
HTTPS POST to a topic. Whoever subscribes to that topic in the ntfy app gets the alert.
The topic name is the only key, so it is long and random and kept in Vercel as
`NTFY_TOPIC`. With that setting removed, alerts stop and nothing else changes.

| Alert | When | Loudness |
|---|---|---|
| Out of Anthropic credit | any study or plan hits "credit balance too low" | 5: breaks through Focus |
| Anthropic error | any other error from the model service | 4 |
| A study or plan failed | both tries failed (cut off, wrong shape, declined) | 3 |
| Couldn't reach Anthropic / rate-limited | connection or rate-limit errors | 3 |
| New Spindle iPhone | an install registers its App Attest key for the first time | 3 |
| Feedback | someone sends feedback from the app | 3 |
| Server checks failing | registering or checking an iPhone request throws | 4 |

**Feedback** is a box in the app's Settings. It goes to `/api/app/feedback`, which is
attested and limited per hour like a study. The server keeps it in `app_feedback`
(migration 0006) and sends it as an alert. Keeping it means that a missed or dismissed
alert does not lose the note. Feedback never reaches a model, so the "no free text in a
prompt" rule is untouched.

## Why not the alternatives

- **Email (Resend, SendGrid):** needs an account, a verified sending domain (Spindle has
  none yet), and an API key. It also lands in an inbox, not on the lock screen.
- **Slack or Discord webhooks:** need a workspace or server just for this.
- **Sentry or another monitoring service:** a third-party dependency, and far more than
  seven alert types call for.

ntfy can be swapped for any of these later. Everything goes through
`lib/server/notify.ts`, which is the only file that knows ntfy exists.

## What it costs

- ntfy.sh is free at this volume.
- Each alert adds up to three seconds to a request that already failed. Only failures,
  new installs and feedback send alerts, so ordinary studies are unaffected.
- Alert text passes through ntfy.sh's servers. Error messages carry no personal data.
  Feedback carries whatever the person wrote, and the privacy policy says so.

## Not done

- **New users on the website:** Dave has retired it.
- **Replying to feedback:** feedback is anonymous, like everything else on the iPhone.
- **A daily summary, or a limit on repeated alerts:** an outage sends one alert per
  failed request. At today's usage that is a handful. Revisit if it ever gets noisy.
