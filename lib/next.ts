/** Разрешаем только локальный путь: `next` приходит из URL. */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value.slice(0, 500);
}
