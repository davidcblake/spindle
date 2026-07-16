/** The study sections a user can show/hide (Settings → Study sections).
 *  Order here is render order. Keys match StudySchema fields. */
export const SECTION_DEFS: { key: string; title: string }[] = [
  { key: "placement", title: "Where This Sits" },
  { key: "background", title: "Background & Context" },
  { key: "people", title: "People & Connections" },
  { key: "principles", title: "Principles & Doctrine" },
  { key: "patterns", title: "Patterns & Types" },
  { key: "christ", title: "Christ at the Center" },
  { key: "conference", title: "From General Conference" },
  { key: "crossRefs", title: "Cross-References" },
  { key: "reflection", title: "For Reflection" },
  { key: "invitation", title: "Invitation to Act" },
  { key: "anchor", title: "Remember This" },
];
