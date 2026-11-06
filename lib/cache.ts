type Entry<T> = { value: T; time: number };

const memory = new Map<string, Entry<unknown>>();

/** Память + sessionStorage: переживает переходы и перезагрузку вкладки. */
export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && Date.now() - mem.time < ttlMs) return mem.value;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`carcar.cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (Date.now() - entry.time > ttlMs) return null;
    memory.set(key, entry);
    return entry.value;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  const entry = { value, time: Date.now() };
  memory.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`carcar.cache:${key}`, JSON.stringify(entry));
  } catch {
    // переполнение sessionStorage — держим только память
  }
}

export function cacheDelete(key: string): void {
  memory.delete(key);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`carcar.cache:${key}`);
  } catch {
    /* пусто */
  }
}

export function sessionGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(`carcar.session:${key}`) ?? "null") as T | null;
  } catch {
    return null;
  }
}

export function sessionSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`carcar.session:${key}`, JSON.stringify(value));
  } catch {
    /* пусто */
  }
}
