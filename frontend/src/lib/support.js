export const SUPPORT_EMAIL_FALLBACK = 'support@kazoot.app';

export function getSupportEmail(env = import.meta.env) {
  const configuredEmail = env?.VITE_SUPPORT_EMAIL?.trim();
  return configuredEmail || SUPPORT_EMAIL_FALLBACK;
}

export const SUPPORT_EMAIL = getSupportEmail();
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
