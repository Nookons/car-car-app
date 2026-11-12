"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [token, setToken] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !token) return;
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
      await api("/auth/password/reset", {
        method: "POST",
        body: { token, password },
      });
      setDone(true);
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-8">
      <Card className="space-y-4 p-6">
        {done ? (
          <div className="space-y-3 text-center">
            <CheckCircle size={44} weight="fill" className="mx-auto text-emerald-500" />
            <h1 className="text-lg font-semibold">{t("auth.resetDone")}</h1>
            <Link href="/login" className={cn(buttonVariants(), "w-full")}>
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold">{t("auth.resetTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.newPassword")}</p>
            </div>
            <form className="space-y-3" onSubmit={submit}>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">{t("auth.newPassword")}</span>
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
              {token === "" ? (
                <p className="text-sm text-red-600 dark:text-red-400">{t("auth.verifyFailed")}</p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !token || !password || !confirm}
              >
                {busy ? t("list.loading") : t("auth.resetDone")}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
