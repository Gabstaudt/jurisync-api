type MailParams = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

/**
 * Envia e-mail usando um provider SMTP simples se configurado.
 * Caso as variáveis de ambiente não estejam presentes, apenas loga no console.
 */
export async function sendMail({ to, subject, text, html }: MailParams) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@jurisync.com";

  if (!host || !port || !user || !pass) {
    console.warn("[mailer] SMTP não configurado. Email logado no console.");
    console.info({ to, subject, text, html });
    return;
  }

  // Import dinâmico para evitar depender do módulo em build sem necessidade
  const nodemailer = await import("nodemailer").catch(() => null);
  if (!nodemailer) {
    console.warn("[mailer] nodemailer não instalado. Email logado no console.");
    console.info({ to, subject, text, html });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
