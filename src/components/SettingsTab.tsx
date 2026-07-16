"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTION_DEFS } from "@/lib/sections";
import ProfileForm, { type ProfileText } from "./ProfileForm";

interface Props {
  supabase: SupabaseClient;
  userId: string;
  profileText: ProfileText | null;
  hiddenSections: string[];
  onProfileSaved: (text: ProfileText) => void;
  onHiddenChange: (hidden: string[]) => void;
  onSignOut?: () => void;
  email?: string;
}

export default function SettingsTab({
  supabase,
  userId,
  profileText,
  hiddenSections,
  onProfileSaved,
  onHiddenChange,
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
