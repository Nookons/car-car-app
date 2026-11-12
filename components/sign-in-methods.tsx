"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle,
  EnvelopeSimple,
  FacebookLogo,
  GithubLogo,
  GoogleLogo,
  Key as KeyIcon,
  Phone,
  TelegramLogo,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";
import type { AuthProviders, Identity, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Notice = { tone: "ok" | "error"; text: string };

function ProviderIcon({ id }: { id: string }) {
  if (id === "google") return <GoogleLogo size={18} weight="bold" />;
  if (id === "facebook") return <FacebookLogo size={18} weight="fill" />;
  if (id === "github") return <GithubLogo size={18} weight="fill" />;
  return <TelegramLogo size={18} />;
}

/**
 * «Способы входа»: почта, телефон, пароль, Telegram и OAuth-сервисы.
 *
 * Карточка живёт и в веб-аккаунте, и в Telegram Mini App. Для Telegram-
 * пользователя она — путь в веб: добавить почту, поставить пароль и войти
 * на сайте; для веб-пользователя — привязать Telegram, чтобы тот же аккаунт
 * открывался в боте.
 */
export function SignInMethods() {
  const { user, token, mode, refreshUser } = useAuth();
  const { t } = useI18n();
  const auth = token ? { token } : {};

  const [providers, setProviders] = React.useState<AuthProviders | null>(null);
  const [identities, setIdentities] = React.useState<Identity[]>([]);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const [tgOpen, setTgOpen] = React.useState(false);
  const [tgData, setTgData] = React.useState<{
    deep_link: string;
    command: string;
    code: string;
  } | null>(null);
  const [tgBusy, setTgBusy] = React.useState(false);

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);
  const [emailDevToken, setEmailDevToken] = React.useState<string | null>(null);
  const [emailBusy, setEmailBusy] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [phoneOpen, setPhoneOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [providerData, identityData] = await Promise.all([
        api<AuthProviders>("/auth/providers"),
        api<{ items: Identity[] }>("/auth/identities", auth),
      ]);
      setProviders(providerData);
      setIdentities(identityData.items);
    } catch {
      // карточка не критична для остального экрана
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const linkError = params.get("link");
    if (linked) {
      setNotice({ tone: "ok", text: t("auth.oauthLinked") });
    } else if (linkError === "exists") {
      setNotice({ tone: "error", text: t("auth.oauthLinkExists") });
    }
    if (linked || linkError) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [t]);

  const linked = (provider: string) =>
    identities.some((item) => item.provider === provider) ||
    (provider === "telegram" && Boolean(user?.tg_id));

  React.useEffect(() => {
    if (!tgOpen) return;
    const timer = window.setInterval(async () => {
      try {
        const data = await api<{ items: Identity[] }>("/auth/identities", auth);
        if (data.items.some((item) => item.provider === "telegram")) {
          setIdentities(data.items);
          setTgOpen(false);
          await refreshUser();
          setNotice({ tone: "ok", text: t("auth.telegramLinked") });
        }
      } catch {
        // продолжаем ждать, пока диалог открыт
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [tgOpen, token, refreshUser, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const startTelegram = async () => {
    setTgBusy(true);
    setNotice(null);
    try {
      const data = await api<{ deep_link: string; command: string; code: string }>(
        "/auth/telegram/link/start",
        { method: "POST", ...auth },
      );
      setTgData(data);
      setTgOpen(true);
    } catch (err) {
      setNotice({
        tone: "error",
        text: t(authErrorKey(err instanceof Error ? err.message : null)),
      });
    } finally {
      setTgBusy(false);
    }
  };

  const linkOAuth = (provider: string) => {
    window.location.assign(`/api/auth/oauth/${provider}/start?link=1&next=/account`);
  };

  const sendEmail = async () => {
    if (emailBusy || !email.trim()) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const data = await api<{ sent: boolean; dev_token?: string }>("/auth/email/start", {
        method: "POST",
        ...auth,
        body: { email: email.trim() },
      });
      setEmailSent(true);
      setEmailDevToken(data.dev_token ?? null);
    } catch (err) {
      setEmailError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setEmailBusy(false);
    }
  };

  const checkEmail = async () => {
    try {
      const fresh = await api<User>("/me", auth);
      if (fresh.email_verified) {
        await refreshUser();
        setEmailOpen(false);
        setEmailSent(false);
        setEmail("");
        setNotice({ tone: "ok", text: t("auth.emailVerified") });
      } else {
        setEmailError(t("auth.emailNotYet"));
      }
    } catch (err) {
      setEmailError(t(authErrorKey(err instanceof Error ? err.message : null)));
    }
  };

  const savePassword = async () => {
    if (passwordBusy || password.length < 8) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await api("/auth/password/set", {
        method: "POST",
        ...auth,
        body: { password },
      });
      await refreshUser();
      setPasswordOpen(false);
      setPassword("");
      setNotice({ tone: "ok", text: t("auth.passwordSet") });
    } catch (err) {
      setPasswordError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setPasswordBusy(false);
    }
  };

  const startPhone = async () => {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const data = await api<{ sent: boolean; dev_code?: string }>("/auth/phone/start", {
        method: "POST",
        ...auth,
        body: { phone: phone.trim() },
      });
      setDevCode(data.dev_code ?? null);
      setCodeSent(true);
    } catch (err) {
      setPhoneError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhone = async () => {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      await api("/auth/phone/verify", {
        method: "POST",
        ...auth,
        body: { phone: phone.trim(), code: code.trim() },
      });
      await refreshUser();
      setPhoneOpen(false);
      setPhone("");
      setCode("");
      setCodeSent(false);
      setDevCode(null);
      setNotice({ tone: "ok", text: t("auth.phoneVerified") });
    } catch (err) {
      setPhoneError(t(authErrorKey(err instanceof Error ? err.message : null)));
    } finally {
      setPhoneBusy(false);
    }
  };

  const emailVerified = Boolean(user.email_verified);
  const isWeb = mode === "web";

  return (
    <Card className="min-w-0 space-y-3 p-4">
      <h2 className="text-base font-semibold">{t("auth.signInMethods")}</h2>

      {notice ? (
        <p
          role="status"
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            notice.tone === "ok"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <EnvelopeSimple size={18} className="shrink-0" />
          <span className="truncate">{user.email ?? t("account.emailNotAdded")}</span>
        </span>
        {user.email ? (
          <Badge
            className={cn(
              "shrink-0 whitespace-nowrap",
              emailVerified
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
            )}
          >
            {emailVerified ? t("auth.emailVerified") : t("auth.notVerified")}
          </Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            {t("auth.addEmail")}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Phone size={18} className="shrink-0" />
          <span className="truncate">{user.phone ?? "—"}</span>
        </span>
        {user.phone_verified ? (
          <Badge className="shrink-0 whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {t("auth.phoneVerified")}
          </Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setPhoneOpen(true)}>
            {t("auth.addPhone")}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          <KeyIcon size={18} />
          {user.has_password ? t("auth.passwordSet") : t("account.passwordNotSet")}
        </span>
        {user.has_password ? (
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("auth.changePassword")}
          </Link>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!emailVerified}
            onClick={() => setPasswordOpen(true)}
          >
            {t("auth.setPassword")}
          </Button>
        )}
      </div>
      {!user.has_password && !emailVerified ? (
        <p className="text-xs text-muted-foreground">{t("auth.emailNotVerified")}</p>
      ) : null}

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">{t("account.socialHint")}</p>

        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <TelegramLogo size={18} />
            {t("auth.telegram")}
          </span>
          {linked("telegram") ? (
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {t("auth.linked")}
            </Badge>
          ) : (
            <Button size="sm" variant="outline" disabled={tgBusy} onClick={startTelegram}>
              {t("auth.link")}
            </Button>
          )}
        </div>

        {isWeb
          ? providers?.oauth.map((provider) => (
          <div key={provider.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <ProviderIcon id={provider.id} />
              {provider.label}
            </span>
            {linked(provider.id) ? (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {t("auth.linked")}
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => linkOAuth(provider.id)}>
                {t("auth.link")}
              </Button>
            )}
          </div>
            ))
          : null}
      </div>

      <p className="text-xs text-muted-foreground">{t("account.linkHint")}</p>

      <Dialog
        open={tgOpen}
        onClose={() => setTgOpen(false)}
        title={t("auth.linkTelegram")}
        footer={
          tgData ? (
            <a
              href={tgData.deep_link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), "w-full")}
            >
              <TelegramLogo size={18} />
              {t("auth.openTelegram")}
            </a>
          ) : null
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t("auth.linkTelegramHint")}</p>
          {tgData ? (
            <>
              <p className="break-all rounded-xl bg-secondary px-3 py-2 font-mono text-xs">
                {tgData.deep_link}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.linkCommand")}:{" "}
                <span className="font-mono">{tgData.command}</span>
              </p>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("auth.waitingTelegram")}</p>
        </div>
      </Dialog>

      <Dialog
        open={emailOpen}
        onClose={() => {
          setEmailOpen(false);
          setEmailSent(false);
          setEmailError(null);
          setEmailDevToken(null);
        }}
        title={t("auth.addEmail")}
        footer={
          emailSent ? (
            <Button className="w-full" onClick={checkEmail}>
              {t("auth.checkEmail")}
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={emailBusy || !email.trim()}
              onClick={sendEmail}
            >
              {emailBusy ? t("list.loading") : t("auth.sendReset")}
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {emailSent ? (
            <p className="text-sm text-muted-foreground">{t("auth.emailAddSent")}</p>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("auth.email")}</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
              />
            </label>
          )}
          {emailDevToken ? (
            <a
              href={`/verify-email?token=${encodeURIComponent(emailDevToken)}`}
              className="block text-sm text-primary underline-offset-4 hover:underline"
            >
              {t("auth.devLink")}
            </a>
          ) : null}
          {emailError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {emailError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setPassword("");
          setPasswordError(null);
        }}
        title={t("auth.setPassword")}
        footer={
          <Button
            className="w-full"
            disabled={passwordBusy || password.length < 8}
            onClick={savePassword}
          >
            {passwordBusy ? t("list.loading") : t("auth.setPassword")}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("auth.setPasswordHint")}</p>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.passwordHint")}
            autoComplete="new-password"
          />
          {passwordError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {passwordError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={phoneOpen}
        onClose={() => {
          setPhoneOpen(false);
          setCodeSent(false);
          setCode("");
          setPhoneError(null);
          setDevCode(null);
        }}
        title={t("auth.addPhone")}
        footer={
          <Button
            className="w-full"
            disabled={phoneBusy || !phone.trim() || (codeSent && code.length < 4)}
            onClick={codeSent ? verifyPhone : startPhone}
          >
            {phoneBusy ? t("list.loading") : codeSent ? t("auth.verify") : t("auth.sendCode")}
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.phone")}</span>
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("auth.phonePlaceholder")}
              autoComplete="tel"
              disabled={codeSent}
            />
          </label>
          {codeSent ? (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("auth.code")}</span>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("auth.codePlaceholder")}
              />
            </label>
          ) : null}
          {devCode ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-center text-sm">
              {t("auth.devCode")}: <span className="font-mono font-semibold">{devCode}</span>
            </p>
          ) : null}
          {phoneError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {phoneError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </Card>
  );
}
