"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const OPTIMIZED_IMAGE_HOST = /(^|\.)olxcdn\.com$/i;

function canOptimize(src: string): boolean {
  try {
    return OPTIMIZED_IMAGE_HOST.test(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Фото с умной загрузкой: сначала серый плейсхолдер, потом плавное появление.
 * Приоритетные (первый экран) грузятся сразу, остальные — лениво.
 */
export function SmartImage({
  src,
  alt = "",
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 640px",
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const optimized = canOptimize(src);

  return (
    <span className={cn("relative block overflow-hidden bg-muted", className)}>
      {!loaded ? (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-secondary" />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={!optimized}
        priority={priority}
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
