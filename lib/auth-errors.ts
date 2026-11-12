import type { Key } from "@/lib/i18n";

/**
 * Машинные коды ошибок API → ключи переводов.
 *
 * API намеренно отвечает кодом (`email_taken`), а не готовой фразой: один и
 * тот же ответ должен одинаково звучать на четырёх языках приложения.
 */
const MAP: Record<string, Key> = {
  invalid_credentials: "auth.errCredentials",
  email_taken: "auth.errEmailTaken",
  weak_password: "auth.errWeakPassword",
  password_too_long: "auth.errWeakPassword",
  invalid_email: "auth.errEmail",
  invalid_phone: "auth.errPhone",
  rate_limited: "auth.errRate",
  too_many_attempts: "auth.errAttempts",
  invalid_code: "auth.errCode",
  code_expired: "auth.errCode",
  already_verified: "auth.errAlreadyVerified",
  phone_taken: "auth.phoneTaken",
  invalid_token: "auth.verifyFailed",
  csrf_failed: "auth.errGeneric",
  telegram_already_linked: "auth.telegramAlreadyLinked",
  password_exists: "auth.passwordExists",
  email_not_verified: "auth.emailNotVerified",
  invalid_telegram: "auth.invalidTelegram",
  telegram_unavailable: "auth.telegramUnavailable",
};

const OAUTH: Record<string, Key> = {
  denied: "auth.oauthDenied",
  state: "auth.oauthError",
  oauth_token_failed: "auth.oauthError",
  oauth_profile_failed: "auth.oauthError",
  oauth_email_required: "auth.oauthEmailRequired",
  oauth_email_exists: "auth.oauthEmailExists",
  oauth_link_exists: "auth.oauthLinkExists",
  oauth_unavailable: "auth.oauthUnavailable",
  oauth_session: "auth.oauthSession",
  oauth_unknown_provider: "auth.oauthError",
};

export function oauthErrorKey(code: string | null | undefined): Key {
  if (!code) return "auth.oauthError";
  return OAUTH[code] ?? "auth.oauthError";
}

export function authErrorKey(code: string | null | undefined): Key {
  if (!code) return "auth.errGeneric";
  return MAP[code] ?? "auth.errGeneric";
}
