"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MagnifyingGlass, Play, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const tabs = [
  { href: "/", key: "nav.home", icon: House },
  { href: "/feed", key: "nav.feed", icon: Play },
  { href: "/list", key: "nav.list", icon: MagnifyingGlass },
  { href: "/account", key: "nav.account", icon: UserCircle },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isListing = pathname.startsWith("/listing/");
  const isShare = pathname.startsWith("/share/");

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom md:hidden",
        (isListing || isShare) && "hidden",
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon size={22} weight={active ? "fill" : "regular"} />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
