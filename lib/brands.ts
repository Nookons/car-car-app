/** Логотипы марок лежат у нас в /public/brands (скачаны из открытого датасета). */
const ALIASES: Record<string, string> = {
  "citroën": "citroen",
  citroen: "citroen",
  "ds automobiles": "ds",
  "ssangyong/kgm": "ssangyong",
  ssangyong: "ssangyong",
  "mercedes-benz": "mercedes-benz",
  mercedes: "mercedes-benz",
  "land rover": "land-rover",
  "alfa romeo": "alfa-romeo",
  "aston martin": "aston-martin",
  "rolls-royce": "rolls-royce",
  "range rover": "land-rover",
  mini: "mini",
  "vw": "volkswagen",
};

export function brandSlug(make: string): string {
  const key = make.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return key
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function brandLogoUrl(make: string): string {
  return `/brands/${brandSlug(make)}.png`;
}
