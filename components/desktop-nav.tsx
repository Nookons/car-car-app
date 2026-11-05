"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Главная" },
  { href: "/list", label: "Объявления" },
  { href: "/account", label: "Аккаунт" },
];

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
