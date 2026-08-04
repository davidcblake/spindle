"use client";

import { segmentReferences, parseTalkReference, talkSearchUrl } from "@/lib/links";

/**
 * Renders text with every scripture and talk reference linked into Gospel
 * Library. A whole string shaped like a talk citation (Speaker — "Title"
 * (Session)) becomes one talk-search link; otherwise inline scripture
 * references within the text are linked.
 */
export default function Linkify({ text }: { text: string }) {
  const talk = parseTalkReference(text.trim());
  if (talk) {
    return (
      <a
        className="sp-ref-link"
        href={talkSearchUrl(talk.speaker, talk.talk)}
        target="_blank"
        rel="noopener"
      >
        {text}
      </a>
    );
  }

  const segments = segmentReferences(text);
  return (
    <>
      {segments.map((s, i) =>
        s.url ? (
          <a key={i} className="sp-ref-link" href={s.url} target="_blank" rel="noopener">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
