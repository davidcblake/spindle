"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Profile, EMPTY_PROFILE } from "@/lib/profile";

interface Props {
  supabase: SupabaseClient;
  userId: string;
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
  onboarding?: boolean;
  onSignOut?: () => void;
  email?: string;
}

const FIELDS: {
  key: keyof Omit<Profile, "id">;
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

export default function ProfileTab({
  supabase,
  userId,
  profile,
  onSaved,
  onboarding = false,
  onSignOut,
  email,
}: Props) {
  const [values, setValues] = useState<Omit<Profile, "id">>({
    ...EMPTY_PROFILE,
    ...(profile
      ? {
          first_name: profile.first_name,
          calling: profile.calling,
          family_context: profile.family_context,
          study_focus: profile.study_focus,
          spiritual_season: profile.spiritual_season,
        }
      : {}),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function set(key: keyof Omit<Profile, "id">, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(valuesToSave: Omit<Profile, "id">) {
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
    onSaved({ id: userId, ...valuesToSave });
  }

  return (
    <div className="sp-card">
      {onboarding ? (
        <>
          <p className="sp-label">Welcome</p>
          <p className="sp-intro">
            Tell Spindle a little about yourself and every study will be prepared for{" "}
            <em>you</em> — your calling, your family, your season of life. Everything is
            optional, private to you, and editable any time.
          </p>
        </>
      ) : (
        <p className="sp-intro">
          Your profile shapes every study you prepare. Everything is optional and private to
          you.
          {email ? (
            <>
              {" "}
              Signed in as <strong>{email}</strong>.
            </>
          ) : null}
        </p>
      )}

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
              onClick={() => save({ ...EMPTY_PROFILE })}
            >
              Skip for now
            </button>
          )}
          {!onboarding && onSignOut && (
            <button type="button" className="sp-link-btn" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
