"use client";

import * as React from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-background shadow-xl sm:rounded-2xl",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
