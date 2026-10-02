import { AppError } from './domain.mjs';

export function makeMailer({ key, from, fetchImpl = fetch }) {
  return async ({ email, code, purpose }) => {
    if (!key || !from) throw new AppError(503, 'Email delivery is not configured. Contact support.');
    try {
      const r = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email],
          subject: purpose === 'reset' ? 'Reset your Raabta password' : 'Verify your Raabta email',
          text: `Your Raabta code is ${code}. It expires in 10 minutes. Enter it in the app. Never share this code. If you did not request this, ignore this email.` }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error('mail unavailable');
    } catch { throw new AppError(503, 'Email could not be sent. Please try again shortly.'); }
  };
}

export function makeModerator({ key, fetchImpl = fetch }) {
  return async (input, context = 'public') => {
    if (!key) throw new AppError(503, 'Safety checks are not configured. Please try later.');
    let categories;
    try {
      const r = await fetchImpl('https://api.openai.com/v1/moderations', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'omni-moderation-latest', input }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error('moderation unavailable');
      categories = (await r.json()).results?.[0]?.categories;
      if (!categories || typeof categories['sexual/minors'] !== 'boolean') throw new Error('invalid moderation');
    } catch { throw new AppError(503, 'Safety check unavailable. Your message has not been sent; try again.'); }
    // Personal distress/disclosure is allowed in reflection. Do not punish users for asking for help.
    const prohibited = context === 'reflection'
      ? ['sexual/minors', 'illicit/violent', 'self-harm/instructions']
      : ['sexual/minors', 'harassment/threatening', 'hate', 'hate/threatening', 'illicit/violent', 'self-harm/instructions', 'sexual'];
    if (prohibited.some(c => categories[c]))
      throw new AppError(422, 'This content could not be sent under our community rules. Please rephrase or contact support if this is a mistake.');
  };
}
