"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle, CircleNotch, XCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type State = "loading" | "ok" | "error";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const { refreshSession, authed } = useAuth();
  const [state, setState] = React.useState<State>("loading");
  const [message, setMessage] = React.useState<string | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setState("error");
      setMessage(t("auth.verifyFailed"));
      return;
    }

    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(async () => {
        setState("ok");
        // Если человек уже вошёл в этом браузере, обновляем флаг «почта
        // подтверждена» без перезагрузки страницы.
        if (authed) await refreshSession().catch(() => {});
      })
      .catch((err) => {
        setState("error");
        setMessage(t(authErrorKey(err instanceof Error ? err.message : null)));
      });
  }, [authed, refreshSession, t]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-8">
      <Card className="space-y-4 p-6 text-center">
        {state === "loading" ? (
          <>
            <CircleNotch size={40} className="mx-auto animate-spin text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t("auth.verifyEmailTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.verifying")}</p>
          </>
        ) : null}

        {state === "ok" ? (
          <>
            <CheckCircle size={44} weight="fill" className="mx-auto text-emerald-500" />
            <h1 className="text-lg font-semibold">{t("auth.verifiedTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.verifiedText")}</p>
            <Link href="/account" className={cn(buttonVariants(), "w-full")}>
              {t("nav.account")}
            </Link>
          </>
        ) : null}

        {state === "error" ? (
          <>
            <XCircle size={44} weight="fill" className="mx-auto text-red-500" />
            <h1 className="text-lg font-semibold">{t("auth.verifyEmailTitle")}</h1>
            <p className="text-sm text-muted-foreground">{message ?? t("auth.verifyFailed")}</p>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              {t("auth.backToLogin")}
            </Link>
          </>
        ) : null}
      </Card>
    </div>
  );
}
