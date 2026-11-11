const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://api-production-5bee.up.railway.app"
    : "http://127.0.0.1:8080");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
  const url = `${API_URL}/api${path}`;
  const request = async (): Promise<T> => {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // API cache is authoritative; avoid persisting potentially stale listings in the browser.
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.detail ?? `HTTP ${response.status}`);
    }
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
