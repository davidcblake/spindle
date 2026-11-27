import { z } from "zod";

/** Contract for AI-generated study plans (Plans tab, Beta). */
export const PlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  items: z.array(
    z.object({
      title: z.string(),
      subtitle: z.string(),
      /** A linkable pointer: scripture reference, or talk as
       *  `Speaker — "Title" (Session)`, or empty when not applicable. */
      reference: z.string(),
    }),
  ),
});

export type GeneratedPlan = z.infer<typeof PlanSchema>;

/** A plan as the server hands it back: an item naming a real conference talk
 *  also carries that talk's Gospel Library address, from `lib/talks.ts` —
 *  never from the model. */
export type PreparedPlan = Omit<GeneratedPlan, "items"> & {
  items: (GeneratedPlan["items"][number] & { url?: string })[];
};

export interface PlanItem {
  id: string;
  position: number;
  title: string;
  subtitle: string;
  reference: string;
  completed_at: string | null;
}

export interface StudyPlan {
  id: string;
  title: string;
  description: string;
  created_at: string;
  items: PlanItem[];
}
