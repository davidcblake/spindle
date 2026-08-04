/**
 * Scripture-reference → Gospel Library deep links.
 * churchofjesuschrist.org/study URLs open the Gospel Library app when it's
 * installed on iOS, so every reference is one tap from the source text.
 */

const BASE = "https://www.churchofjesuschrist.org/study/scriptures";

/** book display name (as the model writes it) → [volume slug, book slug] */
const BOOK_SLUGS: Record<string, [string, string]> = {
  // Book of Mormon
  "1 Nephi": ["bofm", "1-ne"],
  "2 Nephi": ["bofm", "2-ne"],
  Jacob: ["bofm", "jacob"],
  Enos: ["bofm", "enos"],
  Jarom: ["bofm", "jarom"],
  Omni: ["bofm", "omni"],
  "Words of Mormon": ["bofm", "w-of-m"],
  Mosiah: ["bofm", "mosiah"],
  Alma: ["bofm", "alma"],
  Helaman: ["bofm", "hel"],
  "3 Nephi": ["bofm", "3-ne"],
  "4 Nephi": ["bofm", "4-ne"],
  Mormon: ["bofm", "morm"],
  Ether: ["bofm", "ether"],
  Moroni: ["bofm", "moro"],
  // Old Testament
  Genesis: ["ot", "gen"],
  Exodus: ["ot", "ex"],
  Leviticus: ["ot", "lev"],
  Numbers: ["ot", "num"],
  Deuteronomy: ["ot", "deut"],
  Joshua: ["ot", "josh"],
  Judges: ["ot", "judg"],
  Ruth: ["ot", "ruth"],
  "1 Samuel": ["ot", "1-sam"],
  "2 Samuel": ["ot", "2-sam"],
  "1 Kings": ["ot", "1-kgs"],
  "2 Kings": ["ot", "2-kgs"],
  "1 Chronicles": ["ot", "1-chr"],
  "2 Chronicles": ["ot", "2-chr"],
  Ezra: ["ot", "ezra"],
  Nehemiah: ["ot", "neh"],
  Esther: ["ot", "esth"],
  Job: ["ot", "job"],
  Psalm: ["ot", "ps"],
  Psalms: ["ot", "ps"],
  Proverbs: ["ot", "prov"],
  Ecclesiastes: ["ot", "eccl"],
  "Song of Solomon": ["ot", "song"],
  Isaiah: ["ot", "isa"],
  Jeremiah: ["ot", "jer"],
  Lamentations: ["ot", "lam"],
  Ezekiel: ["ot", "ezek"],
  Daniel: ["ot", "dan"],
  Hosea: ["ot", "hosea"],
  Joel: ["ot", "joel"],
  Amos: ["ot", "amos"],
  Obadiah: ["ot", "obad"],
  Jonah: ["ot", "jonah"],
  Micah: ["ot", "micah"],
  Nahum: ["ot", "nahum"],
  Habakkuk: ["ot", "hab"],
  Zephaniah: ["ot", "zeph"],
  Haggai: ["ot", "hag"],
  Zechariah: ["ot", "zech"],
  Malachi: ["ot", "mal"],
  // New Testament
  Matthew: ["nt", "matt"],
  Mark: ["nt", "mark"],
  Luke: ["nt", "luke"],
  John: ["nt", "john"],
  Acts: ["nt", "acts"],
  Romans: ["nt", "rom"],
  "1 Corinthians": ["nt", "1-cor"],
  "2 Corinthians": ["nt", "2-cor"],
  Galatians: ["nt", "gal"],
  Ephesians: ["nt", "eph"],
  Philippians: ["nt", "philip"],
  Colossians: ["nt", "col"],
  "1 Thessalonians": ["nt", "1-thes"],
  "2 Thessalonians": ["nt", "2-thes"],
  "1 Timothy": ["nt", "1-tim"],
  "2 Timothy": ["nt", "2-tim"],
  Titus: ["nt", "titus"],
  Philemon: ["nt", "philem"],
  Hebrews: ["nt", "heb"],
  James: ["nt", "james"],
  "1 Peter": ["nt", "1-pet"],
  "2 Peter": ["nt", "2-pet"],
  "1 John": ["nt", "1-jn"],
  "2 John": ["nt", "2-jn"],
  "3 John": ["nt", "3-jn"],
  Jude: ["nt", "jude"],
  Revelation: ["nt", "rev"],
  // Doctrine and Covenants
  "Doctrine and Covenants": ["dc-testament", "dc"],
  "D&C": ["dc-testament", "dc"],
  // Pearl of Great Price
  Moses: ["pgp", "moses"],
  Abraham: ["pgp", "abr"],
  "Joseph Smith—Matthew": ["pgp", "js-m"],
  "Joseph Smith—History": ["pgp", "js-h"],
  "Articles of Faith": ["pgp", "a-of-f"],
};

// Longest names first so "1 Nephi" wins over "Nephi"-less partials and
// "Song of Solomon" is tried before "Solomon" would ever match.
const BOOK_ALTERNATION = Object.keys(BOOK_SLUGS)
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/** Matches e.g. "Alma 7:11-12", "D&C 122:8", "3 Nephi 10", "Psalm 23:1". */
export const REFERENCE_RE = new RegExp(
  `(${BOOK_ALTERNATION})\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-–](\\d{1,3}))?)?`,
  "g",
);

export function referenceUrl(
  book: string,
  chapter: string,
  verseStart?: string,
  verseEnd?: string,
): string | null {
  const entry = BOOK_SLUGS[book];
  if (!entry) return null;
  const [volume, slug] = entry;
  let url = `${BASE}/${volume}/${slug}/${chapter}?lang=eng`;
  if (verseStart) {
    const id = verseEnd ? `p${verseStart}-p${verseEnd}` : `p${verseStart}`;
    url += `&id=${id}#p${verseStart}`;
  }
  return url;
}

export interface TextSegment {
  text: string;
  url?: string;
}

/** Splits text into plain and linked segments. Pure function (testable). */
export function segmentReferences(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(REFERENCE_RE)) {
    const [full, book, chapter, verseStart, verseEnd] = match;
    const url = referenceUrl(book, chapter, verseStart, verseEnd);
    if (!url) continue;
    if (match.index! > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: full, url });
    last = match.index! + full.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length > 0 ? segments : [{ text }];
}

/** Gospel Library search link for a conference talk (never guess talk URLs —
 *  a search that lands beats a fabricated link that 404s). */
export function talkSearchUrl(speaker: string, talk: string): string {
  const query = encodeURIComponent(`${talk} ${speaker}`);
  return `https://www.churchofjesuschrist.org/search?lang=eng&query=${query}&facet=general-conference`;
}

// A talk citation as the prompts format it: Speaker — "Title" (Session).
// Deliberately strict — a quoted title and a year in the parenthetical —
// so ordinary prose (an em-dash plus a trailing "(see …)") never misfires.
const TALK_RE = /^(.+?)\s*[—–]\s*["“”'](.+?)["“”']\s*\(([^)]*\d{4}[^)]*)\)\s*$/;

/** Parses a `Speaker — "Title" (Session)` citation. Returns null for anything
 *  that isn't shaped like a talk (e.g. a scripture reference), so callers can
 *  fall back to scripture linking. */
export function parseTalkReference(
  reference: string,
): { speaker: string; talk: string } | null {
  const match = reference.match(TALK_RE);
  if (!match) return null;
  const speaker = match[1].trim();
  const talk = match[2].trim();
  if (!speaker || !talk) return null;
  return { speaker, talk };
}
