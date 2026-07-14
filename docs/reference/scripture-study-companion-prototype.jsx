import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Bookmark, Trash2, Printer, Loader2, Sparkles, WifiOff, CloudOff, RefreshCw, Copy } from "lucide-react";

/* ---------------- Scripture data ---------------- */
const VOLUMES = [
  {
    id: "bofm", name: "Book of Mormon",
    books: [
      ["1 Nephi", 22], ["2 Nephi", 33], ["Jacob", 7], ["Enos", 1], ["Jarom", 1],
      ["Omni", 1], ["Words of Mormon", 1], ["Mosiah", 29], ["Alma", 63], ["Helaman", 16],
      ["3 Nephi", 30], ["4 Nephi", 1], ["Mormon", 9], ["Ether", 15], ["Moroni", 10],
    ],
  },
  {
    id: "ot", name: "Old Testament",
    books: [
      ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
      ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
      ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10],
      ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
      ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52], ["Lamentations", 5],
      ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9],
      ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3],
      ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
    ],
  },
  {
    id: "nt", name: "New Testament",
    books: [
      ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
      ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6], ["Ephesians", 6],
      ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
      ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5],
      ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1], ["3 John", 1],
      ["Jude", 1], ["Revelation", 22],
    ],
  },
  {
    id: "dc", name: "Doctrine and Covenants",
    books: [["Doctrine and Covenants", 138]],
    extras: ["Official Declaration 1", "Official Declaration 2"],
  },
  {
    id: "pgp", name: "Pearl of Great Price",
    books: [
      ["Moses", 8], ["Abraham", 5], ["Joseph Smith—Matthew", 1],
      ["Joseph Smith—History", 1], ["Articles of Faith", 1],
    ],
  },
];

const SINGLE_CHAPTER_BOOKS = [
  "Enos", "Jarom", "Omni", "Words of Mormon", "4 Nephi", "Philemon",
  "2 John", "3 John", "Jude", "Obadiah",
  "Joseph Smith—Matthew", "Joseph Smith—History", "Articles of Faith",
];

const PROMPT = `You are a faithful, active, Christ-centered gospel scholar of The Church of Jesus Christ of Latter-day Saints, serving as a daily scripture study companion. Teach from the standard works (KJV Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price) and the teachings of living prophets and apostles. Quote scripture accurately with references. Clearly distinguish official doctrine from Church policy, historical evidence, scholarly opinion, and speculation — never present speculation as doctrine. Your central purpose: help the reader see how stories, people, principles, patterns, and doctrine connect ACROSS all four standard works, and point everything to Jesus Christ, His Atonement, and His Resurrection. The reader is a counselor in a stake presidency who studies daily but struggles to connect the dots across the scriptures. Tone: faith-filled, warm, hopeful, humble, reverent.

Respond with ONLY a valid JSON object — no markdown, no code fences, no preamble, no trailing text. Exact schema:
{
  "placement": "2 sentences: where this passage sits in the narrative arc of its book and volume",
  "background": "3-4 sentences of historical, cultural, and textual context",
  "people": [{"name": "...", "who": "1 sentence: who they are here", "elsewhere": "1 sentence: where else they appear/connect across the standard works, with 1-2 refs"}],
  "principles": [{"principle": "...", "explanation": "1-2 sentences", "elsewhere": "1 sentence: where else taught, with 1-2 refs"}],
  "patterns": [{"pattern": "...", "meaning": "1 sentence", "echoes": "1 sentence: where it echoes, with 1-2 refs"}],
  "christ": "3 sentences: how this passage testifies of Jesus Christ, His Atonement and Resurrection",
  "crossRefs": [{"ref": "Scripture reference", "note": "1 sentence: why it connects"}],
  "reflection": ["question 1", "question 2", "question 3"],
  "invitation": "1-2 sentences: one specific, practical invitation to act this week",
  "anchor": "One vivid, memorable sentence capturing the heart of this passage"
}
LENGTH IS CRITICAL: exactly 2 items in people, principles, patterns, and crossRefs arrays. The complete JSON must be well under 900 tokens so it is never cut off. Keep every reference accurate; if unsure of a quotation, paraphrase and cite rather than misquote.`;

