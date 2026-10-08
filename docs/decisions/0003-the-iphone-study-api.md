# 0003 — The study API the iPhone app calls

**Date:** 2026-10-08
**Status:** Accepted. Written by the Builder, under Dave's instruction to keep building; open to challenge in an issue.
**Follows:** `0001` (no accounts; the journal lives in iCloud) and `0002` (App Attest).

## What this decides

The exact requests the iPhone app sends and what comes back. The phone and the server are
built separately, in separate repositories, and this file is the one place both read.

The web app's `/api/study` and `/api/plan` are **not changed**. The iPhone gets its own
routes under `/api/app/`, because the two differ in how a caller is recognised (a Supabase
session versus an attested key), where the profile comes from (a database row versus the
request), and who saves the result (the server versus the phone). Folding both into one
route would mean every line of it asks "which kind of caller is this?"

## The routes

### `GET /api/app/challenge`

Returns `{ "challenge": "<base64, 32 random bytes>" }`. Each challenge is good for five
minutes, and once. It is used only for registering a key.

### `POST /api/app/register`

Once per install. The app makes a key with `DCAppAttestService.generateKey()`, asks Apple
to attest it with `clientDataHash = SHA256(challenge)`, and sends:

```json
{ "keyId": "<base64>", "attestation": "<base64 CBOR>", "challenge": "<base64>" }
```

The server checks the attestation as Apple documents it (certificate chain to Apple's App
Attest root, the nonce, the App ID `TEAMID.com.wpv.spindle`, counter zero, the key id is
the hash of the public key) and stores the public key against the key id with a counter of
zero. `204` on success.

### `POST /api/app/study` and `POST /api/app/plan`

Headers:

- `X-Spindle-Key-Id`: the key id from registering
- `X-Spindle-Assertion`: base64 of `DCAppAttestService.generateAssertion(keyId,
  clientDataHash: SHA256(the exact request body bytes))`

The server checks the assertion's signature against the stored key, that the counter went
**up** (which is what stops a captured request being replayed), and that it signed this
body. Then it counts the request against that key.

Study body — the web app's selection, plus the profile the web app reads from Postgres:

```json
{
  "volumeId": "bofm", "book": "Alma", "chapters": [5, 6, 7, 32], "extras": [],
  "profile": {
    "first_name": "", "calling": "", "family_context": "", "study_focus": "",
    "spiritual_season": "", "conference_scope": "core"
  }
}
```

The selection goes through `validateSelection()` exactly as the web's does. The profile
goes through `describeReader()`, which already collapses whitespace and caps each field,
so the rule that no free text reaches the prompt unguarded still holds — it is now guarded
in code rather than also by a database column.

Plan body: `{ "request": "…", "profile": { … } }`, with the web's 3–500 character rule.

Success:

- study: `{ "study": <the StudySchema object> }`
- plan: `{ "plan": <the PlanSchema object> }`

Failure: the web app's shape exactly, `{ "error": { "message": "…", "type": "…" } }`, with
the web app's messages, so a person reads the same words on either. One new type:
`"attestation"` (status `401`), whose message tells the person to try again later and that
their journal is unaffected.

## Who saves the study

**The phone, before it shows it.** The server has nowhere to save it — that was `0001`'s
point — so the web app's rule "persist before return" becomes, on the phone, "save to the
journal before showing". Same promise, the other side of the wire: a study that was paid
for is never only on screen.

## Usage limits

Per key, in a `device_usage` table: 15 studies an hour (the web's number) and 5 plans an
hour. No daily ceiling yet; `0002` flagged the question and nothing has happened to answer
it.

## What this does not decide

- **How the server writes `device_keys` and `device_usage` without a user.** The web app's
  rule is that RLS is the authorization layer and the app runtime holds no service-role key.
  A caller with no user has no `auth.uid()` for RLS to check. The likely answer is two
  `security definer` Postgres functions that are the only way in — but that is the first
  thing the server work has to settle, in its own record, not here.
- **What a genuine phone sees when Apple's attestation service is down.** The study fails
  with the `attestation` message; everything saved keeps working.
- **The team ID.** The App ID is `TEAMID.com.wpv.spindle`; the team ID is Dave's, from the
  Apple Developer account, and goes in an environment variable, not in this file.
