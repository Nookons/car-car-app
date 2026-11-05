type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
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
  tg.expand();
}
