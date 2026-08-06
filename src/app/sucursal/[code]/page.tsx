import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChecklistForm } from "./checklist-form";
import { FollowupsPanel } from "./followups-panel";
import { HistoryChart } from "./history-chart";
import { currentMonthPeriods, ensureCurrentEvaluation } from "@/lib/evaluations";
import type { Category, ChecklistItem, Evaluation, EvaluationAnswer, Followup } from "@/lib/supabase/types";

export default async function SucursalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: branch } = await supabase.from("branches").select("id, code, name").eq("code", code).single();
  if (!branch) notFound();

  // RLS ya restringe: si el usuario es de otra sucursal, esta consulta no regresará nada útil.
  const { data: profile } = await supabase.from("profiles").select("role, branch_id").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.branch_id !== branch.id) {
    redirect("/login");
  }

  const [{ data: categories }, { data: items }, { data: evaluations }, { data: followups }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("checklist_items").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("evaluations")
      .select("*")
      .eq("branch_id", branch.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase
      .from("followups_with_last_note")
      .select("*")
      .eq("branch_id", branch.id)
      .eq("status", "pendiente")
      .order("created_at", { ascending: false }),
  ]);

  const allEvaluations = (evaluations as Evaluation[] | null) ?? [];
  let pendingEvaluation = allEvaluations.find((e) => e.status === "pendiente") ?? null;

  const { month, year } = currentMonthPeriods(new Date());
  const monthEvaluations = allEvaluations.filter((e) => e.month === month && e.year === year);

  if (!pendingEvaluation) {
    pendingEvaluation = await ensureCurrentEvaluation(supabase, branch.id, monthEvaluations);
  }

  const inicialSubmitted = monthEvaluations.some((e) => e.period === "inicial" && e.status !== "pendiente");
  const seguimientoSubmitted = monthEvaluations.some((e) => e.period === "seguimiento" && e.status !== "pendiente");
  const completionMessage =
    inicialSubmitted && seguimientoSubmitted
      ? "Ya enviaste la evaluación inicial y de seguimiento de este mes. ¡Gracias!"
      : inicialSubmitted
        ? "Ya enviaste tu evaluación inicial de este mes. La de seguimiento se habilita a partir del día 27."
        : "No hay una evaluación pendiente por enviar en este momento.";

  let existingAnswers: EvaluationAnswer[] = [];
  if (pendingEvaluation) {
    const { data } = await supabase
      .from("evaluation_answers")
      .select("*")
      .eq("evaluation_id", pendingEvaluation.id);
    existingAnswers = data ?? [];
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{branch.name}</h1>
          <p className="text-sm text-slate-500">Evaluación mensual de imagen y mantenimiento</p>
        </div>
        <form action="/logout" method="post">
          <button className="text-xs text-slate-400 underline">Salir</button>
        </form>
      </header>

      {pendingEvaluation ? (
        <ChecklistForm
          evaluation={pendingEvaluation}
          branchId={branch.id}
          branchCode={branch.code}
          categories={(categories as Category[]) ?? []}
          items={(items as ChecklistItem[]) ?? []}
          existingAnswers={existingAnswers}
        />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {completionMessage}
        </p>
      )}

      <FollowupsPanel branchCode={branch.code} branchId={branch.id} followups={(followups as Followup[]) ?? []} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Historial</h2>
        <HistoryChart evaluations={(evaluations as Evaluation[]) ?? []} />
      </div>
    </div>
  );
}
