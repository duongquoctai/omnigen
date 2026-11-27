/**
 * Single source of truth for the development-only HMAC fallback secret.
 * In production, `AUTH_SECRET` (or `NEXTAUTH_SECRET`) MUST be configured via environment variables.
 */
export const DEV_AUTH_SECRET = "lachvid_dev_only_secret_do_not_use_in_prod";

export const resolveAuthSecret = (
  env: Record<string, string | undefined> = process.env,
): string => {
  const configured = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  if (configured) return configured;
  return env.NODE_ENV === "production" ? "" : DEV_AUTH_SECRET;
};
