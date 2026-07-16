"use client";

import { segmentReferences } from "@/lib/links";

/** Renders text with scripture references as Gospel Library links. */
export default function Linkify({ text }: { text: string }) {
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
