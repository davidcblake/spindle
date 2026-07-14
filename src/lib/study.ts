import { z } from "zod";

/** The ten-section study contract between the API and the UI (PRD §6.2). */
export const StudySchema = z.object({
  placement: z.string(),
  background: z.string(),
  people: z.array(
    z.object({ name: z.string(), who: z.string(), elsewhere: z.string() }),
  ),
  principles: z.array(
    z.object({ principle: z.string(), explanation: z.string(), elsewhere: z.string() }),
  ),
  patterns: z.array(
    z.object({ pattern: z.string(), meaning: z.string(), echoes: z.string() }),
  ),
  christ: z.string(),
  crossRefs: z.array(z.object({ ref: z.string(), note: z.string() })),
  reflection: z.array(z.string()),
  invitation: z.string(),
  anchor: z.string(),
});

export type Study = z.infer<typeof StudySchema>;

export interface JournalEntry {
  id: string;
  reference: string;
  volume: string;
  date: string; // ISO 8601
  anchor: string;
  content: Study;
}

/**
 * Tolerant parser for raw model text (fallback path — the primary path uses
 * the API's structured outputs). Strips code fences, extracts the first
 * `{` … last `}`, and distinguishes "unexpected format" from truncation.
 */
export function parseStudyText(text: string): Study {
  const clean = text.replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a === -1 || b <= a) {
    throw new Error(`Unexpected study format. It began: "${clean.slice(0, 160)}"`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean.slice(a, b + 1));
  } catch {
    throw new Error(
      "The study was cut off before finishing. Try fewer chapters, or tap Prepare Study again.",
    );
  }
  const result = StudySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("The study came back in an unexpected shape. Tap Prepare Study to try again.");
  }
  return result.data;
}
