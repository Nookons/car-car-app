"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  MagnifyingGlass,
  SlidersHorizontal,
  Sparkle,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

/**
 * Главный экран десктопа: тёмная фотография машины на закате, слева —
 * заголовок, поиск и два действия. Секция занимает всю высоту вьюпорта
 * под шапкой, без внешней рамки.
 */
export function DesktopHero() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/list?q=${encodeURIComponent(term)}` : "/list");
  };

  return (
    <section
      aria-labelledby="hero-title"
      className="relative left-1/2 hidden w-screen -translate-x-1/2 overflow-hidden min-[1152px]:block"
      style={{
        height: "calc(100dvh - 3.8125rem)",
        minHeight: 620,
        background: "var(--hero-surface)",
        color: "var(--hero-ink)",
      }}
    >
      <div className="absolute inset-y-0 right-0 w-[54%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/car-hero.webp"
          alt=""
          aria-hidden="true"
          width={1600}
          height={1067}
          fetchPriority="high"
          className="h-full w-full object-cover object-left"
          style={{ filter: "var(--hero-photo-filter)" }}
        />
        <div className="absolute inset-0" style={{ background: "var(--hero-photo-grade)" }} />
      </div>

      {/* Затемнение под текстом: держит белый текст читаемым на фото. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{ background: "var(--hero-fade)" }}
      />

      {/* Текстовая колонка. */}
      <div
        className="absolute inset-0 z-30 flex items-center"
        style={{
          paddingLeft: "max(16px, calc((100vw - 1152px) / 2 + 16px))",
          paddingRight: 24,
        }}
      >
        <div className="w-full max-w-[600px]">
          <p className="hero-badge inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium">
            <Sparkle size={14} weight="fill" style={{ color: "var(--hero-orange)" }} />
            CarCar · {t("hero.badge")}
          </p>

          <h1
            id="hero-title"
            className="mt-4 text-[clamp(32px,3.05vw,44px)] font-black leading-[0.97] tracking-[-0.04em]"
          >
            {t("hero.title1")}
            <br />
            <span style={{ color: "var(--hero-orange)" }}>{t("hero.title2")}</span>
            <br />
            <span style={{ color: "var(--hero-orange)" }}>{t("hero.title3")}</span>
          </h1>

          <p className="mt-4 max-w-[500px] text-[14.5px] leading-[1.55]" style={{ color: "var(--hero-muted)" }}>
            {t("hero.subtitle")}
          </p>

          <form onSubmit={submit} className="mt-6 max-w-[500px]">
            <div className="relative">
              <MagnifyingGlass
                size={19}
                weight="bold"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--hero-muted)" }}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("list.searchPlaceholder")}
                aria-label={t("list.search")}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
                className="hero-input h-[52px] w-full rounded-2xl border pl-12 pr-4 text-[15px] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)]"
              />
            </div>

            <div className="mt-2.5 grid grid-cols-[0.86fr_1.14fr] gap-2.5">
              <button
                type="submit"
                className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold text-white shadow-[0_16px_32px_-18px_rgba(240,74,28,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)] active:scale-[0.99]"
                style={{ background: "var(--hero-primary-bg)" }}
              >
                {t("hero.search")}
                <ArrowRight
                  size={17}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
              <Link
                href="/onboarding"
                className="hero-secondary inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border px-4 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)] active:scale-[0.99]"
              >
                <SlidersHorizontal size={17} weight="bold" style={{ color: "var(--hero-orange)" }} />
                {t("onboarding.start")}
              </Link>
            </div>
          </form>

          <p className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--hero-hint)" }}>
            <CheckCircle size={14} weight="fill" className="text-[#69b87a]" />
            {t("hero.hint")}
          </p>
        </div>
      </div>

      {/* Ценники поверх фотографии: координаты подобраны под кадр. */}
      <PriceCard
        kind="seller"
        label={t("hero.sellerPrice")}
        value="29 900 zł"
        style={{ left: "56%", top: "26%", width: "19%" }}
      />
      <Pointer left="63%" top="39%" height="11%" />
      <Marker left="63%" top="50%" />

      <PriceCard
        kind="market"
        label={t("hero.marketPrice")}
        value="43 319 zł"
        style={{ left: "77%", top: "14%", width: "19%" }}
      />
      <Pointer left="84%" top="27%" height="9%" />
      <Marker left="84%" top="36%" />

      <p
        className="hero-example absolute bottom-[5%] left-[56%] z-10 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-sm"
        style={{ fontSize: "max(10px, 0.75vw)" }}
      >
        {t("hero.example")}
      </p>
    </section>
  );
}

function PriceCard({
  kind,
  label,
  value,
  style,
}: {
  kind: "seller" | "market";
  label: string;
  value: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      data-hero-card
      className={`absolute z-[12] flex flex-col justify-center rounded-[14px] border ${kind === "seller" ? "hero-seller-card" : "hero-market-card"}`}
      style={{
        ...style,
        height: "15.4%",
        padding: "1.2vw 1.5vw",
        boxShadow: "var(--hero-card-shadow)",
      }}
    >
      <span
        style={{
          fontSize: "clamp(12px, 0.9vw, 16px)",
          lineHeight: 1.15,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: kind === "seller" ? "var(--hero-seller-label)" : "var(--hero-market-label)",
        }}
      >
        {label}
      </span>
      <span
        className="whitespace-nowrap font-extrabold"
        style={{
          marginTop: 4,
          fontSize: "clamp(24px, 2.3vw, 38px)",
          lineHeight: 1,
          letterSpacing: "-0.035em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Pointer({ left, top, height }: { left: string; top: string; height: string }) {
  return (
    <span
      aria-hidden="true"
      data-hero-pointer
      className="absolute z-[8] w-[2px] rounded-full"
      style={{ left, top, height, background: "var(--hero-line)" }}
    />
  );
}

function Marker({ left, top }: { left: string; top: string }) {
  return (
    <span
      aria-hidden="true"
      data-hero-marker
      className="absolute z-[9] grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      style={{ left, top, background: "var(--hero-marker-bg)" }}
    >
      <span className="block h-[6px] w-[6px] rounded-full" style={{ background: "var(--hero-marker-center)" }} />
    </span>
  );
}
