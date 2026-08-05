import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY no configurado; se omite el envío de correo a", to);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to, subject, html });
}

export function reminderEmail(branchName: string, period: "inicial" | "seguimiento", dueDateLabel: string, url: string) {
  const subject =
    period === "inicial"
      ? `Recordatorio: evaluación mensual pendiente — ${branchName}`
      : `Recordatorio: evaluación de seguimiento pendiente — ${branchName}`;
  const html = `
    <p>Hola ${branchName},</p>
    <p>Es momento de enviar tu ${period === "inicial" ? "evaluación mensual inicial" : "evaluación de seguimiento"}.
    Fecha límite: <strong>${dueDateLabel}</strong>.</p>
    <p><a href="${url}">Llenar evaluación</a></p>
  `;
  return { subject, html };
}

export function lateAlertEmail(branchName: string, daysLate: number, url: string) {
  const subject = `Alerta: evaluación atrasada — ${branchName} (${daysLate} día(s))`;
  const html = `
    <p>La evaluación de <strong>${branchName}</strong> lleva ${daysLate} día(s) de retraso.</p>
    <p>Recuerda que cada día de retraso resta 3 puntos de puntualidad.</p>
    <p><a href="${url}">Enviar ahora</a></p>
  `;
  return { subject, html };
}
