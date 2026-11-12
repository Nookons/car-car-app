"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";

export default function PhoneLoginPage() {
  const { t } = useI18n();
  const { refreshSession, authed, ready } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (ready && authed) router.replace("/account");
  }, [ready, authed, router]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ ok: boolean; dev_code?: string }>("/auth/phone/login", {
        method: "POST",
        body: { phone: phone.trim() },
      });
      setDevCode(data.dev_code ?? null);
      setStep("code");
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/phone/login/verify", {
        method: "POST",
        body: { phone: phone.trim(), code: code.trim() },
      });
      await refreshSession().catch(() => {});
      router.replace("/account");
    } catch (err) {
      setError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-8">
      <Card className="space-y-4 p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">{t("auth.phoneLogin")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.phoneLoginHint")}</p>
        </div>

        {step === "phone" ? (
          <form className="space-y-3" onSubmit={send}>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("auth.phone")}</span>
              <Input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                placeholder={t("auth.phonePlaceholder")}
                required
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || !phone.trim()}>
              {busy ? t("list.loading") : t("auth.sendCode")}
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={verify}>
            <p className="text-center text-sm text-muted-foreground">{phone}</p>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("auth.code")}</span>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("auth.codePlaceholder")}
                required
              />
            </label>
            {devCode ? (
              <p className="rounded-xl bg-secondary px-3 py-2 text-center text-sm">
                {t("auth.devCode")}: <span className="font-mono font-semibold">{devCode}</span>
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || code.length < 4}>
              {busy ? t("list.loading") : t("auth.verify")}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              {t("auth.changePhone")}
            </button>
          </form>
        )}

        <p className="border-t pt-3 text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
