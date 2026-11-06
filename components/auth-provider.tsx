"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { getInitData, initTelegram } from "@/lib/telegram";
import type { Listing, User } from "@/lib/types";

type AuthState = {
  token: string | null;
  user: User | null;
  ready: boolean;
  guest: boolean;
  error: string | null;
  favorites: Set<number>;
  toggleFavorite: (id: number) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);
  const [guest, setGuest] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    initTelegram();

    // Повторный заход: сразу работаем с сохранённым токеном, вход — в фоне.
    const stored = typeof window !== "undefined" ? localStorage.getItem("carcar.token") : null;
    if (stored) {
      setToken(stored);
      setGuest(false);
      setReady(true);
    }

    const initData = getInitData();
    if (!initData) {
      // Обычный браузер: полноценный просмотр без аккаунта.
      setGuest(true);
      setReady(true);
      return;
    }

    (async () => {
      try {
        const data = await api<{ token: string; user: User }>("/auth", {
          method: "POST",
          body: { init_data: initData },
        });
        if (cancelled) return;
        setToken(data.token);
        setUser(data.user);
        setGuest(false);
        localStorage.setItem("carcar.token", data.token);

        // Любимое догружаем параллельно, не задерживая список.
        api<{ items: Listing[] }>("/favorites", { token: data.token })
          .then((res) => !cancelled && setFavorites(new Set(res.items.map((item) => item.id))))
          .catch(() => {});
      } catch {
        if (cancelled) return;
        // токен невалиден — работаем как гость, без экрана ошибки
        localStorage.removeItem("carcar.token");
        setToken(null);
        setUser(null);
        setGuest(true);
        setError(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = React.useCallback(
    async (id: number) => {
      if (!token) return;
      const isFav = favorites.has(id);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        await api(`/favorites/${id}`, { method: isFav ? "DELETE" : "POST", token });
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [favorites, token],
  );

  const refreshUser = React.useCallback(async () => {
    if (!token) return;
    const fresh = await api<User>("/me", { token });
    setUser(fresh);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ token, user, ready, guest, error, favorites, toggleFavorite, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth вне AuthProvider");
  return ctx;
}
