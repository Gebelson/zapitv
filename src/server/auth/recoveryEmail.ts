const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function recoveryConfiguration() {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  let origin: URL;
  try { origin = new URL(process.env.APP_URL || ''); }
  catch { throw new Error('RECOVERY_NOT_CONFIGURED'); }
  if (!apiKey || /[\r\n]/.test(apiKey) || !sender || !emailPattern.test(sender) ||
      origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('RECOVERY_NOT_CONFIGURED');
  }
  return { apiKey, sender, origin: origin.origin };
}

export async function sendRecoveryEmail(email: string, link: string): Promise<void> {
  const { apiKey, sender } = recoveryConfiguration();
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ sender: { name: 'ZapiTV', email: sender }, to: [{ email }],
      subject: 'Redefina sua senha da ZapiTV',
      textContent: `Recebemos um pedido para redefinir sua senha da ZapiTV.\n\nAcesse este link em até 15 minutos:\n${link}\n\nO link só pode ser usado uma vez. Se você não fez este pedido, ignore esta mensagem. Sua senha permanece igual.`,
    }),
  });
  if (!response.ok) throw new Error('RECOVERY_EMAIL_DELIVERY_FAILED');
}
