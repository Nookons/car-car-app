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

export async function api<T>(
  path: string,
  options: {
    token?: string | null;
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const method = options.method ?? "GET";
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // Кэш — на стороне API. Браузерный кэш после деплоя отдавал старые
    // ответы без photos/price_analysis, поэтому всегда идём в сеть.
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(response.status, detail.detail ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
