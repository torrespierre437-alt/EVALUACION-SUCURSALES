import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "../status-badge";
import type {
  Category,
  ChecklistItem,
  Evaluation,
  EvaluationAnswer,
  Followup,
  FollowupNote,
} from "@/lib/supabase/types";

export default async function BranchDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/login");

  const { data: branch } = await supabase.from("branches").select("id, code, name").eq("code", code).single();
  if (!branch) notFound();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [{ data: categories }, { data: items }, { data: evaluations }, { data: followups }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("checklist_items").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("evaluations")
      .select("*")
      .eq("branch_id", branch.id)
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("followups")
      .select("*")
      .eq("branch_id", branch.id)
      .order("created_at", { ascending: false }),
  ]);

  const allCategories = (categories as Category[]) ?? [];
  const allItems = (items as ChecklistItem[]) ?? [];
  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  const inicial = (evaluations as Evaluation[] | null)?.find((e) => e.period === "inicial") ?? null;
  const seguimiento = (evaluations as Evaluation[] | null)?.find((e) => e.period === "seguimiento") ?? null;

  const evalIds = [inicial?.id, seguimiento?.id].filter((id): id is string => !!id);
  const { data: answers } = await supabase
    .from("evaluation_answers")
    .select("*")
    .in("evaluation_id", evalIds.length ? evalIds : ["00000000-0000-0000-0000-000000000000"]);
  const answersByEvalId: Record<string, EvaluationAnswer[]> = {};
  for (const a of (answers as EvaluationAnswer[]) ?? []) {
    (answersByEvalId[a.evaluation_id] ??= []).push(a);
  }

  const allFollowups = (followups as Followup[]) ?? [];
  const followupIds = allFollowups.map((f) => f.id);
  const { data: notes } = await supabase
    .from("followup_notes")
    .select("*")
    .in("followup_id", followupIds.length ? followupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("noted_at", { ascending: false });
  const notesByFollowupId: Record<string, FollowupNote[]> = {};
  for (const n of (notes as FollowupNote[]) ?? []) {
    (notesByFollowupId[n.followup_id] ??= []).push(n);
  }

  function renderEvaluation(evaluation: Evaluation | null, label: string) {
    if (!evaluation) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
          <p className="mt-1 text-sm text-slate-500">Aún no se ha creado este mes.</p>
        </div>
      );
    }

    const evalAnswers = answersByEvalId[evaluation.id] ?? [];
    const answersByItemId = new Map(evalAnswers.map((a) => [a.checklist_item_id, a]));

    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
            <p className="text-xs text-slate-500">
              Vence {evaluation.due_date}
              {evaluation.submitted_at && ` · Enviado ${new Date(evaluation.submitted_at).toLocaleString("es-MX")}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={evaluation.status} />
            {evaluation.evaluation_score !== null && (
              <span className="text-sm font-semibold text-slate-800">
                {Math.round(evaluation.evaluation_score * 100)}%
              </span>
            )}
          </div>
        </div>

        {evalAnswers.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Sin respuestas todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {allItems.map((item) => {
              const answer = answersByItemId.get(item.id);
              if (!answer) return null;
              const category = categoryById.get(item.category_id);
              return (
                <li key={item.id} className="space-y-1 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{category?.name}</p>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{item.description}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        answer.value === 1 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {answer.value === 1 ? "Cumple" : "No cumple"}
                    </span>
                  </div>
                  {answer.comment && (
                    <p className="flex items-start gap-1 text-xs text-slate-500">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {answer.comment}
                    </p>
                  )}
                  {answer.photo_url && (
                    <a href={answer.photo_url} target="_blank" rel="noreferrer">
                      <img src={answer.photo_url} alt="Evidencia" className="h-20 w-20 rounded object-cover" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 px-4 py-6">
      <header>
        <Link href="/dashboard" className="text-xs text-slate-500 underline">
          ← Volver al dashboard
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{branch.name}</h1>
        <p className="text-sm text-slate-500">Detalle de evaluación del mes en curso</p>
      </header>

      {renderEvaluation(inicial, "Evaluación inicial")}
      {renderEvaluation(seguimiento, "Evaluación de seguimiento")}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Pendientes / seguimiento ({allFollowups.length})
        </h2>
        {allFollowups.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Sin pendientes registrados.
          </p>
        ) : (
          <ul className="space-y-3">
            {allFollowups.map((f) => (
              <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-700">{f.description}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.status === "resuelto" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {f.status === "resuelto" ? "Resuelto" : "Pendiente"}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {(notesByFollowupId[f.id] ?? []).map((n) => (
                    <li key={n.id} className="text-xs text-slate-500">
                      {new Date(n.noted_at).toLocaleDateString("es-MX")} — {n.note}
                    </li>
                  ))}
                  {(notesByFollowupId[f.id] ?? []).length === 0 && (
                    <li className="text-xs text-slate-500">Sin notas de seguimiento todavía.</li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
