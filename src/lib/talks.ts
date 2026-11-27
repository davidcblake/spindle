import TALKS_JSON from "@/lib/talks.json";

/**
 * Checking that every conference talk a model cites is a real one
 * (docs/accuracy-options.md, option B).
 *
 * `talks.json` lists every general conference talk in Gospel Library since
 * 1971 — speaker, title, conference and address, facts only, no talk text —
 * built by `scripts/update-talks.mjs` and refreshed after each conference.
 * A cited talk counts as real when the list has that title by a speaker with
 * that surname. A real one comes back with the list's title, conference and
 * address, so a wrong session is corrected and the link goes straight to the
 * talk instead of to a search.
 */

export interface Talk {
  speaker: string;
  title: string;
  session: string;
  url: string;
}

export const TALKS: readonly Talk[] = TALKS_JSON;

/** A title as it is compared: case, quotation marks and punctuation ignored. */
export function normalizedTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"‘’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The part of a speaker's name that is compared: "President Russell M.
 *  Nelson" and "Russell M. Nelson" are both "nelson". */
export function surname(speaker: string): string {
  const words = speaker
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,?\s+(jr|sr|ii|iii)\.?$/i, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return (words.at(-1) ?? "").replace(/[^a-z-]/g, "");
}

const byTitle = new Map<string, Talk[]>();
for (const talk of TALKS) {
  const key = normalizedTitle(talk.title);
  byTitle.set(key, [...(byTitle.get(key) ?? []), talk]);
}

function year(session: string): number | null {
  const found = session.match(/\d{4}/);
  return found ? Number(found[0]) : null;
}

/** The real talk a citation names, or null if there is none. Where one
 *  speaker gave two talks with the same title, the one nearest the cited
 *  year. */
export function findTalk(speaker: string, title: string, session = ""): Talk | null {
  const sameSpeaker = (byTitle.get(normalizedTitle(title)) ?? []).filter(
    (talk) => surname(talk.speaker) === surname(speaker),
  );
  if (sameSpeaker.length <= 1) return sameSpeaker[0] ?? null;
  const exact = sameSpeaker.find((talk) => talk.session === session.trim());
  if (exact) return exact;
  const cited = year(session);
  if (cited === null) return sameSpeaker[0];
  return [...sameSpeaker].sort((a, b) => Math.abs(year(a.session)! - cited) - Math.abs(year(b.session)! - cited))[0];
}

/** A study's conference entry, as the model writes it. */
export interface CitedTalk {
  speaker: string;
  talk: string;
  session: string;
  point: string;
}

/** Real talks with the list's title, conference and address; the rest are
 *  the citations that are not on the list. */
export function checkTalks<T extends CitedTalk>(cited: T[]): { real: (T & { url: string })[]; unreal: T[] } {
  const real: (T & { url: string })[] = [];
  const unreal: T[] = [];
  for (const entry of cited) {
    const talk = findTalk(entry.speaker, entry.talk, entry.session);
    if (talk) real.push({ ...entry, talk: talk.title.replace(/^[“"]|[”"]$/g, ""), session: talk.session, url: talk.url });
    else unreal.push(entry);
  }
  return { real, unreal };
}

/**
 * What a second try is told when the first cited talks that are not real:
 * which ones, and the real talks those speakers gave, newest first, to choose
 * from. Capped so a prolific speaker does not crowd out the study.
 */
export function talkCorrectionNote(unreal: CitedTalk[], perSpeaker = 60): string {
  const listed = unreal.map((t) => `${t.speaker} — "${t.talk}" (${t.session})`).join("; ");
  const speakers = [...new Set(unreal.map((t) => surname(t.speaker)))].filter(Boolean);
  const real = speakers
    .map((name) => {
      const theirs = TALKS.filter((talk) => surname(talk.speaker) === name)
        .slice()
        .reverse()
        .slice(0, perSpeaker);
      if (theirs.length === 0) return "";
      return `Real general conference talks by ${theirs[0].speaker}: ${theirs
        .map((talk) => `"${talk.title.replace(/^[“"]|[”"]$/g, "")}" (${talk.session})`)
        .join("; ")}.`;
    })
    .filter(Boolean)
    .join("\n");
  return (
    `\n\nA previous draft cited conference talks that are not real general conference talks: ${listed}. ` +
    `Cite only real general conference talks, with the title exactly as published.` +
    (real ? `\n${real}` : "")
  );
}

// A talk in a plan's `reference`, as the plan prompt asks for it:
// Speaker — "Title" (Session). The same shape `lib/links.ts` reads.
const PLAN_TALK_RE = /^(.+?)\s*[—–]\s*["“”'](.+?)["“”']\s*\(([^)]*\d{4}[^)]*)\)\s*$/;

/** A plan item, as the model writes it. */
export interface PlanItemDraft {
  title: string;
  subtitle: string;
  reference: string;
}

/**
 * Plans name talks in each item's `reference`. A real one is rewritten with
 * the list's title and conference, so a wrong date is fixed, and gains the
 * talk's own address (`url`) for a direct link; the items naming talks that are not real are
 * returned apart. Items whose reference is not a talk (scripture, or empty)
 * pass through untouched.
 */
export function checkPlanTalks<T extends PlanItemDraft>(items: T[]): { items: (T & { url?: string })[]; unreal: CitedTalk[] } {
  const checked: (T & { url?: string })[] = [];
  const unreal: CitedTalk[] = [];
  for (const item of items) {
    const match = item.reference.trim().match(PLAN_TALK_RE);
    if (!match) {
      checked.push(item);
      continue;
    }
    const [, speaker, title, session] = match;
    const talk = findTalk(speaker, title, session);
    if (talk) {
      const realTitle = talk.title.replace(/^[“"]|[”"]$/g, "");
      checked.push({ ...item, reference: `${speaker.trim()} — "${realTitle}" (${talk.session})`, url: talk.url });
    } else {
      unreal.push({ speaker: speaker.trim(), talk: title.trim(), session: session.trim(), point: item.subtitle });
    }
  }
  return { items: checked, unreal };
}
