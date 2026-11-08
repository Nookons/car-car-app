"use client";

import * as React from "react";

export type Theme = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "carcar.theme";
const LIGHT_COLOR = "#f6f7f9";
const DARK_COLOR = "#0b0f14";

const useIsomorphicLayoutEffect: typeof React.useEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function normalizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

function readTheme(): Theme {
  try {
    return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

function systemIsDark(): boolean {
  try {
    const telegram = (window as unknown as {
      Telegram?: { WebApp?: { colorScheme?: string } };
    }).Telegram?.WebApp;
    if (telegram?.colorScheme === "dark" || telegram?.colorScheme === "light") {
      return telegram.colorScheme === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  const color = resolved === "dark" ? DARK_COLOR : LIGHT_COLOR;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));

  // В Telegram шапка рисуется самим клиентом; подгоняем её под тему.
  try {
    const telegram = (window as unknown as {
      Telegram?: { WebApp?: { setHeaderColor?: (color: string) => void } };
    }).Telegram?.WebApp;
    telegram?.setHeaderColor?.(color);
  } catch {
    // Старые версии Telegram могут не поддерживать метод.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [systemDark, setSystemDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const resolved: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useIsomorphicLayoutEffect(() => {
    setThemeState(readTheme());
    setSystemDark(systemIsDark());
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (mounted) applyTheme(resolved);
  }, [mounted, resolved]);

  React.useEffect(() => {
    if (!mounted) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(systemIsDark());
    media.addEventListener?.("change", sync);

    const telegram = (window as unknown as {
      Telegram?: {
        WebApp?: {
          onEvent?: (event: string, handler: () => void) => void;
          offEvent?: (event: string, handler: () => void) => void;
        };
      };
    }).Telegram?.WebApp;
    telegram?.onEvent?.("themeChanged", sync);
    return () => {
      media.removeEventListener?.("change", sync);
      telegram?.offEvent?.("themeChanged", sync);
    };
  }, [mounted]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Приватный режим — тема останется только на текущую сессию.
    }
    applyTheme(next === "system" ? (systemIsDark() ? "dark" : "light") : next);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
