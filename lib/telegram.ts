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

  // В fullscreen высота приходит из события — держим её в CSS-переменной.
  const syncHeight = () => {
    const height = tg.viewportStableHeight;
    if (height) document.documentElement.style.setProperty("--tg-vh", `${height}px`);
  };
  tg.onEvent?.("viewportChanged", syncHeight);
  tg.onEvent?.("fullscreenChanged", syncHeight);
  syncHeight();
}
