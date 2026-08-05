import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { punctualityScore, daysLateBetween } from "@/lib/scoring";
import { sendEmail, reminderEmail, lateAlertEmail } from "@/lib/notifications/email";
import { sendPush } from "@/lib/notifications/push";
import type { Branch, Evaluation, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Cron diario (ver vercel.json). Decide qué hacer según el día del mes:
 *  - Día 1: cierra "seguimiento" del mes anterior que siga pendiente (no_enviado),
 *           crea la evaluación "inicial" del mes en curso y envía recordatorio.
 *  - Día 27: cierra "inicial" del mes en curso que siga pendiente (no_enviado),
 *            crea la evaluación "seguimiento" y envía recordatorio.
 *  - Cualquier otro día: si hay evaluaciones "pendiente" vencidas, envía alerta de atraso.
 *
 * Prueba manual: GET /api/cron/daily?date=2026-09-01&secret=... (override de fecha en dev).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const secret = url.searchParams.get("secret") ?? authHeader?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Se trabaja en UTC de punta a punta (coincide con toISOString().slice(0,10) usado
  // para due_date/submitted_at en el resto del código) para evitar que el día cambie
  // según la zona horaria del servidor.
  const dateOverride = url.searchParams.get("date");
  const today = dateOverride ? new Date(`${dateOverride}T00:00:00Z`) : new Date();
  const day = today.getUTCDate();
  const month = today.getUTCMonth() + 1;
  const year = today.getUTCFullYear();

  const supabase = createServiceRoleClient();

  const { data: branches } = await supabase.from("branches").select("*");
  const { data: profiles } = await supabase.from("profiles").select("*");
  const branchList = (branches as Branch[]) ?? [];
  const profileByBranch = new Map<string, Profile>();
  for (const p of (profiles as Profile[]) ?? []) {
    if (p.branch_id) profileByBranch.set(p.branch_id, p);
  }

  const actions: string[] = [];

  if (day === 1) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    await closeStalePending(supabase, "seguimiento", prevMonth, prevYear, actions);
    await createAndNotify(supabase, branchList, profileByBranch, "inicial", month, year, today, actions);
  } else if (day === 27) {
    await closeStalePending(supabase, "inicial", month, year, actions);
    await createAndNotify(supabase, branchList, profileByBranch, "seguimiento", month, year, today, actions);
  } else {
    await sendLateAlerts(supabase, branchList, profileByBranch, today, actions);
  }

  return NextResponse.json({ ok: true, date: today.toISOString().slice(0, 10), actions });
}

async function closeStalePending(
  supabase: ReturnType<typeof createServiceRoleClient>,
  period: "inicial" | "seguimiento",
  month: number,
  year: number,
  actions: string[]
) {
  const { data: stale } = await supabase
    .from("evaluations")
    .select("id")
    .eq("period", period)
    .eq("month", month)
    .eq("year", year)
    .eq("status", "pendiente");

  for (const row of (stale as { id: string }[]) ?? []) {
    await supabase
      .from("evaluations")
      .update({ status: "no_enviado", punctuality_score: 0 })
      .eq("id", row.id);
    actions.push(`closed_no_enviado:${row.id}`);
  }
}

async function createAndNotify(
  supabase: ReturnType<typeof createServiceRoleClient>,
  branches: Branch[],
  profileByBranch: Map<string, Profile>,
  period: "inicial" | "seguimiento",
  month: number,
  year: number,
  dueDate: Date,
  actions: string[]
) {
  for (const branch of branches) {
    const { data: existing } = await supabase
      .from("evaluations")
      .select("id")
      .eq("branch_id", branch.id)
      .eq("period", period)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    let evaluationId = existing?.id as string | undefined;
    if (!evaluationId) {
      const { data: created } = await supabase
        .from("evaluations")
        .insert({
          branch_id: branch.id,
          period,
          month,
          year,
          due_date: dueDate.toISOString().slice(0, 10),
          status: "pendiente",
        })
        .select("id")
        .single();
      evaluationId = created?.id;
      actions.push(`created:${period}:${branch.code}`);
    }

    const profile = profileByBranch.get(branch.id);
    if (!profile) continue;

    const formUrl = `${APP_URL}/sucursal/${branch.code}`;
    const dueLabel = dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
    const { subject, html } = reminderEmail(branch.name, period, dueLabel, formUrl);
    if (profile.email) await sendEmail(profile.email, subject, html);
    await sendPush(
      profile.push_subscription as never,
      "Evaluación pendiente",
      `${branch.name}: envía tu evaluación ${period} antes del ${dueLabel}.`,
      formUrl
    );
  }
}

async function sendLateAlerts(
  supabase: ReturnType<typeof createServiceRoleClient>,
  branches: Branch[],
  profileByBranch: Map<string, Profile>,
  today: Date,
  actions: string[]
) {
  const { data: pending } = await supabase.from("evaluations").select("*").eq("status", "pendiente");

  for (const evaluation of (pending as Evaluation[]) ?? []) {
    const dueDate = new Date(evaluation.due_date);
    const daysLate = daysLateBetween(dueDate, today);
    if (daysLate <= 0) continue;

    const branch = branches.find((b) => b.id === evaluation.branch_id);
    const profile = profileByBranch.get(evaluation.branch_id);
    if (!branch || !profile) continue;

    await supabase
      .from("evaluations")
      .update({ days_late: daysLate, punctuality_score: punctualityScore(daysLate, false) })
      .eq("id", evaluation.id);

    const formUrl = `${APP_URL}/sucursal/${branch.code}`;
    const { subject, html } = lateAlertEmail(branch.name, daysLate, formUrl);
    if (profile.email) await sendEmail(profile.email, subject, html);
    await sendPush(
      profile.push_subscription as never,
      "Evaluación atrasada",
      `${branch.name} lleva ${daysLate} día(s) de retraso.`,
      formUrl
    );
    actions.push(`late_alert:${branch.code}:${daysLate}d`);
  }
}
