"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { useI18n, type Key } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; key: Key }[] = [
  { value: "system", key: "theme.system" },
  { value: "light", key: "theme.light" },
  { value: "dark", key: "theme.dark" },
];

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{t("account.theme")}</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-input p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "h-9 rounded-lg text-xs font-medium transition",
              theme === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(option.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
