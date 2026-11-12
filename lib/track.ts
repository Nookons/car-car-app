export type TrackKind =
  | "visit"
  | "search"
  | "listing_view"
  | "favorite_add"
  | "favorite_update"
  | "saved_search"
  | "alert_open"
  | "share"
  | "onboarding_start"
  | "onboarding_step"
  | "onboarding_done";

const VISITOR_KEY = "carcar.visitor";
const VISIT_KEY = "carcar.visit";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // UUID v4 без crypto.randomUUID (старые webview).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = (Math.random() * 16) | 0;
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let value = window.localStorage.getItem(VISITOR_KEY);
    if (!value) {
      value = uuid();
      window.localStorage.setItem(VISITOR_KEY, value);
    }
    return value;
  } catch {
    return uuid();
  }
}

/**
 * Обезличенное событие воронки: тип + случайный visitor_id.
 * Здесь нет поисковых фраз, заметок, IP и user-agent.
 */
export function track(
  kind: TrackKind,
  options: {
    listingId?: number;
    meta?: Record<string, string | number>;
  } = {},
): void {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;
  const body = JSON.stringify({
    kind,
    visitor_id: visitorId(),
    listing_id: options.listingId,
    meta: options.meta,
  });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

/** Один визит на вкладку: sessionStorage переживает навигацию, но не новую вкладку. */
export function trackVisitOnce(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return;
    window.sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // приватный режим — всё равно отправляем, просто без дедупа
  }
  track("visit");
}
