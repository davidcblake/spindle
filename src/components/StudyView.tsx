"use client";

import { ChevronLeft, Bookmark, Printer, Sparkles } from "lucide-react";
import type { JournalEntry } from "@/lib/study";

interface Props {
  entry: JournalEntry;
  hiddenSections: string[];
  onBack: () => void;
  onJournal: () => void;
}

export default function StudyView({ entry, hiddenSections, onBack, onJournal }: Props) {
  const c = entry.content;
  const show = (key: string) => !hiddenSections.includes(key);
  // Studies saved before the conference section existed won't have it.
  const conference = c.conference ?? [];

  return (
    <div className="sp-card">
      <button className="sp-back no-print" onClick={onBack}>
        <ChevronLeft size={16} aria-hidden="true" /> New study
      </button>

      <div className="sp-plate">
        <p className="sp-plate-ref">{entry.reference}</p>
        <p className="sp-plate-vol">
          {entry.volume} ·{" "}
          {new Date(entry.date).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="sp-study-actions no-print">
        <button className="sp-icon-btn" onClick={() => window.print()}>
          <Printer size={13} aria-hidden="true" /> Print / Save PDF
        </button>
        <button className="sp-icon-btn" onClick={onJournal}>
          <Bookmark size={13} aria-hidden="true" /> Journal
        </button>
      </div>

      {show("placement") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Where This Sits</h3>
          <p className="sp-body-text">{c.placement}</p>
        </section>
      )}

      {show("background") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Background &amp; Context</h3>
          <p className="sp-body-text">{c.background}</p>
        </section>
      )}

      {show("people") && (
        <section className="sp-section">
          <h3 className="sp-section-title">People &amp; Connections</h3>
          {c.people.map((p, i) => (
            <div key={i} className="sp-item">
              <div className="sp-item-name">{p.name}</div>
              <p className="sp-item-detail">{p.who}</p>
              <div className="sp-elsewhere">
                <strong>Elsewhere in scripture</strong>
                {p.elsewhere}
              </div>
            </div>
          ))}
        </section>
      )}

      {show("principles") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Principles &amp; Doctrine</h3>
          {c.principles.map((p, i) => (
            <div key={i} className="sp-item">
              <div className="sp-item-name">{p.principle}</div>
              <p className="sp-item-detail">{p.explanation}</p>
              <div className="sp-elsewhere">
                <strong>Also taught in</strong>
                {p.elsewhere}
              </div>
            </div>
          ))}
        </section>
      )}

      {show("patterns") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Patterns &amp; Types</h3>
          {c.patterns.map((p, i) => (
            <div key={i} className="sp-item">
              <div className="sp-item-name">{p.pattern}</div>
              <p className="sp-item-detail">{p.meaning}</p>
              <div className="sp-elsewhere">
                <strong>Echoes</strong>
                {p.echoes}
              </div>
            </div>
          ))}
        </section>
      )}

      {show("christ") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Christ at the Center</h3>
          <div className="sp-christ-block">{c.christ}</div>
        </section>
      )}

      {show("conference") && conference.length > 0 && (
        <section className="sp-section">
          <h3 className="sp-section-title">From General Conference</h3>
          {conference.map((t, i) => (
            <div key={i} className="sp-item">
              <div className="sp-item-name">{t.speaker}</div>
              <p className="sp-item-detail">{t.point}</p>
              <div className="sp-elsewhere">
                <strong>
                  &ldquo;{t.talk}&rdquo; · {t.session}
                </strong>
              </div>
            </div>
          ))}
        </section>
      )}

      {show("crossRefs") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Cross-References</h3>
          {c.crossRefs.map((x, i) => (
            <div key={i} className="sp-xref">
              <span className="sp-xref-ref">{x.ref}</span>
              <span className="sp-xref-note">{x.note}</span>
            </div>
          ))}
        </section>
      )}

      {show("reflection") && (
        <section className="sp-section">
          <h3 className="sp-section-title">For Reflection</h3>
          <ol className="sp-reflection-list">
            {c.reflection.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      {show("invitation") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Invitation to Act</h3>
          <p className="sp-body-text">{c.invitation}</p>
        </section>
      )}

      {show("anchor") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Remember This</h3>
          <div className="sp-anchor-block">
            <Sparkles size={16} style={{ color: "var(--amber)", marginBottom: 6 }} aria-hidden="true" />
            <div>{c.anchor}</div>
          </div>
        </section>
      )}
    </div>
  );
}
