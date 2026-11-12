/* Карточка объявления: галерея, характеристики, описание. */

const I18N = {
  ru: {
    title: "Объявление",
    back: "← К дашборду",
    openSource: "Открыть на otomoto",
    description: "Описание",
    more: "Показать полностью",
    less: "Свернуть",
    footer: "Фото и данные — с otomoto.pl, ссылки ведут на оригинал.",
    loadCard: "Загрузить карточку",
    loading: "Загружаю карточку…",
    loaded: "Карточка сохранена",
    noPhotos: "Нет фотографий",
    photo: "фото",
    photos: "фото",
    seller: "Продавец",
    private: "Частное лицо",
    dealer: "Дилер",
    unknown: "—",
    specs: {
      year: "Год",
      mileage: "Пробег",
      fuel: "Топливо",
      gearbox: "КПП",
      engine: "Объём",
      power: "Мощность",
      body: "Кузов",
      color: "Цвет",
      vin: "VIN",
      origin: "Страна",
      created: "Добавлено",
      city: "Город",
    },
    error404: "Объявление не найдено — возможно, оно ещё не в базе.",
    errorLoad: "Не удалось загрузить данные.",
    previewOnly:
      "Пока видны только данные выдачи. Нажмите «Загрузить карточку», чтобы получить фото, описание и полные характеристики.",
    loadedAt: "Карточка сохранена",
    away: "от вас",
    fuel: {
      petrol: "Бензин", diesel: "Дизель", hybrid: "Гибрид",
      plugin_hybrid: "Гибрид plug-in", electric: "Электро",
      lpg: "Газ (LPG)", cng: "CNG", other: "Другое",
    },
    gearbox: {
      manual: "Механика", automatic: "Автоматическая",
      semi_auto: "Полуавтомат", other: "Другое",
    },
    bodyNames: {
      sedan: "Седан", hatchback: "Хэтчбек", wagon: "Универсал", suv: "Кроссовер",
      coupe: "Купе", convertible: "Кабриолет", minivan: "Минивэн",
      pickup: "Пикап", van: "Фургон",
    },
  },
  en: {
    title: "Listing",
    back: "← Dashboard",
    openSource: "Open on otomoto",
    description: "Description",
    more: "Show more",
    less: "Show less",
    footer: "Photos and data from otomoto.pl; links open the original.",
    loadCard: "Load full card",
    loading: "Loading card…",
    loaded: "Card saved",
    noPhotos: "No photos",
    photo: "photo",
    photos: "photos",
    seller: "Seller",
    private: "Private",
    dealer: "Dealer",
    unknown: "—",
    specs: {
      year: "Year",
      mileage: "Mileage",
      fuel: "Fuel",
      gearbox: "Gearbox",
      engine: "Engine",
      power: "Power",
      body: "Body",
      color: "Colour",
      vin: "VIN",
      origin: "Country",
      created: "Listed",
      city: "City",
    },
    error404: "Listing not found — it may not be in the base yet.",
    errorLoad: "Failed to load data.",
    previewOnly:
      "Only feed data is available. Press “Load full card” to fetch photos, description and all specs.",
    loadedAt: "Card saved",
    away: "away",
    fuel: {
      petrol: "Petrol", diesel: "Diesel", hybrid: "Hybrid",
      plugin_hybrid: "Plug-in hybrid", electric: "Electric",
      lpg: "LPG", cng: "CNG", other: "Other",
    },
    gearbox: {
      manual: "Manual", automatic: "Automatic",
      semi_auto: "Semi-auto", other: "Other",
    },
    bodyNames: {
      sedan: "Sedan", hatchback: "Hatchback", wagon: "Wagon", suv: "SUV",
      coupe: "Coupe", convertible: "Convertible", minivan: "Minivan",
      pickup: "Pickup", van: "Van",
    },
  },
};

