"use client";

import * as React from "react";
import { ApiError, api } from "@/lib/api";
import { getInitData, initTelegram } from "@/lib/telegram";
import type { Listing, User } from "@/lib/types";

type AuthState = {
  token: string | null;
  user: User | null;
  ready: boolean;
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
  const [error, setError] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    let cancelled = false;

    async function login() {
      initTelegram();
      const initData = getInitData();
      if (!initData) {
        setError("Открой приложение внутри Telegram");
        setReady(true);
        return;
      }
      try {
        const data = await api<{ token: string; user: User }>("/auth", {
          method: "POST",
          body: { init_data: initData },
        });
        if (cancelled) return;
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("carcar.token", data.token);

        const favoritesData = await api<{ items: Listing[] }>("/favorites", {
          token: data.token,
        });
        if (!cancelled) setFavorites(new Set(favoritesData.items.map((item) => item.id)));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Ошибка авторизации");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void login();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = React.useCallback(
    async (id: number) => {
      if (!token) return;
      const isFav = favorites.has(id);
      await api(`/favorites/${id}`, { method: isFav ? "DELETE" : "POST", token });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(id);
        else next.add(id);
        return next;
      });
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
      value={{ token, user, ready, error, favorites, toggleFavorite, refreshUser }}
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
