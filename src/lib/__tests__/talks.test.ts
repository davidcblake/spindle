import { describe, it, expect } from "vitest";
import { TALKS, checkTalks, findTalk, normalizedTitle, surname, talkCorrectionNote } from "../talks";

const point = "A point about the passage.";

describe("the list of real talks", () => {
  it("covers every conference from April 1971, with an address for each talk", () => {
    const sessions = new Set(TALKS.map((t) => t.session));
    expect(sessions.has("April 1971")).toBe(true);
    expect(sessions.has("October 2025")).toBe(true);
    expect(TALKS.length).toBeGreaterThan(3500);
    for (const talk of TALKS) {
      expect(talk.url).toMatch(/^https:\/\/www\.churchofjesuschrist\.org\/study\/general-conference\/\d{4}\/(04|10)\/[^?]+\?lang=eng$/);
    }
  });
  it("holds facts only: no talk text", () => {
    for (const talk of TALKS) expect(Object.keys(talk).sort()).toEqual(["session", "speaker", "title", "url"]);
  });
});

describe("normalizedTitle and surname", () => {
  it("ignore quotation marks, case and punctuation", () => {
    expect(normalizedTitle("“Lord, I Believe”")).toBe(normalizedTitle("Lord, I believe"));
  });
  it("compare speakers by surname, whatever calling is written", () => {
    expect(surname("President Russell M. Nelson")).toBe("nelson");
    expect(surname("Elder Jeffrey R. Holland")).toBe(surname("Jeffrey R. Holland"));
  });
});

describe("findTalk", () => {
  it("finds a real talk, with its true conference and address", () => {
    const talk = findTalk("President Russell M. Nelson", "Let God Prevail", "October 2018");
    expect(talk?.session).toBe("October 2020");
    expect(talk?.url).toContain("/study/general-conference/2020/10/");
  });
  it("finds a title written without its quotation marks", () => {
    expect(findTalk("Elder Jeffrey R. Holland", "Lord, I Believe", "April 2013")?.session).toBe("April 2013");
  });
  it.each([
    // From real studies Dave saw on his phone, 2026-11-26.
    ["President Dallin H. Oaks", "The Atonement and Repentance", "April 2025"],
    ["Elder Jeffrey R. Holland", "Christ and the New Covenant", "October 1997"],
    ["Elder Jeffrey R. Holland", "Come unto Me", "April 1998"],
  ])("finds nothing for %s — %s, which is not a conference talk", (speaker, title, session) => {
    expect(findTalk(speaker, title, session)).toBeNull();
  });
  it("needs the speaker to match, not just the title", () => {
    expect(findTalk("Elder Jeffrey R. Holland", "Let God Prevail")).toBeNull();
  });
});

describe("checkTalks", () => {
  it("keeps real talks with their addresses and sets aside the rest", () => {
    const { real, unreal } = checkTalks([
      { speaker: "President Russell M. Nelson", talk: "Let God Prevail", session: "October 2018", point },
      { speaker: "President Dallin H. Oaks", talk: "The Atonement and Repentance", session: "April 2025", point },
    ]);
    expect(real).toHaveLength(1);
    expect(real[0]).toMatchObject({ speaker: "President Russell M. Nelson", talk: "Let God Prevail", session: "October 2020", point });
    expect(real[0].url).toContain("churchofjesuschrist.org");
    expect(unreal.map((t) => t.talk)).toEqual(["The Atonement and Repentance"]);
  });
  it("gives back the title without the list's quotation marks", () => {
    const { real } = checkTalks([{ speaker: "Jeffrey R. Holland", talk: "Lord, I Believe", session: "April 2013", point }]);
    expect(real[0].talk).toBe("Lord, I Believe");
  });
});

describe("talkCorrectionNote", () => {
  it("names the talk that is not real and lists that speaker's real talks", () => {
    const note = talkCorrectionNote([
      { speaker: "President Dallin H. Oaks", talk: "The Atonement and Repentance", session: "April 2025", point },
    ]);
    expect(note).toContain('"The Atonement and Repentance"');
    expect(note).toContain("Real general conference talks by Dallin H. Oaks");
  });
});
