# Product Requirements Document — Scripture Study Companion

**Version:** 1.0
**Owner:** Dave Blake
**Status:** Ready for build
**Target builder:** Claude Code
**Prototype reference:** `scripture-study-companion.jsx` (working React prototype from Claude.ai artifacts; reuse its data, prompt, parsing, and design tokens)

---

## 1. Overview

Scripture Study Companion is a daily scripture study app for members of The Church of Jesus Christ of Latter-day Saints. The user selects a passage from the standard works with a tap-based interface modeled on the Gospel Library app, and the app generates a structured, Christ-centered study using the Anthropic API. Every study is automatically archived in a personal study journal that compounds over time and works offline.

### 1.1 Problem statement

The primary user reads scripture daily but struggles to connect people, principles, patterns, and doctrine **across** the four standard works. Existing tools (Gospel Library, manuals) are excellent for reading but do not synthesize cross-volume connections on demand or build a personal, cumulative record of insights.

### 1.2 Product goals

1. Make preparing a rich, connected study of any passage a sub-60-second task.
2. Surface cross-references and patterns across all four standard works in every study.
3. Point every study to Jesus Christ, His Atonement, and His Resurrection.
4. Build a compounding, searchable study journal the user owns.
5. Work reliably on iPhone/iPad, including offline reading of past studies.

### 1.3 Non-goals (v1)

- Multi-user accounts, sharing, or social features
- Full scripture text display (link out to Gospel Library / ChurchofJesusChrist.org instead)
- Come, Follow Me calendar integration (v2 candidate)
- Android/desktop native apps (responsive web app covers them in v1)

---

## 2. Target user & context

- **Primary user:** An adult member and stake-level leader (counselor in a stake presidency, former bishop). Studies daily, comfortable with technology, uses iPhone and iPad, often dictates and taps rather than types.
- **Usage context:** Morning/evening personal study, talk and lesson preparation, quick reference during ministering and leadership settings.
- **Accessibility:** Larger readable type, high contrast, respects `prefers-reduced-motion`, full keyboard/VoiceOver operability.

---

## 3. Core user flows

### Flow A — Prepare a study (happy path)
1. Open app → **Prepare** tab.
2. Tap a **Volume** (Book of Mormon, Old Testament, New Testament, Doctrine and Covenants, Pearl of Great Price).
3. Tap a **Book** (skipped for D&C, which goes straight to sections).
4. Tap one or more **chapter tiles** (multi-select; no typing anywhere).
5. Selection bar shows a live formatted reference (e.g., "Alma 5–7, 32").
6. Tap **Prepare Study** → loading state → rendered study appears.
7. Study is auto-saved to the Journal.

### Flow B — Revisit the journal
1. Open **Journal** tab → reverse-chronological list of entries (reference, date, one-line "anchor").
2. Tap an entry → full study re-renders exactly as originally generated.
3. Swipe/tap to delete an entry (with confirm).
4. Works fully offline.

### Flow C — Export
1. From any study view, tap **Print / Save PDF** → print-optimized layout via the platform print dialog.

### Flow D — Offline
1. If the device is offline: banner appears ("Offline — journal available"), Prepare is disabled with a friendly message, Journal is fully readable.
2. Writes that fail while offline are queued and synced when connectivity returns.

---

## 4. Functional requirements

### 4.1 Passage selection

| ID | Requirement |
|----|-------------|
| SEL-1 | Selection is 100% tap-based: volume pills → book pills → chapter number tiles. No text input. |
| SEL-2 | Chapter tiles support multi-select; selected tiles use the primary blue fill with an amber focus ring. |
| SEL-3 | Contiguous chapters merge into ranges in the displayed reference: `[5,6,7,32]` → "Alma 5–7, 32" (en dash). |
| SEL-4 | Single-chapter books (Enos, Jarom, Omni, Words of Mormon, 4 Nephi, Philemon, 2–3 John, Jude, Obadiah, JS—Matthew, JS—History, Articles of Faith) display as the book name alone, no chapter number. |
| SEL-5 | Doctrine and Covenants shows sections 1–138 plus two wide tiles: **Official Declaration 1** and **Official Declaration 2**, selectable alongside sections (reference joins with "; "). |
| SEL-6 | Pearl of Great Price books: Moses (8), Abraham (5), Joseph Smith—Matthew, Joseph Smith—History, Articles of Faith. |
| SEL-7 | Changing volume or book clears the chapter selection. |
| SEL-8 | Prepare Study is disabled until at least one chapter/section/declaration is selected. |

