"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TelegramLogo } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { SocialAuth } from "@/components/social-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authErrorKey, oauthErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import { safeNext } from "@/lib/next";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login, authed, ready } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [value, setValue] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nextPath, setNextPath] = React.useState("/account");

  React.useEffect(() => {
    setNextPath(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  React.useEffect(() => {
    if (ready && authed) router.replace(nextPath);
  }, [ready, authed, nextPath, router]);

  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("oauth");
    if (!code) return;
    setError(t(oauthErrorKey(code)));
  }, [t]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(value.trim(), password);
      router.replace(nextPath);
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  const bot = (process.env.NEXT_PUBLIC_TELEGRAM_BOT || "CarCarFinderBot").replace(/^@/, "");

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
      </div>

      <Card className="space-y-4 p-5">
        <SocialAuth next={nextPath} />
        <form className="space-y-3" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.loginField")}</span>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="username"
              inputMode="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.password")}</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              required
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy || !value.trim() || !password}>
            {busy ? t("list.loading") : t("auth.login")}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href="/login/phone" className="text-muted-foreground underline-offset-4 hover:underline">
            {t("auth.phoneLogin")}
          </Link>
          <Link
            href="/forgot-password"
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("auth.forgot")}
          </Link>
        </div>

        <p className="border-t pt-3 text-center text-sm">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("auth.register")}
          </Link>
        </p>
      </Card>

      <Card className="space-y-3 p-5 text-center">
        <p className="text-xs text-muted-foreground">{t("auth.telegramHint")}</p>
        <a
          href={`https://t.me/${bot}?startapp`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <TelegramLogo size={18} />
          {t("auth.orTelegram")}
        </a>
      </Card>
    </div>
  );
}
