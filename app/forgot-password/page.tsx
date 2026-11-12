"use client";

import * as React from "react";
import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-8">
      <Card className="space-y-4 p-6">
        {sent ? (
          <div className="space-y-3 text-center">
            <EnvelopeSimple size={40} className="mx-auto text-primary" />
            <h1 className="text-lg font-semibold">{t("auth.resetSentTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.resetSentText")}</p>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold">{t("auth.resetTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.resetSubtitle")}</p>
            </div>
            <form className="space-y-3" onSubmit={submit}>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">{t("auth.email")}</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  required
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
                {busy ? t("list.loading") : t("auth.sendReset")}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("auth.backToLogin")}
              </Link>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
