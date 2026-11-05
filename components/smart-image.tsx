"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Фото с умной загрузкой: сначала серый плейсхолдер, потом плавное появление.
 * Приоритетные (первый экран) грузятся сразу, остальные — лениво.
 */
export function SmartImage({
  src,
  alt = "",
  className,
  priority = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <span className={cn("relative block overflow-hidden bg-muted", className)}>
      {!loaded ? (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-secondary" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
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
