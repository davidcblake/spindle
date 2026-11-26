#!/usr/bin/env node
// Builds src/lib/talks.json: every general conference talk in Gospel Library,
// as facts only — speaker, title, conference and its address. No talk text.
//
// Run after each April and October conference:
//   NODE_USE_ENV_PROXY=1 node scripts/update-talks.mjs
//
// Reads one index page per conference (about 110), half a second apart, and
// writes the list in a stable order so a re-run's diff shows only what is new.
// Why this list exists: docs/accuracy-options.md, option B.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = "https://www.churchofjesuschrist.org";
const FIRST_YEAR = 1971; // the earliest conference Gospel Library carries
const MONTHS = { "04": "April", 10: "October" };
// Index entries that are not talks.
const NOT_A_TALK =
  /^(the )?(sustaining of church officers|church auditing|audit report|church finance committee report|statistical report|video presentation)/i;

const OUT = fileURLToPath(new URL("../src/lib/talks.json", import.meta.url));

function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;| /g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every talk on one conference's index page: the page's list of talk cards,
 *  each with a speaker and a title. Session cards have no speaker. */
export function talksOnPage(html, year, month) {
  const talks = [];
  const card = new RegExp(
    `<a href="/study/general-conference/${year}/${month}/([^"?]+)\\?lang=eng" class="[^"]*list-tile[^"]*">(.*?)</a>`,
    "gs",
  );
  for (const [, slug, inner] of html.matchAll(card)) {
    const speaker = decode(inner.match(/<p class="primaryMeta"[^>]*>(.*?)<\/p>/s)?.[1] ?? "");
    const title = decode(inner.match(/<p class="title"[^>]*>(.*?)<\/p>/s)?.[1] ?? "");
    if (!title || !speaker || slug.endsWith("-session") || NOT_A_TALK.test(title)) continue;
    talks.push({
      speaker,
      title,
      session: `${MONTHS[month]} ${year}`,
      url: `${SITE}/study/general-conference/${year}/${month}/${slug}?lang=eng`,
    });
  }
  return talks;
}

async function fetchPage(year, month) {
  const url = `${SITE}/study/general-conference/${year}/${month}?lang=eng`;
  const response = await fetch(url, {
    headers: { "user-agent": "Spindle talk list (a free scripture study app); runs twice a year" },
  });
  if (response.status === 404) return null; // a conference not held yet
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

async function main() {
  const all = [];
  const thisYear = new Date().getFullYear();
  for (let year = FIRST_YEAR; year <= thisYear; year++) {
    for (const month of ["04", "10"]) {
      const html = await fetchPage(year, month);
      if (html) {
        const talks = talksOnPage(html, year, month);
        if (talks.length === 0) throw new Error(`No talks found for ${month}/${year}: the page layout may have changed`);
        all.push(...talks);
        console.log(`${MONTHS[month]} ${year}: ${talks.length} talks`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  writeFileSync(OUT, JSON.stringify(all, null, 0).replace(/},{/g, "},\n{") + "\n");
  console.log(`${all.length} talks written to src/lib/talks.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
