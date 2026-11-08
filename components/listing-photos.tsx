"use client";

import * as React from "react";
import { CarProfile } from "@phosphor-icons/react";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";

/**
 * Фотолента карточки: листается свайпом прямо в списке, следующее фото
 * выглядывает справа. Тап без свайпа открывает объявление (ссылка карточки).
 */
export function ListingPhotos({
  photos,
  title,
  priority = false,
}: {
  photos: string[];
  title: string;
  priority?: boolean;
}) {
  const [index, setIndex] = React.useState(0);
  const scroller = React.useRef<HTMLDivElement>(null);
  const startX = React.useRef<number | null>(null);
  const dragged = React.useRef(false);
  const count = photos.length;
  const multiple = count > 1;

  const onScroll = () => {
    const element = scroller.current;
    if (!element || !multiple) return;
    const first = element.firstElementChild as HTMLElement | null;
    if (!first) return;
    const step = first.offsetWidth + 4;
    const next = Math.round(element.scrollLeft / step);
    setIndex(Math.max(0, Math.min(count - 1, next)));
  };

  if (!count) {
    return (
      <span className="grid aspect-[16/9] w-full place-items-center bg-muted text-muted-foreground">
        <CarProfile size={44} weight="duotone" />
      </span>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={(event) => {
          startX.current = event.clientX;
          dragged.current = false;
        }}
        onPointerMove={(event) => {
          if (startX.current != null && Math.abs(event.clientX - startX.current) > 8) {
            dragged.current = true;
          }
        }}
        onPointerUp={() => {
          startX.current = null;
        }}
        onPointerCancel={() => {
          startX.current = null;
        }}
        onClickCapture={(event) => {
          if (!dragged.current) return;
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }}
        onDragStart={(event) => event.preventDefault()}
        className="no-scrollbar flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain"
      >
        {photos.map((src, position) => (
          <div
            key={position}
            className={cn(
              "shrink-0 snap-start overflow-hidden bg-muted",
              multiple ? "w-[calc(100%_-_16px)]" : "w-full",
            )}
          >
            <SmartImage
              src={src}
              alt={title}
              priority={priority && position === 0}
              className="aspect-[16/9] w-full"
            />
          </div>
        ))}
      </div>

      {multiple ? (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          {index + 1}/{count}
        </span>
      ) : null}
    </div>
  );
}
