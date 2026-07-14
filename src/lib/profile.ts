export interface Profile {
  id: string;
  first_name: string;
  calling: string;
  family_context: string;
  study_focus: string;
  spiritual_season: string;
}

export const EMPTY_PROFILE: Omit<Profile, "id"> = {
  first_name: "",
  calling: "",
  family_context: "",
  study_focus: "",
  spiritual_season: "",
};
