import { REFERENCE_RE } from "@/lib/links";
import { VERSE_COUNTS } from "@/lib/verseCounts";

/**
 * Checking that every scripture reference a model writes actually exists
 * (docs/accuracy-options.md, option A).
 *
 * It finds references the same way the links do (`REFERENCE_RE`), so anything
 * that would become a Gospel Library link is checked, and nothing else is.
 */

/** Names a study may use for a book, mapped to the name the counts use. */
const ALIASES: Record<string, string> = {
  Psalm: "Psalms",
  "D&C": "Doctrine and Covenants",
};

export interface ReferenceProblem {
  /** The reference as written, e.g. "Alma 32:45". */
  written: string;
  /** What it should become if it cannot be put right: "Alma 32", or "Alma". */
  repair: string;
  reason: "no such chapter" | "no such verse";
}

/** The problems with one reference, or null if it exists. */
function check(written: string, bookAsWritten: string, chapter: number, from?: number, to?: number): ReferenceProblem | null {
  const counts = VERSE_COUNTS[ALIASES[bookAsWritten] ?? bookAsWritten];
  if (!counts) return null; // not a book the counts know; the link step decides
  const verses = counts[chapter - 1];
  if (!verses || chapter < 1) {
    return { written, repair: bookAsWritten, reason: "no such chapter" };
  }
  const last = to ?? from;
  if (from !== undefined && (from < 1 || (last ?? from) > verses || (to !== undefined && to < from))) {
    return { written, repair: `${bookAsWritten} ${chapter}`, reason: "no such verse" };
  }
  return null;
}

/** Every reference in `text` that does not exist. */
export function referenceProblems(text: string): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  for (const match of text.matchAll(new RegExp(REFERENCE_RE.source, "g"))) {
    const [written, book, chapter, from, to] = match;
    const problem = check(
      written,
      book,
      Number(chapter),
      from === undefined ? undefined : Number(from),
      to === undefined ? undefined : Number(to),
    );
    if (problem) problems.push(problem);
  }
  return problems;
}

/** `text` with every reference that does not exist cut back to one that does. */
export function repairReferences(text: string): string {
  let repaired = text;
  for (const problem of referenceProblems(text)) {
    repaired = repaired.split(problem.written).join(problem.repair);
  }
  return repaired;
}

/** Every string anywhere inside a value — a study, a plan — in order. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Every reference anywhere in a study or plan that does not exist. */
export function problemsIn(value: unknown): ReferenceProblem[] {
  return strings(value).flatMap(referenceProblems);
}

/** A copy of a study or plan with every string's references repaired. */
export function repairedCopy<T>(value: T): T {
  if (typeof value === "string") return repairReferences(value) as T;
  if (Array.isArray(value)) return value.map(repairedCopy) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairedCopy(v)])) as T;
  }
  return value;
}

/**
 * One line per chapter of the passage, telling the model how many verses it
 * has, so it never cites a verse past the end. "Alma 32 has 43 verses."
 */
export function verseCountNote(book: string | null, chapters: number[]): string {
  if (!book) return "";
  const counts = VERSE_COUNTS[book];
  if (!counts) return "";
  return [...new Set(chapters)]
    .sort((a, b) => a - b)
    .filter((c) => counts[c - 1])
    .map((c) => `${book} ${c} has ${counts[c - 1]} verses.`)
    .join(" ");
}
