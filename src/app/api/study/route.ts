import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateSelection } from "@/lib/scripture";
import type { ReaderProfile } from "@/lib/server/prompt";
import { generateStudy } from "@/lib/server/generate";

export const maxDuration = 60; // Vercel function limit; generation is well under this

const RequestSchema = z.object({
  volumeId: z.string(),
  book: z.string().nullable(),
  chapters: z.array(z.number()).max(80),
  extras: z.array(z.string()).max(2),
});

const HOURLY_LIMIT = 15;

function err(status: number, message: string, type?: string) {
  return NextResponse.json({ error: { message, type: type ?? "error" } }, { status });
}

export async function POST(request: Request) {
  // 1. Auth — only signed-in users may spend API credits.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Please sign in to prepare a study.", "auth");

  // 2. Validate the selection and rebuild the reference server-side.
  //    The client never supplies free text that reaches the prompt.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Invalid request.");
  }
  const parsedBody = RequestSchema.safeParse(body);
  if (!parsedBody.success) return err(400, "Invalid request.");

  let reference: string;
  let volumeName: string;
  try {
    ({ reference, volumeName } = validateSelection(parsedBody.data));
  } catch (e) {
    return err(400, e instanceof Error ? e.message : "Invalid selection.");
  }

  // 3. Rate limit — per-user, sliding hour, counted against saved studies.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if (countError) return err(500, "Couldn't check your study history — try again.");
  if ((count ?? 0) >= HOURLY_LIMIT) {
    return err(
      429,
      "You've prepared a lot of studies this hour — take a few minutes to ponder, then try again.",
      "rate_limit",
    );
  }

  // 4. Load the profile for personalization (missing profile is fine).
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, calling, family_context, study_focus, spiritual_season, conference_scope")
    .eq("id", user.id)
    .maybeSingle<ReaderProfile>();

  // 5. Generate (lib/server/generate.ts: model per decision 0005, one retry
  //    on validation failure, specific messages).
  const generated = await generateStudy(reference, volumeName, profile ?? null);
  if (!generated.ok) return err(generated.status, generated.message, generated.type);
  const study = generated.value;

  // 6. Persist BEFORE returning (GEN-6) — the entry exists even if the
  //    response never reaches the device. RLS scopes the insert to the user.
  const { data: entry, error: insertError } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      reference,
      volume: volumeName,
      anchor: study.anchor ?? "",
      content: study,
    })
    .select("id, reference, volume, anchor, content, created_at")
    .single();

  if (insertError || !entry) {
    return err(500, "The study was generated but couldn't be saved — tap again.");
  }

  return NextResponse.json({
    entry: {
      id: entry.id,
      reference: entry.reference,
      volume: entry.volume,
      date: entry.created_at,
      anchor: entry.anchor,
      content: entry.content,
    },
  });
}
