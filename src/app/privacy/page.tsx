import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Spindle",
  description: "What Spindle keeps, where it keeps it, and who else sees it.",
};

/** Who to write to about privacy. Dave's to fill in before this page is
 *  linked from the App Store. */
const CONTACT = "CONTACT-EMAIL-TO-ADD";

const UPDATED = "October 8, 2026";

/**
 * Spindle's privacy policy, for the website and the iPhone app (the App
 * Store asks for one link that covers both). Plain words, and only what is
 * true of the code on the day it was written — decisions 0001–0004 say why
 * each piece works the way it does.
 */
export default function PrivacyPage() {
  return (
    <main className="sp-root">
      <header className="sp-header">
        <h1 className="sp-title">Spindle and your privacy</h1>
        <p className="sp-tagline">Updated {UPDATED}</p>
      </header>

      <article className="sp-card sp-privacy">
        <p className="sp-intro">
          Spindle is a scripture study companion. A study journal is personal, so Spindle keeps as
          little as it can, shows no ads, sells nothing, and uses no analytics or tracking of any
          kind.
        </p>

        <h2>The iPhone app</h2>
        <ul>
          <li>
            <strong>No account.</strong> You never sign in, and Spindle does not know your name,
            email or Apple ID.
          </li>
          <li>
            <strong>Your journal stays with you.</strong> Studies, your thoughts on them, plans and
            your profile are kept on your iPhone. When syncing between your own devices is turned
            on, they are kept in your private iCloud, which only you can read — not on any server
            Spindle runs.
          </li>
          <li>
            <strong>Preparing a study or a plan</strong> sends the passage you chose (or the plan
            you described) and your profile — whatever you have filled in of first name, calling,
            family, study focus and spiritual season — to Spindle&apos;s server, which passes them
            to Anthropic to write the study. The server does not keep the request or the study.
          </li>
          <li>
            <strong>Proving the request is from Spindle.</strong> Your iPhone makes a key with
            Apple&apos;s App Attest so the server can tell genuine requests from abuse. The server
            keeps that key&apos;s public half and the times it was used, to limit how many studies
            can be prepared in an hour. The key identifies a copy of the app, not a person, and is
            not linked to anything else about you.
          </li>
        </ul>

        <h2>The website</h2>
        <ul>
          <li>
            <strong>Signing in</strong> uses your email address (by a sign-in link) or your Google
            account. Your email is kept so you can sign in again.
          </li>
          <li>
            <strong>Your journal, thoughts, plans and profile</strong> are stored in Spindle&apos;s
            database (Supabase) so they are on every device you sign in on. Each row can be read
            only by your account.
          </li>
          <li>
            <strong>Preparing a study or a plan</strong> sends the passage or your request, and
            your profile, to Anthropic to write it, the same as the iPhone app.
          </li>
          <li>Deleting a study or a plan deletes it.</li>
        </ul>

        <h2>Who else handles your information</h2>
        <ul>
          <li>
            <strong>Anthropic</strong> writes each study and plan. Its commercial terms say it does
            not use what Spindle sends to train its models.
          </li>
          <li>
            <strong>Vercel</strong> runs Spindle&apos;s server and keeps ordinary request logs.
          </li>
          <li>
            <strong>Supabase</strong> stores the website&apos;s accounts and journals, and the
            iPhone app&apos;s App Attest keys.
          </li>
          <li>
            <strong>Apple</strong> provides App Attest and iCloud, under Apple&apos;s own privacy
            policy.
          </li>
        </ul>
        <p>Nothing is sold, shared for advertising, or used to follow you across other apps.</p>

        <h2>Children</h2>
        <p>Spindle is not directed at children under 13 and does not knowingly collect their information.</p>

        <h2>Questions, or deleting everything</h2>
        <p>
          Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. On the iPhone, deleting the app
          deletes everything it kept on the phone; your iCloud copy can be removed in Settings →
          your name → iCloud. For the website, ask and your account and everything in it will be
          deleted.
        </p>
      </article>
    </main>
  );
}
