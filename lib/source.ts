const SOURCE_NAMES: Record<string, string> = {
  otomoto: "Otomoto",
  olx: "OLX",
  allegro: "Allegro",
  autoscout24: "AutoScout24",
  "mobile.de": "mobile.de",
  drom: "Drom",
  cars: "Cars",
};

/** «otomoto» → «Otomoto», «olx» → «OLX». Неизвестный источник — с заглавной. */
export function sourceName(value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) return "";
  const known = SOURCE_NAMES[source.toLowerCase()];
  if (known) return known;
  return source[0].toUpperCase() + source.slice(1);
}
