import { driveLabel, gearboxLabel } from "./format";
import type { Key } from "./i18n";

/** Короткие подписи для карточки и таблицы характеристик: «автомат», «задний». */
export function gearboxShort(t: (key: Key) => string, value: string | null | undefined) {
  if (value === "automatic") return t("card.gearbox.automatic");
  if (value === "manual") return t("card.gearbox.manual");
  if (value === "semi_auto") return t("card.gearbox.semi_auto");
  if (value === "other") return t("card.gearbox.other");
  return gearboxLabel(value ?? null);
}

export function driveShort(t: (key: Key) => string, value: string | null | undefined) {
  if (value === "front") return t("card.drive.front");
  if (value === "rear") return t("card.drive.rear");
  if (value === "awd") return t("card.drive.awd");
  return driveLabel(value ?? null);
}