let lang = localStorage.getItem("carcar.lang") || "ru";
let card = null;
let descriptionFull = false;

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[lang][key] ?? key;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function fmtInt(value) {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB").format(value ?? 0);
}

function fmtPrice(value, currency = "PLN") {
  if (!value) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currency || "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB");
}

function userGeo() {
  try {
    return JSON.parse(localStorage.getItem("carcar.geo") || "null");
  } catch {
    return null;
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function labelFuel(value) {
  return (value && I18N[lang].fuel[value]) || value || "";
}

function labelGearbox(value) {
  return (value && I18N[lang].gearbox[value]) || value || "";
}

function labelBody(value) {
  return (value && I18N[lang].bodyNames[value]) || value || "";
}

function listingId() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $("lang").textContent = lang === "ru" ? "EN" : "RU";
  document.title = `CarCar · ${t("title")}`;
}

function chips() {
  const parts = [];
  if (card.year) parts.push(card.year);
  if (card.mileage_km) parts.push(`${fmtInt(card.mileage_km)} km`);
  if (card.fuel) parts.push(labelFuel(card.fuel));
  if (card.gearbox) parts.push(labelGearbox(card.gearbox));
  if (card.power_hp) parts.push(`${card.power_hp} KM`);
  if (card.engine_cm3) parts.push(`${fmtInt(card.engine_cm3)} cm³`);
  return parts.map((p) => `<span class="chip">${esc(p)}</span>`).join("");
}

function kvRows() {
  const s = t("specs");
  const rows = [
    [s.year, card.year],
    [s.mileage, card.mileage_km ? `${fmtInt(card.mileage_km)} km` : null],
    [s.fuel, labelFuel(card.fuel)],
    [s.gearbox, labelGearbox(card.gearbox)],
    [s.engine, card.engine_cm3 ? `${fmtInt(card.engine_cm3)} cm³` : null],
    [s.power, card.power_hp ? `${card.power_hp} KM` : null],
    [s.body, labelBody(card.body)],
    [s.color, card.color],
    [s.vin, card.vin],
    [s.origin, card.country_origin],
    [s.city, [card.city, card.region].filter(Boolean).join(", ")],
    [s.created, card.created_at ? fmtDate(card.created_at) : null],
  ].filter(([, value]) => value);
  return rows
    .map(
      ([label, value]) =>
        `<div class="kv-row"><span class="kv-key">${esc(label)}</span><span class="kv-val">${esc(value)}</span></div>`,
    )
    .join("");
}

function renderGallery() {
  const main = $("gallery-main");
  const thumbs = $("thumbs");
  main.innerHTML = "";
  thumbs.innerHTML = "";

  if (!card.photos.length) {
    main.innerHTML = `<div class="no-photo">${t("noPhotos")}</div>`;
    $("photo-count").textContent = "";
    return;
  }

  const show = (url) => {
    main.innerHTML = `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">`;
  };
  show(card.photos[0]);

  card.photos.forEach((url) => {
    const button = document.createElement("button");
    button.className = "thumb";
    button.innerHTML = `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
    button.addEventListener("click", () => show(url));
    thumbs.appendChild(button);
  });

  const word = card.photos.length === 1 ? t("photo") : t("photos");
  $("photo-count").textContent = `${card.photos.length} ${word}`;
}

function renderDescription() {
  const wrap = $("description-card");
  const text = card.description || "";
  wrap.hidden = !text;
  if (!text) return;
  $("description").textContent = text;
  $("description").classList.toggle("clamped", !descriptionFull);
  $("more").hidden = text.length < 400;
  $("more").textContent = descriptionFull ? t("less") : t("more");
}

function render() {
  $("card").hidden = false;
  $("title").textContent = card.title || t("title");
  $("subtitle").textContent = [card.make, card.model].filter(Boolean).join(" ") || "—";
  $("price").textContent = fmtPrice(card.price, card.currency);
  $("listing-title").textContent = card.title || "";
  $("chips").innerHTML = chips();

  const place = [card.city, card.region].filter(Boolean).join(", ");
  const here = userGeo();
  let distance = "";
  if (here && card.lat != null && card.lon != null) {
    const km = Math.round(haversine(here.lat, here.lon, card.lat, card.lon));
    distance = ` · ≈ ${fmtInt(km)} ${t("km")} ${t("away")}`;
  }
  $("location").textContent = (place || "") + distance;

  const kind = card.seller?.type === "PRIVATE" ? t("private") : card.seller?.type ? t("dealer") : "";
  $("seller").textContent = card.seller?.name
    ? `${t("seller")}: ${card.seller.name}${kind ? ` · ${kind}` : ""}`
    : "";

  $("open-source").href = card.url || "#";
  $("kv").innerHTML = kvRows();
  $("admin-title").value = card.title || "";
  $("admin-price").value = card.price || "";
  $("admin-city").value = card.city || "";
  $("admin-mileage").value = card.mileage_km ?? "";
  $("admin-status").value = card.status || "active";

  const fetchButton = $("fetch");
  const hint = $("hint");
  if (!card.has_detail) {
    fetchButton.hidden = false;
    fetchButton.textContent = t("loadCard");
    fetchButton.disabled = false;
    hint.textContent = t("previewOnly");
  } else {
    fetchButton.hidden = true;
    hint.textContent = card.fetched_at ? `${t("loadedAt")}: ${fmtDate(card.fetched_at)}` : "";
  }

  renderGallery();
  renderDescription();
}

$("listing-admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("listing-admin-message");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const response = await fetch(`/api/listings/${listingId()}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: $("admin-title").value, price: Number($("admin-price").value),
        city: $("admin-city").value || null,
        mileage_km: $("admin-mileage").value === "" ? null : Number($("admin-mileage").value),
        status: $("admin-status").value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Не удалось сохранить");
    message.textContent = "Изменения сохранены";
    await load();
  } catch (error) { message.textContent = error.message || "Ошибка"; }
  finally { button.disabled = false; }
});

$("listing-delete").addEventListener("click", async () => {
  if (!window.confirm("Удалить объявление и связанные с ним избранное и статистику навсегда? Это действие нельзя отменить.")) return;
  const button = $("listing-delete"); button.disabled = true;
  try {
    const response = await fetch(`/api/listings/${listingId()}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Не удалось удалить");
    location.assign("/");
  } catch (error) { $("listing-admin-message").textContent = error.message || "Ошибка удаления"; button.disabled = false; }
});

fetch("/api/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
  .then((session) => { $("listing-admin-form").closest("details").hidden = !session?.authenticated; })
  .catch(() => { $("listing-admin-form").closest("details").hidden = true; });

async function load() {
  const id = listingId();
  try {
    const response = await fetch(`/api/listings/${id}`, { cache: "no-store" });
    if (response.status === 404) throw new Error(t("error404"));
    if (!response.ok) throw new Error(t("errorLoad"));
    card = await response.json();
    render();
  } catch (error) {
    const banner = $("banner");
    banner.className = "banner bad";
    banner.textContent = error.message;
  }
}

async function fetchFull() {
  const button = $("fetch");
  button.disabled = true;
  button.textContent = t("loading");
  try {
    const response = await fetch(`/api/listings/${listingId()}/fetch`, { method: "POST" });
    if (!response.ok) throw new Error(t("errorLoad"));
    await load();
  } catch (error) {
    button.disabled = false;
    button.textContent = t("loadCard");
    const banner = $("banner");
    banner.className = "banner bad";
    banner.textContent = error.message;
  }
}

$("fetch").addEventListener("click", fetchFull);
$("more").addEventListener("click", () => {
  descriptionFull = !descriptionFull;
  renderDescription();
});
$("lang").addEventListener("click", () => {
  lang = lang === "ru" ? "en" : "ru";
  localStorage.setItem("carcar.lang", lang);
  applyLang();
  if (card) render();
});

applyLang();
load();
