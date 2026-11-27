let override = null;

/** Tests inject a fake mailer here. */
export function setMailer(fn) {
  override = fn;
}

export async function sendOtpEmail(to, code) {
  if (override) return override(to, code);
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const from = process.env.RESEND_FROM || 'Ágape Multimidia <no-reply@agapemultimidia.com.br>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Seu código de acesso: ${code}`,
      text: `Seu código para entrar no painel do site é ${code}.\n\nEle vale por 10 minutos e só pode ser usado uma vez. Se você não pediu este código, ignore este e-mail.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}
