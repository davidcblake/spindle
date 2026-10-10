/**
 * Spindle's standing test set (docs/accuracy-options.md): the same passages,
 * prepared the way the app prepares them, with a report of what went wrong
 * before the checks caught it, what it cost, and every conference talk cited
 * so a person can check them.
 *
 *   ANTHROPIC_API_KEY=… pnpm eval
 *
 * Model settings (SPINDLE_STUDY_MODEL and the rest, decision 0005) apply here
 * exactly as on the server, so a change can be measured before it ships.
 * About 12 studies: a few cents on Haiku 5.5, about 40¢ on Sonnet.
 */
import { describe, it, expect, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateStudy } from "@/lib/server/generate";
import { validateSelection } from "@/lib/scripture";

const PASSAGES: { volumeId: string; book: string | null; chapters: number[]; extras: string[] }[] = [
  { volumeId: "bofm", book: "Alma", chapters: [32], extras: [] },
  { volumeId: "bofm", book: "Alma", chapters: [5, 6, 7], extras: [] },
  { volumeId: "bofm", book: "3 Nephi", chapters: [11], extras: [] },
  { volumeId: "bofm", book: "Moroni", chapters: [10], extras: [] },
  { volumeId: "bofm", book: "Enos", chapters: [1], extras: [] },
  { volumeId: "ot", book: "Isaiah", chapters: [53], extras: [] },
  { volumeId: "ot", book: "Psalms", chapters: [23], extras: [] },
  { volumeId: "nt", book: "John", chapters: [17], extras: [] },
  { volumeId: "nt", book: "Hebrews", chapters: [11], extras: [] },
  { volumeId: "dc", book: "Doctrine and Covenants", chapters: [76], extras: [] },
  { volumeId: "dc", book: "Doctrine and Covenants", chapters: [121], extras: [] },
  { volumeId: "pgp", book: "Moses", chapters: [1], extras: [] },
];

/** Per million tokens, for the estimate only. Check anthropic.com/pricing. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
};

interface Logged {
  event: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  references?: string[];
}

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

describe.skipIf(!hasKey)("standing test set", () => {
  it("prepares every passage, and reports how it went", async () => {
    const rows: string[] = [];
    const talks: string[] = [];
    let cost = 0;
    let failures = 0;

    for (const passage of PASSAGES) {
      const { reference, volumeName } = validateSelection(passage);
      const logged: Logged[] = [];
      const record = (line: unknown) => {
        try {
          logged.push(JSON.parse(String(line)));
        } catch {
          // not one of generate.ts's log lines
        }
      };
      const info = vi.spyOn(console, "info").mockImplementation(record);
      const warn = vi.spyOn(console, "warn").mockImplementation(record);
      const started = Date.now();
      const result = await generateStudy(reference, volumeName, null, passage);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      info.mockRestore();
      warn.mockRestore();

      const generations = logged.filter((l) => l.event === "generated");
      const studyCost = generations.reduce((sum, g) => {
        const [inPrice, outPrice] = PRICES[g.model ?? ""] ?? [0, 0];
        return sum + ((g.input_tokens ?? 0) * inPrice + (g.output_tokens ?? 0) * outPrice) / 1e6;
      }, 0);
      cost += studyCost;
      const wrong = logged.filter((l) => l.event === "reference_problems").flatMap((l) => l.references ?? []);
      const models = generations.map((g) => g.model).join(" → ");
      if (!result.ok) failures++;

      rows.push(
        `| ${reference} | ${result.ok ? "✅" : `❌ ${result.message}`} | ${models} | ${wrong.join(", ") || "—"} | ${seconds}s | ${(studyCost * 100).toFixed(2)}¢ |`,
      );
      if (result.ok) {
        for (const t of result.value.conference) {
          talks.push(`- **${reference}:** ${t.speaker}, "${t.talk}" (${t.session})`);
        }
      }
    }

    const report = [
      `# Standing test set — ${new Date().toISOString().slice(0, 10)}`,
      "",
      `Model settings: study ${process.env.SPINDLE_STUDY_MODEL || process.env.ANTHROPIC_MODEL || "default (decision 0005)"}.`,
      `Total ≈ ${(cost * 100).toFixed(1)}¢ for ${PASSAGES.length} studies; ${failures} failed.`,
      "",
      "| Passage | Result | Model(s) | Verses that didn't exist (before repair) | Time | Cost |",
      "|---|---|---|---|---|---|",
      ...rows,
      "",
      "## Conference talks cited — check each in Gospel Library",
      "",
      ...talks,
      "",
    ].join("\n");

    mkdirSync("evals/results", { recursive: true });
    const file = `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
    writeFileSync(file, report);
    console.log(report);
    console.log(`\nWritten to ${file}`);

    expect(failures).toBe(0);
  });
});
