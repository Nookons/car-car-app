"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellSlash, Trash, Eye } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { loadFilters, saveFilters } from "@/lib/filters";
import { filtersSummary } from "@/lib/format";
import type { Filters, Listing, Subscription, User } from "@/lib/types";

const LANGS: Array<[string, string]> = [
  ["ru", "Русский"],
  ["pl", "Polski"],
  ["uk", "Українська"],
  ["en", "English"],
];

export default function AccountPage() {
  const { token, user, ready, favorites } = useAuth();
  const router = useRouter();
  const [subs, setSubs] = React.useState<Subscription[]>([]);
  const [favItems, setFavItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [nameOpen, setNameOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [subsData, favData] = await Promise.all([
        api<{ items: Subscription[] }>("/subscriptions", { token }),
        api<{ items: Listing[] }>("/favorites", { token }),
      ]);
      setSubs(subsData.items);
      setFavItems(favData.items);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  const patchUser = async (patch: Partial<User>) => {
    if (!token) return;
    await api<User>("/me", { method: "PATCH", token, body: patch });
    await load();
    router.refresh();
  };

  const saveFilter = async () => {
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      const criteria: Filters = loadFilters();
      await api("/subscriptions", {
        method: "POST",
        token,
        body: { name: name.trim(), criteria },
      });
      setName("");
      setNameOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const initials = (user?.first_name?.[0] ?? "?") + (user?.last_name?.[0] ?? "");

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card className="flex items-center gap-3 p-4 lg:col-span-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
          {initials}
        </div>
        <div>
          <p className="font-semibold">
            {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Пользователь"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.username ? `@${user.username}` : `Telegram ID ${user?.tg_id}`}
          </p>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Настройки</h2>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Язык интерфейса</span>
          <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={user?.lang ?? "ru"}
            onChange={(event) => patchUser({ lang: event.target.value })}
          >
            {LANGS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-3 py-1">
          <span className="flex items-center gap-2 text-sm">
            {user?.notify_new ? <Bell size={18} /> : <BellSlash size={18} />}
            Уведомления о новых
          </span>
          <Button
            variant={user?.notify_new ? "default" : "outline"}
            size="sm"
            onClick={() => patchUser({ notify_new: !user?.notify_new })}
          >
            {user?.notify_new ? "Вкл" : "Выкл"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm">Дайджест вместо мгновенных</span>
          <Button
            variant={user?.digest ? "default" : "outline"}
            size="sm"
            onClick={() => patchUser({ digest: !user?.digest })}
          >
            {user?.digest ? "Вкл" : "Выкл"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Мои фильтры</h2>
          <span className="text-xs text-muted-foreground">{subs.length}</span>
        </div>

        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока нет — собери фильтр в «Объявлениях» и сохрани.
          </p>
        ) : (
          <ul className="space-y-3">
            {subs.map((sub) => (
              <li key={sub.id} className="space-y-2 border-b pb-3 last:border-none last:pb-0">
                <div>
                  <p className="text-sm font-medium">{sub.name}</p>
                  <p className="text-xs text-muted-foreground">{filtersSummary(sub.criteria)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      saveFilters(sub.criteria);
                      router.push("/list");
                    }}
                  >
                    <Eye size={16} /> Показать
                  </Button>
                  <Button
                    variant={sub.active ? "default" : "outline"}
                    size="sm"
                    onClick={async () => {
                      await api(`/subscriptions/${sub.id}`, {
                        method: "PATCH",
                        token,
                        body: { active: !sub.active },
                      });
                      await load();
                    }}
                  >
                    {sub.active ? "Вкл" : "Выкл"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await api(`/subscriptions/${sub.id}`, { method: "DELETE", token });
                      await load();
                    }}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" className="w-full" onClick={() => setNameOpen(true)}>
          Сохранить текущий фильтр
        </Button>
      </Card>

      <Card className="space-y-3 p-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Избранное</h2>
          <span className="text-xs text-muted-foreground">{favorites.size}</span>
        </div>
        {favItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пусто — добавляй машины звёздочкой.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favItems.slice(0, 6).map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="Название фильтра"
        footer={
          <Button className="w-full" onClick={saveFilter} disabled={saving || !name.trim()}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        }
      >
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="BMW 320d до 50 000"
          maxLength={120}
        />
      </Dialog>
    </div>
  );
}
