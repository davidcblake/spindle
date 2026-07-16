import { describe, it, expect } from "vitest";
import {
  VOLUMES,
  mergeRanges,
  buildReference,
  validateSelection,
  getVolume,
  chapterCount,
} from "../scripture";
import { parseStudyText } from "../study";

describe("mergeRanges", () => {
  it("merges contiguous runs with an en dash", () => {
    expect(mergeRanges([5, 6, 7, 32])).toBe("5–7, 32");
  });
  it("handles a single chapter", () => {
    expect(mergeRanges([8])).toBe("8");
  });
  it("sorts before merging", () => {
    expect(mergeRanges([3, 1, 2])).toBe("1–3");
  });
  it("handles multiple disjoint ranges", () => {
    expect(mergeRanges([1, 2, 5, 6, 9])).toBe("1–2, 5–6, 9");
  });
});

describe("buildReference (PRD acceptance cases)", () => {
  it('formats "Alma 5, 6, 7, 32" as "Alma 5–7, 32"', () => {
    expect(buildReference("Alma", [5, 6, 7, 32], [])).toBe("Alma 5–7, 32");
  });
  it("collapses single-chapter books to the book name", () => {
    expect(buildReference("Enos", [1], [])).toBe("Enos");
  });
  it("joins D&C sections and Official Declarations with a semicolon", () => {
    expect(
      buildReference("Doctrine and Covenants", [137, 138], ["Official Declaration 1"]),
    ).toBe("Doctrine and Covenants 137–138; Official Declaration 1");
  });
  it("handles extras only", () => {
    expect(buildReference(null, [], ["Official Declaration 2"])).toBe(
      "Official Declaration 2",
    );
  });
});

describe("canonical data", () => {
  it("has 5 volumes with the right book counts", () => {
    expect(VOLUMES).toHaveLength(5);
    expect(getVolume("ot")!.books).toHaveLength(39);
    expect(getVolume("nt")!.books).toHaveLength(27);
    expect(getVolume("bofm")!.books).toHaveLength(15);
    expect(getVolume("pgp")!.books).toHaveLength(5);
  });
  it("has canonical chapter counts", () => {
    expect(chapterCount(getVolume("ot")!, "Psalms")).toBe(150);
    expect(chapterCount(getVolume("ot")!, "Isaiah")).toBe(66);
    expect(chapterCount(getVolume("bofm")!, "Alma")).toBe(63);
    expect(chapterCount(getVolume("nt")!, "Revelation")).toBe(22);
    expect(chapterCount(getVolume("dc")!, "Doctrine and Covenants")).toBe(138);
  });
});

describe("validateSelection (server-side trust boundary)", () => {
  it("accepts a valid selection and rebuilds the reference", () => {
    expect(
      validateSelection({ volumeId: "bofm", book: "Alma", chapters: [5, 6, 7, 32], extras: [] }),
    ).toEqual({ reference: "Alma 5–7, 32", volumeName: "Book of Mormon" });
  });
  it("rejects out-of-range chapters", () => {
    expect(() =>
      validateSelection({ volumeId: "bofm", book: "Jacob", chapters: [8], extras: [] }),
    ).toThrow();
  });
  it("rejects unknown books", () => {
    expect(() =>
      validateSelection({ volumeId: "bofm", book: "Hezekiah", chapters: [1], extras: [] }),
    ).toThrow();
  });
  it("rejects extras on non-D&C volumes", () => {
    expect(() =>
      validateSelection({
        volumeId: "bofm", book: "Alma", chapters: [5], extras: ["Official Declaration 1"],
      }),
    ).toThrow();
  });
  it("rejects empty selections", () => {
    expect(() =>
      validateSelection({ volumeId: "nt", book: null, chapters: [], extras: [] }),
    ).toThrow("Nothing selected.");
  });
  it("rejects more than 20 chapters", () => {
    const many = Array.from({ length: 21 }, (_, i) => i + 1);
    expect(() =>
      validateSelection({ volumeId: "ot", book: "Psalms", chapters: many, extras: [] }),
    ).toThrow(/20 chapters/);
  });
  it("accepts Official Declarations alongside sections", () => {
    expect(
      validateSelection({
        volumeId: "dc",
        book: "Doctrine and Covenants",
        chapters: [137, 138],
        extras: ["Official Declaration 1"],
      }).reference,
    ).toBe("Doctrine and Covenants 137–138; Official Declaration 1");
  });
});

describe("parseStudyText (fallback parser)", () => {
  const valid = {
    placement: "p", background: "b",
    people: [{ name: "n", who: "w", elsewhere: "e" }],
    principles: [{ principle: "p", explanation: "x", elsewhere: "e" }],
    patterns: [{ pattern: "p", meaning: "m", echoes: "e" }],
    christ: "c",
    conference: [{ speaker: "s", talk: "t", session: "April 2024", point: "p" }],
    crossRefs: [{ ref: "r", note: "n" }],
    reflection: ["q1", "q2", "q3"],
    invitation: "i", anchor: "a",
  };
  it("strips code fences and preamble", () => {
    const text = "Here is your study:\n```json\n" + JSON.stringify(valid) + "\n```\nEnjoy!";
    expect(parseStudyText(text).anchor).toBe("a");
  });
  it("detects truncation", () => {
    const full = JSON.stringify(valid);
    const text = full.slice(0, full.length - 10);
    expect(() => parseStudyText(text)).toThrow(/cut off/);
  });
  it("rejects non-JSON text", () => {
    expect(() => parseStudyText("I can't help with that.")).toThrow(/Unexpected study format/);
  });
});
