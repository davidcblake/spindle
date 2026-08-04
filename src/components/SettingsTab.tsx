"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTION_DEFS } from "@/lib/sections";
import type { ConferenceScope } from "@/lib/profile";
import ProfileForm, { type ProfileText } from "./ProfileForm";

interface Props {
  supabase: SupabaseClient;
  userId: string;
  profileText: ProfileText | null;
  hiddenSections: string[];
  conferenceScope: ConferenceScope;
  onProfileSaved: (text: ProfileText) => void;
  onHiddenChange: (hidden: string[]) => void;
  onScopeChange: (scope: ConferenceScope) => void;
  onSignOut?: () => void;
  email?: string;
}

const SCOPE_OPTIONS: { value: ConferenceScope; title: string; note: string }[] = [
  {
    value: "core",
    title: "Emphasize First Presidency & Twelve",
    note: "Quote the current First Presidency and Quorum of the Twelve by default — but never miss an exceptional talk from a broader source when it truly nails the topic.",
  },
  {
    value: "expanded",
    title: "Best fit, wherever it's found",
    note: "Choose whatever conference talk best addresses the topic across recent years, still giving preference to the current First Presidency and Twelve when the fit is comparable.",
  },
];

export default function SettingsTab({
  supabase,
  userId,
  profileText,
  hiddenSections,
  conferenceScope,
  onProfileSaved,
  onHiddenChange,
  onScopeChange,
  onSignOut,
  email,
}: Props) {
  const [error, setError] = useState("");

  async function toggleSection(key: string) {
    const next = hiddenSections.includes(key)
      ? hiddenSections.filter((k) => k !== key)
      : [...hiddenSections, key];
    onHiddenChange(next); // optimistic — applies to the next render immediately
    setError("");
    const { error: saveError } = await supabase
      .from("profiles")
      .upsert({ id: userId, hidden_sections: next, updated_at: new Date().toISOString() });
    if (saveError) {
      onHiddenChange(hiddenSections); // revert
      setError("Couldn't save that preference — check your connection and try again.");
    }
  }

  async function chooseScope(scope: ConferenceScope) {
    if (scope === conferenceScope) return;
    const previous = conferenceScope;
    onScopeChange(scope); // optimistic
    setError("");
    const { error: saveError } = await supabase
      .from("profiles")
      .upsert({ id: userId, conference_scope: scope, updated_at: new Date().toISOString() });
    if (saveError) {
      onScopeChange(previous); // revert
      setError("Couldn't save that preference — check your connection and try again.");
    }
  }

  return (
    <div className="sp-card">
      <p className="sp-label">Study sections</p>
      <p className="sp-intro">
        Choose what appears in your studies. Every study is generated in full, so anything you
        switch back on will show up in past journal entries too.
      </p>
      <div className="sp-pill-row" role="group" aria-label="Study sections to display">
        {SECTION_DEFS.map((s) => {
          const shown = !hiddenSections.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`sp-pill ${shown ? "selected" : ""}`}
              aria-pressed={shown}
              onClick={() => toggleSection(s.key)}
            >
              {s.title}
            </button>
          );
        })}
      </div>
      <hr className="sp-divider" />

      <p className="sp-label">General conference voices</p>
      <p className="sp-intro">
        Whose conference teachings the studies and plans draw on. The current First Presidency
        and Quorum of the Twelve are always prioritized.
      </p>
      <div className="sp-pill-row" role="group" aria-label="General conference sourcing">
        {SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`sp-pill ${conferenceScope === opt.value ? "selected" : ""}`}
            aria-pressed={conferenceScope === opt.value}
            onClick={() => chooseScope(opt.value)}
          >
            {opt.title}
          </button>
        ))}
      </div>
      <p className="sp-field-hint">
        {SCOPE_OPTIONS.find((o) => o.value === conferenceScope)?.note}
      </p>

      {error && <p className="sp-error" role="alert">{error}</p>}

      <hr className="sp-divider" />

      <p className="sp-label">Your profile</p>
      <p className="sp-intro">
        Shapes every study you prepare. Everything is optional and private to you.
        {email ? (
          <>
            {" "}
            Signed in as <strong>{email}</strong>.
          </>
        ) : null}
      </p>
      <ProfileForm
        supabase={supabase}
        userId={userId}
        initial={profileText}
        onSaved={onProfileSaved}
      />

      {onSignOut && (
        <>
          <hr className="sp-divider" />
          <button type="button" className="sp-link-btn" onClick={onSignOut}>
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
