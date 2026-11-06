"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsOut, ChatCircle, Eye, Heart, PaperPlaneTilt } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { CommentsSheet } from "@/components/comments-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { labelFor, useI18n } from "@/lib/i18n";

type FeedItem = {
  id: number;
  title: string;
  price: number | null;
  currency: string;
  year: number | null;
  mileage_km: number | null;
  city: string;
  make: string;
  model: string;
  thumbnail: string;
  fuel: string | null;
  gearbox: string | null;
  published_at: string | null;
  views: number;
  likes: number;
  comments: number;
  reposts: number;
};

export default function FeedPage() {
  const { token, ready, guest } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = React.useState<"for_you" | "popular">("for_you");
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [liked, setLiked] = React.useState<Set<number>>(new Set());
  const [commentsFor, setCommentsFor] = React.useState<number | null>(null);
  const [counts, setCounts] = React.useState<Record<number, { likes: number; comments: number; reposts: number; views: number }>>({});
  const viewed = React.useRef<Set<number>>(new Set());
  const seq = React.useRef(0);

  const load = React.useCallback(
    async (next: "for_you" | "popular", offset = 0) => {
      const id = ++seq.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await api<{ items: FeedItem[] }>(
          `/feed?mode=${next}&limit=10&offset=${offset}`,
          token ? { token } : {},
        );
        if (id !== seq.current) return;
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
        setCounts((prev) => {
          const next = { ...prev };
          for (const item of data.items) {
            next[item.id] = next[item.id] ?? {
              likes: item.likes,
              comments: item.comments,
              reposts: item.reposts,
              views: item.views,
            };
          }
          return next;
        });
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [token],
  );

  React.useEffect(() => {
    if (!ready) return;
    void load(mode, 0);
  }, [ready, mode, load]);

  React.useEffect(() => {
    if (!token) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = Number((entry.target as HTMLElement).dataset.listing);
          if (!id || viewed.current.has(id)) continue;
          viewed.current.add(id);
          void api<{ views: number }>(`/listings/${id}/view`, { method: "POST", token })
            .then((res) =>
              setCounts((prev) => ({
                ...prev,
                [id]: { ...(prev[id] ?? { likes: 0, comments: 0, reposts: 0, views: 0 }), views: res.views },
              })),
            )
            .catch(() => {});
        }
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll("[data-listing]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, token]);

  const toggleLike = async (item: FeedItem, on?: boolean) => {
    if (!token) {
      if (guest) router.push("/account");
      return;
    }
    const next = on ?? !liked.has(item.id);
    setLiked((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(item.id);
      else copy.delete(item.id);
      return copy;
    });
    setCounts((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] ?? { likes: item.likes, comments: item.comments, reposts: item.reposts, views: item.views }),
        likes: Math.max(0, (prev[item.id]?.likes ?? item.likes) + (next ? 1 : -1)),
      },
    }));
    try {
      await api(`/listings/${item.id}/like`, { method: "POST", token, body: { on: next } });
    } catch {
      setLiked((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(item.id);
        else copy.add(item.id);
        return copy;
      });
    }
  };

  const share = async (item: FeedItem) => {
    if (!token) {
      if (guest) router.push("/account");
      return;
    }
    void api(`/listings/${item.id}/repost`, { method: "POST", token })
      .then(() =>
        setCounts((prev) => ({
          ...prev,
          [item.id]: {
            ...(prev[item.id] ?? { likes: item.likes, comments: item.comments, reposts: item.reposts, views: item.views }),
            reposts: (prev[item.id]?.reposts ?? item.reposts) + 1,
          },
        })),
      )
      .catch(() => {});
    const url = `${window.location.origin}/listing/${item.id}`;
    const text = `${item.title} — ${num(item.price ?? 0)} ${item.currency}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text, url });
        return;
      } catch {
        /* отменили */
      }
    }
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-2xl bg-secondary p-1">
        {(["for_you", "popular"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
              mode === value ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t(value === "for_you" ? "feed.forYou" : "feed.popular")}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-[60dvh] w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("feed.empty")}</p>
      ) : mode === "popular" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/listing/${item.id}`}
              className="min-w-0 overflow-hidden rounded-2xl border bg-card"
            >
              <div className="relative aspect-[4/3] bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                  <Eye size={12} /> {num(counts[item.id]?.views ?? item.views)}
                </span>
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                <p className="text-sm font-semibold">
                  {num(item.price ?? 0)} {item.currency}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {[item.year, item.mileage_km ? `${num(item.mileage_km)} km` : null, item.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="h-[calc(100dvh-12.5rem)] snap-y snap-mandatory overflow-y-auto rounded-2xl">
          {items.map((item) => {
            const isLiked = liked.has(item.id);
            return (
              <article
                key={item.id}
                data-listing={item.id}
                className="relative h-full w-full snap-start overflow-hidden rounded-2xl bg-black"
                onDoubleClick={() => void toggleLike(item, true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

                <div className="absolute left-3 top-3 flex gap-2 text-[11px] text-white/90">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1">
                    <Eye size={12} /> {num(counts[item.id]?.views ?? item.views)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1">
                    <Heart size={12} /> {num(counts[item.id]?.likes ?? item.likes)}
                  </span>
                </div>

                <div className="absolute bottom-5 left-3 right-16 space-y-1 pb-2 text-white">
                  <p className="text-lg font-semibold">
                    {num(item.price ?? 0)} {item.currency}
                  </p>
                  <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-white/80">
                    {[
                      item.year,
                      item.mileage_km ? `${num(item.mileage_km)} km` : null,
                      item.fuel ? labelFor(t, "fuel", item.fuel) : null,
                      item.gearbox ? labelFor(t, "gearbox", item.gearbox) : null,
                      item.city,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <Link
                    href={`/listing/${item.id}`}
                    className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black"
                  >
                    <ArrowsOut size={16} />
                    {t("feed.open")}
                  </Link>
                </div>

                <div className="absolute bottom-5 right-2 flex flex-col items-center gap-3 text-white">
                  <button
                    onClick={() => void toggleLike(item)}
                    className="flex flex-col items-center gap-0.5 text-[10px]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
                      <Heart
                        size={22}
                        weight={isLiked ? "fill" : "regular"}
                        className={isLiked ? "text-rose-500" : ""}
                      />
                    </span>
                    {num(counts[item.id]?.likes ?? item.likes)}
                  </button>
                  <button
                    onClick={() => setCommentsFor(item.id)}
                    className="flex flex-col items-center gap-0.5 text-[10px]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
                      <ChatCircle size={22} />
                    </span>
                    {num(counts[item.id]?.comments ?? item.comments)}
                  </button>
                  <button
                    onClick={() => void share(item)}
                    className="flex flex-col items-center gap-0.5 text-[10px]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
                      <PaperPlaneTilt size={21} />
                    </span>
                    {num(counts[item.id]?.reposts ?? item.reposts)}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {mode === "popular" ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={loadingMore}
          onClick={() => load(mode, items.length)}
        >
          {loadingMore ? t("list.loading") : t("list.more")}
        </Button>
      ) : null}

      <CommentsSheet
        listingId={commentsFor}
        open={commentsFor !== null}
        onClose={() => setCommentsFor(null)}
        onCreated={() => {
          if (commentsFor === null) return;
          setCounts((prev) => ({
            ...prev,
            [commentsFor]: {
              ...(prev[commentsFor] ?? { likes: 0, comments: 0, reposts: 0, views: 0 }),
              comments: (prev[commentsFor]?.comments ?? 0) + 1,
            },
          }));
        }}
      />
    </div>
  );
}
