import { describe, it, expect } from "vitest";
import { segmentReferences, referenceUrl, talkSearchUrl, parseTalkReference } from "../links";

describe("referenceUrl", () => {
  it("builds verse-range links", () => {
    expect(referenceUrl("Alma", "7", "11", "12")).toBe(
      "https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/7?lang=eng&id=p11-p12#p11",
    );
  });
  it("builds single-verse links", () => {
    expect(referenceUrl("Hebrews", "4", "15")).toBe(
      "https://www.churchofjesuschrist.org/study/scriptures/nt/heb/4?lang=eng&id=p15#p15",
    );
  });
  it("builds chapter links", () => {
    expect(referenceUrl("3 Nephi", "10")).toBe(
      "https://www.churchofjesuschrist.org/study/scriptures/bofm/3-ne/10?lang=eng",
    );
  });
  it("handles D&C", () => {
    expect(referenceUrl("D&C", "122", "8")).toBe(
      "https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/122?lang=eng&id=p8#p8",
    );
  });
  it("returns null for unknown books", () => {
    expect(referenceUrl("Hezekiah", "1")).toBeNull();
  });
});

describe("segmentReferences", () => {
  it("links references inside prose", () => {
    const segs = segmentReferences(
      "His conversion is recounted in Mosiah 27:8-31 and Alma 36:6-24.",
    );
    const linked = segs.filter((s) => s.url);
    expect(linked.map((s) => s.text)).toEqual(["Mosiah 27:8-31", "Alma 36:6-24"]);
    expect(segs.map((s) => s.text).join("")).toBe(
      "His conversion is recounted in Mosiah 27:8-31 and Alma 36:6-24.",
    );
  });
  it("handles en-dash verse ranges", () => {
    const segs = segmentReferences("See Alma 7:11–12 for the doctrine.");
    expect(segs.find((s) => s.url)?.text).toBe("Alma 7:11–12");
  });
  it("prefers longer book names (1 Nephi over Nephi fragments)", () => {
    const segs = segmentReferences("Compare 1 Nephi 3:7 and 2 Nephi 25:26.");
    expect(segs.filter((s) => s.url).map((s) => s.text)).toEqual([
      "1 Nephi 3:7",
      "2 Nephi 25:26",
    ]);
  });
  it("links Doctrine and Covenants by full name", () => {
    const segs = segmentReferences("Doctrine and Covenants 122:8 teaches this.");
    expect(segs.find((s) => s.url)?.url).toContain("/dc-testament/dc/122");
  });
  it("returns whole text when nothing matches", () => {
    expect(segmentReferences("No references here.")).toEqual([
      { text: "No references here." },
    ]);
  });
});

describe("parseTalkReference", () => {
  it("parses a Speaker — \"Title\" (Session) citation", () => {
    expect(
      parseTalkReference('Elder David A. Bednar — "Bear Up Their Burdens with Ease" (April 2014)'),
    ).toEqual({ speaker: "Elder David A. Bednar", talk: "Bear Up Their Burdens with Ease" });
  });
  it("handles curly quotes", () => {
    expect(
      parseTalkReference("President Russell M. Nelson — “Think Celestial!” (October 2023)"),
    ).toEqual({ speaker: "President Russell M. Nelson", talk: "Think Celestial!" });
  });
  it("returns null for a scripture reference", () => {
    expect(parseTalkReference("Alma 42:13-25")).toBeNull();
    expect(parseTalkReference("Doctrine and Covenants 6:9; 64:7")).toBeNull();
  });
  it("does not misfire on prose with an em-dash and a trailing parenthetical", () => {
    expect(
      parseTalkReference("faith — and hope — unto salvation (see Alma 32)"),
    ).toBeNull();
  });
  it("requires a year in the session", () => {
    expect(parseTalkReference('Someone — "A Title" (a devotional)')).toBeNull();
  });
});

describe("talkSearchUrl", () => {
  it("builds a conference-scoped search", () => {
    const url = talkSearchUrl("Elder David A. Bednar", "Bear Up Their Burdens with Ease");
    expect(url).toContain("churchofjesuschrist.org/search");
    expect(url).toContain("facet=general-conference");
    expect(url).toContain(encodeURIComponent("Bear Up Their Burdens with Ease"));
  });
});
