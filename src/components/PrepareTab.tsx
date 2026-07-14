"use client";

import { useState } from "react";
import { VOLUMES, buildReference, chapterCount, type Volume } from "@/lib/scripture";
import type { Selection } from "./SpindleApp";

interface Props {
  online: boolean;
  error: string;
  onPrepare: (selection: Selection) => void;
}

export default function PrepareTab({ online, error, onPrepare }: Props) {
  const [volume, setVolume] = useState<Volume>(VOLUMES[0]);
  const [book, setBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<number[]>([]);
  const [extras, setExtras] = useState<string[]>([]);

  function pickVolume(v: Volume) {
    setVolume(v);
    setBook(v.books.length === 1 ? v.books[0][0] : null);
    setChapters([]);
    setExtras([]);
  }

  function pickBook(name: string) {
    setBook(name);
    setChapters([]);
    setExtras([]);
  }

  function toggleChapter(n: number) {
    setChapters((prev) => (prev.includes(n) ? prev.filter((c) => c !== n) : [...prev, n]));
  }

  function toggleExtra(name: string) {
    setExtras((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));
  }

  const reference = buildReference(chapters.length ? book : null, chapters, extras);
  const count = book ? chapterCount(volume, book) : 0;
  const selectedCount = chapters.length + extras.length;

  function prepare() {
    if (!reference) return;
    onPrepare({ volumeId: volume.id, book, chapters, extras, reference });
  }

  return (
    <div className="sp-card">
      <p className="sp-intro">
        Choose a passage and prepare a study that traces its people, principles, and doctrine
        across all four standard works — and shows how each points to the Savior.
      </p>

      <p className="sp-label" id="volume-label">Volume</p>
      <div className="sp-pill-row" role="group" aria-labelledby="volume-label">
        {VOLUMES.map((v) => (
          <button
            key={v.id}
            className={`sp-pill ${volume.id === v.id ? "selected" : ""}`}
            aria-pressed={volume.id === v.id}
            onClick={() => pickVolume(v)}
          >
            {v.name}
          </button>
        ))}
      </div>

      {volume.books.length > 1 && (
        <>
          <hr className="sp-divider" />
          <p className="sp-label" id="book-label">Book</p>
          <div className="sp-pill-row" role="group" aria-labelledby="book-label">
            {volume.books.map(([name]) => (
              <button
                key={name}
                className={`sp-pill ${book === name ? "selected" : ""}`}
                aria-pressed={book === name}
                onClick={() => pickBook(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      {book && (
        <>
          <hr className="sp-divider" />
          <p className="sp-label" id="chapter-label">
            {volume.id === "dc" ? "Sections" : "Chapters"} <em>— tap one or more</em>
          </p>
          <div className="sp-tile-grid" role="group" aria-labelledby="chapter-label">
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={`sp-tile ${chapters.includes(n) ? "selected" : ""}`}
                aria-pressed={chapters.includes(n)}
                onClick={() => toggleChapter(n)}
              >
                {n}
              </button>
            ))}
            {volume.extras?.map((name) => (
              <button
                key={name}
                className={`sp-tile sp-extra-tile ${extras.includes(name) ? "selected" : ""}`}
                aria-pressed={extras.includes(name)}
                onClick={() => toggleExtra(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedCount > 10 && (
        <p className="sp-soft-warning">
          That&apos;s a big span — the study will synthesize across it rather than treat each
          chapter in depth.
        </p>
      )}

      {!online && (
        <p className="sp-soft-warning">
          You&apos;re offline — preparing a new study needs a connection, but your journal is
          fully readable.
        </p>
      )}

      {error && <p className="sp-error" role="alert">{error}</p>}

      <div className="sp-selection-bar">
        <span className="sp-selection-ref" aria-live="polite">
          {reference || "Nothing selected yet"}
        </span>
        <button className="sp-prepare" onClick={prepare} disabled={!reference || !online}>
          Prepare Study
        </button>
      </div>
    </div>
  );
}
