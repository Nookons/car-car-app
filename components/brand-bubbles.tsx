"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BubbleMake = { value: string; count: number; users?: number };

type Body = { x: number; y: number; vx: number; vy: number; r: number };

const SHORT_LABELS: Record<string, string> = {
  "Mercedes-Benz": "Mercedes",
};

function displayLabel(value: string): string {
  return SHORT_LABELS[value] ?? value;
}

/**
 * Плавающие пузыри марок: медленно дрейфуют, отталкиваются от краёв и друг
 * от друга. Выбранный пузырь чуть увеличивается. Скорость намеренно низкая —
 * это фон для выбора, а не аттракцион.
 *
 * Движение полностью на requestAnimationFrame и transform: React не
 * перерисовывается 60 раз в секунду. При prefers-reduced-motion пузыри
 * остаются на месте.
 */
export function BrandBubbles({
  makes,
  selected,
  onToggle,
  onClear,
}: {
  makes: BubbleMake[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const buttonsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const bodiesRef = React.useRef<Body[]>([]);
  const hasUserStats = makes.some((make) => (make.users ?? 0) > 0);
  const weights = makes.map((make) =>
    hasUserStats ? make.users ?? 0 : make.count,
  );
  const maxWeight = Math.max(1, ...weights);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !makes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(makes.length))));
    const rows = Math.ceil(makes.length / columns);
    const cellW = width / columns;
    const cellH = height / rows;

    const bodies: Body[] = makes.map((make, index) => {
      const weight = hasUserStats ? make.users ?? 0 : make.count;
      const label = displayLabel(make.value);
      const minForText = 28 + label.length * 2.2;
      const radius = Math.max(
        Math.max(31, minForText),
        Math.min(
          52,
          29 + 17 * Math.sqrt(weight / maxWeight),
        ),
      );
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: cellW * (col + 0.5) + (Math.random() - 0.5) * cellW * 0.25,
        y: cellH * (row + 0.5) + (Math.random() - 0.5) * cellH * 0.25,
        vx: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08),
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08),
        r: radius,
      };
    });
    bodiesRef.current = bodies;

    const apply = () => {
      bodies.forEach((body, index) => {
        const element = buttonsRef.current[index];
        if (!element) return;
        const size = body.r * 2;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.transform = `translate3d(${body.x - body.r}px, ${
          body.y - body.r
        }px, 0)`;
        element.style.setProperty(
          "--bubble-font",
          `${Math.max(10, Math.min(13, 10 + (body.r - 30) * 0.22))}px`,
        );
      });
    };

    const clamp = (body: Body) => {
      body.x = Math.max(body.r, Math.min(width - body.r, body.x));
      body.y = Math.max(body.r, Math.min(height - body.r, body.y));
    };
    bodies.forEach(clamp);
    apply();

    if (reduced) return;

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(2, (now - previous) / 16.67);
      previous = now;

      for (const body of bodies) {
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        if (body.x - body.r <= 0) {
          body.x = body.r;
          body.vx = Math.abs(body.vx);
        } else if (body.x + body.r >= width) {
          body.x = width - body.r;
          body.vx = -Math.abs(body.vx);
        }
        if (body.y - body.r <= 0) {
          body.y = body.r;
          body.vy = Math.abs(body.vy);
        } else if (body.y + body.r >= height) {
          body.y = height - body.r;
          body.vy = -Math.abs(body.vy);
        }
      }

      // Мягкое расталкивание: пузыри не должны слипаться в один ком.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < bodies.length; i += 1) {
          for (let j = i + 1; j < bodies.length; j += 1) {
            const a = bodies[i];
            const b = bodies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy) || 0.001;
            const min = a.r + b.r + 2;
            if (distance >= min) continue;
            const overlap = (min - distance) / 2;
            const nx = dx / distance;
            const ny = dy / distance;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
        }
        bodies.forEach(clamp);
      }

      apply();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      bodies.forEach(clamp);
      apply();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [makes, maxWeight, hasUserStats]);

  if (!makes.length) {
    return (
      <div className="grid h-[320px] place-items-center rounded-2xl border bg-secondary/20 text-sm text-muted-foreground">
        {t("onboarding.loadingMakes")}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition",
            selected.length === 0
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:bg-secondary",
          )}
        >
          {selected.length === 0
            ? t("onboarding.allMakes")
            : t("onboarding.resetMakes")}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {t("onboarding.multiHint")}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-[330px] w-full overflow-hidden rounded-2xl border bg-secondary/10"
      >
        {makes.map((make, index) => {
          const isSelected = selected.includes(make.value);
          const label = displayLabel(make.value);
          const subtitle = hasUserStats && make.users ? make.users : null;
          return (
            <button
              key={make.value}
              ref={(element) => {
                buttonsRef.current[index] = element;
              }}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${make.value}${
                subtitle
                  ? `, ${t("onboarding.chosenBy").replace("{count}", String(subtitle))}`
                  : ""
              }`}
              title={
                hasUserStats
                  ? `${make.value}: ${t("onboarding.chosenBy").replace(
                      "{count}",
                      String(make.users ?? 0),
                    )}`
                  : `${make.value}: ${t("onboarding.listingsFor").replace(
                      "{count}",
                      String(make.count),
                    )}`
              }
              onClick={() => onToggle(make.value)}
              className={cn(
                "absolute left-0 top-0 touch-manipulation select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected && "z-10",
              )}
              style={{
                width: bodiesRef.current[index]?.r
                  ? bodiesRef.current[index].r * 2
                  : 78,
                height: bodiesRef.current[index]?.r
                  ? bodiesRef.current[index].r * 2
                  : 78,
              }}
            >
              <span
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center rounded-full border px-1.5 text-center leading-tight transition-[transform,background-color,color,box-shadow] duration-300",
                  isSelected
                    ? "scale-110 border-primary bg-primary text-primary-foreground shadow-lg"
                    : "border-border/80 bg-card text-foreground hover:bg-secondary",
                )}
              >
                <span
                  data-bubble-label
                  className="max-w-full whitespace-nowrap"
                  style={{ fontSize: "var(--bubble-font, 11px)" }}
                >
                  {label}
                </span>
                {subtitle ? (
                  <span className="mt-0.5 text-[9px] opacity-60">{subtitle}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
