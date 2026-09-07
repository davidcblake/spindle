# 0001 — Rebuilding Spindle natively on Plug and Play

**Date:** 2026-09-07
**Status:** Proposed — the decision in §3 is Dave's, and everything else waits on it.

## What this proposes

Spindle becomes a native SwiftUI iPhone app built on the
[Plug and Play foundation](https://github.com/davidcblake/plug-and-play-ios),
released through TestFlight before any App Store submission. The web app keeps
running while that happens.

## 1. Why not simply ship the shell that already exists

`.github/workflows/ios-build.yml` builds a Capacitor shell in **remote mode** — it
loads `spindlestudy.vercel.app`, so the binary contains no app. That is the shape App
Review is most hostile to under **guideline 4.2, Minimum Functionality**, and it is the
one thing the foundation's own decision `0001` forbids outright.

Two further blockers apply to *any* submission of Spindle as it stands today, and are
worth knowing whichever path wins:

- **In-app account deletion** is required by guideline 5.1.1(v) for any app that lets
  somebody create an account. Spindle creates Supabase accounts. Nothing in the codebase
  deletes one.
- **A privacy policy** URL and accurate privacy labels are required. Spindle stores
  journal entries and sends passages and profile text to Anthropic.

## 2. What Spindle takes from the foundation, and what it builds itself

This is the split that decides whether the foundation was worth building.

**Takes from the foundation**

| Module | What Spindle uses it for |
|---|---|
| `PPCore` | Logging, the two-voice error split, feature flags — Spindle already has kill switches |
| `PPDesign` | The family look; Spindle's own tokens in §7 of the PRD map onto it |
| `PPData` | The journal on SwiftData, synced to the person's own iCloud, and the sync provider shipped today |
| `PPNotify` | A daily reminder to study. Local, on a schedule — no push, no server |
| `PPInput` | Dictation for thoughts and notes. The PRD already leans on iOS dictation |
| `PPOnboard` | The profile questions, asked once on first run |

**Builds itself**

Passage selection across the standard works, the study JSON contract, the ten-section
study view, Gospel Library deep links, study plans, and export.

If that split holds, the foundation is doing its job. **If Spindle ends up reaching
around it or reimplementing pieces of it, that goes in the foundation's roadmap plainly**
— it is much cheaper to learn on app one than on app four.

## 3. The decision everything else hangs on: where the journal lives

Spindle's data is `profiles`, `journal_entries`, `entry_notes`, `study_plans` and
`plan_items`. Every one is owner-only under RLS. **Nothing is shared between people** —
which means CloudKit's private database fits exactly, and the sharing work that is
blocked elsewhere in the foundation is not needed here at all.

### Option A — the journal lives in iCloud, and there are no accounts *(recommended)*

The journal and profile live in SwiftData, mirrored to the person's own iCloud. There is
no sign-in screen, because iCloud is the account.

What that buys, beyond a simpler app:

- **The App Store blockers largely evaporate.** No account creation means 5.1.1(v) does
  not apply; the privacy labels shrink to what the generation call actually sends; and
  nothing of somebody's scripture journal sits in a database we operate. For a devotional
  app that is not a technicality — it is the promise.
- It is exactly what `PPData` was built for, so the rebuild proves the foundation rather
  than working around it.

What it costs:

- **The web app and the phone app become two different journals.** A journal written on
  the web will not appear on the phone.
- **The generation API needs a new way to authenticate and rate-limit a caller.** Today
  `/api/study` reads a Supabase session and saves the study server-side. A native caller
  with no Supabase account needs something else, and the study gets saved on the device
  instead.

### Option B — keep Supabase

One journal across web and phone, and everybody who already has entries keeps them.

The cost is that the native app reimplements the offline cache the foundation already
provides, `PPData` is barely used, every App Store account requirement stays, and the
person's journal keeps living on a server we run.

### The recommendation, and why it is not mine to make

**Option A**, unless somebody other than Dave has a journal in Spindle today that has to
follow them to the phone. That is a fact about real users, not about code, and it decides
the architecture — so it is the one question this record cannot answer for itself.

## 4. What breaks a rule, said out loud

The foundation's `0002` says local-first with **no server**. Spindle has a server and
needs one: study generation holds an API key, which a phone cannot.

This does **not** break local-first. Every screen except *prepare a new study* works with
the phone in airplane mode — the journal, past studies, thoughts and plans are all read
from the device. What it breaks is the claim that the foundation needs no server, which
was a statement about the foundation, not a prohibition on an app having one. The
wording of `0002` should be amended to say so, in a companion pull request, rather than
left to be quietly contradicted by the first real app.

The foundation's proposed rule that no screen may require a model (`plug-and-play-ios#19`)
survives: preparing a study is a place you choose to go, not a place the app puts you.

## 5. TestFlight first

- **No guideline 4.2 argument at all.** Beta App Review is lighter than App Review.
- Up to 10,000 external testers, which is more than enough for a ward, a stake, or a
  family.
- It is the honest way to find out whether anybody uses this before paying for App Review
  cycles on a product nobody has held yet.

## 6. What this costs

- **Weeks, not days.** The shell could be submitted this week; this cannot.
- **Spindle is the first app to exercise the foundation's Apple halves** — Sign in with
  Apple, notifications, dictation — every one of which is written and has never run on a
  device. That is valuable and it is the schedule risk, in the same sentence.
- **The foundation will move underneath.** Spindle pins a tagged version (`0.1.0` is the
  first) and takes new ones deliberately.

## 7. What this record deliberately does not decide

- **Which repository.** Recommended: a new `davidcblake/spindle-ios`, rather than Swift
  living inside a Next.js repository.
- **Whether the web app is eventually retired**, or kept as the desktop way in.
- **How `/api/study` authenticates a native caller** — that follows from §3.
- **Whether Spindle is the study generator it is today or the conversational companion
  Dave's own system prompt describes.** `plug-and-play-ios/docs/where-we-are.md` flags
  these as different products. It should be settled before screens get built, not after.

## Revisit when

- §3 is answered, at which point this becomes Accepted or is rewritten around Option B.
- The first TestFlight build is in somebody else's hands, which is when the split in §2
  stops being a prediction.
