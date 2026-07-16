"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { WifiOff, CloudOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JournalEntry } from "@/lib/study";
import type { Profile } from "@/lib/profile";
import {
  cacheJournal,
  readCachedJournal,
  cacheEntry,
  removeCachedEntry,
  queuePendingDelete,
  drainPendingDeletes,
  clearPendingDelete,
} from "@/lib/journalCache";
import SignIn from "./SignIn";
import PrepareTab from "./PrepareTab";
import StudyView from "./StudyView";
import JournalTab from "./JournalTab";
import ProfileTab from "./ProfileTab";

type Tab = "prepare" | "journal" | "profile";
type Mode = "select" | "loading" | "study";

// Guest mode (on by default while testing): the app signs in anonymously and
// never shows the sign-in screen. Set NEXT_PUBLIC_GUEST_MODE=0 in Vercel to
// restore email sign-in. Requires "Allow anonymous sign-ins" in Supabase.
const GUEST_MODE = process.env.NEXT_PUBLIC_GUEST_MODE !== "0";

export interface Selection {
  volumeId: string;
  book: string | null;
  chapters: number[];
  extras: string[];
  reference: string;
}

export default function SpindleApp() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [tab, setTab] = useState<Tab>("prepare");
  const [mode, setMode] = useState<Mode>("select");
  const [study, setStudy] = useState<JournalEntry | null>(null);
  const [loadingRef, setLoadingRef] = useState("");
  const [error, setError] = useState("");
  const [syncNote, setSyncNote] = useState("");

  /* ---- connectivity ---- */
  const online = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true, // server snapshot
  );

  /* ---- auth ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        setUser(data.user);
        return;
      }
      if (GUEST_MODE) {
        // Guest mode: silently create an anonymous session so the app is
        // usable with no sign-in screen. When real login returns, Supabase
        // can attach an email to this same user, preserving the journal.
        const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
        if (!cancelled) setUser(anonError ? null : (anon.user ?? null));
      } else {
        setUser(null);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      else if (!GUEST_MODE) setUser(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  /* ---- profile ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setProfile(undefined);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, calling, family_context, study_focus, spiritual_season")
        .eq("id", user.id)
        .maybeSingle<Profile>();
      if (!cancelled) setProfile(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  /* ---- journal: server first, cache fallback ---- */
  const loadJournal = useCallback(async () => {
    if (!user) return;
    if (navigator.onLine) {
      const { data, error: loadError } = await supabase
        .from("journal_entries")
        .select("id, reference, volume, anchor, content, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!loadError && data) {
        const entries: JournalEntry[] = data.map((row) => ({
          id: row.id,
          reference: row.reference,
          volume: row.volume,
          date: row.created_at,
          anchor: row.anchor,
          content: row.content,
        }));
        setJournal(entries);
        await cacheJournal(entries);
        return;
      }
    }
    setJournal(await readCachedJournal());
  }, [supabase, user]);

  useEffect(() => {
    // loadJournal only sets state after awaiting the network/IndexedDB,
    // so this can't cascade renders synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJournal();
  }, [loadJournal]);

  /* ---- replay offline deletes on reconnect ---- */
  useEffect(() => {
    if (!online || !user) return;
    (async () => {
      const pending = await drainPendingDeletes();
      for (const id of pending) {
        const { error: delError } = await supabase.from("journal_entries").delete().eq("id", id);
        if (!delError) await clearPendingDelete(id);
      }
      if (pending.length > 0) setSyncNote("");
    })();
  }, [online, user, supabase]);

  /* ---- prepare a study ---- */
  async function prepareStudy(selection: Selection) {
    setError("");
    setLoadingRef(selection.reference);
    setMode("loading");
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volumeId: selection.volumeId,
          book: selection.book,
          chapters: selection.chapters,
          extras: selection.extras,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.entry) {
        throw new Error(
          data?.error?.message ?? "Couldn't reach the study service — check your connection.",
        );
      }
      const entry: JournalEntry = data.entry;
      setStudy(entry);
      setJournal((prev) => [entry, ...prev]);
      await cacheEntry(entry);
      setMode("study");
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "Failed to fetch"
          ? e.message
          : "Couldn't reach the study service — check your connection.",
      );
      setMode("select");
    }
  }

  /* ---- journal actions ---- */
  function openEntry(entry: JournalEntry) {
    setStudy(entry);
    setMode("study");
    setTab("prepare");
  }

  async function deleteEntry(id: string) {
    const entry = journal.find((j) => j.id === id);
    if (!entry) return;
    if (!window.confirm(`Delete your study of ${entry.reference}? This can't be undone.`)) return;

    setJournal((prev) => prev.filter((j) => j.id !== id));
    if (study?.id === id) {
      setStudy(null);
      setMode("select");
    }
    await removeCachedEntry(id);

    const { error: delError } = await supabase.from("journal_entries").delete().eq("id", id);
    if (delError) {
      await queuePendingDelete(id);
      setSyncNote("Deleted on this device — will finish syncing when you're back online.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setJournal([]);
    setStudy(null);
    setMode("select");
    setTab("prepare");
    await cacheJournal([]);
  }

  /* ---- render ---- */
  if (user === undefined) {
    return <div className="sp-root" />; // auth state resolving — avoid a sign-in flash
  }

  if (user === null) {
    return <SignIn />;
  }

  const needsOnboarding = profile === null;

  return (
    <div className="sp-root">
      <header className="sp-header">
        <h1 className="sp-title">Spindle</h1>
        <p className="sp-tagline">Feast upon the words of Christ</p>
        {!online && (
          <div className="sp-offline-badge" role="status">
            <WifiOff size={12} aria-hidden="true" /> Offline — journal available
          </div>
        )}
      </header>

      {syncNote && (
        <p className="sp-sync-note no-print" role="status">
          <CloudOff size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />
          {syncNote}
        </p>
      )}

      {needsOnboarding ? (
        <ProfileTab
          supabase={supabase}
          userId={user.id}
          profile={null}
          onSaved={(p) => setProfile(p)}
          onboarding
        />
      ) : (
        <>
          <div className="sp-tabs no-print" role="tablist" aria-label="Spindle sections">
            {(
              [
                ["prepare", "Prepare"],
                ["journal", `Journal`],
                ["profile", "Profile"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`sp-tab ${tab === id ? "active" : ""}`}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "journal" && journal.length > 0 && (
                  <span className="sp-count">({journal.length})</span>
                )}
              </button>
            ))}
          </div>

          {tab === "prepare" && mode === "select" && (
            <PrepareTab online={online} error={error} onPrepare={prepareStudy} />
          )}

          {tab === "prepare" && mode === "loading" && (
            <div className="sp-loading" role="status">
              <svg
                className="sp-spin"
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <div className="sp-loading-ref">{loadingRef}</div>
              <div className="sp-loading-note">
                Searching the scriptures and gathering connections…
              </div>
            </div>
          )}

          {tab === "prepare" && mode === "study" && study && (
            <StudyView
              entry={study}
              onBack={() => {
                setMode("select");
                setError("");
              }}
              onJournal={() => setTab("journal")}
            />
          )}

          {tab === "journal" && (
            <JournalTab
              entries={journal}
              online={online}
              onOpen={openEntry}
              onDelete={deleteEntry}
            />
          )}

          {tab === "profile" && (
            <ProfileTab
              supabase={supabase}
              userId={user.id}
              profile={profile ?? null}
              onSaved={(p) => setProfile(p)}
              onSignOut={user.is_anonymous ? undefined : signOut}
              email={user.is_anonymous ? "" : (user.email ?? "")}
            />
          )}
        </>
      )}

      <div className="sp-footer">
        <div className="sp-rule" aria-hidden="true" />
        <p className="sp-verse">
          “And we talk of Christ, we rejoice in Christ, we preach of Christ, we prophesy of
          Christ… that our children may know to what source they may look for a remission of
          their sins.”
        </p>
        <p className="sp-verse-ref">2 Nephi 25:26</p>
      </div>
    </div>
  );
}