/* ---------------- Helpers ---------------- */
function mergeRanges(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const parts = [];
  let start = s[0], prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === prev + 1) { prev = s[i]; continue; }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = s[i]; prev = s[i];
  }
  return parts.join(", ");
}

function buildReference(volume, book, chapters, extras) {
  const pieces = [];
  if (book && chapters.length) {
    if (SINGLE_CHAPTER_BOOKS.includes(book) && chapters.length === 1 && chapters[0] === 1) {
      pieces.push(book);
    } else {
      pieces.push(`${book} ${mergeRanges(chapters)}`);
    }
  }
  extras.forEach((e) => pieces.push(e));
  return pieces.join("; ");
}

function parseStudyText(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a === -1 || b <= a) {
    throw new Error(`Unexpected study format. It began: "${clean.slice(0, 160)}"`);
  }
  try {
    return JSON.parse(clean.slice(a, b + 1));
  } catch (e) {
    throw new Error("The study was cut off before finishing. Try fewer chapters, or tap Prepare Study again.");
  }
}

/* ---------------- AI caller: supports both artifact AI interfaces ---------------- */
async function callModel(promptText) {
  // Path A: window.claude.complete (available in some artifact environments)
  if (typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function") {
    const reply = await window.claude.complete(promptText);
    return { text: typeof reply === "string" ? reply : JSON.stringify(reply), via: "window.claude.complete" };
  }
  // Path B: direct fetch to the messages endpoint
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: promptText }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`API error (${data.error.type || "unknown"}): ${data.error.message || "no detail"}`);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, via: "fetch" };
}

