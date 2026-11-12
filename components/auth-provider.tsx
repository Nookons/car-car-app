"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { getInitData, initTelegram } from "@/lib/telegram";
import { track } from "@/lib/track";
import type { Listing, User } from "@/lib/types";

export type AuthMode = "telegram" | "web" | "guest";

type LoginResult = { user: User };
type RegisterInput = { email: string; password: string; name?: string };

type AuthState = {
  /** JWT только для Telegram; в веб-режиме вход живёт в httpOnly-cookie. */
  token: string | null;
  user: User | null;
  ready: boolean;
  authed: boolean;
  guest: boolean;
  mode: AuthMode;
  error: string | null;
  favorites: Set<number>;
  toggleFavorite: (id: number) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
  login: (login: string, password: string) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<{ verification_sent: boolean }>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);
  const [mode, setMode] = React.useState<AuthMode>("guest");
  const [error, setError] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<Set<number>>(new Set());

  const loadFavorites = React.useCallback(async (bearer: string | null) => {
    const res = await api<{ items: Listing[] }>(
      "/favorites",
      bearer ? { token: bearer } : {},
    );
    setFavorites(new Set(res.items.map((item) => item.id)));
  }, []);

  const applyWebSession = React.useCallback(
    async (data: { user: User }, bearer: string | null) => {
      setUser(data.user);
      setToken(bearer);
      setAuthed(true);
      setMode("web");
      await loadFavorites(bearer).catch(() => setFavorites(new Set()));
    },
    [loadFavorites],
  );

  React.useEffect(() => {
    let cancelled = false;
    initTelegram();

    const initData = getInitData();

    // Telegram: поведение прежнее — initData → JWT в localStorage.
    if (initData) {
      setMode("telegram");
      const stored = typeof window !== "undefined" ? localStorage.getItem("carcar.token") : null;
      if (stored) {
        setToken(stored);
        setAuthed(true);
        setMode("telegram");
        setReady(true);
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
          setAuthed(true);
          setMode("telegram");
          localStorage.setItem("carcar.token", data.token);

          // Любимое догружаем параллельно, не задерживая список.
          loadFavorites(data.token).catch(() => {});
        } catch {
          if (cancelled) return;
          // токен невалиден — работаем как гость, без экрана ошибки
          localStorage.removeItem("carcar.token");
          setToken(null);
          setUser(null);
          setAuthed(false);
          setError(null);
        } finally {
          if (!cancelled) setReady(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    // Обычный браузер: сессия в httpOnly-cookie, без токена в localStorage.
    (async () => {
      try {
        const data = await api<{ user: User; csrf_token: string | null }>("/auth/session");
        if (cancelled) return;
        setUser(data.user);
        setToken(null);
        setAuthed(true);
        setMode("web");
        loadFavorites(null).catch(() => {});
      } catch {
        if (cancelled) return;
        setAuthed(false);
        setMode("guest");
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFavorites]);

  const login = React.useCallback(
    async (loginValue: string, password: string) => {
      const data = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: { login: loginValue, password },
      });
      await applyWebSession(data, null);
      return { user: data.user };
    },
    [applyWebSession],
  );

  const register = React.useCallback(
    async (input: RegisterInput) => {
      const data = await api<{ user: User; verification_sent: boolean }>("/auth/register", {
        method: "POST",
        body: input,
      });
      await applyWebSession(data, null);
      return { verification_sent: data.verification_sent };
    },
    [applyWebSession],
  );

  const logout = React.useCallback(async () => {
    if (mode === "web") {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        // сессия могла уже истечь — локальное состояние всё равно чистим
      }
    }
    if (typeof window !== "undefined") localStorage.removeItem("carcar.token");
    setToken(null);
    setUser(null);
    setAuthed(false);
    setMode("guest");
    setFavorites(new Set());
  }, [mode]);

  const toggleFavorite = React.useCallback(
    async (id: number) => {
      if (!authed) return;
      const isFav = favorites.has(id);
      if (!isFav) track("favorite_add", { listingId: id });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        await api(`/favorites/${id}`, {
          method: isFav ? "DELETE" : "POST",
          token,
        });
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [authed, favorites, token],
  );

  const refreshUser = React.useCallback(async () => {
    if (!authed) return;
    const fresh = await api<User>("/me", token ? { token } : {});
    setUser(fresh);
  }, [authed, token]);

  const refreshSession = React.useCallback(async () => {
    const data = await api<{ user: User; csrf_token: string | null }>("/auth/session");
    setUser(data.user);
    setToken(null);
    setAuthed(true);
    setMode("web");
    await loadFavorites(null).catch(() => setFavorites(new Set()));
  }, [loadFavorites]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        ready,
        authed,
        guest: !authed,
        mode,
        error,
        favorites,
        toggleFavorite,
        refreshUser,
        refreshSession,
        login,
        register,
        logout,
      }}
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
