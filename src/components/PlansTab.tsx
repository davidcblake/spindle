"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronLeft, Trash2, Sparkles, CheckCircle2, Circle } from "lucide-react";
import type { StudyPlan, PlanItem } from "@/lib/plans";
import Linkify from "./Linkify";

interface Props {
  supabase: SupabaseClient;
  online: boolean;
}

const EXAMPLES = [
  "The Savior's teachings in 3 Nephi, one chapter a day",
  "Elder Neal A. Maxwell's best-known conference talks",
  "Mercy across all four standard works",
  "Last general conference, one talk per day",
];

export default function PlansTab({ supabase, online }: Props) {
  const [plans, setPlans] = useState<StudyPlan[] | null>(null);
  const [open, setOpen] = useState<StudyPlan | null>(null);
  const [request, setRequest] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadPlans = useCallback(async () => {
    const { data } = await supabase
      .from("study_plans")
      .select(
        "id, title, description, created_at, plan_items ( id, position, title, subtitle, reference, completed_at )",
      )
      .order("created_at", { ascending: false });
    if (data) {
      setPlans(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          created_at: row.created_at,
          items: ((row.plan_items ?? []) as PlanItem[]).sort((a, b) => a.position - b.position),
        })),
      );
    } else {
      setPlans([]);
    }
  }, [supabase]);

  useEffect(() => {
    // Sets state only after awaiting the network, so no synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlans();
  }, [loadPlans]);

  function applyPlanUpdate(updated: StudyPlan) {
    setPlans((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
    setOpen((prev) => (prev?.id === updated.id ? updated : prev));
  }

  async function createPlan() {
    const text = request.trim();
    if (!text) return;
    setCreating(true);
    setError("");
    // Broad plans can take most of a minute to build. Give the request a
    // generous ceiling (past the server's own 60s limit) so a slow phone
    // connection surfaces the real result instead of aborting early.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.plan) {
        throw new Error(data?.error?.message ?? "Couldn't create that plan — try again.");
      }
      setPlans((prev) => [data.plan, ...(prev ?? [])]);
      setOpen(data.plan);
      setRequest("");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(
          "That plan is taking longer than expected — try a slightly narrower topic (e.g. one theme or one speaker).",
        );
      } else {
        setError(
          e instanceof Error && e.message !== "Failed to fetch"
            ? e.message
            : "Couldn't reach the study service — check your connection.",
        );
      }
    } finally {
      clearTimeout(timeout);
      setCreating(false);
    }
  }

  async function toggleItem(plan: StudyPlan, item: PlanItem) {
    const completed_at = item.completed_at ? null : new Date().toISOString();
    const updatedPlan: StudyPlan = {
      ...plan,
      items: plan.items.map((i) => (i.id === item.id ? { ...i, completed_at } : i)),
    };
    applyPlanUpdate(updatedPlan); // optimistic
    const { error: updateError } = await supabase
      .from("plan_items")
      .update({ completed_at })
      .eq("id", item.id);
    if (updateError) applyPlanUpdate(plan); // revert
  }

  async function deletePlan(plan: StudyPlan) {
    if (!window.confirm(`Delete the plan "${plan.title}"? This can't be undone.`)) return;
    setOpen(null);
    setPlans((prev) => (prev ?? []).filter((p) => p.id !== plan.id));
    await supabase.from("study_plans").delete().eq("id", plan.id);
  }

  /* ---------- plan detail ---------- */
  if (open) {
    const done = open.items.filter((i) => i.completed_at).length;
    return (
      <div className="sp-card">
        <button className="sp-back no-print" onClick={() => setOpen(null)}>
          <ChevronLeft size={16} aria-hidden="true" /> All plans
        </button>
        <div className="sp-plate">
          <p className="sp-plate-ref">{open.title}</p>
          <p className="sp-plate-vol">
            {done} of {open.items.length} complete
          </p>
        </div>
        <p className="sp-intro">
          <Linkify text={open.description} />
        </p>
        {open.items.map((item) => (
          <div key={item.id} className={`sp-plan-item ${item.completed_at ? "done" : ""}`}>
            <button
              className="sp-plan-check"
              aria-label={item.completed_at ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
              aria-pressed={!!item.completed_at}
              onClick={() => toggleItem(open, item)}
            >
              {item.completed_at ? (
                <CheckCircle2 size={22} aria-hidden="true" />
              ) : (
                <Circle size={22} aria-hidden="true" />
              )}
            </button>
            <div className="sp-plan-item-body">
              <div className="sp-plan-item-title">
                <Linkify text={item.title} />
              </div>
              {item.subtitle && (
                <p className="sp-plan-item-sub">
                  <Linkify text={item.subtitle} />
                </p>
              )}
              {item.reference && item.reference !== item.title && (
                <p className="sp-plan-item-ref">
                  <Linkify text={item.reference} />
                </p>
              )}
            </div>
          </div>
        ))}
        <div className="sp-form-actions no-print">
          <button className="sp-icon-btn danger" onClick={() => deletePlan(open)}>
            <Trash2 size={13} aria-hidden="true" /> Delete plan
          </button>
        </div>
        <p className="sp-field-hint" style={{ marginTop: 14 }}>
          Plans are AI-prepared study outlines — verify talk titles in Gospel Library as you go.
        </p>
      </div>
    );
  }

  /* ---------- plan list + create ---------- */
  return (
    <div className="sp-card">
      <p className="sp-label">
        Study plans <span className="sp-beta">Beta</span>
      </p>
      <p className="sp-intro">
        Describe what you&apos;d like to study over the coming days or weeks, and Spindle builds
        an ordered plan you can check off as you go.
      </p>

      <div className="no-print">
        <textarea
          className="sp-textarea"
          rows={2}
          maxLength={500}
          placeholder="e.g. Mercy across all four standard works…"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          aria-label="Describe your study plan"
        />
        <div className="sp-pill-row" style={{ marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="sp-pill" onClick={() => setRequest(ex)}>
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="sp-error" role="alert">{error}</p>}
        <button
          className="sp-prepare"
          style={{ marginTop: 12 }}
          onClick={createPlan}
          disabled={creating || !request.trim() || !online}
        >
          {creating ? "Preparing your plan…" : "Create plan"}
        </button>
        {creating && (
          <p className="sp-soft-warning" role="status">
            Gathering and ordering the right scriptures and talks — broad topics can take up to a
            minute. Please keep this screen open.
          </p>
        )}
        {!online && (
          <p className="sp-soft-warning">Creating a plan needs a connection.</p>
        )}
      </div>

      <hr className="sp-divider" />

      {plans === null ? (
        <p className="sp-empty-journal">Loading your plans…</p>
      ) : plans.length === 0 ? (
        <p className="sp-empty-journal">
          No plans yet. Describe one above — a book to walk through, a topic to trace, a
          conference to revisit — and start checking off sessions.
        </p>
      ) : (
        plans.map((plan) => {
          const done = plan.items.filter((i) => i.completed_at).length;
          return (
            <div key={plan.id} className="sp-entry-row">
              <button className="sp-entry" onClick={() => setOpen(plan)}>
                <div className="sp-entry-ref">{plan.title}</div>
                <div className="sp-entry-date">
                  {done} of {plan.items.length} complete
                </div>
                <div className="sp-entry-anchor">{plan.description}</div>
                <div className="sp-plan-progress" aria-hidden="true">
                  <div
                    className="sp-plan-progress-fill"
                    style={{ width: `${plan.items.length ? (done / plan.items.length) * 100 : 0}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })
      )}

      <p className="sp-field-hint" style={{ marginTop: 10 }}>
        <Sparkles size={11} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 4 }} />
        Plans are AI-prepared and may not be exhaustive — a great start, not an official list.
      </p>
    </div>
  );
}
