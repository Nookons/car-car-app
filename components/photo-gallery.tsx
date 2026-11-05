"use client";

import * as React from "react";
import { ArrowsOut, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
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
    return <div className="grid aspect-[4/3] place-items-center bg-muted text-sm text-muted-foreground">Фото ещё не загружены</div>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in bg-muted"
        aria-label="Открыть фото на весь экран"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={valid[index]}
          alt={title}
          className="aspect-[4/3] w-full object-cover md:aspect-[16/10]"
        />
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
          {index + 1} / {count}
        </span>
        <span className="absolute bottom-2 right-2 hidden rounded-full bg-black/60 p-1.5 text-white sm:block">
          <ArrowsOut size={16} />
        </span>
      </button>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
            aria-label="Предыдущее фото"
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
            aria-label="Следующее фото"
          >
            <CaretRight size={20} />
          </button>
        </>
      ) : null}

      {count > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t bg-card p-2">
          {valid.map((src, position) => (
            <button
              key={position}
              type="button"
              onClick={() => setIndex(position)}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                position === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
              aria-label={`Фото ${position + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
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
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 p-2"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-2 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={valid[index]}
              alt={title}
              className="max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    go(-1);
                  }}
                  className="absolute left-2 rounded-full bg-white/15 p-3 text-white"
                  aria-label="Предыдущее фото"
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
                  aria-label="Следующее фото"
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
