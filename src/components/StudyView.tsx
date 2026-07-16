"use client";

import { useState } from "react";
import { ChevronLeft, Bookmark, Printer, Sparkles, PenLine, Trash2 } from "lucide-react";
import type { JournalEntry } from "@/lib/study";
import { talkSearchUrl } from "@/lib/links";
import Linkify from "./Linkify";

interface Props {
  entry: JournalEntry;
  hiddenSections: string[];
  onBack: () => void;
  onJournal: () => void;
  onAddNote: (entryId: string, body: string) => Promise<boolean>;
  onDeleteNote: (entryId: string, noteId: string) => Promise<void>;
}

export default function StudyView({
  entry,
  hiddenSections,
  onBack,
  onJournal,
  onAddNote,
  onDeleteNote,
}: Props) {
  const c = entry.content;
  const show = (key: string) => !hiddenSections.includes(key);
  // Studies saved before the conference section existed won't have it.
  const conference = c.conference ?? [];
  const notes = entry.notes ?? [];

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteError, setNoteError] = useState("");

  async function addNote() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setNoteError("");
    const ok = await onAddNote(entry.id, body);
    setBusy(false);
    if (ok) {
      setDraft("");
    } else {
      setNoteError("Couldn't save that thought — check your connection and try again.");
    }
  }

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
          <p className="sp-body-text">
            <Linkify text={c.placement} />
          </p>
        </section>
      )}

      {show("background") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Background &amp; Context</h3>
          <p className="sp-body-text">
            <Linkify text={c.background} />
          </p>
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
                <Linkify text={p.elsewhere} />
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
                <Linkify text={p.elsewhere} />
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
                <Linkify text={p.echoes} />
              </div>
            </div>
          ))}
        </section>
      )}

      {show("christ") && (
        <section className="sp-section">
          <h3 className="sp-section-title">Christ at the Center</h3>
          <div className="sp-christ-block">
            <Linkify text={c.christ} />
          </div>
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
                  <a
                    className="sp-ref-link"
                    href={talkSearchUrl(t.speaker, t.talk)}
                    target="_blank"
                    rel="noopener"
                  >
                    &ldquo;{t.talk}&rdquo; · {t.session}
                  </a>
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
              <span className="sp-xref-ref">
                <Linkify text={x.ref} />
              </span>
              <span className="sp-xref-note">
                <Linkify text={x.note} />
              </span>
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

      <section className="sp-section">
        <h3 className="sp-section-title">My Thoughts</h3>
        {notes.map((note) => (
          <div key={note.id} className="sp-note">
            <div className="sp-note-body">{note.body}</div>
            <div className="sp-note-meta">
              {new Date(note.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              ·{" "}
              {new Date(note.created_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
              <button
                className="sp-note-del no-print"
                aria-label="Delete this thought"
                onClick={() => onDeleteNote(entry.id, note.id)}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        <div className="no-print">
          <textarea
            className="sp-textarea"
            rows={3}
            placeholder="What stood out? What is the Spirit teaching you? Type, or tap the mic on your keyboard and speak…"
            value={draft}
            maxLength={10000}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Add a thought about this study"
          />
          {noteError && <p className="sp-error">{noteError}</p>}
          <button
            className="sp-icon-btn"
            style={{ marginTop: 8 }}
            onClick={addNote}
            disabled={busy || !draft.trim()}
          >
            <PenLine size={13} aria-hidden="true" /> {busy ? "Saving…" : "Add to my journal"}
          </button>
        </div>
      </section>
    </div>
  );
}
