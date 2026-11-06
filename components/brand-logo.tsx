"use client";

import * as React from "react";
import { brandLogoUrl } from "@/lib/brands";
import { cn } from "@/lib/utils";

export function BrandLogo({ make, className }: { make: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const initials = make.replace(/[^A-Za-zА-Яа-я0-9 ]/g, "").slice(0, 2).toUpperCase();

  if (failed) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-full bg-card text-xs font-semibold",
          className,
        )}
      >
        {initials}
      </span>
    );
  }
  return (
    <span className={cn("grid place-items-center rounded-full bg-white p-1.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandLogoUrl(make)}
        alt={make}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
