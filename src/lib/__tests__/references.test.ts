import { describe, it, expect } from "vitest";
import { VERSE_COUNTS } from "../verseCounts";
import { VOLUMES } from "../scripture";
import {
  problemsIn,
  referenceProblems,
  repairReferences,
  repairedCopy,
  verseCountNote,
} from "../references";

describe("the verse counts", () => {
  it("cover every chapter of every book Spindle offers, and no more", () => {
    for (const volume of VOLUMES) {
      for (const [book, chapters] of volume.books) {
        expect(VERSE_COUNTS[book]?.length, book).toBe(chapters);
      }
    }
  });
  it.each([
    ["Psalms", 119, 176],
    ["Doctrine and Covenants", 138, 60],
    ["Alma", 32, 43],
    ["Moroni", 10, 34],
    ["John", 3, 36],
    ["Joseph Smith—History", 1, 75],
  ])("%s %i has %i verses", (book, chapter, verses) => {
    expect(VERSE_COUNTS[book][chapter - 1]).toBe(verses);
  });
});

describe("referenceProblems", () => {
  it("finds nothing wrong with real references", () => {
    expect(
      referenceProblems("See Alma 32:21, Ether 12:6, D&C 122:8, Psalm 23:1 and Moroni 10:4–5."),
    ).toEqual([]);
  });
  it("catches a verse past the end of the chapter", () => {
    expect(referenceProblems("as in Alma 32:45")).toEqual([
      { written: "Alma 32:45", repair: "Alma 32", reason: "no such verse" },
    ]);
  });
  it("catches a range that runs past the end", () => {
    expect(referenceProblems("Moroni 10:30-40")[0]?.reason).toBe("no such verse");
  });
  it("catches a chapter that does not exist", () => {
    expect(referenceProblems("read Alma 70:3")).toEqual([
      { written: "Alma 70:3", repair: "Alma", reason: "no such chapter" },
    ]);
  });
  it("catches a D&C section that does not exist, by either name", () => {
    expect(referenceProblems("D&C 140:1")[0]?.reason).toBe("no such chapter");
    expect(referenceProblems("Doctrine and Covenants 139")[0]?.reason).toBe("no such chapter");
  });
});

describe("repairing", () => {
  it("cuts a wrong verse back to its chapter, and leaves the rest alone", () => {
    expect(repairReferences("Compare Alma 32:45 with Ether 12:6.")).toBe("Compare Alma 32 with Ether 12:6.");
  });
  it("finds and repairs references anywhere in a study", () => {
    const study = { christ: "See 3 Nephi 11:99.", crossRefs: [{ ref: "Alma 70:1", note: "fine" }] };
    expect(problemsIn(study)).toHaveLength(2);
    expect(repairedCopy(study)).toEqual({ christ: "See 3 Nephi 11.", crossRefs: [{ ref: "Alma", note: "fine" }] });
  });
});

describe("verseCountNote", () => {
  it("tells the model how long each chapter is", () => {
    expect(verseCountNote("Alma", [32, 31])).toBe("Alma 31 has 38 verses. Alma 32 has 43 verses.");
  });
  it("says nothing when there is no book (a declaration on its own)", () => {
    expect(verseCountNote(null, [])).toBe("");
  });
});
