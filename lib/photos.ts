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

/**
 * Адаптивный srcSet без оптимизатора Vercel.
 *
 * CDN площадки сам умеет отдавать нужный размер через `;s=ШxВ`, поэтому
 * браузеру достаточно предложить 2–3 варианта: он выберет под экран и DPR.
 * Так мы не тратим квоту `/_next/image` и не делаем лишний хоп через Vercel.
 * Неизвестные хосты возвращают пустую строку — там остаётся обычный `src`.
 */
export function photoSrcSet(src: string, widths: number[] = [320, 640, 960]): string {
  if (!src) return "";
  try {
    const url = new URL(src);
    if (!RESIZABLE_HOST.test(url.hostname)) return "";
  } catch {
    return "";
  }
  return widths
    .map((width) => `${photoSize(src, width, Math.round(width * 0.75))} ${width}w`)
    .join(", ");
}
