import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { punctualityScore, daysLateBetween } from "@/lib/scoring";
import { periodDates } from "@/lib/evaluations";
import { sendEmail, reminderEmail, lateAlertEmail } from "@/lib/notifications/email";
import { sendPush } from "@/lib/notifications/push";
import type { Branch, Evaluation, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function sameDate(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

/**
 * Cron diario (ver vercel.json). El vencimiento de "inicial" es el día 1 y el de
 * "seguimiento" el día 25 (recorridos al siguiente día hábil si caen domingo); el
 * checklist abre 2 días hábiles antes de cada vencimiento (ver periodDates en
 * src/lib/evaluations.ts). Ese día de apertura puede caer en el mes calendario
 * anterior al del vencimiento (ej. si el día 1 cae lunes), así que se evalúan tanto
 * las fechas del mes en curso como las del mes siguiente:
 *  - Abre "inicial" del mes en curso: cierra "seguimiento" del mes anterior que siga
 *    pendiente (no_enviado), crea la evaluación "inicial" y envía recordatorio.
 *  - Abre "seguimiento" del mes en curso: cierra "inicial" del mes en curso que siga
 *    pendiente, crea la evaluación "seguimiento" y envía recordatorio.
 *  - Abre "inicial" del mes siguiente: cierra "seguimiento" del mes en curso que siga
 *    pendiente, crea la evaluación "inicial" del mes siguiente y envía recordatorio.
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
  const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const month = todayOnly.getUTCMonth() + 1;
  const year = todayOnly.getUTCFullYear();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;

  const thisMonth = periodDates(year, month);
  const nextMonthPeriods = periodDates(nextMonthYear, nextMonth);

  const supabase = createServiceRoleClient();

  const { data: branches } = await supabase.from("branches").select("*");
  const { data: profiles } = await supabase.from("profiles").select("*");
  const branchList = (branches as Branch[]) ?? [];
  const profileByBranch = new Map<string, Profile>();
  for (const p of (profiles as Profile[]) ?? []) {
    if (p.branch_id) profileByBranch.set(p.branch_id, p);
  }

  const actions: string[] = [];

  if (sameDate(todayOnly, thisMonth.inicialOpen)) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    await closeStalePending(supabase, "seguimiento", prevMonth, prevYear, actions);
    await createAndNotify(supabase, branchList, profileByBranch, "inicial", month, year, thisMonth.inicialDue, actions);
  } else if (sameDate(todayOnly, thisMonth.seguimientoOpen)) {
    await closeStalePending(supabase, "inicial", month, year, actions);
    await createAndNotify(supabase, branchList, profileByBranch, "seguimiento", month, year, thisMonth.seguimientoDue, actions);
  } else if (sameDate(todayOnly, nextMonthPeriods.inicialOpen)) {
    await closeStalePending(supabase, "seguimiento", month, year, actions);
    await createAndNotify(
      supabase,
      branchList,
      profileByBranch,
      "inicial",
      nextMonth,
      nextMonthYear,
      nextMonthPeriods.inicialDue,
      actions
    );
  } else {
    await sendLateAlerts(supabase, branchList, profileByBranch, todayOnly, actions);
  }

  return NextResponse.json({ ok: true, date: todayOnly.toISOString().slice(0, 10), actions });
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
