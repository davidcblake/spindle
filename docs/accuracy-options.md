# Keeping studies accurate — options for later

**Written 2026-10-10. Nothing here is decided or built.** Dave asked to note these and come
back to them if needed. Read this before building anything that touches how studies cite
scripture or conference talks.

## The risk, from highest to lowest

1. **Conference talks** — an invented title, the wrong speaker, the wrong session.
2. **Scripture references** — a real chapter with a verse that doesn't exist.
3. **Quotations** — wording that drifts from the real verse.
4. **Doctrine** — lowest; the system prompt (`lib/server/prompt.ts`) already holds the model
   to what living prophets and official curriculum teach.

Already in place: the prompt's no-fabrication rules, Gospel Library links on every reference
(talks link to a search, never a guessed address), and Sonnet 5.5 for plans about talks
(decision 0005).

## The options, cheapest first

| | What | Catches | Needs permission? |
|---|---|---|---|
| **A** | Check every scripture reference against a table of verse counts after generation; fix or drop any that don't exist | Wrong verse numbers, every time | No |
| **B** | Check every talk against a list of real talks (title, speaker, session); drop or replace any not on it | Invented talks | Probably not for a list of facts — but see below |
| **C** | "The 10/10": look up the passage's verses, cross-references and the talks that cite it *before* writing; the model may only cite from that list (enforced by the response schema, not by asking); then check everything after | Prevents rather than catches; better studies | Yes, for the richest sources |

Performance: C adds about a second to a 10–30 second study (lookup ~0.1–0.3s, reading the
sources ~0.5–1s, checks in milliseconds). Cost roughly doubles, from ~0.15¢ to ~0.3¢ a study
on Haiku 5.5.

## Sources worth knowing about

- **No official public Gospel Library API.** The Church's Tech Forum consistently says none
  is published; a 2011 developer beta existed but nothing shows it is still running. The
  app's own web services are undocumented and the content is Intellectual Reserve, Inc.'s —
  don't build on them.
  [Tech Forum](https://tech.churchofjesuschrist.org/forum/viewtopic.php?t=39793) ·
  [2011 announcement](https://lds365.com/2011/07/27/third-party-developer-access-to-church-materials/)
- **[Open Scripture API](https://www.openscriptureapi.org/)** — independent, free, says it
  serves the scripture text and metadata found in Gospel Library. Check its terms; prefer
  downloading once over depending on its server. Good candidate for option A.
- **[BYU Scripture Citation Index](https://scriptures.byu.edu/)** — for any verse, which
  general conference talks cited it, by whom, when, back to 1942. Very nearly the "context
  graph" option C needs. BYU's work: use needs BYU's permission.
- **[Church permissions office](https://www.churchofjesuschrist.org/legal/permissions?lang=eng)**
  — the route for talk text, footnotes and the Topical Guide.

## If this is picked up

Start with A (no permission needed). For B and C, Dave writes to the BYU Scripture Citation
Index team and the Church permissions office describing Spindle as a free, faith-building
study app; the answers decide how far C can go.
