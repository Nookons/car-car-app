"use client";

import * as React from "react";
import { PaperPlaneTilt, X } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Comment = { id: number; text: string; author: string; created_at: string };

export function CommentsSheet({
  listingId,
  open,
  onClose,
  onCreated,
}: {
  listingId: number | null;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { token } = useAuth();
  const { t, lang } = useI18n();
  const [items, setItems] = React.useState<Comment[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open || !listingId) return;
    api<{ items: Comment[] }>(`/listings/${listingId}/comments`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [open, listingId]);

  if (!open || !listingId) return null;

  const send = async () => {
    if (!token || !text.trim()) return;
    setSending(true);
    try {
      const created = await api<Comment>(`/listings/${listingId}/comments`, {
        method: "POST",
        token,
        body: { text: text.trim() },
      });
      setItems((prev) => [created, ...prev]);
      setText("");
      onCreated?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[72dvh] flex-col rounded-t-3xl bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("feed.comments")}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("feed.noComments")}</p>
          ) : (
            items.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-secondary px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium">{comment.author || "—"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString(lang)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{comment.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("feed.commentPlaceholder")}
            maxLength={1000}
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button disabled={sending || !text.trim()} onClick={send} className="h-11">
            <PaperPlaneTilt size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
