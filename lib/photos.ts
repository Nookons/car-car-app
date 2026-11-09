/**
 * Размер фотографии на CDN площадки.
 *
 * otomoto/OLX отдают варианты через `;s=ШxВ` прямо в пути: исходник 1000×750
 * весит ~135 КБ, а 160×120 — ~6 КБ. Для миниатюр и лент берём маленький
 * вариант, для лайтбокса остаётся оригинал. Чужие CDN не трогаем: без
 * известного формата параметра запрос может сломать картинку.
 */
const RESIZABLE_HOST = /(^|\.)olxcdn\.com$/i;

export function photoSize(src: string, width: number, height: number): string {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (!RESIZABLE_HOST.test(url.hostname)) return src;
    const path = url.pathname.replace(/;s=\d+x\d+$/, "");
    url.pathname = `${path};s=${width}x${height}`;
    return url.toString();
  } catch {
    return src;
  }
}
