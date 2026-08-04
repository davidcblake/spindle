import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateSelection } from "@/lib/scripture";
import { StudySchema, type Study } from "@/lib/study";
import { buildSystemPrompt, type ReaderProfile } from "@/lib/server/prompt";

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

  // 5. Generate with structured outputs; retry once on validation failure.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const system = buildSystemPrompt(profile ?? null);
  const userMessage = `Prepare a complete study for: ${reference} (${volumeName}).`;

  let study: Study | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !study; attempt++) {
    try {
      const response = await anthropic.messages.parse({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: userMessage }],
        output_config: { format: zodOutputFormat(StudySchema) },
      });
      if (response.stop_reason === "max_tokens") {
        lastError = "The study was cut off — try fewer chapters, or tap again.";
        continue;
      }
      if (response.parsed_output) {
        study = response.parsed_output;
      } else {
        lastError = "The study came back in an unexpected shape.";
      }
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionError) {
        return err(502, "Couldn't reach the study service — check your connection.", "network");
      }
      if (e instanceof Anthropic.RateLimitError) {
        return err(429, "The study service is busy — wait a moment and tap again.", "rate_limit");
      }
      if (e instanceof Anthropic.APIError) {
        return err(
          502,
          `The study service returned an error (${e.status ?? "unknown"}): ${e.message}`,
          "api",
        );
      }
      lastError = e instanceof Error ? e.message : "Unknown error.";
    }
  }
  if (!study) {
    return err(502, lastError || "The study service returned an empty response — tap again.");
  }

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
