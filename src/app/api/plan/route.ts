import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ReaderProfile } from "@/lib/server/prompt";
import { generatePlan } from "@/lib/server/generate";

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

  // Generate (lib/server/generate.ts: model per decision 0005, one retry,
  // specific messages, items already capped to what is saved below).
  const generated = await generatePlan(parsed.data.request, profile ?? null);
  if (!generated.ok) return err(generated.status, generated.message, generated.type);
  const plan = generated.value;

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
