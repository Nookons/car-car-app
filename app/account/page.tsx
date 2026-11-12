"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellSlash,
  CheckCircle,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  SignOut,
  TelegramLogo,
  Trash,
  TrendDown,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { ListingRow } from "@/components/listing-row";
import { ShortlistDialog } from "@/components/shortlist-dialog";
import { SignInMethods } from "@/components/sign-in-methods";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemeSwitch } from "@/components/theme-switch";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { loadFilters, saveFilters } from "@/lib/filters";
import { shortlistKey } from "@/lib/shortlist";
import { track } from "@/lib/track";
import { LANGS, labelFor, useI18n, type Key } from "@/lib/i18n";
import { filtersSummary } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Filters, Listing, Subscription, User } from "@/lib/types";

export default function AccountPage() {
  const { token, user, authed, mode, ready, favorites, logout, refreshUser } = useAuth();
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [subs, setSubs] = React.useState<Subscription[]>([]);
  const [me, setMe] = React.useState<User | null>(user);
  const [favItems, setFavItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [nameOpen, setNameOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [resend, setResend] = React.useState<"idle" | "sending" | "sent">("idle");
  const [shortlistItem, setShortlistItem] = React.useState<Listing | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteWord, setDeleteWord] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  const load = React.useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    const auth = token ? { token } : {};
    try {
      const [subsData, favData, meData] = await Promise.all([
        api<{ items: Subscription[] }>("/subscriptions", auth),
        api<{ items: Listing[] }>("/favorites", auth),
        api<User>("/me", auth),
      ]);
      setSubs(subsData.items);
      setMe(meData);
      setFavItems(favData.items);
    } catch {
      // сессия могла истечь — гостевой экран покажет вход
    } finally {
      setLoading(false);
    }
  }, [authed, token]);

  React.useEffect(() => {
    if (ready && authed) void load();
  }, [ready, authed, load]);

  const patchUser = async (patch: Partial<User>) => {
    if (!authed || !me) return;
    const previous = me;
    // Мгновенно показываем новое состояние, запрос — фоном.
    setMe({ ...me, ...patch } as User);
    try {
      const fresh = await api<User>("/me", {
        method: "PATCH",
        token: token ?? undefined,
        body: patch,
      });
      setMe(fresh);
    } catch {
      setMe(previous);
    }
  };

  const saveFilter = () => {
    if (!authed || !name.trim()) return;
    const criteria: Filters = loadFilters();
    const draft: Subscription = {
      id: -Date.now(),
      name: name.trim(),
      criteria,
      active: true,
      created_at: new Date().toISOString(),
    };
    // Сразу показываем новый фильтр, сохранение уходит фоном.
    setSubs((prev) => [draft, ...prev]);
    track("saved_search");
    setName("");
    setNameOpen(false);
    api<Subscription>("/subscriptions", {
      method: "POST",
      token: token ?? undefined,
      body: { name: draft.name, criteria },
    })
      .then((created) =>
        setSubs((prev) => prev.map((item) => (item.id === draft.id ? created : item))),
      )
      .catch(() => setSubs((prev) => prev.filter((item) => item.id !== draft.id)));
  };

  const resendEmail = async () => {
    if (resend === "sending") return;
    setResend("sending");
    try {
      await api("/auth/email/resend", { method: "POST", token: token ?? undefined });
      setResend("sent");
    } catch {
      setResend("idle");
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/");
  };

  const exportData = async () => {
    setDataError(null);
    try {
      const data = await api<unknown>("/account/export", token ? { token } : {});
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carcar-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exc) {
      setDataError(exc instanceof Error ? exc.message : "error");
    }
  };

  const deleteAccount = async () => {
    if (deleteWord !== t("account.deleteWord")) return;
    setDeleting(true);
    setDataError(null);
    try {
      await api("/account", { method: "DELETE", token: token ?? undefined });
      await logout();
      router.replace("/");
    } catch (exc) {
      setDataError(exc instanceof Error ? exc.message : "error");
      setDeleting(false);
    }
  };

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-4">
        <h1 className="text-lg font-semibold">{t("nav.account")}</h1>
        <Card className="space-y-3 p-6 text-center">
          <ThemeSwitch />
          <p className="text-sm text-muted-foreground">{t("account.guestHint")}</p>
          <Link href="/login" className={cn(buttonVariants(), "w-full")}>
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            {t("auth.register")}
          </Link>
          <a
            href={`https://t.me/${(process.env.NEXT_PUBLIC_TELEGRAM_BOT || "CarCarFinderBot").replace(/^@/, "")}?startapp`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
          >
            <TelegramLogo size={18} />
            {t("account.openTelegram")}
          </a>
        </Card>
      </div>
    );
  }

  if (loading && !me) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const isWeb = mode === "web";
  const displayName =
    [me?.first_name, me?.last_name].filter(Boolean).join(" ") ||
    me?.email ||
    (me?.tg_id ? `${t("account.telegramId")} ${me.tg_id}` : t("account.user"));
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      <Card className="flex flex-wrap items-center gap-3 p-4 lg:col-span-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{displayName}</p>
          {isWeb ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <EnvelopeSimple size={14} />
              <span className="truncate">{me?.email}</span>
              {me?.email_verified ? (
                <CheckCircle size={14} weight="fill" className="text-emerald-500" />
              ) : (
                <WarningCircle size={14} className="text-amber-500" />
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {me?.username ? `@${me.username}` : `${t("account.telegramId")} ${me?.tg_id}`}
            </p>
          )}
        </div>
        {isWeb ? (
          <Button variant="outline" size="sm" onClick={doLogout}>
            <SignOut size={16} />
            {t("auth.logout")}
          </Button>
        ) : null}
      </Card>

      {isWeb && me && !me.email_verified ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40 lg:col-span-2">
          <p className="flex items-center gap-2 text-sm">
            <WarningCircle size={18} className="text-amber-600 dark:text-amber-400" />
            {t("account.verifyEmailBanner")}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={resend === "sending" || resend === "sent"}
            onClick={resendEmail}
          >
            {resend === "sent" ? t("auth.emailSent") : t("auth.resendEmail")}
          </Button>
        </Card>
      ) : null}

      <SignInMethods />

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{t("account.settings")}</h2>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("account.lang")}</span>
          <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={lang}
            onChange={(event) => {
              const next = event.target.value as (typeof LANGS)[number][0];
              setLang(next);
              void patchUser({ lang: next });
            }}
          >
            {LANGS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <ThemeSwitch />

        <div className="flex items-center justify-between gap-3 py-1">
          <span className="flex items-center gap-2 text-sm">
            {me?.notify_new ? <Bell size={18} /> : <BellSlash size={18} />}
            {t("account.notify")}
          </span>
          <Button
            variant={me?.notify_new ? "default" : "outline"}
            size="sm"
            onClick={() => patchUser({ notify_new: !me?.notify_new })}
          >
            {me?.notify_new ? t("account.on") : t("account.off")}
          </Button>
        </div>

        <div className="space-y-1 py-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <TrendDown size={18} />
              {t("account.notifyPrice")}
            </span>
            <Button
              variant={me?.notify_price ? "default" : "outline"}
              size="sm"
              onClick={() => patchUser({ notify_price: !me?.notify_price })}
            >
              {me?.notify_price ? t("account.on") : t("account.off")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("account.notifyPriceHint")}</p>
        </div>

        {isWeb ? (
          <p className="text-xs text-muted-foreground">{t("account.alertsTelegramOnly")}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm">{t("account.digest")}</span>
          <Button
            variant={me?.digest ? "default" : "outline"}
            size="sm"
            onClick={() => patchUser({ digest: !me?.digest })}
          >
            {me?.digest ? t("account.on") : t("account.off")}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("account.filters")}</h2>
          <span className="text-xs text-muted-foreground">{subs.length}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("account.hintFilters")}</p>

        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("account.noFilters")}</p>
        ) : (
          <ul className="space-y-3">
            {subs.map((sub) => (
              <li key={sub.id} className="space-y-2 border-b pb-3 last:border-none last:pb-0">
                <div>
                  <p className="text-sm font-medium">{sub.name}</p>
                  <p className="text-xs text-muted-foreground">{summary(sub.criteria, t)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      saveFilters(sub.criteria);
                      router.push("/list");
                    }}
                  >
                    <Eye size={16} /> {t("account.show")}
                  </Button>
                  <Button
                    variant={sub.active ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const nextActive = !sub.active;
                      setSubs((prev) =>
                        prev.map((item) =>
                          item.id === sub.id ? { ...item, active: nextActive } : item,
                        ),
                      );
                      api(`/subscriptions/${sub.id}`, {
                        method: "PATCH",
                        token: token ?? undefined,
                        body: { active: nextActive },
                      }).catch(() =>
                        setSubs((prev) =>
                          prev.map((item) =>
                            item.id === sub.id ? { ...item, active: sub.active } : item,
                          ),
                        ),
                      );
                    }}
                  >
                    {sub.active ? t("account.on") : t("account.off")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSubs((prev) => prev.filter((item) => item.id !== sub.id));
                      api(`/subscriptions/${sub.id}`, {
                        method: "DELETE",
                        token: token ?? undefined,
                      }).catch(() => load());
                    }}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" className="w-full" onClick={() => setNameOpen(true)}>
          {t("account.saveCurrent")}
        </Button>
      </Card>

      <section className="space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("account.favorites")}</h2>
          <span className="text-xs text-muted-foreground">{favorites.size}</span>
        </div>
        {favItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("account.emptyFavorites")}</p>
        ) : (
          <div className="-mx-4 space-y-3 md:mx-auto md:w-full md:max-w-2xl">
            {favItems.slice(0, 6).map((item, index) => (
              <div key={item.id} className="space-y-1">
                <ListingRow item={item} priority={index < 2} />
                <div className="flex items-center justify-between gap-2 px-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {t(shortlistKey(item.favorite_status))}
                    {item.favorite_note ? ` · ${item.favorite_note}` : ""}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setShortlistItem(item)}
                  >
                    {t("shortlist.open")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="lg:col-span-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">{t("account.dataTitle")}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportData}>
              <DownloadSimple size={16} />
              {t("account.export")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash size={16} />
              {t("account.delete")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("account.exportHint")}</p>
          {dataError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {dataError}
            </p>
          ) : null}
        </Card>
      </section>

      {shortlistItem ? (
        <ShortlistDialog
          open
          onClose={() => setShortlistItem(null)}
          listingId={shortlistItem.id}
          initialStatus={shortlistItem.favorite_status}
          initialNote={shortlistItem.favorite_note}
          onSaved={(status, note) =>
            setFavItems((prev) =>
              prev.map((item) =>
                item.id === shortlistItem.id
                  ? { ...item, favorite_status: status, favorite_note: note || null }
                  : item,
              ),
            )
          }
        />
      ) : null}

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteWord("");
          setDataError(null);
        }}
        title={t("account.delete")}
        footer={
          <Button
            variant="destructive"
            className="w-full"
            disabled={deleting || deleteWord !== t("account.deleteWord")}
            onClick={deleteAccount}
          >
            {deleting ? t("onboarding.saving") : t("account.deleteAction")}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("account.deleteHint")}</p>
          <p className="text-sm font-medium">{t("account.deleteConfirm")}</p>
          <Input
            value={deleteWord}
            onChange={(event) => setDeleteWord(event.target.value)}
            autoComplete="off"
            placeholder={t("account.deleteWord")}
          />
        </div>
      </Dialog>

      <Dialog
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title={t("account.filterName")}
        footer={
          <Button className="w-full" onClick={saveFilter} disabled={saving || !name.trim()}>
            {t("account.save")}
          </Button>
        }
      >
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="BMW 320d до 50 000"
          maxLength={120}
        />
      </Dialog>

    </div>
  );
}

function summary(filters: Filters, t: (key: Key) => string): string {
  const parts = [
    filters.makes?.join(", ") ?? filters.make,
    filters.bodies?.map((value) => labelFor(t, "body", value)).join(", ") ??
      (filters.body ? labelFor(t, "body", filters.body) : null),
    filters.price_max ? `≤ ${filters.price_max} zł` : null,
    filters.year_min ? `≥ ${filters.year_min}` : null,
    filters.mileage_max ? `≤ ${filters.mileage_max} km` : null,
    filters.gearboxes?.map((value) => labelFor(t, "gearbox", value)).join(", ") ??
      (filters.gearbox ? labelFor(t, "gearbox", filters.gearbox) : null),
    filters.radius_km ? `${filters.radius_km} km` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
