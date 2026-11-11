"use client";

import * as React from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/smart-image";
import { useI18n } from "@/lib/i18n";
import { photoSize } from "@/lib/photos";

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const { t } = useI18n();
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const touchStart = React.useRef<number | null>(null);

  const valid = React.useMemo(() => photos.filter(Boolean), [photos]);
  const count = valid.length;

  const go = React.useCallback(
    (delta: number) => {
      if (!count) return;
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  if (!count) {
    return (
      <div className="grid aspect-[4/5] place-items-center bg-muted text-sm text-muted-foreground md:aspect-[16/10]">
        {t("listing.noPhotos")}
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in bg-muted"
        aria-label={t("listing.openPhoto")}
      >
        <SmartImage
          src={photoSize(valid[index], 800, 600)}
          alt={title}
          priority
          sizes="(max-width: 768px) 100vw, 720px"
          className="aspect-[4/5] w-full md:aspect-[16/10]"
        />
      </button>

      {count > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <span className="absolute bottom-[4.25rem] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {index + 1}/{count}
          </span>
          <div className="no-scrollbar absolute inset-x-0 bottom-0 z-20 flex gap-1.5 overflow-x-auto px-2 pb-2">
            {valid.map((src, position) => (
              <button
                key={position}
                type="button"
                onClick={() => setIndex(position)}
                className={cn(
                  "h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 shadow-sm transition",
                  position === index
                    ? "border-white opacity-100"
                    : "border-white/20 opacity-75 hover:opacity-100",
                )}
                aria-label={`${position + 1}`}
              >
                <SmartImage
                  src={photoSize(src, 160, 120)}
                  sizes="64px"
                  className="h-full w-full"
                />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
            aria-label="Previous photo"
          >
            <CaretLeft size={20} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
            aria-label="Next photo"
          >
            <CaretRight size={20} />
          </button>
        </>
      ) : null}


      {open ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black"
          onClick={() => setOpen(false)}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            if (touchStart.current == null) return;
            const delta = event.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1);
            touchStart.current = null;
          }}
        >
          <div
            className="flex items-center justify-between p-3 text-white"
            style={{ paddingTop: "calc(0.75rem + var(--tg-safe-top, 0px))" }}
          >
            <span className="text-sm">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 p-2"
              aria-label={t("common.close")}
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-2 pb-4">
            {/* Фиксированная рамка: фото любого размера вписывается в неё */}
            <div className="flex h-[68vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={valid[index]}
                alt={title}
                className="h-full w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    go(-1);
                  }}
                  className="absolute left-2 rounded-full bg-white/15 p-3 text-white"
                  aria-label="Previous photo"
                >
                  <CaretLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    go(1);
                  }}
                  className="absolute right-2 rounded-full bg-white/15 p-3 text-white"
                  aria-label="Next photo"
                >
                  <CaretRight size={22} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
