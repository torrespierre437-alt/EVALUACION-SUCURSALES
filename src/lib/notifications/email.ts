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

/**
 * Nunca lanza: un solo destinatario con problemas (typo, cuota de Gmail alcanzada,
 * error transitorio de SMTP) no debe tumbar el resto del envío por lotes del cron —
 * antes un solo fallo aquí cortaba en seco el loop y ninguna sucursal después de esa
 * recibía su recordatorio ese día. Devuelve true/false para que quien llama pueda
 * registrar el fallo (ver actions en el cron).
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD no configurados; se omite el envío de correo a", to);
    return false;
  }
  try {
    await transport.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
    return true;
  } catch (err) {
    console.error(`Error enviando correo a ${to}:`, err);
    return false;
  }
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

export function thankYouEmail(branchName: string, period: "inicial" | "seguimiento", onTime: boolean) {
  const periodLabel = period === "inicial" ? "evaluación mensual inicial" : "evaluación de seguimiento";
  const subject = `Gracias — ${periodLabel} recibida (${branchName})`;
  const html = `
    <p>Hola ${branchName},</p>
    <p>Recibimos tu ${periodLabel}${onTime ? " a tiempo" : ""}. ¡Gracias por enviarla!</p>
  `;
  return { subject, html };
}
