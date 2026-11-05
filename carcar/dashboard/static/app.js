/* Дашборд сборщика: опрос /api/status раз в 3 секунды, пауза — POST /api/control. */

const I18N = {
  ru: {
    title: "сборщик",
    polls: "Опросов",
    newListings: "Новых объявлений",
    details: "Карточек в папке",
    errors: "Ошибок",
    perSession: "за сессию",
    chart: "Новые объявления по опросам",
    control: "Управление",
    reason: "Причина паузы",
    pauseHint:
      "Сборщик проверяет паузу перед каждым опросом — на площадку запросы перестают идти в пределах одного интервала.",
    recentListings: "Последние объявления",
    noListings: "Пока нет объявлений — запустите сборщик",
    nearMe: "Рядом со мной",
    showAll: "Показать все",
    locating: "Определяю…",
    geoDenied: "Не удалось получить геолокацию — разрешите доступ в браузере",
    radiusAll: "Вся Польша",
    km: "км",
    recentPolls: "Последние опросы",
    runs: "Прогоны",
    time: "Время",
    new: "Новых",
    sec: "Секунд",
    kb: "КБ",
    mode: "Режим",
    detailsShort: "Карточек",
    footer:
      "Данные — локально, папка data. Дашборд только для владельца, слушает 127.0.0.1.",
    pause: "Поставить на паузу",
    resume: "Продолжить",
    states: {
      running: "Работает",
      paused: "Пауза",
      stale: "Нет связи",
      never: "Не запускался",
      idle: "Остановлен",
      error: "Ошибка",
    },
    lastPoll: "последний опрос",
    nextPoll: "следующий через",
    ago: "назад",
    pausedAt: "пауза с",
    pausedReason: "причина",
    noData: "Пока нет опросов — запустите: python -m carcar watch --minutes 120",
    staleHint:
      "Сборщик не отвечает {sec} с. Проверьте, запущен ли процесс watch, и посмотрите его лог.",
    neverHint:
      "Сборщик ещё не запускался. Запустите: python -m carcar watch --minutes 120",
    errorHint: "Последний опрос завершился ошибкой: {err}",
    noRuns: "Прогонов пока нет",
  },
  en: {
    title: "collector",
    polls: "Polls",
    newListings: "New listings",
    details: "Cached details",
    errors: "Errors",
    perSession: "this session",
    chart: "New listings per poll",
    control: "Control",
    reason: "Pause reason",
    pauseHint:
      "The collector checks the pause flag before every poll — requests stop within one interval.",
    recentListings: "Latest listings",
    noListings: "No listings yet — start the collector",
    nearMe: "Near me",
    showAll: "Show all",
    locating: "Locating…",
    geoDenied: "Could not get your location — allow access in the browser",
    radiusAll: "All Poland",
    km: "km",
    recentPolls: "Recent polls",
    runs: "Runs",
    time: "Time",
    new: "New",
    sec: "Seconds",
    kb: "KB",
    mode: "Mode",
    detailsShort: "Details",
    footer: "Data is local, in the data folder. Owner-only dashboard on 127.0.0.1.",
    pause: "Pause",
    resume: "Resume",
    states: {
      running: "Running",
      paused: "Paused",
      stale: "No signal",
      never: "Never started",
      idle: "Stopped",
      error: "Error",
    },
    lastPoll: "last poll",
    nextPoll: "next in",
    ago: "ago",
    pausedAt: "paused at",
    pausedReason: "reason",
    noData: "No polls yet — run: python -m carcar watch --minutes 120",
    staleHint: "Collector silent for {sec}s. Check the watch process and its log.",
    neverHint: "Collector has not started yet. Run: python -m carcar watch --minutes 120",
    errorHint: "Last poll failed: {err}",
    noRuns: "No runs yet",
  },
};

let lang = localStorage.getItem("carcar.lang") || "ru";
let current = null;
let busy = false;
let geo = readGeo();

// Ссылку «рядом со мной» можно открыть с координатами: /?lat=52.23&lon=21.01&radius=50
(() => {
  const params = new URLSearchParams(location.search);
  const lat = parseFloat(params.get("lat"));
  const lon = parseFloat(params.get("lon"));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    saveGeo({ lat, lon });
  }
})();

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[lang][key] ?? key;

function readGeo() {
  try {
    return JSON.parse(localStorage.getItem("carcar.geo") || "null");
  } catch {
    return null;
  }
}

function saveGeo(value) {
  geo = value;
  if (value) localStorage.setItem("carcar.geo", JSON.stringify(value));
  else localStorage.removeItem("carcar.geo");
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", { hour12: false });
}

function fmtAgo(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} ${lang === "ru" ? "с" : "s"}`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} ${lang === "ru" ? "мин" : "min"}`;
  return `${Math.floor(m / 60)} ${lang === "ru" ? "ч" : "h"}`;
}

function fmtInt(value) {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB").format(value ?? 0);
}