**Canonical chapter counts** (validated in prototype QA): BoM — 1 Ne 22, 2 Ne 33, Jacob 7, Mosiah 29, Alma 63, Hel 16, 3 Ne 30, Morm 9, Ether 15, Moro 10 (+ five single-chapter books). OT — 39 books, Genesis 50 … Malachi 4 (Psalms 150, Isaiah 66). NT — 27 books, Matthew 28 … Revelation 22. Full table lives in the prototype's `VOLUMES` constant; copy it verbatim.

### 4.2 Study generation (AI)

| ID | Requirement |
|----|-------------|
| GEN-1 | Studies are generated by the Anthropic Messages API. Model: use the current mid-tier model (Sonnet class) by default; make the model string a config value. |
| GEN-2 | The system prompt establishes a faithful, Christ-centered Latter-day Saint gospel-scholar persona that teaches from the standard works and living prophets, distinguishes doctrine from policy/history/speculation, and emphasizes cross-standard-works connections. Use the prompt from the prototype verbatim as the starting point. |
| GEN-3 | The model must return **structured JSON only** (no markdown fences) matching the schema in §6.2. Use the API's structured output/tool-use features if available; otherwise enforce via prompt + robust parsing. |
| GEN-4 | Parser must tolerate: code fences, preamble text before `{`, trailing text after `}`. It must detect truncation (unparseable JSON) and surface a retry message suggesting fewer chapters. |
| GEN-5 | Response budget: prompt for concise sections (exactly 2 items per array) so responses complete reliably; set `max_tokens` with ~30% headroom above observed response sizes. |
| GEN-6 | Every generated study is immediately persisted to the journal before display. |
| GEN-7 | Errors are specific and human-readable: network failure, API error (with type/message), empty response, truncated response. Never a bare "something went wrong." |

### 4.3 Study journal

| ID | Requirement |
|----|-------------|
| JRN-1 | Every prepared study auto-saves: `{ id, reference, volume, date (ISO), anchor, content (full JSON) }`. |
| JRN-2 | Journal lists entries reverse-chronologically showing reference, formatted date, and the anchor sentence in quotes. |
| JRN-3 | Tapping an entry re-renders the full study from stored content (no re-generation, no network). |
| JRN-4 | Entries can be deleted with confirmation. |
| JRN-5 | Storage is local-first (IndexedDB via a wrapper like `idb`, or localStorage for v1 simplicity) so the journal is readable offline and survives app restarts. |
| JRN-6 | (v1.1) Optional sync to a backend for cross-device journal continuity. |

### 4.4 Offline mode

| ID | Requirement |
|----|-------------|
| OFF-1 | App detects connectivity via `navigator.onLine` + online/offline events. |
| OFF-2 | Offline: header badge shown; Prepare Study blocked with explanatory message; Journal fully functional. |
| OFF-3 | Failed persistence attempts are retried automatically on reconnect; user sees a "saved on this device, will sync" note when applicable. |
| OFF-4 | Ship as a PWA: web app manifest + service worker caching the app shell, so it installs to the home screen and opens offline. |

### 4.5 Export

| ID | Requirement |
|----|-------------|
| EXP-1 | Print / Save PDF button on every study view triggers `window.print()` with a print stylesheet: hide chrome (`.no-print`), white background, `break-inside: avoid` on sections. |

---

## 5. Study content specification

Each rendered study contains exactly these ten sections, in order:

