"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FacebookLogo, GithubLogo, GoogleLogo, TelegramLogo } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import type { AuthProviders } from "@/lib/types";

type TelegramWidgetUser = Record<string, string | number>;

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

function ProviderIcon({ id, size = 18 }: { id: string; size?: number }) {
  if (id === "google") return <GoogleLogo size={size} weight="bold" />;
  if (id === "facebook") return <FacebookLogo size={size} weight="fill" />;
  if (id === "github") return <GithubLogo size={size} weight="fill" />;
  return <TelegramLogo size={size} />;
}

/**
 * Быстрый вход через внешние сервисы.
 *
 * Telegram — официальный Login Widget: он сам присылает подписанный профиль,
 * а мы отправляем его на `/api/auth/telegram/web`. Google/Facebook/GitHub —
 * обычный redirect на `/api/auth/oauth/{provider}/start`.
 */
export function SocialAuth({ next = "/account" }: { next?: string }) {
  const { refreshSession } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [providers, setProviders] = React.useState<AuthProviders | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const telegramRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api<AuthProviders>("/auth/providers")
      .then((data) => !cancelled && setProviders(data))
      .catch(() => !cancelled && setProviders(null));
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const container = telegramRef.current;
    if (!providers?.telegram.widget || !container) return;

    window.onTelegramAuth = async (user) => {
      setBusy(true);
      setError(null);
      try {
        await api("/auth/telegram/web", { method: "POST", body: user });
        await refreshSession();
        router.replace(next);
      } catch (err) {
        setError(t(authErrorKey(err instanceof Error ? err.message : null)));
      } finally {
        setBusy(false);
      }
    };

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", providers.telegram.bot_username);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.innerHTML = "";
    };
  }, [providers, refreshSession, router, t, next]);

  const startOAuth = (provider: string) => {
    window.location.assign(
      `/api/auth/oauth/${provider}/start?next=${encodeURIComponent(next)}`,
    );
  };

  const devTelegram = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/telegram/web", {
        method: "POST",
        body: { hash: "dev", id: 1, auth_date: Math.floor(Date.now() / 1000) },
      });
      await refreshSession();
      router.replace(next);
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  if (!providers) return null;
  const hasSocial =
    providers.oauth.length > 0 || providers.telegram.widget || providers.dev;
  if (!hasSocial) return null;

  return (
    <div className="space-y-2">
      {providers.oauth.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => startOAuth(provider.id)}
        >
          <ProviderIcon id={provider.id} />
          {provider.label}
        </Button>
      ))}

      {providers.telegram.widget ? (
        <div ref={telegramRef} className="flex min-h-11 items-center justify-center" />
      ) : null}

      {providers.dev ? (
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={devTelegram}>
          <TelegramLogo size={18} />
          Telegram (dev)
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
