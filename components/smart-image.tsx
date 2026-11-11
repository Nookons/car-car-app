"use client";

import * as React from "react";
import { photoSize, photoSrcSet } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Фото с умной загрузкой: сначала серый плейсхолдер, потом плавное появление.
 * Приоритетные (первый экран) грузятся сразу, остальные — лениво.
 *
 * Намеренно без `next/image`: его оптимизатор на Vercel считается в квоте
 * (5 000 исходных картинок в месяц на бесплатном плане и она у нас кончилась),
 * а CDN площадки уже умеет отдавать нужный размер через `;s=ШxВ`. Поэтому
 * браузеру отдаётся обычный `img` с `srcSet` на 320/640/960 — он сам выбирает
 * вариант под экран и DPR, без лишнего хопа через Vercel.
 */
const DEFAULT_WIDTHS = [320, 640, 960];

export function SmartImage({
  src,
  alt = "",
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 640px",
  widths = DEFAULT_WIDTHS,
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  widths?: number[];
}) {
  const [loaded, setLoaded] = React.useState(false);
  const srcSet = React.useMemo(() => photoSrcSet(src, widths), [src, widths]);
  const fallback = React.useMemo(() => photoSize(src, 640, 480), [src]);

  return (
    <span className={cn("relative block overflow-hidden bg-muted", className)}>
      {!loaded ? (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-secondary" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcSet ? fallback : src}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
