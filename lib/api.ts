// Фронт ходит на свой же `/api`, а Next проксирует запрос в FastAPI
// (см. `rewrites` в next.config.mjs). Это не оптимизация: cookie сессии
// становится first-party, и браузер не режет её как стороннюю.
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

// Coalesce identical in-flight GETs (for example when multiple components
// mount together). Requests with AbortSignals stay independent because one
// consumer must not cancel another consumer's request.
const inFlightGets = new Map<string, Promise<unknown>>();

export async function api<T>(
  path: string,
  options: {
    token?: string | null;
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    analyticsAdminToken?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.analyticsAdminToken) headers["X-Analytics-Admin-Token"] = options.analyticsAdminToken;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const method = options.method ?? "GET";
  // Cookie-сессия уходит автоматически, поэтому изменяющий запрос обязан
  // предъявить CSRF-токен из читаемой cookie. Для Bearer он не нужен.
  if (method !== "GET" && method !== "HEAD" && !options.token) {
    const csrf = readCookie("carcar_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const url = `${BASE}${path}`;
  const request = async (): Promise<T> => {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Cookie сессии — единственный носитель входа в веб-версии.
      credentials: "include",
      // API cache is authoritative; avoid persisting potentially stale listings in the browser.
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.detail ?? `HTTP ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };

  if (method !== "GET" || options.body !== undefined || options.signal) {
    return request();
  }

  const key = JSON.stringify([options.token ?? "", url]);
  const existing = inFlightGets.get(key);
  if (existing) return existing as Promise<T>;

  const pending = request().finally(() => {
    if (inFlightGets.get(key) === pending) inFlightGets.delete(key);
  });
  inFlightGets.set(key, pending);
  return pending;
}
