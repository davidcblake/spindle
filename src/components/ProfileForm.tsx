"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The five personalization text fields (section prefs are handled in
 *  SettingsTab and deliberately excluded so a profile save can't clobber
 *  them with stale values). */
export interface ProfileText {
  first_name: string;
  calling: string;
  family_context: string;
  study_focus: string;
  spiritual_season: string;
}

export const EMPTY_PROFILE_TEXT: ProfileText = {
  first_name: "",
  calling: "",
  family_context: "",
  study_focus: "",
  spiritual_season: "",
};

interface Props {
  supabase: SupabaseClient;
  userId: string;
  initial: ProfileText | null;
  onSaved: (text: ProfileText) => void;
  onboarding?: boolean;
}

const FIELDS: {
  key: keyof ProfileText;
  label: string;
  hint: string;
  placeholder: string;
  multiline?: boolean;
  maxLength: number;
}[] = [
  {
    key: "first_name",
    label: "First name",
    hint: "So your studies can speak to you by name.",
    placeholder: "Dave",
    maxLength: 100,
  },
  {
    key: "calling",
    label: "Current calling",
    hint: "Studies get framed for your service — a Primary teacher and a bishop need different things.",
    placeholder: "Counselor in a stake presidency, Relief Society president, no calling right now…",
    maxLength: 200,
  },
  {
    key: "spiritual_season",
    label: "Spiritual season",
    hint: "New convert, returning, lifelong member, preparing for a mission or the temple…",
    placeholder: "Lifelong member",
    maxLength: 200,
  },
  {
    key: "family_context",
    label: "Family",
    hint: "Helps invitations to act land in your real life.",
    placeholder: "Married, three kids at home (14, 11, 7)…",
    multiline: true,
    maxLength: 500,
  },
  {
    key: "study_focus",
    label: "Study focus",
    hint: "What are you working toward right now?",
    placeholder: "Preparing Sunday lessons, a question I'm pondering, Come Follow Me pace…",
    multiline: true,
    maxLength: 500,
  },
];

export default function ProfileForm({ supabase, userId, initial, onSaved, onboarding = false }: Props) {
  // Pick fields explicitly: `initial` may be a superset (the full Profile),
  // and letting extra keys into `values` would write them back on save.
  const [values, setValues] = useState<ProfileText>(() =>
    initial
      ? {
          first_name: initial.first_name,
          calling: initial.calling,
          family_context: initial.family_context,
          study_focus: initial.study_focus,
          spiritual_season: initial.spiritual_season,
        }
      : { ...EMPTY_PROFILE_TEXT },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function set(key: keyof ProfileText, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(valuesToSave: ProfileText) {
    setBusy(true);
    setError("");
    const { error: saveError } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...valuesToSave, updated_at: new Date().toISOString() });
    setBusy(false);
    if (saveError) {
      setError("Couldn't save your profile — check your connection and try again.");
      return;
    }
    setSaved(true);
    onSaved(valuesToSave);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(values);
      }}
    >
      {FIELDS.map((f) => (
        <div className="sp-field" key={f.key}>
          <label className="sp-field-label" htmlFor={`pf-${f.key}`}>
            {f.label}
          </label>
          {f.multiline ? (
            <textarea
              id={`pf-${f.key}`}
              className="sp-textarea"
              value={values[f.key]}
              maxLength={f.maxLength}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          ) : (
            <input
              id={`pf-${f.key}`}
              className="sp-input"
              type="text"
              value={values[f.key]}
              maxLength={f.maxLength}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
          <p className="sp-field-hint">{f.hint}</p>
        </div>
      ))}

      {error && <p className="sp-error" role="alert">{error}</p>}
      {saved && !onboarding && (
        <p className="sp-success" role="status">
          Profile saved — your next study will use it.
        </p>
      )}

      <div className="sp-form-actions">
        <button className="sp-prepare" type="submit" disabled={busy}>
          {busy ? "Saving…" : onboarding ? "Start studying" : "Save profile"}
        </button>
        {onboarding && (
          <button
            type="button"
            className="sp-link-btn"
            disabled={busy}
            onClick={() => save({ ...EMPTY_PROFILE_TEXT })}
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}
