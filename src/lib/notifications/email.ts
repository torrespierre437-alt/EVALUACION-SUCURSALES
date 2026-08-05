import nodemailer from "nodemailer";

/**
 * Envío por Gmail SMTP con una "contraseña de aplicación" (no la contraseña normal
 * de la cuenta). Se eligió sobre Resend porque el dominio corporativo (pcponline.mx)
 * no está bajo control del usuario y no se pudo verificar en Resend; Gmail no requiere
 * verificar dominio y permite enviar a cualquier destinatario de inmediato.
 */
function getTransport() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  const transport = getTransport();
  if (!transport) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD no configurados; se omite el envío de correo a", to);
    return;
  }
  await transport.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
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
