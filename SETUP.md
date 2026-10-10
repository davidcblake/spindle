# Spindle — One-Time Setup Guide

Everything the code needs is already in the repo. This guide covers the three accounts you wire together once: **Supabase** (auth + database), **Anthropic** (study generation), and **Vercel** (hosting). Budget ~20 minutes.

---

## 1. Supabase project (~7 min)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   - Name: `spindle` · Region: closest US region · Generate a strong database password (you won't need it day-to-day; store it in your password manager).
2. When the project finishes provisioning, open **SQL Editor** → **New query**, paste the entire contents of [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql), and click **Run**. You should see "Success. No rows returned."
3. Grab your keys: **Project Settings → API**. Copy:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (The `service_role` key is **not** used — leave it alone.)

### 1a. Email magic link (already on)

Supabase's built-in email provider works out of the box for magic links (rate-limited to ~4/hour per address on the free tier — fine for now; add a custom SMTP provider later if sign-in volume grows).

### 1b. Google sign-in (~5 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project called `spindle` (or reuse an existing one).
2. **APIs & Services → OAuth consent screen**: External · App name `Spindle` · your email for support/developer contact · no extra scopes needed (email/profile are default) → **Publish** the app (it can stay in production mode; the basic scopes don't need verification).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**, name `Spindle (Supabase)`
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback` (copy the exact URL from Supabase → **Authentication → Sign In / Up → Google** — it shows you the callback to use)
4. Copy the **Client ID** and **Client secret** into Supabase → **Authentication → Sign In / Up → Google** → enable → save.

### 1c. Auth URLs

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://spindlestudy.vercel.app` (or your final domain)
- **Redirect URLs:** add both `https://spindlestudy.vercel.app/**` and `http://localhost:3000/**`

---

## 2. Anthropic API key (~2 min)

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys** → **Create key**.
2. Name it `spindle` (dedicated key — keeps Spindle's spend visible separately from Dossier).
3. Copy the `sk-ant-...` value; you'll paste it into Vercel next. Consider setting a monthly spend limit in the console (Settings → Limits) — e.g. $10/month comfortably covers heavy personal use.

---

## 3. Vercel (~5 min)

1. Push this repo to GitHub (`davidcblake/spindle`) if not already done.
2. [vercel.com/new](https://vercel.com/new) → import `davidcblake/spindle` → framework auto-detects Next.js. Before deploying, add **Environment Variables**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1.3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1.3 |
   | `ANTHROPIC_API_KEY` | from step 2 |

3. **Deploy.** Every future push to `main` ships automatically.
4. If the production URL isn't `spindle.vercel.app`, update: Supabase Site URL / Redirect URLs (step 1c) and the `remote_url` default in `.github/workflows/ios-build.yml`.

---

## 4. Verify (5 min)

On your iPhone, open the production URL and check:

- [ ] Sign in with Google works end to end; magic link works too
- [ ] First sign-in shows the profile onboarding; save it
- [ ] Prepare a study of **3 Nephi 8** — renders all ten sections in under a minute
- [ ] The study appears in **Journal**; kill and reopen the app — still there
- [ ] Airplane mode: journal opens and past studies are readable; Prepare is disabled with a friendly note
- [ ] Share → **Add to Home Screen** — Spindle installs with its icon and opens standalone
- [ ] Print / Save PDF produces a clean document
- [ ] View page source of the deployed site: no `sk-ant` anywhere (key is server-side only)

## 5. iOS app (optional, later)

The repo already carries the Plug and Play wrapper (`.github/workflows/ios-build.yml`, bundle id `com.wpv.spindle`). When you want the native shell: GitHub → Actions → **iOS build (Capacitor)** → Run workflow → download the `ios-project` artifact → open in Xcode → run on your iPhone (same Track A flow as Dossier; free-signing builds expire after 7 days). The PWA covers daily use until then.

## 6. The native iPhone app's study routes (~10 min)

The native app (`davidcblake/spindle-ios`) prepares studies through `/api/app/*`, proving
itself with Apple's App Attest instead of signing in (decisions `0002`–`0004`). Until the
two values below are set, those routes answer "isn't set up on the server yet" and the web
app is unaffected.

1. **Supabase → SQL editor:** run `supabase/migrations/0005_app_attest.sql`.
2. **Make a secret:** in Terminal, `openssl rand -base64 48`. Copy the output.
3. **Supabase → SQL editor**, with your secret pasted in:
   `insert into public.app_server_secret (secret_hash) values (encode(extensions.digest('YOUR-SECRET', 'sha256'), 'hex'));`
4. **Vercel → Settings → Environment Variables**, then redeploy:
   - `APP_SERVER_SECRET` = the same secret
   - `APPLE_TEAM_ID` = your 10-character Team ID (developer.apple.com → Account → Membership details)
5. **Once, by hand:** open apple.com/certificateauthority, download *Apple App Attestation
   Root CA*, and check its SHA-256 fingerprint matches the certificate in
   `src/lib/server/appAttest.ts` (`node -e` with `X509Certificate(...).fingerprint256`
   prints it). The session that wrote it could not reach apple.com.

## 7. Alerts to your phone, and feedback from the app (~5 min)

Decision `0006`. The server pushes alerts to your iPhone for failures, running out of
Anthropic credit, new installs and feedback.

1. **Supabase → SQL editor:** run `supabase/migrations/0006_feedback.sql`.
2. **iPhone:** install **ntfy** from the App Store. Tap **+**, enter the topic name, and
   subscribe. The topic is the `NTFY_TOPIC` value in Vercel. Leave the server as ntfy.sh.
3. **Vercel → Settings → Environment Variables:** `NTFY_TOPIC` must be set, then redeploy.
   Anyone who knows the topic name can read the alerts, so keep it long and random.

To read every piece of feedback ever sent, in the SQL editor:
`select created_at, message from public.app_feedback order by created_at desc;`
