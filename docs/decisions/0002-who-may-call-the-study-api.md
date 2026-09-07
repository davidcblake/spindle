# 0002 — Who may call the study API, when nobody has an account

**Date:** 2026-09-07
**Status:** Proposed — option in §4 is Dave's call, because it is his money at risk.
**Follows:** `0001`, which decided the journal lives in iCloud and Spindle has no accounts.

## The problem, which is bigger than it first looks

`/api/study` today does three things that all rest on the caller having a Supabase
account:

1. **Knows who is calling** — `supabase.auth.getUser()`, and refuses anybody else.
2. **Rate limits them** — 15 studies an hour, counted by `select count(*) from
   journal_entries where created_at > now() - 1 hour`.
3. **Personalizes the study** — loads `profiles` server-side, so the client never supplies
   free text that reaches the model.

`0001` removes the account. That breaks all three, and the second one breaks in a way
worth saying plainly:

> **The rate limit is a side effect of saving.** It counts rows the server wrote. Once the
> app saves studies on the device, there are no rows to count, so the limit does not get
> weaker — **it stops existing.** An endpoint holding an Anthropic key with no limit is
> somebody else's free API.

The third breaks quietly rather than loudly. Profile text moves from a Postgres column
with `char_length` constraints to a field the client sends, so **the one place a person's
free text reaches the prompt stops being guarded by the database.** Whatever else is
decided here, the server has to validate and truncate that text itself, and treat it as
what it now is: input from outside.

## What is actually at stake

Roughly **$0.03 a study**. A cap of 15 an hour is about 45 cents an hour per identity. The
question is therefore not "can somebody read a study they should not" — every study is
generated from public scripture — it is **how cheaply somebody can mint a new identity**,
because that number multiplied by 45 cents an hour is the bill.

## The options

### A — App Attest *(recommended)*

Apple's `DCAppAttestService`. On first launch the app generates a key in the Secure
Enclave and asks Apple to attest it; the server verifies that attestation and stores the
key. Every study request carries an assertion signed by that key, and the server counts
requests per attested key in a small table.

- **It is the only option here that binds a caller to a genuine build of Spindle running
  on a real device.** Minting a new identity means having another iPhone.
- It needs no account and no personal data — the key identifies a device, not a person.
- Apple built it for exactly this: an app with no login that has to protect a paid backend.

Cost: real work on both sides. Attestation verification is not something Supabase does for
you — a certificate chain, a nonce, a receipt, a replay window, and a `device_keys` table
with a counter. Call it a couple of days, and it sits on the critical path to TestFlight,
because a TestFlight build is a binary in other people's hands pointed at a live endpoint.

### B — An anonymous Supabase user, used only as a credential

Guest mode already exists (`51b0599`). The app signs in anonymously, uses the JWT to call
the API, and keeps its journal on the device regardless. Rate limiting needs a new counter
table, since `journal_entries` will no longer be written.

- Cheap. Most of the machinery is there.
- **It quietly re-creates the thing `0001` removed.** There would be a user record per
  install — nothing personal in it, but it is an account, and "Spindle has no accounts"
  stops being exactly true in the place it matters most: what we tell people.
- An anonymous account costs one HTTP request to mint. The rate limit is then a speed
  bump, not a wall.

### C — A secret shipped in the app

A key in the binary. Anybody can extract it in minutes. **Not acceptable**, listed only so
nobody proposes it later.

### D — A token minted per install and kept in the Keychain

The server mints a random token on first launch and counts against it. Simple and honest
about what it is: protection against accident, not against abuse. Anybody can ask for
another token.

## The recommendation

**A.** The whole argument for `0001` was that a scripture journal should not sit on a
server we run and a person should not need an account to study. Option B gets the second
half by creating an account and not mentioning it, which is the kind of small dishonesty
that is easy now and awkward to explain later.

App Attest also has a property none of the others do: **it fails closed on a jailbroken or
simulated device**, which is where abuse would come from.

If the days matter more than the principle, B is defensible — but then say so in the app's
privacy text rather than leaving "no accounts" standing.

## What this does not decide

- **What happens when attestation fails** on a legitimate device — Apple's service has
  outages, and the answer must not be a screen that says nothing. The likely answer is
  that preparing a study fails with a plain message and everything already saved keeps
  working, which is `0001`'s local-first promise doing its job.
- **Whether the web app moves to the same scheme.** It cannot — a browser has no App
  Attest — so `/api/study` will have two ways in for as long as both exist.
- **The rate limit number.** 15 an hour was chosen for accounts; a per-device limit may
  want a different one, and a daily ceiling as well as an hourly one.

## Revisit when

- The first TestFlight build goes out, which is the first time the endpoint faces a binary
  that is not on Dave's own phone.
- Anthropic pricing moves enough to change what an abused hour costs.
