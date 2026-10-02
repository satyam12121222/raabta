export function configFromEnv(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const requireVerification = env.REQUIRE_EMAIL_VERIFICATION !== 'false';
  const moderationEnabled = env.MODERATION_ENABLED !== 'false';
  const registrationMode = env.REGISTRATION_MODE || 'invite';
  if (!['invite', 'open'].includes(registrationMode)) throw new Error('REGISTRATION_MODE must be invite or open.');
  if (production) {
    for (const k of ['DATA_KEY', 'INVITE_CODE', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'RESEND_API_KEY', 'MAIL_FROM', 'PUBLIC_ORIGIN', 'SUPPORT_EMAIL', 'OPERATOR_NAME'])
      if (!env[k]?.trim()) throw new Error(`Production requires ${k}.`);
    const url = new URL(env.PUBLIC_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_ORIGIN must be an HTTPS origin without a path.');
    if (!requireVerification || !moderationEnabled) throw new Error('Production requires email verification and moderation.');
  }
  const publicOrigin = (env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
  return {
    dbPath: env.DB_PATH || 'data/raabta.db', dataKey: env.DATA_KEY, inviteCode: env.INVITE_CODE,
    aiKey: env.OPENAI_API_KEY, aiModel: env.OPENAI_MODEL,
    mailKey: env.RESEND_API_KEY, mailFrom: env.MAIL_FROM,
    dailyMessages: Number(env.DAILY_AI_MESSAGES || 30), globalDailyCalls: Number(env.GLOBAL_DAILY_AI_CALLS || 500),
    globalHourlyEmails: Number(env.GLOBAL_HOURLY_EMAILS || 100),
    allowedOrigin: env.ALLOWED_ORIGIN || publicOrigin, publicOrigin,
    requireVerification, moderationEnabled, registrationMode,
    trustProxy: env.TRUST_PROXY === 'true',
    privacyUrl: publicOrigin ? publicOrigin + '/privacy' : '', termsUrl: publicOrigin ? publicOrigin + '/terms' : '',
    supportEmail: env.SUPPORT_EMAIL, operatorName: env.OPERATOR_NAME,
  };
}
