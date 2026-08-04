export type ConferenceScope = "core" | "expanded";

export interface Profile {
  id: string;
  first_name: string;
  calling: string;
  family_context: string;
  study_focus: string;
  spiritual_season: string;
  /** Section keys (see lib/sections.ts) the user has chosen to hide. */
  hidden_sections: string[];
  /** How broadly to source general-conference teachings. */
  conference_scope: ConferenceScope;
}

export const EMPTY_PROFILE: Omit<Profile, "id"> = {
  first_name: "",
  calling: "",
  family_context: "",
  study_focus: "",
  spiritual_season: "",
  hidden_sections: [],
  conference_scope: "core",
};
