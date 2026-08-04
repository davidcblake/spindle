import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PlanSchema, type GeneratedPlan } from "@/lib/plans";
import { buildPlanPrompt, type ReaderProfile } from "@/lib/server/prompt";

export const maxDuration = 60;

const RequestSchema = z.object({
  request: z.string().min(3).max(500),
});

const HOURLY_LIMIT = 5;
const TOTAL_LIMIT = 50;

function err(status: number, message: string, type?: string) {
  return NextResponse.json({ error: { message, type: type ?? "error" } }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Please sign in to create a study plan.", "auth");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Invalid request.");
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return err(400, "Describe the plan you'd like in a sentence or two (up to 500 characters).");
  }

  // Rate limits: creations per hour and total plans.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabase
    .from("study_plans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if ((recent ?? 0) >= HOURLY_LIMIT) {
    return err(429, "You've created several plans this hour — try again a little later.", "rate_limit");
  }
  const { count: total } = await supabase
    .from("study_plans")
    .select("id", { count: "exact", head: true });
  if ((total ?? 0) >= TOTAL_LIMIT) {
    return err(429, "You've reached the plan limit — delete a plan you've finished to make room.", "rate_limit");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, calling, family_context, study_focus, spiritual_season, conference_scope")
    .eq("id", user.id)
    .maybeSingle<ReaderProfile>();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  let plan: GeneratedPlan | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !plan; attempt++) {
    try {
      const response = await anthropic.messages.parse({
        model,
        max_tokens: 8192,
        system: buildPlanPrompt(profile ?? null),
        messages: [
          {
            role: "user",
            content: `Create a study plan for this request: ${parsed.data.request}`,
          },
        ],
        output_config: { format: zodOutputFormat(PlanSchema) },
      });
      if (response.stop_reason === "max_tokens") {
        lastError = "The plan came out too long — try describing a narrower topic.";
        continue;
      }
      if (response.parsed_output && response.parsed_output.items.length > 0) {
        plan = response.parsed_output;
      } else {
        lastError = "The plan came back in an unexpected shape — tap again.";
      }
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionError) {
        return err(502, "Couldn't reach the study service — check your connection.", "network");
      }
      if (e instanceof Anthropic.RateLimitError) {
        return err(429, "The study service is busy — wait a moment and tap again.", "rate_limit");
      }
      if (e instanceof Anthropic.APIError) {
        return err(502, `The study service returned an error (${e.status ?? "unknown"}): ${e.message}`, "api");
      }
      lastError = e instanceof Error ? e.message : "Unknown error.";
    }
  }
  if (!plan) return err(502, lastError || "Couldn't create that plan — tap again.");

  // Persist plan, then items (cap at 60 regardless of what the model sent).
  const { data: planRow, error: planError } = await supabase
    .from("study_plans")
    .insert({
      user_id: user.id,
      title: plan.title.slice(0, 200),
      description: plan.description.slice(0, 1000),
      request: parsed.data.request,
    })
    .select("id, title, description, created_at")
    .single();
  if (planError || !planRow) return err(500, "The plan was generated but couldn't be saved — tap again.");

  const items = plan.items.slice(0, 60).map((item, i) => ({
    plan_id: planRow.id,
    user_id: user.id,
    position: i + 1,
    title: item.title.slice(0, 300),
    subtitle: item.subtitle.slice(0, 500),
    reference: item.reference.slice(0, 300),
  }));
  const { data: itemRows, error: itemsError } = await supabase
    .from("plan_items")
    .insert(items)
    .select("id, position, title, subtitle, reference, completed_at");
  if (itemsError || !itemRows) {
    await supabase.from("study_plans").delete().eq("id", planRow.id);
    return err(500, "The plan couldn't be saved completely — tap again.");
  }

  return NextResponse.json({
    plan: {
      id: planRow.id,
      title: planRow.title,
      description: planRow.description,
      created_at: planRow.created_at,
      items: itemRows.sort((a, b) => a.position - b.position),
    },
  });
}
