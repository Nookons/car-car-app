"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { DesktopNav } from "@/components/desktop-nav";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const isListing = pathname.startsWith("/listing/");

  return (
    <header
      className={cn(
        "app-header sticky top-0 z-30 border-b bg-background/95 backdrop-blur",
        isListing && "max-md:hidden",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
            CC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">CarCar</p>
            <p className="text-[11px] text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </div>
        <DesktopNav />
      </div>
    </header>
  );
}
