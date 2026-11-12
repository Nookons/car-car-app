import type { Key } from "@/lib/i18n";

export const SHORTLIST_STATUSES = [
  "shortlist",
  "contacted",
  "viewed",
  "rejected",
  "bought",
] as const;

export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

export function shortlistKey(status: string | null | undefined): Key {
  const value = SHORTLIST_STATUSES.includes(status as ShortlistStatus)
    ? (status as ShortlistStatus)
    : "shortlist";
  return `shortlist.status.${value}` as Key;
}
