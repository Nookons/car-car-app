"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MagnifyingGlass, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Главная", icon: House },
  { href: "/list", label: "Объявления", icon: MagnifyingGlass },
  { href: "/account", label: "Аккаунт", icon: UserCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {tabs.map(({ href, label, icon: Icon }) => {
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
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
