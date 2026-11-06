"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Соответствие наших кодов кузова файлам в /public/bodies. */
const FILES: Record<string, string> = {
  sedan: "sedan",
  hatchback: "hatchback",
  wagon: "station",
  estate: "station",
  suv: "suv",
  coupe: "coupe",
  convertible: "cabriolet",
  minivan: "minivan",
  van: "minivan",
  pickup: "pickup",
};

export function BodyIcon({ body, className }: { body: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const file = FILES[body];

  if (file && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/bodies/${file}.svg`}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("h-8 w-12 object-contain", className)}
      />
    );
  }

  // Фолбэк — простой силуэт, если картинка недоступна.
  const common = {
    viewBox: "0 0 64 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
    className: cn("h-8 w-16", className),
  };
  return (
    <svg {...common}>
      <rect x="8" y="12" width="48" height="10" rx="3" />
      <circle cx="18" cy="24" r="3" />
      <circle cx="46" cy="24" r="3" />
    </svg>
  );
}
