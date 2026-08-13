import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { categoryScore, evaluationScore, monthlyPunctuality, finalScore } from "@/lib/scoring";
import { monthLabel } from "@/lib/dashboard";
import type {
  Branch,
  Category,
  ChecklistItem,
  Evaluation,
  EvaluationAnswer,
  Followup,
  FollowupNote,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map((c) => csvCell(c)).join(",")).join("\n");
}

/**
 * Genera un ZIP de respaldo de un mes: un CSV resumen (score por sucursal),
 * un CSV detallado (respuesta por respuesta, con comentario), un CSV de
 * pendientes/seguimiento, y una carpeta con las fotos de evidencia de ese mes.
 * Es el paso previo obligatorio antes de poder "liberar espacio" (ver
 * /api/admin/archive/release), que borra esas mismas fotos de Storage.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "solo admin" }, { status: 403 });

  const url = new URL(request.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "month/year inválidos" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const [{ data: branches }, { data: categories }, { data: items }, { data: evaluations }, { data: followups }] =
    await Promise.all([
      admin.from("branches").select("*").order("code"),
      admin.from("categories").select("*").order("sort_order"),
      admin.from("checklist_items").select("*").eq("active", true).order("sort_order"),
      admin.from("evaluations").select("*").eq("month", month).eq("year", year),
      admin.from("followups").select("*").order("created_at", { ascending: false }),
    ]);

  const allBranches = (branches as Branch[]) ?? [];
  const allCategories = (categories as Category[]) ?? [];
  const allItems = (items as ChecklistItem[]) ?? [];
  const allEvaluations = (evaluations as Evaluation[]) ?? [];
  const allFollowups = (followups as Followup[]) ?? [];

  const branchById = new Map(allBranches.map((b) => [b.id, b]));
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  const evalIds = allEvaluations.map((e) => e.id);
  const { data: answers } = await admin
    .from("evaluation_answers")
    .select("*")
    .in("evaluation_id", evalIds.length ? evalIds : ["00000000-0000-0000-0000-000000000000"]);
  const allAnswers = (answers as EvaluationAnswer[]) ?? [];
  const answersByEvalId = new Map<string, EvaluationAnswer[]>();
  for (const a of allAnswers) {
    const list = answersByEvalId.get(a.evaluation_id) ?? [];
    list.push(a);
    answersByEvalId.set(a.evaluation_id, list);
  }

  const followupIds = allFollowups.map((f) => f.id);
  const { data: notes } = await admin
    .from("followup_notes")
    .select("*")
    .in("followup_id", followupIds.length ? followupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("noted_at", { ascending: true });
  const notesByFollowupId = new Map<string, FollowupNote[]>();
  for (const n of (notes as FollowupNote[]) ?? []) {
    const list = notesByFollowupId.get(n.followup_id) ?? [];
    list.push(n);
    notesByFollowupId.set(n.followup_id, list);
  }

  // ---- CSV resumen (score por sucursal) ----
  const summaryRows: string[][] = [
    ["Sucursal", "Periodo", "Estado", "Score %", "Puntualidad %", "Enviado"],
  ];
  const byBranchPeriod = new Map<string, Evaluation>();
  for (const e of allEvaluations) byBranchPeriod.set(`${e.branch_id}:${e.period}`, e);

  for (const branch of allBranches) {
    for (const period of ["inicial", "seguimiento"] as const) {
      const ev = byBranchPeriod.get(`${branch.id}:${period}`);
      if (!ev) continue;
      summaryRows.push([
        branch.code,
        period,
        ev.status,
        ev.evaluation_score !== null ? String(Math.round(ev.evaluation_score * 100)) : "",
        ev.punctuality_score !== null ? String(Math.round(ev.punctuality_score * 100)) : "",
        ev.submitted_at ? new Date(ev.submitted_at).toLocaleString("es-MX") : "",
      ]);
    }
    const inicial = byBranchPeriod.get(`${branch.id}:inicial`);
    const seguimiento = byBranchPeriod.get(`${branch.id}:seguimiento`);
    const punct = monthlyPunctuality(inicial?.punctuality_score ?? null, seguimiento?.punctuality_score ?? null);
    const scoreForFinal = seguimiento?.evaluation_score ?? inicial?.evaluation_score ?? null;
    const final = finalScore(scoreForFinal, punct);
    if (final !== null) {
      summaryRows.push([branch.code, "CALIFICACIÓN FINAL DEL MES", "", String(Math.round(final * 100)), "", ""]);
    }
  }

  // ---- CSV detallado (respuesta por respuesta) ----
  const detailRows: string[][] = [
    ["Sucursal", "Periodo", "Categoría", "Punto", "Valor", "Comentario", "Foto (archivo en /fotos)"],
  ];

  const zip = new JSZip();
  const fotosFolder = zip.folder("fotos");
  let photoCount = 0;
  const photosToFetch: { photoFile: string; url: string }[] = [];

  for (const ev of allEvaluations) {
    const branch = branchById.get(ev.branch_id);
    if (!branch) continue;
    const evAnswers = answersByEvalId.get(ev.id) ?? [];
    for (const item of allItems) {
      const answer = evAnswers.find((a) => a.checklist_item_id === item.id);
      if (!answer) continue;
      const category = categoryById.get(item.category_id);
      let photoFile = "";
      if (answer.photo_url) {
        photoCount++;
        const ext = answer.photo_url.split(".").pop()?.split("?")[0] || "jpg";
        photoFile = `${branch.code}_${ev.period}_${category?.name ?? "cat"}_${photoCount}.${ext}`;
        photosToFetch.push({ photoFile, url: answer.photo_url });
      }
      detailRows.push([
        branch.code,
        ev.period,
        category?.name ?? "",
        item.description,
        answer.value === 1 ? "Cumple" : "No cumple",
        answer.comment ?? "",
        photoFile,
      ]);
    }
  }

  // Las fotos se descargan en paralelo (en lotes) en vez de una por una — con ~150
  // fotos, secuencial tardaba más de 60s y arriesgaba el límite de tiempo de Vercel.
  const CONCURRENCY = 12;
  for (let i = 0; i < photosToFetch.length; i += CONCURRENCY) {
    const batch = photosToFetch.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ photoFile, url }) => {
        try {
          const res = await fetch(url);
          if (res.ok && fotosFolder) {
            const buf = await res.arrayBuffer();
            fotosFolder.file(photoFile, buf);
          }
        } catch {
          // si una foto individual falla, seguimos con el resto en vez de tronar todo el respaldo
        }
      })
    );
  }

  // ---- CSV pendientes / seguimiento (no está acotado a un mes en el modelo,
  // se incluye completo como contexto de negocio) ----
  const followupRows: string[][] = [["Sucursal", "Pendiente", "Estado", "Fecha nota", "Nota"]];
  for (const f of allFollowups) {
    const branch = branchById.get(f.branch_id);
    const notesForF = notesByFollowupId.get(f.id) ?? [];
    if (notesForF.length === 0) {
      followupRows.push([branch?.code ?? "", f.description, f.status, "", ""]);
    } else {
      for (const n of notesForF) {
        followupRows.push([
          branch?.code ?? "",
          f.description,
          f.status,
          new Date(n.noted_at).toLocaleDateString("es-MX"),
          n.note,
        ]);
      }
    }
  }

  const label = monthLabel(month, year).replace(" ", "-");
  zip.file(`resumen-${label}.csv`, toCsv(summaryRows));
  zip.file(`respuestas-${label}.csv`, toCsv(detailRows));
  zip.file(`pendientes-seguimiento.csv`, toCsv(followupRows));

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="respaldo-${label}.zip"`,
    },
  });
}
