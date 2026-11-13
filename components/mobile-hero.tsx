"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

/**
 * Мобильная версия главного экрана: тот же тёмный закат и два ценника,
 * но вертикально — текст, поиск, две кнопки и фото машины под ними.
 */
export function MobileHero() {
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
      aria-labelledby="mobile-hero-title"
      className="mobile-hero relative left-1/2 flex w-screen -translate-x-1/2 flex-col overflow-hidden min-[1152px]:hidden"
      style={{ background: "var(--hero-surface)", color: "var(--hero-ink)" }}
    >
      <div className="px-5 pt-8">
        <h1
          id="mobile-hero-title"
          className="text-[clamp(26px,7.2vw,34px)] font-black leading-[0.98] tracking-[-0.04em]"
        >
          {t("hero.title1")}
          <br />
          <span style={{ color: "var(--hero-orange)" }}>{t("hero.title2")}</span>
          <br />
          <span style={{ color: "var(--hero-orange)" }}>{t("hero.title3")}</span>
        </h1>

        <p className="mt-3 max-w-[520px] text-[13.5px] leading-[1.5]" style={{ color: "var(--hero-muted)" }}>
          {t("hero.subtitle")}
        </p>

        <form onSubmit={submit} className="mt-5">
          <div className="relative">
            <MagnifyingGlass
              size={18}
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
              className="hero-input h-[50px] w-full rounded-2xl border pl-11 pr-4 text-[14px] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)]"
            />
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-[0.9fr_1.1fr]">
            <button
              type="submit"
              className="group inline-flex h-[50px] items-center justify-center gap-1.5 rounded-2xl px-3 text-[14px] font-semibold text-white shadow-[0_16px_32px_-18px_rgba(240,74,28,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)] active:scale-[0.99]"
              style={{ background: "var(--hero-primary-bg)" }}
            >
              {t("hero.search")}
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <Link
              href="/onboarding"
              className="hero-secondary inline-flex h-[50px] items-center justify-center gap-1.5 rounded-2xl border px-3 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hero-orange)] active:scale-[0.99]"
            >
              <SlidersHorizontal size={16} weight="bold" style={{ color: "var(--hero-orange)" }} />
              {t("onboarding.start")}
            </Link>
          </div>
        </form>

        <p className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--hero-hint)" }}>
          <CheckCircle size={14} weight="fill" className="text-[#69b87a]" />
          {t("hero.hint")}
        </p>
      </div>

      <div className="relative mt-5 min-h-[250px] flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/car-hero.webp"
          alt=""
          aria-hidden="true"
          width={1600}
          height={1067}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-left"
          style={{ filter: "var(--hero-photo-filter)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--hero-mobile-photo-overlay)" }}
        />

        <MobilePriceCard
          kind="seller"
          label={t("hero.sellerPrice")}
          value="29 900 zł"
          style={{ left: "3%", top: "6%", width: "45%" }}
        />
        <MobilePointer left={25} top={24} height={22} />
        <MobileMarker left={25} top={46} />

        <MobilePriceCard
          kind="market"
          label={t("hero.marketPrice")}
          value="43 319 zł"
          style={{ right: "3%", top: "6%", width: "45%" }}
        />
        <MobilePointer left={74} top={24} height={18} />
        <MobileMarker left={74} top={42} />

        <p className="hero-example absolute bottom-[4%] left-[4%] z-10 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm">
          {t("hero.example")}
        </p>
      </div>
    </section>
  );
}

function MobilePriceCard({
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
      className={`absolute z-[12] flex h-[78px] flex-col justify-center rounded-xl border px-3 py-2 ${kind === "seller" ? "hero-seller-card" : "hero-market-card"}`}
      style={{ ...style, boxShadow: "var(--hero-card-shadow)" }}
    >
      <span
        className="text-[10px] font-medium leading-tight tracking-[-0.01em]"
        style={{ color: kind === "seller" ? "var(--hero-seller-label)" : "var(--hero-market-label)" }}
      >
        {label}
      </span>
      <span className="mt-1 whitespace-nowrap text-[21px] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </span>
    </div>
  );
}

function MobilePointer({ left, top, height }: { left: number; top: number; height: number }) {
  return (
    <span
      aria-hidden="true"
      data-hero-pointer
      className="absolute z-[8] w-[2px] rounded-full"
      style={{ left: `${left}%`, top: `${top}%`, height: `${height}%`, background: "var(--hero-line)" }}
    />
  );
}

function MobileMarker({ left, top }: { left: number; top: number }) {
  return (
    <span
      aria-hidden="true"
      data-hero-marker
      className="absolute z-[9] grid h-[17px] w-[17px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      style={{ left: `${left}%`, top: `${top}%`, background: "var(--hero-marker-bg)" }}
    >
      <span className="block h-[6px] w-[6px] rounded-full" style={{ background: "var(--hero-marker-center)" }} />
    </span>
  );
}