1. **Where This Sits** — narrative placement (2 sentences)
2. **Background & Context** — historical/cultural/textual context (3–4 sentences)
3. **People & Connections** — 2 people/groups: who they are here + where else they appear across the standard works, with references
4. **Principles & Doctrine** — 2 principles: explanation + where else taught, with references
5. **Patterns & Types** — 2 patterns/symbols: meaning + where they echo, with references
6. **Christ at the Center** — devotional paragraph on how the passage testifies of Jesus Christ, His Atonement and Resurrection (3 sentences)
7. **Cross-References** — 2 references, each with a one-sentence note on why it connects
8. **For Reflection** — exactly 3 questions
9. **Invitation to Act** — one specific, practical invitation for the week
10. **Remember This** — a single vivid recall-anchor sentence (also used as the journal preview line)

Content standards: quote scripture accurately with references; prefer official Church sources; never present speculation as doctrine; when uncertain of a quotation, paraphrase and cite.

---

## 6. Technical specification

### 6.1 Recommended architecture

```
apps/
  web/          # React + Vite + TypeScript PWA (UI, journal, offline)
  api/          # Minimal backend proxy (Node/Express, or serverless functions)
```

- **Frontend:** React 18 + TypeScript + Vite. State: React hooks (no heavy state library needed). Styling: CSS variables + plain CSS or Tailwind, matching §7 tokens.
- **Backend proxy (required):** A tiny endpoint `POST /api/study` that accepts `{ reference, volume }`, injects the system prompt, calls the Anthropic Messages API with the server-held `ANTHROPIC_API_KEY`, and returns parsed JSON. **The API key must never ship to the browser.** Add basic rate limiting and a shared-secret or simple auth so only Dave's clients can call it.
- **Hosting:** Vercel or similar (static frontend + serverless function). HTTPS required for PWA install.
- **Persistence:** IndexedDB (journal), service worker (app shell). No server-side journal in v1.

### 6.2 Study JSON schema (contract between API and UI)

```json
{
  "placement": "string",
  "background": "string",
  "people": [{ "name": "string", "who": "string", "elsewhere": "string" }],
  "principles": [{ "principle": "string", "explanation": "string", "elsewhere": "string" }],
  "patterns": [{ "pattern": "string", "meaning": "string", "echoes": "string" }],
  "christ": "string",
  "crossRefs": [{ "ref": "string", "note": "string" }],
  "reflection": ["string", "string", "string"],
  "invitation": "string",
  "anchor": "string"
}
```

Arrays contain exactly 2 items (reflection: exactly 3). Validate server-side with zod; on validation failure, retry generation once before returning an error.

### 6.3 Journal entry model

```ts
interface JournalEntry {
  id: string;          // uuid
  reference: string;   // "Alma 5–7, 32"
  volume: string;      // "Book of Mormon"
  date: string;        // ISO 8601
  anchor: string;      // recall sentence
  content: Study;      // full schema above
  synced?: boolean;    // reserved for v1.1 sync
}
```

### 6.4 Key algorithms (port from prototype — already unit-tested)

- `mergeRanges(nums: number[]): string` — sorts, merges contiguous runs with en dash, joins with ", ".
- `buildReference(volume, book, chapters, extras): string` — applies single-chapter-book collapsing, D&C naming, "; " joining of Official Declarations.
- `parseStudyText(text: string): Study` — strips fences, extracts first `{` … last `}`, JSON.parse, distinguishes "unexpected format" vs "truncated" errors.

### 6.5 System prompt

Reuse the prototype's `PROMPT` constant verbatim (persona + schema + length constraints). Keep it server-side in the proxy.

---

## 7. Design specification

**Direction:** modern, clean product design (per approved redesign) — not ornamental.

### 7.1 Tokens

```css
--bg: #f6f7f9;        /* app background */
--surface: #ffffff;   /* cards */
--surface-2: #eef1f6; /* inputs, insets */
--blue: #2b4bd7;      /* primary actions */
--blue-deep: #1d2f8f; /* selected states, headings accent */
--blue-soft: #e6ebfc; /* hover fills */
--amber: #e0a428;     /* selection focus ring */
--ink: #171a23;       /* text */
--ink-soft: #5b6172;  /* secondary text */
--line: #e3e6ee;      /* borders */
--danger: #c23d3d;
--radius: 16px;
```