function fmtMb(bytes) {
  const mb = (bytes || 0) / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round((bytes || 0) / 1024)} KB`;
}

function fillRadius() {
  const select = $("radius");
  const currentValue = select.value || "100";
  select.innerHTML = "";
  [25, 50, 100, 200].forEach((km) => {
    const option = document.createElement("option");
    option.value = String(km);
    option.textContent = `${km} ${t("km")}`;
    select.appendChild(option);
  });
  const all = document.createElement("option");
  all.value = "0";
  all.textContent = t("radiusAll");
  select.appendChild(all);
  const fromUrl = new URLSearchParams(location.search).get("radius");
  select.value = fromUrl || currentValue;
}

function updateGeoButton() {
  $("near").textContent = geo ? t("showAll") : t("nearMe");
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $("lang").textContent = lang === "ru" ? "EN" : "RU";
  document.title = `CarCar · ${t("title")}`;
  fillRadius();
  updateGeoButton();
}

function renderState(status) {
  const state = status.state;
  const pill = $("state-pill");
  pill.dataset.state = state;
  $("state-text").textContent = t("states")[state] || state;

  const hb = status.heartbeat || {};
  const parts = [];
  if (hb.last_poll_at) {
    parts.push(`${t("lastPoll")} ${fmtTime(hb.last_poll_at)}`);
  }
  if (hb.last_poll_at && state === "running") {
    const interval = (hb.interval || 15) * 1000;
    const seconds = (new Date(hb.last_poll_at).getTime() + interval - Date.now()) / 1000;
    if (seconds > 0) {
      parts.push(`${t("nextPoll")} ${Math.round(seconds)} ${lang === "ru" ? "с" : "s"}`);
    }
  }
  if (status.control?.paused) {
    parts.push(`${t("pausedAt")} ${fmtTime(status.control.updated_at)}`);
    if (status.control.reason) parts.push(`${t("pausedReason")}: ${status.control.reason}`);
  }
  $("subtitle").textContent = ["otomoto.pl · Польша", ...parts].join(" · ");

  const banner = $("banner");
  banner.className = "banner hidden";
  if (state === "stale") {
    banner.textContent = t("staleHint").replace("{sec}", Math.round(status.age_seconds || 0));
    banner.classList.remove("hidden");
  } else if (state === "never") {
    banner.textContent = t("neverHint");
    banner.classList.remove("hidden");
  } else if (state === "error") {
    banner.textContent = t("errorHint").replace("{err}", hb.last_error || "?");
    banner.classList.add("bad");
    banner.classList.remove("hidden");
  }
}

function renderKpi(status) {
  const hb = status.heartbeat || {};
  const totals = hb.totals || {};
  const storage = status.storage || {};
  const client = hb.client || {};

  $("kpi-polls").textContent = fmtInt(totals.polls);
  $("kpi-new").textContent = fmtInt(totals.new_ids);
  $("kpi-details").textContent = fmtInt(storage.detail_files);
  $("kpi-details-size").textContent = fmtMb(storage.detail_bytes);
  $("kpi-errors").textContent = fmtInt(totals.errors);
  $("kpi-errors").closest(".kpi").classList.toggle("negative", (totals.errors || 0) > 0);
  $("kpi-traffic").textContent = client.wire_bytes
    ? `${lang === "ru" ? "сеть" : "network"}: ${fmtMb(client.wire_bytes)}`
    : "—";
}

function renderChart(polls) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = 140;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const data = polls.slice(-40);
  const hint = $("chart-hint");
  if (!data.length) {
    hint.textContent = t("noData");
    return;
  }
  hint.textContent = lang === "ru" ? `журнал: ${data.length}` : `history: ${data.length}`;

  const max = Math.max(1, ...data.map((p) => p.new || 0));
  const pad = 6;
  const gap = 3;
  const barWidth = Math.min(
    26,
    Math.max(2, (width - pad * 2 - gap * (data.length - 1)) / data.length),
  );

  // Сетка: три горизонтальные линии по шкале «новых».
  ctx.strokeStyle = "#eef0f3";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = pad + ((height - pad * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  data.forEach((poll, index) => {
    const value = poll.new || 0;
    const barHeight = Math.round(((height - pad * 2) * value) / max);
    const x = pad + index * (barWidth + gap);
    const y = height - pad - barHeight;
    ctx.fillStyle = value > 0 ? "#2563eb" : "#dbe3ef";
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), 2);
    ctx.fill();
  });

  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(max), width - pad, 12);
  ctx.textAlign = "left";
}

function renderPolls(polls) {
  const body = $("polls");
  body.innerHTML = "";
  if (!polls.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted">${t("noData")}</td></tr>`;
    return;
  }
  polls
    .slice()
    .reverse()
    .slice(0, 10)
    .forEach((poll) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${fmtTime(poll.at)}</td>
        <td class="num">${fmtInt(poll.new)}</td>
        <td class="num">${(poll.seconds ?? 0).toFixed(1)}</td>
        <td class="num">${Math.round((poll.wire_bytes || 0) / 1024)}</td>`;
      body.appendChild(row);
    });
}

function renderRuns(runs) {
  const body = $("runs");
  body.innerHTML = "";
  if (!runs.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted">${t("noRuns")}</td></tr>`;
    return;
  }
  runs.forEach((run) => {
    // Старые сводки писались до появления поля mode — угадываем по содержимому.
    const mode = run.mode || (run.rounds ? "watch" : run.details_saved ? "collect" : "discover");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${mode}</td>
      <td>${fmtTime(run.started_at)}</td>
      <td class="num">${fmtInt(run.new_ids)}</td>
      <td class="num">${fmtInt(run.details_saved)}</td>`;
    body.appendChild(row);
  });
}

function renderControl(status) {
  const paused = Boolean(status.control?.paused);
  const button = $("toggle");
  button.textContent = paused ? t("resume") : t("pause");
  button.classList.toggle("resume", paused);
  button.disabled = busy;

  $("reason").disabled = paused;

  const note = $("control-note");
  if (paused) {
    const at = fmtTime(status.control.updated_at);
    note.textContent = `${t("pausedAt")} ${at}${status.control.reason ? ` · ${status.control.reason}` : ""}`;
  } else {
    const interval = (status.heartbeat || {}).interval || 15;
    note.textContent =
      lang === "ru"
        ? `Сбор идёт. Проверка паузы — каждые ${interval} с.`
        : `Collecting. Pause check every ${interval}s.`;
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function fmtPrice(value, currency = "PLN") {
  if (!value) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function renderListings(items) {
  const box = $("listings");
  box.innerHTML = "";
  if (!items.length) {
    box.innerHTML = `<p class="muted small">${t("noListings")}</p>`;
    return;
  }
  items.forEach((item) => {
    const meta = [
      item.year,
      item.mileage_km ? `${fmtInt(item.mileage_km)} km` : null,
      item.distance_km != null
        ? item.distance_km < 1
          ? `≈ <1 ${t("km")}`
          : `≈ ${fmtInt(Math.round(item.distance_km))} ${t("km")}`
        : item.city,
    ]
      .filter(Boolean)
      .join(" · ");
    const link = document.createElement("a");
    link.className = "listing-card";
    link.href = `/listing/${encodeURIComponent(item.id)}`;
    link.innerHTML = `
      <div class="thumb">${
        item.thumbnail ? `<img loading="lazy" src="${esc(item.thumbnail)}" alt="" referrerpolicy="no-referrer">` : ""
      }</div>
      <div class="lc-body">
        <div class="lc-title">${esc(item.title || "—")}</div>
        <div class="lc-price">${fmtPrice(item.price, item.currency)}</div>
        <div class="lc-meta">${esc(meta)}</div>
      </div>`;
    box.appendChild(link);
  });
}

async function loadListings() {
  try {
    const params = new URLSearchParams({ limit: "8" });
    if (geo) {
      params.set("lat", geo.lat);
      params.set("lon", geo.lon);
      const radius = $("radius").value;
      if (radius !== "0") params.set("radius_km", radius);
    }
    const response = await fetch(`/api/listings?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    renderListings(data.items || []);
  } catch {
    /* карточки не критичны для статуса */
  }
}

