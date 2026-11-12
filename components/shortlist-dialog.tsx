"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { SHORTLIST_STATUSES, shortlistKey, type ShortlistStatus } from "@/lib/shortlist";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export function ShortlistDialog({
  open,
  onClose,
  listingId,
  initialStatus,
  initialNote,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  listingId: number;
  initialStatus?: string;
  initialNote?: string | null;
  onSaved?: (status: ShortlistStatus, note: string) => void;
}) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = React.useState<ShortlistStatus>(
    (initialStatus as ShortlistStatus) || "shortlist",
  );
  const [note, setNote] = React.useState(initialNote ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStatus((initialStatus as ShortlistStatus) || "shortlist");
    setNote(initialNote ?? "");
    setError(null);
    api<{ status: string; note: string | null }>(`/favorites/${listingId}`, {
      token: token ?? undefined,
    })
      .then((data) => {
        setStatus((data.status as ShortlistStatus) || "shortlist");
        setNote(data.note ?? "");
      })
      .catch(() => {
        // если запись ещё не создана — оставляем значения по умолчанию
      });
  }, [open, listingId, initialStatus, initialNote, token]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/favorites/${listingId}`, {
        method: "PATCH",
        token: token ?? undefined,
        body: { status, note },
      });
      track("favorite_update", { listingId, meta: { status } });
      onSaved?.(status, note.trim());
      onClose();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("shortlist.title")}
      footer={
        <Button className="w-full" disabled={busy} onClick={save}>
          {busy ? t("onboarding.saving") : t("shortlist.save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("shortlist.status")}</p>
          <div className="flex flex-wrap gap-2">
            {SHORTLIST_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  status === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-secondary",
                )}
              >
                {t(shortlistKey(value))}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("shortlist.note")}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            placeholder={t("shortlist.notePlaceholder")}
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
