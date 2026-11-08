type TelegramWebApp = {
  initData: string;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (event: string, cb: () => void) => void;
  viewportStableHeight?: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  LocationManager?: {
    init: () => Promise<void>;
    getLocation: () => Promise<{ latitude: number; longitude: number }>;
    isLocationAvailable?: boolean;
    openSettings?: () => void;
  };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
  themeParams?: Record<string, string>;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function telegram(): TelegramWebApp | undefined {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

export function getInitData(): string {
  const tg = telegram();
  if (tg?.initData) return tg.initData;
  return process.env.NEXT_PUBLIC_ALLOW_DEV === "1" ? "dev" : "";
}

export type Coords = { lat: number; lon: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Геолокация: в Telegram — через LocationManager, иначе браузерная. */
export async function requestLocation(): Promise<Coords> {
  const tg = telegram();
  const manager = tg?.LocationManager;
  if (manager?.init && manager.isLocationAvailable !== false) {
    try {
      await manager.init();
    } catch {
      // менеджер может быть недоступен — пробуем всё равно
    }
    // Клиент иногда отвечает NotInitied сразу после init — даём ему время.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const position = (await manager.getLocation()) as
          | { latitude?: number; longitude?: number }
          | undefined;
        const latitude = Number(position?.latitude);
        const longitude = Number(position?.longitude);
        // В обычном браузере Telegram-заглушка может вернуть пустой объект.
        // Тогда не подменяем координаты на undefined, а идём в navigator.geolocation.
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { lat: latitude, lon: longitude };
        }
        break;
      } catch (error) {
        if (!/notinit/i.test(String(error)) || attempt === 3) break;
        await sleep(400);
      }
    }
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Геолокация недоступна"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => reject(new Error("Доступ к геолокации запрещён")),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export function openLocationSettings(): boolean {
  const manager = telegram()?.LocationManager;
  if (!manager?.openSettings) return false;
  manager.openSettings();
  return true;
}

export function initTelegram(): void {
  const tg = telegram();
  if (!tg) return;
  tg.ready();

  const supports = (version: string) => {
    if (tg.isVersionAtLeast) return tg.isVersionAtLeast(version);
    const current = (tg.version ?? "6.0").split(".").map(Number);
    const target = version.split(".").map(Number);
    for (let index = 0; index < Math.max(current.length, target.length); index += 1) {
      const a = current[index] ?? 0;
      const b = target[index] ?? 0;
      if (a !== b) return a > b;
    }
    return true;
  };

  // Bot API 8.0: на мобильных и в Desktop разворачивает Mini App на весь экран.
  if (supports("8.0")) {
    try {
      tg.requestFullscreen?.();
    } catch {
      // клиент старее 8.0 — останется окно по умолчанию
    }
  }
  tg.expand?.();
  if (supports("7.7")) tg.disableVerticalSwipes?.();

  // В fullscreen высота и безопасные зоны приходят событиями — держим их в CSS.
  const syncLayout = () => {
    const root = document.documentElement;
    const height = tg.viewportStableHeight;
    if (height) root.style.setProperty("--tg-vh", `${height}px`);

    const safe = tg.safeAreaInset ?? { top: 0, bottom: 0 };
    const content = tg.contentSafeAreaInset ?? { top: 0, bottom: 0 };
    // системная шапка Telegram рисуется поверх webview — отступаем на её высоту
    root.style.setProperty("--tg-safe-top", `${(safe.top ?? 0) + (content.top ?? 0)}px`);
    root.style.setProperty("--tg-safe-bottom", `${(safe.bottom ?? 0) + (content.bottom ?? 0)}px`);
  };
  const syncFullscreen = () => {
    document.documentElement.classList.toggle("tg-fullscreen", Boolean(tg.isFullscreen));
  };
  tg.onEvent?.("viewportChanged", syncLayout);
  tg.onEvent?.("fullscreenChanged", () => {
    syncLayout();
    syncFullscreen();
  });
  tg.onEvent?.("safeAreaChanged", syncLayout);
  tg.onEvent?.("contentSafeAreaChanged", syncLayout);
  syncLayout();
  syncFullscreen();
}
