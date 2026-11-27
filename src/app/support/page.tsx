import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Spindle",
  description: "Help with Spindle, the scripture study companion, and how to reach its developer.",
};

/** Who to write to. The same address as the privacy page. */
const CONTACT = "daveblake1@gmail.com";

/**
 * Spindle's support page: the Support URL the App Store asks for. Short
 * answers to what people actually ask, and how to reach a person.
 */
export default function SupportPage() {
  return (
    <main className="sp-root">
      <header className="sp-header">
        <h1 className="sp-title">Spindle support</h1>
        <p className="sp-tagline">A Christ-centered scripture study companion</p>
      </header>

      <article className="sp-card sp-privacy">
        <h2>Getting help</h2>
        <p>
          In the iPhone app, open <strong>Settings → Send feedback or an idea</strong>. It goes
          straight to the person who makes Spindle. You can also write to{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Common questions</h2>
        <ul>
          <li>
            <strong>Do I need an account?</strong> No. On iPhone there is nothing to sign in to;
            your journal, thoughts and plans are kept on your phone.
          </li>
          <li>
            <strong>Does it work offline?</strong> Your journal does, always. Preparing a new study
            or plan needs a connection.
          </li>
          <li>
            <strong>A study shows the passage I already studied.</strong> Spindle keeps the study you
            prepared. Tap ↻ on a study to prepare a fresh one; the earlier one stays in your journal.
          </li>
          <li>
            <strong>Are the conference talks real?</strong> Every talk in a new study is checked
            against the full list of general conference talks in Gospel Library, and tapping one
            opens it there. Studies prepared before November 2026 were not checked: tap ↻ for a
            fresh one.
          </li>
          <li>
            <strong>Speak doesn&apos;t appear.</strong> Speaking a thought is turned into words on
            your iPhone itself; on phones that can&apos;t do that, the button is hidden. The
            microphone on the keyboard still works.
          </li>
          <li>
            <strong>Is Spindle an official Church app?</strong> No. Spindle is not an official
            product of The Church of Jesus Christ of Latter-day Saints. Studies are prepared with
            AI: read the passages themselves, and let the scriptures and living prophets be the
            authority.
          </li>
        </ul>

        <h2>Privacy</h2>
        <p>
          What Spindle keeps, and where, is on the <a href="/privacy">privacy page</a>.
        </p>
      </article>
    </main>
  );
}