/* ---------------- Component ---------------- */
export default function ScriptureStudyCompanion() {
  const [tab, setTab] = useState("prepare");           // prepare | journal
  const [mode, setMode] = useState("select");          // select | loading | study
  const [volume, setVolume] = useState(VOLUMES[0]);
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [extras, setExtras] = useState([]);
  const [study, setStudy] = useState(null);
  const [journal, setJournal] = useState([]);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  /* ---- offline awareness ---- */
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  /* ---- load cached journal ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("study-journal", false);
        if (res && res.value) setJournal(JSON.parse(res.value));
      } catch (e) { /* nothing cached yet */ }
    })();
  }, []);

  /* ---- write-through persistence with offline queue ---- */
  const syncJournal = useCallback(async (entries) => {
    try {
      await window.storage.set("study-journal", JSON.stringify(entries), false);
      setPendingSync(false);
      setSyncNote("");
      return true;
    } catch (e) {
      setPendingSync(true);
      setSyncNote("Saved on this device — will sync to your journal when you're back online.");
      return false;
    }
  }, []);

  async function persistJournal(next) {
    setJournal(next);           // always available in-session, even offline
    await syncJournal(next);    // best-effort durable save
  }

  /* ---- retry sync when connection returns ---- */
  useEffect(() => {
    if (online && pendingSync && journal.length) syncJournal(journal);
  }, [online, pendingSync, journal, syncJournal]);

  /* ---- selection ---- */
  function pickVolume(v) {
    setVolume(v);
    setBook(v.books.length === 1 ? v.books[0][0] : null);
    setChapters([]); setExtras([]); setError("");
  }
  function pickBook(b) { setBook(b); setChapters([]); setExtras([]); setError(""); }
  function toggleChapter(n) {
    setChapters((p) => p.includes(n) ? p.filter((c) => c !== n) : [...p, n]);
  }
  function toggleExtra(name) {
    setExtras((p) => p.includes(name) ? p.filter((e) => e !== name) : [...p, name]);
  }

  const reference = buildReference(volume, book, chapters, extras);
  const chapterCount = book ? (volume.books.find((x) => x[0] === book) || [null, 0])[1] : 0;
  const [pasteText, setPasteText] = useState("");
  const [copied, setCopied] = useState(false);

  const fullPrompt = reference
    ? `${PROMPT}\n\nPrepare a complete study for: ${reference} (${volume.name}). Respond with ONLY the JSON object — no other text.`
    : "";

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setError("Couldn't copy automatically — long-press the prompt text below to select and copy it.");
    }
  }

  function renderPasted() {
    try {
      const parsed = parseStudyText(pasteText);
      const entry = {
        id: Date.now().toString(),
        reference,
        volume: volume.name,
        date: new Date().toISOString(),
        anchor: parsed.anchor || "",
        content: parsed,
      };
      setStudy(entry);
      persistJournal([entry, ...journal]);
      setPasteText(""); setError("");
      setMode("study");
    } catch (e) {
      setError(e.message || "That didn't look like a study response — paste Claude's full reply.");
    }
  }

  /* ---- prepare study: manual-first (the automatic AI call is opt-in via tryAutomatic) ---- */
  async function prepareStudy() {
    if (!reference) return;
    setError("");
    setMode("manual");
  }

  async function tryAutomatic() {
    setMode("loading"); setError("");
    try {
      const { text } = await callModel(fullPrompt);
      if (!text) throw new Error("empty");
      const parsed = parseStudyText(text);
      const entry = {
        id: Date.now().toString(),
        reference,
        volume: volume.name,
        date: new Date().toISOString(),
        anchor: parsed.anchor || "",
        content: parsed,
      };
      setStudy(entry);
      await persistJournal([entry, ...journal]);
      setMode("study");
    } catch (e) {
      setMode("manual");
      setError("Automatic generation isn't available on this device — the copy-and-paste steps below always work.");
    }
  }

  async function testConnection() {
    const hasComplete = typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function";
    setError(`Testing… (window.claude.complete ${hasComplete ? "available" : "not available"}; trying ${hasComplete ? "it" : "direct fetch"})`);
    try {
      const { text, via } = await callModel("Reply with exactly: OK");
      setError(text
        ? `Connection works via ${via}. The model replied: "${String(text).slice(0, 80)}"`
        : `Connected via ${via}, but the reply was empty.`);
    } catch (e) {
      setError(`Test failed (${hasComplete ? "window.claude.complete" : "fetch"} path): ${e.message}`);
    }
  }

  function openEntry(entry) { setStudy(entry); setMode("study"); setTab("prepare"); }
  function deleteEntry(id) {
    const next = journal.filter((j) => j.id !== id);
    persistJournal(next);
    if (study && study.id === id) { setStudy(null); setMode("select"); }
  }
  function backToSelect() { setMode("select"); setError(""); }

  const c = study ? study.content : null;

  return (
    <div className="ssc-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        .ssc-root {
          --bg: #f6f7f9;
          --surface: #ffffff;
          --surface-2: #eef1f6;
          --blue: #2b4bd7;
          --blue-deep: #1d2f8f;
          --blue-soft: #e6ebfc;
          --amber: #e0a428;
          --ink: #171a23;
          --ink-soft: #5b6172;
          --line: #e3e6ee;
          --danger: #c23d3d;
          --radius: 16px;
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          padding: 0 0 8px;
          -webkit-font-smoothing: antialiased;
        }
        .ssc-root * { box-sizing: border-box; }

        .ssc-header { text-align: center; padding: 26px 20px 6px; }
        .ssc-title {
          font-family: 'Sora', sans-serif; font-weight: 700;
          font-size: clamp(20px, 5vw, 26px); letter-spacing: -0.02em;
          color: var(--ink); margin: 0;
        }
        .ssc-tagline { font-size: 14px; color: var(--ink-soft); margin: 5px 0 0; }

        .ssc-offline-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--ink); color: #fff;
          border-radius: 999px; padding: 6px 14px; margin-top: 10px;
          font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
        }
        .ssc-sync-note { text-align: center; font-size: 13px; color: var(--ink-soft); margin: 8px 24px 0; }

        .ssc-tabs {
          display: flex; gap: 6px; margin: 16px auto 14px; padding: 5px;
          background: var(--surface-2); border-radius: 999px; width: fit-content;
        }
        .ssc-tab {
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
          border: none; border-radius: 999px;
          background: transparent; color: var(--ink-soft); padding: 9px 22px; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .ssc-tab.active { background: var(--surface); color: var(--blue-deep); box-shadow: 0 1px 4px rgba(23,26,35,0.08); }
        @media (prefers-reduced-motion: reduce) { .ssc-tab { transition: none; } }
        .ssc-tab:focus-visible, .ssc-pill:focus-visible, .ssc-tile:focus-visible,
        .ssc-prepare:focus-visible, .ssc-icon-btn:focus-visible, .ssc-entry:focus-visible,
        .ssc-entry-del:focus-visible, .ssc-back:focus-visible, .ssc-paste:focus-visible {
          outline: 2px solid var(--blue); outline-offset: 2px;
        }
        .ssc-count { margin-left: 5px; opacity: 0.75; }

        .ssc-card {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: var(--radius); margin: 0 16px 16px; padding: 22px 18px;
          max-width: 760px; box-shadow: 0 1px 3px rgba(23,26,35,0.04);
        }
        @media (min-width: 800px) { .ssc-card { margin-left: auto; margin-right: auto; } }

        .ssc-intro { font-size: 15px; line-height: 1.6; color: var(--ink-soft); margin: 0 0 20px; }

        .ssc-label {
          font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--ink-soft); margin: 0 0 10px;
        }
        .ssc-label em { font-style: normal; font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 13px; }

        .ssc-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
        .ssc-pill {
          font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 500;
          background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
          color: var(--ink); padding: 10px 16px; cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .ssc-pill.round { border-radius: 999px; }
        .ssc-pill:hover { border-color: var(--blue); background: var(--blue-soft); }
        .ssc-pill.selected { background: var(--blue-deep); color: #fff; border-color: var(--blue-deep); }
        @media (prefers-reduced-motion: reduce) { .ssc-pill { transition: none; } }

        .ssc-divider { border: none; border-top: 1px solid var(--line); margin: 20px 0; }

        .ssc-tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 8px; }
        .ssc-tile {
          aspect-ratio: 1; border-radius: 12px;
          background: var(--surface); border: 1px solid var(--line);
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500;
          color: var(--ink); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.12s, color 0.12s, box-shadow 0.12s, border-color 0.12s;
        }
        .ssc-tile:hover { border-color: var(--blue); background: var(--blue-soft); }
        .ssc-tile.selected {
          background: var(--blue-deep); color: #fff; border-color: var(--blue-deep);
          box-shadow: 0 0 0 2px var(--amber);
        }
        @media (prefers-reduced-motion: reduce) { .ssc-tile { transition: none; } }
        .ssc-extra-tile { grid-column: span 3; aspect-ratio: auto; padding: 12px 8px; font-size: 12.5px; line-height: 1.3; text-align: center; }
        @media (max-width: 400px) { .ssc-extra-tile { grid-column: span 4; } }

        .ssc-selection-bar {
          position: sticky; bottom: 0; margin-top: 20px;
          background: var(--surface); border-top: 1px solid var(--line);
          padding: 12px 2px calc(12px + env(safe-area-inset-bottom, 0px));
          display: flex; align-items: center; gap: 12px; justify-content: space-between;
        }
        .ssc-selection-ref { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 15px; color: var(--blue-deep); }
        .ssc-prepare {
          background: var(--blue); border: none; border-radius: 12px;
          font-family: 'Sora', sans-serif; font-weight: 600; font-size: 14px;
          color: #fff; padding: 13px 22px; cursor: pointer; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(43,75,215,0.35);
          transition: background 0.12s;
        }
        .ssc-prepare:hover:not(:disabled) { background: var(--blue-deep); }
        .ssc-prepare:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        @media (prefers-reduced-motion: reduce) { .ssc-prepare { transition: none; } }

        .ssc-error { color: var(--danger); text-align: center; font-size: 13.5px; margin: 12px 0 0; user-select: text; word-break: break-word; }
        .ssc-error-actions { text-align: center; margin-top: 8px; }

        .ssc-loading { text-align: center; padding: 70px 20px; }
        .ssc-loading-ref { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 17px; color: var(--ink); margin: 14px 0 6px; }
        .ssc-loading-note { color: var(--ink-soft); font-size: 14px; }
        .ssc-spin { animation: ssc-spin 1.1s linear infinite; color: var(--blue); }
        @keyframes ssc-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .ssc-spin { animation: none; } }

        .ssc-back {
          display: inline-flex; align-items: center; gap: 2px;
          background: none; border: none; color: var(--blue);
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; padding: 6px 8px 6px 0; margin-bottom: 6px;
        }

        .ssc-plate {
          position: relative; margin: 6px 0 20px;
          background: linear-gradient(135deg, var(--blue-deep) 0%, var(--blue) 100%);
          border: none; border-radius: var(--radius);
          padding: 22px 24px; text-align: left;
          box-shadow: 0 4px 16px rgba(29,47,143,0.25);
        }
        .ssc-plate-ref {
          font-family: 'Sora', sans-serif; font-weight: 700;
          font-size: clamp(18px, 4.5vw, 24px); letter-spacing: -0.01em;
          color: #fff; margin: 0;
        }
        .ssc-plate-vol {
          font-family: 'Inter', sans-serif; font-size: 12.5px;
          color: rgba(255,255,255,0.75); margin: 6px 0 0;
        }
        .ssc-rivet { display: none; }

        .ssc-section { margin-bottom: 24px; }
        .ssc-section-title {
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; color: var(--blue-deep);
          margin: 0 0 8px; display: flex; align-items: center; gap: 8px;
        }
        .ssc-section-title::after { content: ""; flex: 1; height: 1px; background: var(--line); }
        .ssc-body-text { font-size: 15.5px; line-height: 1.65; margin: 0 0 8px; }

        .ssc-dropcap::first-letter { font-size: inherit; }

        .ssc-item { margin-bottom: 14px; }
        .ssc-item-name { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 15px; color: var(--ink); }
        .ssc-item-detail { font-size: 15px; line-height: 1.55; margin: 3px 0; }
        .ssc-elsewhere {
          font-size: 13.5px; line-height: 1.5; color: var(--ink-soft);
          background: var(--surface-2); border-radius: 10px; padding: 9px 12px; margin-top: 6px;
        }
        .ssc-elsewhere strong {
          font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue);
          display: block; margin-bottom: 2px;
        }

        .ssc-christ-block {
          background: var(--blue-soft); border: 1px solid rgba(43,75,215,0.2);
          border-radius: 12px; padding: 16px 18px;
          font-size: 15.5px; line-height: 1.65;
        }

        .ssc-xref { display: flex; gap: 10px; margin-bottom: 10px; align-items: baseline; }
        .ssc-xref-ref { font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 600; color: var(--blue-deep); white-space: nowrap; min-width: 30%; }
        .ssc-xref-note { font-size: 14.5px; line-height: 1.5; }

        .ssc-reflection-list { padding-left: 20px; margin: 0; }
        .ssc-reflection-list li { font-size: 15px; line-height: 1.6; margin-bottom: 10px; }

        .ssc-anchor-block {
          background: var(--ink); border: none; border-radius: 12px;
          padding: 18px 20px; text-align: center;
          color: #fff; font-size: 16px; line-height: 1.55; font-weight: 500;
        }

        .ssc-study-actions { display: flex; gap: 10px; margin: 0 0 18px; flex-wrap: wrap; }
        .ssc-icon-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
          font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 600;
          color: var(--ink); padding: 9px 14px; cursor: pointer;
          transition: border-color 0.12s, background 0.12s;
        }
        .ssc-icon-btn:hover { border-color: var(--blue); background: var(--blue-soft); }
        @media (prefers-reduced-motion: reduce) { .ssc-icon-btn { transition: none; } }

        .ssc-entry-row { display: flex; gap: 8px; align-items: stretch; margin-bottom: 10px; }
        .ssc-entry {
          flex: 1; text-align: left; background: var(--surface);
          border: 1px solid var(--line); border-radius: 12px;
          padding: 14px 16px; cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.12s, background 0.12s;
        }
        .ssc-entry:hover { border-color: var(--blue); background: var(--blue-soft); }
        @media (prefers-reduced-motion: reduce) { .ssc-entry { transition: none; } }
        .ssc-entry-ref { font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: var(--blue-deep); }
        .ssc-entry-date { font-size: 12px; color: var(--ink-soft); margin: 3px 0 5px; }
        .ssc-entry-anchor { font-size: 13.5px; line-height: 1.5; color: var(--ink); }
        .ssc-entry-del {
          background: var(--surface); border: 1px solid var(--line); border-radius: 12px; color: var(--danger);
          cursor: pointer; padding: 0 13px; display: flex; align-items: center;
        }
        .ssc-entry-del:hover { border-color: var(--danger); }
        .ssc-empty-journal { text-align: center; color: var(--ink-soft); font-size: 14.5px; line-height: 1.6; padding: 36px 20px; }
        .ssc-journal-offline {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          font-size: 13px; color: var(--ink-soft); margin-bottom: 14px;
        }

        .ssc-manual-heading { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--ink); margin: 6px 0 4px; }
        .ssc-manual-heading em { font-style: normal; color: var(--blue-deep); }
        .ssc-manual-note { font-size: 14px; color: var(--ink-soft); margin: 0 0 18px; line-height: 1.5; }
        .ssc-step { display: flex; gap: 12px; margin-bottom: 20px; }
        .ssc-step-num {
          flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
          background: var(--blue); color: #fff;
          font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
        }
        .ssc-step-body { flex: 1; min-width: 0; }
        .ssc-step-text { font-size: 14.5px; line-height: 1.5; margin: 3px 0 10px; }
        .ssc-paste {
          width: 100%; resize: vertical; background: var(--surface-2);
          border: 1px solid var(--line); border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 13.5px;
          color: var(--ink); padding: 11px 13px; margin-bottom: 10px;
        }
        .ssc-prompt-details { margin-top: 8px; font-size: 13px; color: var(--ink-soft); }
        .ssc-prompt-details summary { cursor: pointer; }
        .ssc-prompt-raw {
          margin-top: 8px; padding: 10px 12px; background: var(--surface-2);
          border: 1px solid var(--line); border-radius: 10px;
          font-size: 11.5px; line-height: 1.45; white-space: pre-wrap;
          user-select: text; max-height: 200px; overflow-y: auto;
        }

        .ssc-footer { text-align: center; padding: 24px 24px 18px; max-width: 640px; margin: 0 auto; }
        .ssc-rule { height: 1px; background: var(--line); margin-bottom: 16px; }
        .ssc-verse { font-size: 13.5px; line-height: 1.6; color: var(--ink-soft); margin: 0; font-style: italic; }
        .ssc-verse-ref { font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue); margin: 8px 0 0; }

        @media print {
          .no-print { display: none !important; }
          .ssc-root { background: #fff; }
          .ssc-section { break-inside: avoid; }
        }
      `}</style>

      <header className="ssc-header">
        <h1 className="ssc-title">Scripture Study Companion</h1>
        <p className="ssc-tagline">Feast upon the words of Christ</p>
        {!online && (
          <div className="ssc-offline-badge">
            <WifiOff size={12} aria-hidden="true" /> Offline — journal available
          </div>
        )}
      </header>

      {syncNote && (
        <p className="ssc-sync-note no-print">
          <CloudOff size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />
          {syncNote}
        </p>
      )}

      <div className="ssc-tabs no-print" role="tablist">
        <button
          className={`ssc-tab ${tab === "prepare" ? "active" : ""}`}
          role="tab" aria-selected={tab === "prepare"}
          onClick={() => setTab("prepare")}
        >
          Prepare
        </button>
        <button
          className={`ssc-tab ${tab === "journal" ? "active" : ""}`}
          role="tab" aria-selected={tab === "journal"}
          onClick={() => setTab("journal")}
        >
          Journal{journal.length > 0 && <span className="ssc-count">({journal.length})</span>}
        </button>
      </div>

      {/* ---------- PREPARE: SELECT ---------- */}
      {tab === "prepare" && mode === "select" && (
        <div className="ssc-card">
          <p className="ssc-intro">
            Choose a passage and prepare a study that traces its people, principles, and doctrine
            across all four standard works — and shows how each points to the Savior.
          </p>

          <p className="ssc-label">Volume</p>
          <div className="ssc-pill-row">
            {VOLUMES.map((v) => (
              <button
                key={v.id}
                className={`ssc-pill ${volume.id === v.id ? "selected" : ""}`}
                aria-pressed={volume.id === v.id}
                onClick={() => pickVolume(v)}
              >
                {v.name}
              </button>
            ))}
          </div>

          {volume.books.length > 1 && (
            <>
              <hr className="ssc-divider" />
              <p className="ssc-label">Book</p>
              <div className="ssc-pill-row">
                {volume.books.map(([name]) => (
                  <button
                    key={name}
                    className={`ssc-pill round ${book === name ? "selected" : ""}`}
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
              <hr className="ssc-divider" />
              <p className="ssc-label">
                {volume.id === "dc" ? "Sections" : "Chapters"} <em>— tap one or more</em>
              </p>
              <div className="ssc-tile-grid">
                {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`ssc-tile ${chapters.includes(n) ? "selected" : ""}`}
                    aria-pressed={chapters.includes(n)}
                    onClick={() => toggleChapter(n)}
                  >
                    {n}
                  </button>
                ))}
                {volume.extras && volume.extras.map((name) => (
                  <button
                    key={name}
                    className={`ssc-tile ssc-extra-tile ${extras.includes(name) ? "selected" : ""}`}
                    aria-pressed={extras.includes(name)}
                    onClick={() => toggleExtra(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div>
              <p className="ssc-error">{error}</p>
              <div className="ssc-error-actions no-print">
                <button className="ssc-icon-btn" onClick={testConnection}>
                  <RefreshCw size={12} aria-hidden="true" /> Test connection
                </button>
              </div>
            </div>
          )}

          <div className="ssc-selection-bar">
            <span className="ssc-selection-ref">{reference || "Nothing selected yet"}</span>
            <button className="ssc-prepare" onClick={prepareStudy} disabled={!reference}>
              Prepare Study
            </button>
          </div>
        </div>
      )}

      {/* ---------- PREPARE: LOADING ---------- */}
      {tab === "prepare" && mode === "loading" && (
        <div className="ssc-loading">
          <Loader2 size={34} className="ssc-spin" aria-hidden="true" />
          <div className="ssc-loading-ref">{reference}</div>
          <div className="ssc-loading-note">Searching the scriptures and gathering connections…</div>
        </div>
      )}

      {/* ---------- PREPARE: MANUAL COPY & PASTE ---------- */}
      {tab === "prepare" && mode === "manual" && (
        <div className="ssc-card">
          <button className="ssc-back no-print" onClick={backToSelect}>
            <ChevronLeft size={16} aria-hidden="true" /> Back
          </button>
          <p className="ssc-manual-heading">Prepare your study of <em>{reference}</em></p>
          <p className="ssc-manual-note">
            Two quick steps with any Claude chat — or try automatic generation if your device supports it.
          </p>

          <div className="ssc-step">
            <span className="ssc-step-num">1</span>
            <div className="ssc-step-body">
              <p className="ssc-step-text">Copy the study prompt, then paste it into any Claude chat and send it.</p>
              <button className="ssc-icon-btn" onClick={copyPrompt}>
                <Copy size={13} aria-hidden="true" /> {copied ? "Copied!" : "Copy study prompt"}
              </button>
            </div>
          </div>

          <div className="ssc-step">
            <span className="ssc-step-num">2</span>
            <div className="ssc-step-body">
              <p className="ssc-step-text">Copy Claude's entire reply and paste it here:</p>
              <textarea
                className="ssc-paste"
                rows={5}
                placeholder="Paste Claude's response…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button className="ssc-prepare" onClick={renderPasted} disabled={!pasteText.trim()}>
                Render Study
              </button>
            </div>
          </div>

          {error && <p className="ssc-error">{error}</p>}

          <div style={{ textAlign: "center", marginTop: 6 }} className="no-print">
            <button className="ssc-icon-btn" onClick={tryAutomatic}>
              <Sparkles size={13} aria-hidden="true" /> Try automatic generation
            </button>
          </div>

          <details className="ssc-prompt-details">
            <summary>View the prompt text (long-press to copy manually)</summary>
            <div className="ssc-prompt-raw">{fullPrompt}</div>
          </details>
        </div>
      )}

      {/* ---------- PREPARE: STUDY ---------- */}
      {tab === "prepare" && mode === "study" && study && c && (
        <div className="ssc-card">
          <button className="ssc-back no-print" onClick={backToSelect}>
            <ChevronLeft size={16} aria-hidden="true" /> New study
          </button>

          <div className="ssc-plate">
            <span className="ssc-rivet tl" aria-hidden="true" /><span className="ssc-rivet tr" aria-hidden="true" />
            <span className="ssc-rivet bl" aria-hidden="true" /><span className="ssc-rivet br" aria-hidden="true" />
            <p className="ssc-plate-ref">{study.reference}</p>
            <p className="ssc-plate-vol">
              {study.volume} · {new Date(study.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="ssc-study-actions no-print">
            <button className="ssc-icon-btn" onClick={() => window.print()}>
              <Printer size={13} aria-hidden="true" /> Print / Save PDF
            </button>
            <button className="ssc-icon-btn" onClick={() => setTab("journal")}>
              <Bookmark size={13} aria-hidden="true" /> Journal
            </button>
          </div>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Where This Sits</h3>
            <p className="ssc-body-text">{c.placement}</p>
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Background &amp; Context</h3>
            <p className="ssc-body-text ssc-dropcap">{c.background}</p>
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">People &amp; Connections</h3>
            {(c.people || []).map((p, i) => (
              <div key={i} className="ssc-item">
                <div className="ssc-item-name">{p.name}</div>
                <p className="ssc-item-detail">{p.who}</p>
                <div className="ssc-elsewhere"><strong>Elsewhere in scripture</strong>{p.elsewhere}</div>
              </div>
            ))}
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Principles &amp; Doctrine</h3>
            {(c.principles || []).map((p, i) => (
              <div key={i} className="ssc-item">
                <div className="ssc-item-name">{p.principle}</div>
                <p className="ssc-item-detail">{p.explanation}</p>
                <div className="ssc-elsewhere"><strong>Also taught in</strong>{p.elsewhere}</div>
              </div>
            ))}
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Patterns &amp; Types</h3>
            {(c.patterns || []).map((p, i) => (
              <div key={i} className="ssc-item">
                <div className="ssc-item-name">{p.pattern}</div>
                <p className="ssc-item-detail">{p.meaning}</p>
                <div className="ssc-elsewhere"><strong>Echoes</strong>{p.echoes}</div>
              </div>
            ))}
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Christ at the Center</h3>
            <div className="ssc-christ-block">{c.christ}</div>
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Cross-References</h3>
            {(c.crossRefs || []).map((x, i) => (
              <div key={i} className="ssc-xref">
                <span className="ssc-xref-ref">{x.ref}</span>
                <span className="ssc-xref-note">{x.note}</span>
              </div>
            ))}
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">For Reflection</h3>
            <ol className="ssc-reflection-list">
              {(c.reflection || []).map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Invitation to Act</h3>
            <p className="ssc-body-text">{c.invitation}</p>
          </section>

          <section className="ssc-section">
            <h3 className="ssc-section-title">Remember This</h3>
            <div className="ssc-anchor-block">
              <Sparkles size={16} style={{ color: "var(--gold-bright)", marginBottom: 6 }} aria-hidden="true" />
              <div>{c.anchor}</div>
            </div>
          </section>
        </div>
      )}

      {/* ---------- JOURNAL ---------- */}
      {tab === "journal" && (
        <div className="ssc-card">
          {!online && (
            <div className="ssc-journal-offline">
              <WifiOff size={14} aria-hidden="true" />
              You're offline — every saved study below is fully readable.
            </div>
          )}
          {journal.length === 0 ? (
            <div className="ssc-empty-journal">
              Your journal is empty. Each study you prepare is saved here automatically —
              and stays readable even without a connection — so your understanding compounds day by day.
            </div>
          ) : (
            journal.map((entry) => (
              <div key={entry.id} className="ssc-entry-row">
                <button className="ssc-entry" onClick={() => openEntry(entry)}>
                  <div className="ssc-entry-ref">{entry.reference}</div>
                  <div className="ssc-entry-date">
                    {new Date(entry.date).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="ssc-entry-anchor">“{entry.anchor}”</div>
                </button>
                <button className="ssc-entry-del" onClick={() => deleteEntry(entry.id)} aria-label={`Delete study of ${entry.reference}`}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="ssc-footer">
        <div className="ssc-rule" aria-hidden="true" />
        <p className="ssc-verse">
          “And we talk of Christ, we rejoice in Christ, we preach of Christ, we prophesy of Christ…
          that our children may know to what source they may look for a remission of their sins.”
        </p>
        <p className="ssc-verse-ref">2 Nephi 25:26</p>
      </div>
    </div>
  );
}