### 7.2 Typography

- **Display/headings:** Sora (600–700)
- **Body/UI:** Inter (400–600)
- Section titles: 13px Sora 700, uppercase, letter-spacing 0.06em, `--blue-deep`, hairline rule after.

### 7.3 Signature components

- **Tabs:** segmented control (pill container `--surface-2`, active pill white with soft shadow).
- **Chapter tiles:** square, 12px radius, 1px `--line` border; selected = `--blue-deep` fill, white numeral, 2px `--amber` outer ring.
- **Reference header ("plate"):** gradient card `--blue-deep → --blue`, white Sora reference, subtle shadow (successor to the prototype's engraved gold plate).
- **Anchor block:** near-black card, centered white text.
- **Christ at the Center:** `--blue-soft` panel with light blue border.
- **Sticky selection bar:** bottom of the selection card; live reference left, primary button right; safe-area padding.

### 7.4 Accessibility

- All interactive elements: visible `:focus-visible` outline (2px `--blue`).
- Toggle tiles/pills expose `aria-pressed`.
- Honor `prefers-reduced-motion` (disable transitions/spinner animation).
- Color contrast ≥ WCAG AA for all text.
- Footer of every view: 2 Nephi 25:26 quotation with reference.

---

## 8. Error handling & edge cases

| Case | Behavior |
|------|----------|
| API network failure | "Couldn't reach the study service — check your connection." Retry button. |
| API returns error object | Show `type` + `message` verbatim beneath a friendly line. |
| Truncated JSON | "The study was cut off — try fewer chapters or tap again." Auto-retry once server-side. |
| Empty selection | Prepare disabled; bar reads "Nothing selected yet." |
| Very large selection (e.g., 20 chapters) | Allowed, but prompt instructs synthesis across the span; consider soft warning above 10. |
| Storage quota / private browsing | Journal falls back to in-memory with visible "won't persist" note. |
| Duplicate study same passage | Allowed — each is a new dated entry (studies evolve). |

---

## 9. Milestones

**M1 — Skeleton (day 1):** Vite + TS scaffold, tokens, tabs, volume/book/chapter selection with reference building (port `VOLUMES`, `mergeRanges`, `buildReference` + their unit tests).
**M2 — Generation (day 2):** API proxy with key + zod validation, loading state, full ten-section study rendering, error states.
**M3 — Journal + offline (day 3):** IndexedDB persistence, journal list/detail/delete, offline detection, PWA manifest + service worker, print stylesheet.
**M4 — Polish (day 4):** accessibility pass, reduced-motion, iPhone/iPad visual QA, deploy, Add-to-Home-Screen walkthrough.

## 10. Acceptance criteria (v1 ship checklist)

- [ ] Can prepare a study of "3 Nephi 8" in under 60 seconds from cold open on iPhone.
- [ ] "Alma 5, 6, 7, 32" selection displays as "Alma 5–7, 32"; Enos displays as "Enos".
- [ ] D&C 137, 138 + OD 1 selectable together → "Doctrine and Covenants 137–138; Official Declaration 1".
- [ ] All ten sections render for every study; arrays validated (2/2/2/2, 3 reflection).
- [ ] Airplane mode: journal opens and every past study is readable; clear offline messaging.
- [ ] Kill and reopen the app: journal intact.
- [ ] Print produces a clean single-document PDF of a study.
- [ ] API key absent from all client bundles (verify in build output).
- [ ] VoiceOver can complete Flow A end to end.

## 11. Open questions / v2 backlog

- Come, Follow Me weekly auto-suggestion on the Prepare tab
- Journal search and tags; export journal to Markdown/Word
- Cross-device sync (simple auth + hosted journal)
- "Talk builder" mode that assembles multiple journal entries into an outline
- Verse-level selection (currently chapter-level by design)
