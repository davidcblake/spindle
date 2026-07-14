"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignIn() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) setError("Couldn't start Google sign-in — try again.");
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (authError) {
      setError("Couldn't send the link — check the address and try again.");
    } else {
      setSent(true);
    }
  }

  return (
    <div className="sp-root">
      <div className="sp-signin">
        <div className="sp-signin-mark" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="24" stroke="#1d2f8f" strokeWidth="2.5" />
            <path d="M26 8 L30 22 L44 26 L30 30 L26 44 L22 30 L8 26 L22 22 Z" fill="#2b4bd7" />
            <circle cx="26" cy="26" r="3.5" fill="#e0a428" />
          </svg>
        </div>
        <h1 className="sp-signin-title">Spindle</h1>
        <p className="sp-signin-sub">
          A daily scripture study companion. Prepare a Christ-centered study of any passage,
          and build a journal that follows you to every device.
        </p>

        <button className="sp-signin-btn primary" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="sp-signin-or">or use email</p>

        {sent ? (
          <p className="sp-success" role="status">
            Check your email — tap the link we sent to <strong>{email}</strong> and you&apos;ll be
            signed in. You can close this tab.
          </p>
        ) : (
          <form onSubmit={sendMagicLink}>
            <div className="sp-field">
              <label className="sp-field-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="sp-input"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="sp-signin-btn" type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}

        {error && <p className="sp-error">{error}</p>}

        <p className="sp-signin-note">
          No password to remember — sign in with Google or a link sent to your email.
        </p>
      </div>

      <div className="sp-footer">
        <div className="sp-rule" aria-hidden="true" />
        <p className="sp-verse">“Feast upon the words of Christ; for behold, the words of Christ will tell you all things what ye should do.”</p>
        <p className="sp-verse-ref">2 Nephi 32:3</p>
      </div>
    </div>
  );
}
