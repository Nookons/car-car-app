"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function LegalFooter() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-28 pt-6 text-xs text-muted-foreground md:pb-8">
      <Link href="/privacy" className="underline-offset-4 hover:underline">
        {t("legal.privacy")}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="underline-offset-4 hover:underline">
        {t("legal.terms")}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/onboarding" className="underline-offset-4 hover:underline">
        {t("onboarding.start")}
      </Link>
    </footer>
  );
}