function render(status) {
  current = status;
  renderState(status);
  renderKpi(status);
  renderChart(status.polls || []);
  renderPolls(status.polls || []);
  renderRuns(status.runs || []);
  renderControl(status);
  loadListings();
}

async function load() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    render(await response.json());
  } catch (error) {
    const pill = $("state-pill");
    pill.dataset.state = "stale";
    $("state-text").textContent = t("states").stale;
    const banner = $("banner");
    banner.className = "banner bad";
    banner.textContent = `Дашборд недоступен: ${error.message}`;
  }
}

async function toggle() {
  if (busy) return;
  busy = true;
  $("toggle").disabled = true;
  const paused = !current?.control?.paused;
  try {
    await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paused,
        reason: paused ? $("reason").value.trim() || null : null,
        by: "dashboard",
      }),
    });
    await load();
  } finally {
    busy = false;
    $("toggle").disabled = false;
  }
}

$("toggle").addEventListener("click", toggle);

$("near").addEventListener("click", () => {
  if (geo) {
    saveGeo(null);
    updateGeoButton();
    loadListings();
    return;
  }
  if (!navigator.geolocation) {
    alert(t("geoDenied"));
    return;
  }
  const button = $("near");
  button.textContent = t("locating");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      saveGeo({ lat: position.coords.latitude, lon: position.coords.longitude });
      updateGeoButton();
      loadListings();
    },
    () => {
      button.textContent = t("nearMe");
      alert(t("geoDenied"));
    },
    { timeout: 8000, maximumAge: 600000 },
  );
});

$("radius").addEventListener("change", () => {
  if (geo) loadListings();
});
$("lang").addEventListener("click", () => {
  lang = lang === "ru" ? "en" : "ru";
  localStorage.setItem("carcar.lang", lang);
  applyLang();
  if (current) render(current);
});

applyLang();
load();
setInterval(load, 3000);
