"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const links = [
  { href: "/", key: "nav.home" },
  { href: "/feed", key: "nav.feed" },
  { href: "/list", key: "nav.list" },
  { href: "/account", key: "nav.account" },
] as const;

export function DesktopNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map(({ href, key }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
