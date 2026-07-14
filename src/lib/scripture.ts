/**
 * Canonical scripture data + reference-building helpers.
 * Ported verbatim from the validated prototype (PRD §4.1, §6.4).
 * This module is shared by the client (selection UI) and the server
 * (/api/study rebuilds and validates the reference from raw selection).
 */

export interface Volume {
  id: "bofm" | "ot" | "nt" | "dc" | "pgp";
  name: string;
  books: [name: string, chapters: number][];
  extras?: string[];
}

export const VOLUMES: Volume[] = [
  {
    id: "bofm",
    name: "Book of Mormon",
    books: [
      ["1 Nephi", 22], ["2 Nephi", 33], ["Jacob", 7], ["Enos", 1], ["Jarom", 1],
      ["Omni", 1], ["Words of Mormon", 1], ["Mosiah", 29], ["Alma", 63], ["Helaman", 16],
      ["3 Nephi", 30], ["4 Nephi", 1], ["Mormon", 9], ["Ether", 15], ["Moroni", 10],
    ],
  },
  {
    id: "ot",
    name: "Old Testament",
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
    id: "nt",
    name: "New Testament",
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
    id: "dc",
    name: "Doctrine and Covenants",
    books: [["Doctrine and Covenants", 138]],
    extras: ["Official Declaration 1", "Official Declaration 2"],
  },
  {
    id: "pgp",
    name: "Pearl of Great Price",
    books: [
      ["Moses", 8], ["Abraham", 5], ["Joseph Smith—Matthew", 1],
      ["Joseph Smith—History", 1], ["Articles of Faith", 1],
    ],
  },
];

export const SINGLE_CHAPTER_BOOKS = [
  "Enos", "Jarom", "Omni", "Words of Mormon", "4 Nephi", "Philemon",
  "2 John", "3 John", "Jude", "Obadiah",
  "Joseph Smith—Matthew", "Joseph Smith—History", "Articles of Faith",
];

/** Sorts and merges contiguous runs with an en dash: [5,6,7,32] → "5–7, 32". */
export function mergeRanges(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === prev + 1) {
      prev = s[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = s[i];
    prev = s[i];
  }
  return parts.join(", ");
}

/** Builds the display reference, collapsing single-chapter books and joining extras with "; ". */
export function buildReference(
  book: string | null,
  chapters: number[],
  extras: string[],
): string {
  const pieces: string[] = [];
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

export function getVolume(id: string): Volume | undefined {
  return VOLUMES.find((v) => v.id === id);
}

export function chapterCount(volume: Volume, book: string): number {
  const entry = volume.books.find(([name]) => name === book);
  return entry ? entry[1] : 0;
}

/**
 * Server-side validation of a raw selection. Returns the trusted, rebuilt
 * reference or throws. Never trust a client-supplied reference string —
 * rebuilding it here prevents prompt injection via the passage field.
 */
export function validateSelection(input: {
  volumeId: string;
  book: string | null;
  chapters: number[];
  extras: string[];
}): { reference: string; volumeName: string } {
  const volume = getVolume(input.volumeId);
  if (!volume) throw new Error("Unknown volume.");

  const extras = input.extras ?? [];
  for (const e of extras) {
    if (!volume.extras?.includes(e)) throw new Error("Invalid selection.");
  }

  let book: string | null = null;
  let chapters: number[] = [];
  if (input.chapters.length > 0) {
    if (!input.book) throw new Error("Invalid selection.");
    const max = chapterCount(volume, input.book);
    if (max === 0) throw new Error("Invalid selection.");
    const unique = [...new Set(input.chapters)];
    if (unique.length > 20) throw new Error("Please select 20 chapters or fewer.");
    for (const c of unique) {
      if (!Number.isInteger(c) || c < 1 || c > max) throw new Error("Invalid selection.");
    }
    book = input.book;
    chapters = unique;
  }

  if (!book && extras.length === 0) throw new Error("Nothing selected.");

  return { reference: buildReference(book, chapters, extras), volumeName: volume.name };
}
