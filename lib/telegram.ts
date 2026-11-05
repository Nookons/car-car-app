type TelegramWebApp = {
  initData: string;
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

export function initTelegram(): void {
  const tg = telegram();
  if (!tg) return;
  tg.ready();

  // Bot API 8.0: на мобильных и в Desktop разворачивает Mini App на весь экран.
  try {
    tg.requestFullscreen?.();
  } catch {
    // клиент старее 8.0 — останется окно по умолчанию
  }
  tg.expand?.();
  tg.disableVerticalSwipes?.();

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
  tg.onEvent?.("viewportChanged", syncLayout);
  tg.onEvent?.("fullscreenChanged", syncLayout);
  tg.onEvent?.("safeAreaChanged", syncLayout);
  tg.onEvent?.("contentSafeAreaChanged", syncLayout);
  syncLayout();
}
