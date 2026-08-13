import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  buildBranchRows,
  buildCategoryMatrix,
  buildNationalTrend,
  latestSubmittedEvaluationId,
  monthLabel,
} from "@/lib/dashboard";
import { RankingChart } from "./ranking-chart";
import { TrendChart } from "./trend-chart";
import { CategoryMatrix } from "./category-matrix";
import { StatusBadge } from "./status-badge";
import { ExportButton } from "./export-button";
import { ArchivePanel } from "./archive-panel";
import type { Branch, Category, ChecklistItem, Evaluation, EvaluationAnswer, Followup } from "@/lib/supabase/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/login");

  const now = new Date();
  const params = await searchParams;
  const month = clampMonth(Number(params.month)) ?? now.getMonth() + 1;
  const year = Number(params.year) || now.getFullYear();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const prev = { month: month === 1 ? 12 : month - 1, year: month === 1 ? year - 1 : year };
  const next = { month: month === 12 ? 1 : month + 1, year: month === 12 ? year + 1 : year };

  const [{ data: branches }, { data: categories }, { data: items }, { data: evaluations }, { data: followups }] =
    await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("checklist_items").select("*").eq("active", true),
      supabase.from("evaluations").select("*"),
      supabase
        .from("followups_with_last_note")
        .select("*")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false }),
    ]);

  const allEvaluations = (evaluations as Evaluation[]) ?? [];
  const allBranches = (branches as Branch[]) ?? [];
  const allCategories = (categories as Category[]) ?? [];
  const allItems = (items as ChecklistItem[]) ?? [];
  const allFollowups = (followups as Followup[]) ?? [];
  const branchByEncId = new Map(allBranches.map((b) => [b.id, b]));

  const branchRows = buildBranchRows(allBranches, allEvaluations, month, year);

  // Solo se usan evaluaciones que YA se enviaron (evaluation_score no nulo); una
  // "seguimiento" que existe pero sigue en blanco no debe tapar los datos de "inicial".
  const currentEvaluationIds = branchRows
    .map(latestSubmittedEvaluationId)
    .filter((id): id is string => !!id);

  const { data: answers } = await supabase
    .from("evaluation_answers")
    .select("*")
    .in("evaluation_id", currentEvaluationIds.length ? currentEvaluationIds : ["00000000-0000-0000-0000-000000000000"]);

  const answersByEvaluationId: Record<string, EvaluationAnswer[]> = {};
  for (const a of (answers as EvaluationAnswer[]) ?? []) {
    (answersByEvaluationId[a.evaluation_id] ??= []).push(a);
  }

  const categoryMatrixRows = buildCategoryMatrix(
    branchRows.map((r) => ({ branchCode: r.branch.code, evaluationId: latestSubmittedEvaluationId(r) })),
    answersByEvaluationId,
    allItems
  );

  const rankingData = branchRows
    .filter((r) => r.finalScorePct !== null)
    .map((r) => ({ branch: r.branch.code, score: r.finalScorePct as number }));

  const trendData = buildNationalTrend(allEvaluations);

  const nationalAvg = rankingData.length
    ? Math.round(rankingData.reduce((s, r) => s + r.score, 0) / rankingData.length)
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="PCP" className="h-10 w-10 rounded-md" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard de sucursales</h1>
            <p className="text-sm text-slate-500">
              {allBranches.length} sucursales ·{" "}
              {nationalAvg !== null ? `Promedio nacional: ${nationalAvg}%` : "Sin datos este mes"}
            </p>
          </div>
        </div>
        <form action="/logout" method="post">
          <button className="text-xs text-slate-500 underline">Salir</button>
        </form>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard?month=${prev.month}&year=${prev.year}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="w-32 text-center text-sm font-medium text-slate-700 capitalize">
            {monthLabel(month, year)}
            {isCurrentMonth && <span className="ml-1 text-xs font-normal text-brand">(actual)</span>}
          </p>
          <Link
            href={`/dashboard?month=${next.month}&year=${next.year}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            month={month}
            year={year}
            categories={allCategories}
            branchRows={branchRows.map((r) => ({
              code: r.branch.code,
              categoryScores: categoryMatrixRows.find((c) => c.branchCode === r.branch.code)?.scoresByCategory ?? {},
              punctualityPct: r.monthlyPunctualityPct,
              finalScorePct: r.finalScorePct,
              initialStatus: r.initial?.status ?? "pendiente",
              followUpStatus: r.followUp?.status ?? "pendiente",
            }))}
          />
          <ArchivePanel month={month} year={year} monthLabel={monthLabel(month, year)} />
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Ranking — calificación final de {monthLabel(month, year)}
        </h2>
        <RankingChart data={rankingData} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Tendencia histórica nacional</h2>
        <TrendChart data={trendData} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Cumplimiento por categoría de {monthLabel(month, year)}</h2>
        <CategoryMatrix categories={allCategories} rows={categoryMatrixRows} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Puntualidad de envío de {monthLabel(month, year)}</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">Sucursal</th>
                <th className="px-3 py-2 font-medium">Inicial</th>
                <th className="px-3 py-2 font-medium">Seguimiento</th>
                <th className="px-3 py-2 font-medium">Puntualidad %</th>
                <th className="px-3 py-2 font-medium">Calificación final</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((row) => (
                <tr key={row.branch.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">
                    <Link href={`/dashboard/${row.branch.code}`} className="underline hover:text-slate-900">
                      {row.branch.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.initial?.status ?? "pendiente"} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.followUp?.status ?? "pendiente"} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.monthlyPunctualityPct !== null ? `${row.monthlyPunctualityPct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {row.finalScorePct !== null ? `${row.finalScorePct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Pendientes abiertos ({allFollowups.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          {allFollowups.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No hay pendientes abiertos en ninguna sucursal.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">Sucursal</th>
                  <th className="px-3 py-2 font-medium">Pendiente</th>
                  <th className="px-3 py-2 font-medium">Último seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {allFollowups.map((f) => {
                  const branch = branchByEncId.get(f.branch_id);
                  return (
                    <tr key={f.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {branch ? (
                          <Link href={`/dashboard/${branch.code}`} className="underline hover:text-slate-900">
                            {branch.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{f.description}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {f.last_note_at ? (
                          <>
                            {new Date(f.last_note_at).toLocaleDateString("es-MX")} — {f.last_note}
                          </>
                        ) : (
                          "Sin seguimiento todavía"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function clampMonth(month: number): number | null {
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}
