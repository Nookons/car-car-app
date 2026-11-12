"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { SocialAuth } from "@/components/social-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import { safeNext } from "@/lib/next";

export default function RegisterPage() {
  const { register, authed, ready } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nextPath, setNextPath] = React.useState("/account");

  React.useEffect(() => {
    setNextPath(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  React.useEffect(() => {
    if (ready && authed) router.replace(nextPath);
  }, [ready, authed, nextPath, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError(t("auth.errWeakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({ email: email.trim(), password, name: name.trim() || undefined });
      router.replace(nextPath);
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.registerSubtitle")}</p>
      </div>

      <Card className="space-y-4 p-5">
        <SocialAuth next={nextPath} />
        <form className="space-y-3" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.name")}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder={t("auth.namePlaceholder")}
              maxLength={80}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.email")}</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              placeholder={t("auth.passwordHint")}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.passwordConfirm")}</span>
            <Input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder={t("auth.passwordHint")}
              required
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || !email.trim() || !password || !confirm}
          >
            {busy ? t("list.loading") : t("auth.register")}
          </Button>
        </form>

        <p className="border-t pt-3 text-center text-sm">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
