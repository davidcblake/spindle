"use client";

import { WifiOff, Trash2, PenLine } from "lucide-react";
import type { JournalEntry } from "@/lib/study";

interface Props {
  entries: JournalEntry[];
  online: boolean;
  onOpen: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}

export default function JournalTab({ entries, online, onOpen, onDelete }: Props) {
  return (
    <div className="sp-card">
      {!online && (
        <div className="sp-journal-offline" role="status">
          <WifiOff size={14} aria-hidden="true" />
          You&apos;re offline — every saved study below is fully readable.
        </div>
      )}
      {entries.length === 0 ? (
        <div className="sp-empty-journal">
          Your journal is empty. Each study you prepare is saved here automatically — and syncs
          to every device you sign in on — so your understanding compounds day by day.
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="sp-entry-row">
            <button className="sp-entry" onClick={() => onOpen(entry)}>
              <div className="sp-entry-ref">{entry.reference}</div>
              <div className="sp-entry-date">
                {new Date(entry.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="sp-entry-anchor">&ldquo;{entry.anchor}&rdquo;</div>
              {(entry.notes?.length ?? 0) > 0 && (
                <div className="sp-entry-notes-badge">
                  <PenLine size={11} aria-hidden="true" />
                  {entry.notes!.length === 1
                    ? "1 thought"
                    : `${entry.notes!.length} thoughts`}
                </div>
              )}
            </button>
            <button
              className="sp-entry-del"
              onClick={() => onDelete(entry.id)}
              aria-label={`Delete study of ${entry.reference}`}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
