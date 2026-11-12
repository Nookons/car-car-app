/* Дашборд сборщика: опрос /api/status раз в 3 секунды, пауза — POST /api/control. */

const I18N = {
  ru: {
    title: "сборщик",
    userAnalytics: "Активность пользователей",
    userAnalyticsHint: "Сводка активности приложения.",
    loadAnalytics: "Обновить",
    logout: "Выйти",
    polls: "Опросов",
    newListings: "Новых объявлений",
    details: "Карточек в папке",
    inDb: "Объявлений в базе",
    errors: "Ошибок",
    perSession: "за сессию",
    chart: "Новые объявления по опросам",
    control: "Управление",
    reason: "Причина паузы",
    pauseHint:
      "Сборщик проверяет паузу перед каждым опросом — на площадку запросы перестают идти в пределах одного интервала.",
    recentListings: "Последние объявления",
    today: "Сегодня",
    week: "За 7 дней",
    month: "За 30 дней",
    sources: "Платформ",
    newShort: "новых",
    inWork: "сбор идёт",
    dailyChart: "Новые объявления по дням",
    monthlyChart: "По месяцам",
    platforms: "Платформы",
    collectors: "Коллекторы",
    status: "Статус",
    lastPoll: "Последний опрос",
    errorsShort: "Ошибок",
    actions: "Действия",
    pauseBtn: "Пауза",
    resumeBtn: "Продолжить",
    source: "Площадка",
    active: "Активных",
    total: "Всего",
    median: "Медиана",
    allSources: "Все площадки",
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
    userAnalytics: "User activity",
    userAnalyticsHint: "Application activity summary.",
    loadAnalytics: "Refresh",
    logout: "Log out",
    polls: "Polls",
    newListings: "New listings",
    details: "Cached details",
    inDb: "Listings in DB",
    errors: "Errors",
    perSession: "this session",
    chart: "New listings per poll",
    control: "Control",
    reason: "Pause reason",
    pauseHint:
      "The collector checks the pause flag before every poll — requests stop within one interval.",
    recentListings: "Latest listings",
    today: "Today",
    week: "Last 7 days",
    month: "Last 30 days",
    sources: "Platforms",
    newShort: "new",
    inWork: "collecting",
    dailyChart: "New listings per day",
    monthlyChart: "Per month",
    platforms: "Platforms",
    collectors: "Collectors",
    status: "Status",
    lastPoll: "Last poll",
    errorsShort: "Errors",
    actions: "Actions",
    pauseBtn: "Pause",
    resumeBtn: "Resume",
    source: "Platform",
    active: "Active",
    total: "Total",
    median: "Median",
    allSources: "All platforms",
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
let lastMetrics = null;
let dashboardStarted = false;
let dashboardIntervals = [];
let userSearchTimer = null;
let userAnalyticsRequest = 0;
let userDetailRequest = 0;

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
  const collectorTotals = (status.collectors || []).reduce((sum, collector) => {
    const stats = collector.stats || {};
    sum.polls += Number(collector.round || 0);
    sum.new_ids += Number(stats.new_ids || 0);
    sum.errors += Number(stats.errors || 0);
    return sum;
  }, { polls: 0, new_ids: 0, errors: 0 });
  const totals = { ...collectorTotals, ...(hb.totals || {}) };
  const storage = status.storage || {};
  const client = hb.client || {};

  $("kpi-polls").textContent = fmtInt(totals.polls);
  $("kpi-new").textContent = fmtInt(totals.new_ids);
  const isDb = storage.mode === "db";
  $("kpi-details").textContent = fmtInt(
    isDb ? storage.listings : storage.detail_files,
  );
  const sweep = status.sweep || {};
  const sweepText =
    sweep.total_pages && sweep.next_page
      ? ` · ${lang === "ru" ? "обход" : "sweep"} ${Math.min(sweep.next_page - 1, sweep.total_pages)}/${sweep.total_pages}`
      : "";
  $("kpi-details-size").textContent = (isDb ? storage.size : fmtMb(storage.detail_bytes)) + sweepText;
  const detailsLabel = document.querySelector('[data-i18n="details"]');
  if (detailsLabel) detailsLabel.textContent = isDb ? t("inDb") : t("details");
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
        <td>${fmtTime(poll.ts || poll.at)}</td>
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
      <td class="num">${fmtInt(run.new ?? run.new_ids)}</td>
      <td class="num">${fmtInt(run.details_saved ?? run.items)}</td>`;
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
    const source = $("source").value;
    if (source) params.set("source", source);
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

const SOURCE_COLORS = {
  otomoto: "#2563eb",
  olx: "#16a34a",
  allegro: "#f59e0b",
  autoscout24: "#8b5cf6",
  autotrader: "#0ea5e9",
};
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9"];

function sourceColor(source, index) {
  return SOURCE_COLORS[source] || PALETTE[index % PALETTE.length];
}

function buildSeries(rows, key) {
  const labels = [...new Set(rows.map((r) => r[key]))].sort();
  const sources = [...new Set(rows.map((r) => r.source))].sort();
  const index = new Map(rows.map((r) => [`${r[key]}|${r.source}`, r.count]));
  const series = sources
    .map((src, i) => ({
      source: src,
      color: sourceColor(src, i),
      values: labels.map((label) => index.get(`${label}|${src}`) || 0),
    }))
    .filter((s) => s.values.some((value) => value > 0));
  return { labels, series };
}

function drawStack(canvas, labels, series, labelFmt) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = 150;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = 8;
  const count = Math.max(labels.length, 1);
  const totals = labels.map((_, i) =>
    series.reduce((sum, item) => sum + (item.values[i] || 0), 0),
  );
  const max = Math.max(1, ...totals);
  const gap = count > 20 ? 2 : 4;
  const barWidth = Math.max(2, (width - pad * 2 - gap * (count - 1)) / count);

  ctx.strokeStyle = "#eef0f3";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = pad + ((height - pad * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  labels.forEach((label, i) => {
    let y = height - pad;
    series.forEach((item) => {
      const value = item.values[i] || 0;
      if (!value) return;
      const barHeight = ((height - pad * 2) * value) / max;
      const x = pad + i * (barWidth + gap);
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - barHeight, barWidth, barHeight);
      y -= barHeight;
    });
  });

  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(max), width - pad, 12);

  const step = Math.ceil(count / 6);
  labels.forEach((label, i) => {
    if (i % step !== 0 && i !== count - 1) return;
    const x = pad + i * (barWidth + gap) + barWidth / 2;
    ctx.textAlign = i === 0 ? "left" : i === count - 1 ? "right" : "center";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(labelFmt(label), x, height - 2);
  });
  ctx.textAlign = "left";
}

function renderLegend(element, series) {
  if (!element) return;
  element.innerHTML = "";
  series.forEach((item) => {
    const chip = document.createElement("span");
    chip.innerHTML = `<i style="background:${item.color}"></i>${esc(item.source)}`;
    element.appendChild(chip);
  });
}

function renderMetrics() {
  const data = lastMetrics;
  const charts = document.querySelector(".charts");
  if (!data || !data.available) {
    if (charts) charts.hidden = true;
    return;
  }
  if (charts) charts.hidden = false;

  $("kpi-today").textContent = fmtInt(data.totals.today);
  $("kpi-week").textContent = fmtInt(data.totals.week);
  $("kpi-month").textContent = fmtInt(data.totals.month);
  $("kpi-sources").textContent = fmtInt(data.totals.sources);

  const daily = buildSeries(data.daily, "day");
  drawStack($("chart-daily"), daily.labels, daily.series, (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`);
  renderLegend($("legend-daily"), daily.series);
  $("daily-range").textContent = `${daily.labels.length} ${lang === "ru" ? "дней" : "days"}`;

  const monthly = buildSeries(data.monthly, "month");
  drawStack($("chart-monthly"), monthly.labels, monthly.series, (m) => m.slice(2).replace("-", "/"));
  renderLegend($("legend-monthly"), monthly.series);
  $("monthly-range").textContent = `${monthly.labels.length} ${lang === "ru" ? "мес." : "mo"}`;

  const tbody = $("platforms");
  tbody.innerHTML = "";
  data.by_source.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(row.source)}</td>
      <td class="num">${fmtInt(row.active)}</td>
      <td class="num">${fmtInt(row.today)}</td>
      <td class="num">${fmtInt(row.week)}</td>
      <td class="num">${fmtInt(row.month)}</td>
      <td class="num">${fmtInt(row.total)}</td>
      <td class="num">${row.median_price ? fmtPrice(row.median_price) : "—"}</td>`;
    tbody.appendChild(tr);
  });

  const select = $("source");
  const current = select.value;
  select.innerHTML = `<option value="">${t("allSources")}</option>`;
  data.by_source.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.source;
    option.textContent = row.source;
    select.appendChild(option);
  });
  select.value = current;
}

async function loadMetrics() {
  try {
    const response = await fetch("/api/metrics?days=30&months=12", { cache: "no-store" });
    if (!response.ok) return;
    lastMetrics = await response.json();
    renderMetrics();
  } catch {
    /* графики не критичны для статуса */
  }
}

function addAnalyticsCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value == null || value === "" ? "—" : String(value);
  row.appendChild(cell);
}

function fillAnalyticsTable(id, rows, renderRow, emptyColumns) {
  const body = $(id);
  body.replaceChildren();
  if (!rows?.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = emptyColumns;
    td.className = "muted";
    td.textContent = lang === "ru" ? "Пока нет данных" : "No data yet";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    renderRow(tr, item);
    body.appendChild(tr);
  });
}

function renderFunnel(funnel) {
  const box = $("ua-funnel");
  if (!box || !funnel?.stages) return;
  const labels = lang === "ru"
    ? { visit: "Визиты", search: "Поиски", saved_search: "Сохранённые", alert_open: "Алерты" }
    : { visit: "Visits", search: "Searches", saved_search: "Saved searches", alert_open: "Alerts" };
  box.innerHTML = funnel.stages.map((stage) => {
    const conv = stage.conversion == null ? "" : ` · ${Math.round(stage.conversion * 100)}%`;
    return `<article class="card kpi"><span class="label">${labels[stage.kind] ?? stage.kind}</span><strong>${fmtInt(stage.visitors)}</strong><span class="tiny muted">${fmtInt(stage.events)} ${lang === "ru" ? "событий" : "events"}${conv}</span></article>`;
  }).join("");
}

function renderUserAnalytics(data, funnel) {
  const filter = $("ua-user-search").value.trim();
  $("ua-users-title").textContent = filter
    ? `Найдено пользователей: ${fmtInt(data.total_users)}`
    : `Пользователи · 30 дней (${fmtInt(data.total_users)})`;
  $("ua-registered").textContent = fmtInt(data.totals.registered_users);
  $("ua-dau").textContent = fmtInt(data.totals.dau);
  $("ua-wau").textContent = fmtInt(data.totals.wau);
  $("ua-mau").textContent = fmtInt(data.totals.mau);
  fillAnalyticsTable("ua-daily", data.daily, (tr, day) => {
    addAnalyticsCell(tr, day.day);
    addAnalyticsCell(tr, fmtInt(day.active_users));
    addAnalyticsCell(tr, fmtInt(day.sessions));
    addAnalyticsCell(tr, fmtInt(day.searches));
    addAnalyticsCell(tr, fmtInt(day.listing_views));
  }, 5);
  fillAnalyticsTable("ua-listings", data.top_listings, (tr, item) => {
    addAnalyticsCell(tr, item.title);
    addAnalyticsCell(tr, fmtInt(item.views), "num");
  }, 2);
  fillAnalyticsTable("ua-users", data.users, (tr, user) => {
    const label = user.username
      ? `@${user.username}`
      : [user.first_name, user.last_name].filter(Boolean).join(" ") || `ID ${user.id}`;
    addAnalyticsCell(tr, label);
    const lastSeen = user.last_seen_at
      ? new Date(user.last_seen_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")
      : "—";
    addAnalyticsCell(tr, lastSeen);
    addAnalyticsCell(tr, fmtInt(user.sessions));
    addAnalyticsCell(tr, fmtInt(user.searches));
    addAnalyticsCell(tr, fmtInt(user.listing_views));
    addAnalyticsCell(tr, fmtInt(user.favorites_added));
    addAnalyticsCell(tr, fmtInt(user.subscriptions_created));
    const cell = document.createElement("td");
    const link = document.createElement("a");
    link.href = `#user=${encodeURIComponent(user.id)}`;
    link.className = "user-detail-link";
    link.textContent = "Статистика";
    cell.appendChild(link);
    tr.appendChild(cell);
  }, 8);
  if (funnel) renderFunnel(funnel);
  $("user-analytics-results").classList.remove("hidden");
  $("user-analytics-error").classList.add("hidden");
  $("user-analytics-status").textContent = lang === "ru" ? "Обновлено сейчас" : "Updated now";
}

async function loadUserAnalytics() {
  const requestId = ++userAnalyticsRequest;
  const button = $("refresh-user-analytics");
  const error = $("user-analytics-error");
  button.disabled = true;
  error.classList.add("hidden");
  $("user-analytics-status").textContent = lang === "ru" ? "Загрузка…" : "Loading…";
  try {
    const params = new URLSearchParams({ days: "30", limit: "100" });
    const query = $("ua-user-search").value.trim();
    if (query) params.set("query", query);
    const [response, funnelResponse] = await Promise.all([
      fetch(`/api/user-metrics?${params}`, { cache: "no-store" }),
      fetch("/api/funnel-metrics?days=30", { cache: "no-store" }),
    ]);
    const data = await response.json().catch(() => ({}));
    const funnel = funnelResponse.ok ? await funnelResponse.json().catch(() => null) : null;
    if (requestId !== userAnalyticsRequest) return;
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    renderUserAnalytics(data, funnel);
  } catch (exc) {
    if (requestId !== userAnalyticsRequest) return;
    $("user-analytics-results").classList.add("hidden");
    error.textContent = exc instanceof Error ? exc.message : "Не удалось загрузить метрики";
    error.classList.remove("hidden");
    $("user-analytics-status").textContent = "";
    if (error.textContent.includes("401")) showDashboardLogin();
  } finally {
    if (requestId === userAnalyticsRequest) button.disabled = false;
  }
}

$("refresh-user-analytics").addEventListener("click", loadUserAnalytics);

$("ua-user-search").addEventListener("input", () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(loadUserAnalytics, 350);
});

async function loadUserDetail(userId) {
  const requestId = ++userDetailRequest;
  const dialog = $("ua-user-dialog");
  const error = $("ua-user-error");
  const content = $("ua-user-content");
  if (!dialog.open) dialog.showModal();
  error.classList.add("hidden");
  content.classList.add("hidden");
  $("ua-user-meta").textContent = "Загрузка…";
  $("ua-user-title").textContent = `Пользователь #${userId}`;
  try {
    const response = await fetch(`/api/user-metrics/${encodeURIComponent(userId)}?days=30&search_limit=100`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    if (requestId !== userDetailRequest) return;
    const user = data.user;
    const label = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(" ") || `ID ${user.id}`;
    $("ua-user-title").textContent = label;
    const lastSeen = user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("ru-RU") : "—";
    $("ua-user-meta").textContent = `ID ${user.id} · регистрация ${fmtDateTime(user.created_at)} · последний визит ${lastSeen}`;
    const totals = data.totals || {};
    $("ua-user-sessions").textContent = fmtInt(totals.sessions);
    $("ua-user-searches").textContent = fmtInt(totals.searches);
    $("ua-user-views").textContent = fmtInt(totals.listing_views);
    $("ua-user-favorites").textContent = fmtInt(totals.favorites_added);
    $("ua-user-subscriptions").textContent = fmtInt(totals.subscriptions_created);
    $("ua-user-days").textContent = fmtInt(totals.active_days);
    fillAnalyticsTable("ua-user-searches-list", data.searches, (tr, item) => {
      addAnalyticsCell(tr, new Date(item.at).toLocaleString("ru-RU"));
      addAnalyticsCell(tr, item.query || "—");
      const filters = Object.entries(item.filters || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
      addAnalyticsCell(tr, filters || "—");
      addAnalyticsCell(tr, item.sort || "new");
    }, 4);
    fillAnalyticsTable("ua-user-daily", data.daily, (tr, day) => {
      addAnalyticsCell(tr, day.day);
      addAnalyticsCell(tr, fmtInt(day.sessions));
      addAnalyticsCell(tr, fmtInt(day.searches));
      addAnalyticsCell(tr, fmtInt(day.listing_views));
      addAnalyticsCell(tr, fmtInt(day.favorites_added));
      addAnalyticsCell(tr, fmtInt(day.subscriptions_created));
    }, 6);
    content.classList.remove("hidden");
    $("ua-user-meta").classList.remove("muted");
  } catch (cause) {
    if (requestId !== userDetailRequest) return;
    $("ua-user-meta").textContent = "";
    error.textContent = cause instanceof Error ? cause.message : "Не удалось загрузить статистику";
    error.classList.remove("hidden");
  }
}

function showUserFromHash() {
  const match = location.hash.match(/^#user=(\d+)$/);
  if (match && dashboardStarted) void loadUserDetail(match[1]);
  else if ($("ua-user-dialog").open) $("ua-user-dialog").close();
}

window.addEventListener("hashchange", showUserFromHash);
$("ua-user-close").addEventListener("click", () => $("ua-user-dialog").close());
$("ua-user-dialog").addEventListener("close", () => {
  if (location.hash.startsWith("#user=")) location.hash = "#user-analytics";
});

function renderCollectors(status) {
  const tbody = $("collectors");
  if (!tbody) return;
  const rows = status.collectors || [];
  const notices = new Map((status.service_notices || []).map((notice) => [notice.source, notice]));
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">${t("noData")}</td></tr>`;
    return;
  }
  rows.forEach((row) => {
    const stats = row.stats || {};
    const notice = notices.get(row.source);
    const inWindow = notice && new Date(notice.starts_at) <= new Date() && new Date(notice.ends_at) > new Date();
    const paused = Boolean(row.paused || inWindow);
    const state = paused ? "paused" : (row.status || "never");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(row.source)}</td>
      <td><span class="pill" data-state="${state}"><span class="dot"></span>${t("states")[state] || state}</span></td>
      <td>${fmtTime(row.last_poll_at)}</td>
      <td class="num">${fmtInt(stats.new_ids)}</td>
      <td class="num">${fmtInt(stats.errors)}</td>
      <td class="service-state">${notice ? `<span class="service-mode ${notice.mode}">${notice.mode === "maintenance" ? "Ремонт" : "Пауза"}</span><small>${fmtDateTime(notice.starts_at)} — ${fmtDateTime(notice.ends_at)}</small><small>${esc(notice.reason)}</small>` : `<span class="muted">Без ограничений</span>`}</td>
      <td><button class="ghost service-configure" type="button">Настроить</button></td>`;
    const cell = tr.lastElementChild;
    cell.querySelector(".service-configure").addEventListener("click", () => openServiceDialog(row.source, notice));
    tbody.appendChild(tr);
  });
}

async function loadLogs() {
  const body = $("service-logs");
  if (!body) return;
  try {
    const response = await fetch("/api/logs?limit=100", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const { items = [] } = await response.json();
    body.replaceChildren();
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "muted";
      cell.textContent = "Ошибок и событий пока нет";
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      for (const item of items) {
        const row = document.createElement("tr");
        for (const value of [fmtDateTime(item.at), item.source, item.level, item.message, item.details]) {
          const cell = document.createElement("td");
          cell.textContent = value == null ? "—" : String(value);
          row.appendChild(cell);
        }
        body.appendChild(row);
      }
    }
    $("logs-updated").textContent = `Обновлено ${fmtTime(new Date().toISOString())}`;
  } catch (error) {
    $("logs-updated").textContent = `Ошибка загрузки: ${error instanceof Error ? error.message : "API"}`;
  }
}

$("refresh-logs").addEventListener("click", loadLogs);

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function localInputDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openServiceDialog(source, notice) {
  const dialog = $("service-dialog");
  $("service-source").value = source;
  $("service-dialog-title").textContent = source;
  $("service-mode").value = notice?.mode || "paused";
  $("service-reason").value = notice?.reason || "";
  const now = new Date();
  now.setSeconds(0, 0);
  $("service-start").value = notice ? localInputDate(new Date(notice.starts_at)) : localInputDate(now);
  const end = notice ? new Date(notice.ends_at) : new Date(now.getTime() + 4 * 60 * 60 * 1000);
  $("service-end").value = localInputDate(end);
  $("service-clear").classList.toggle("hidden", !notice);
  $("service-error").classList.add("hidden");
  dialog.showModal();
}

$("service-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("service-save");
  const error = $("service-error");
  button.disabled = true;
  error.classList.add("hidden");
  try {
    const source = $("service-source").value;
    const response = await fetch(`/api/service-notices/${encodeURIComponent(source)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: $("service-mode").value,
        reason: $("service-reason").value.trim(),
        starts_at: new Date($("service-start").value).toISOString(),
        ends_at: new Date($("service-end").value).toISOString(),
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.detail || `HTTP ${response.status}`);
    }
    $("service-dialog").close();
    await load();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : "Не удалось сохранить";
    error.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});

async function clearServiceNotice() {
  const source = $("service-source").value;
  const button = $("service-clear");
  button.disabled = true;
  try {
    const response = await fetch(`/api/service-notices/${encodeURIComponent(source)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    $("service-dialog").close();
    await load();
  } catch (error) {
    $("service-error").textContent = error instanceof Error ? error.message : "Не удалось удалить";
    $("service-error").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

$("service-clear").addEventListener("click", clearServiceNotice);
$("service-close").addEventListener("click", () => $("service-dialog").close());
$("service-cancel").addEventListener("click", () => $("service-dialog").close());

function render(status) {
  current = status;
  renderState(status);
  renderKpi(status);
  renderChart(status.polls || []);
  renderPolls(status.polls || []);
  renderRuns(status.runs || []);
  renderControl(status);
  renderCollectors(status);
  loadListings();
}

async function load() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    render(await response.json());
  } catch (error) {
    if (error.message === "401") {
      showDashboardLogin();
      return;
    }
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

$("source").addEventListener("change", () => loadListings());
$("lang").addEventListener("click", () => {
  lang = lang === "ru" ? "en" : "ru";
  localStorage.setItem("carcar.lang", lang);
  applyLang();
  if (current) render(current);
  renderMetrics();
});

function showDashboardLogin(message = "") {
  dashboardIntervals.forEach(clearInterval);
  dashboardIntervals = [];
  dashboardStarted = false;
  $("dashboard-login").classList.remove("hidden");
  $("dashboard-header").classList.add("hidden");
  $("dashboard-main").classList.add("hidden");
  $("dashboard-footer").classList.add("hidden");
  $("dashboard-password").value = "";
  $("dashboard-login-error").textContent = message;
  $("dashboard-login-error").classList.toggle("hidden", !message);
}

function showDashboard() {
  $("dashboard-login").classList.add("hidden");
  $("dashboard-header").classList.remove("hidden");
  $("dashboard-main").classList.remove("hidden");
  $("dashboard-footer").classList.remove("hidden");
  if (dashboardStarted) return;
  dashboardStarted = true;
  load();
  loadMetrics();
  loadUserAnalytics();
  showUserFromHash();
  loadLogs();
  dashboardIntervals = [setInterval(load, 3000), setInterval(loadMetrics, 30000), setInterval(loadLogs, 15000)];
}

async function checkDashboardSession() {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const session = await response.json();
    if (response.ok && session.authenticated) showDashboard();
    else showDashboardLogin();
  } catch {
    showDashboardLogin(lang === "ru" ? "Не удалось проверить вход" : "Could not check session");
  }
}

$("dashboard-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("dashboard-login-button");
  const error = $("dashboard-login-error");
  button.disabled = true;
  error.classList.add("hidden");
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("dashboard-password").value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "HTTP " + response.status);
    $("dashboard-password").value = "";
    showDashboard();
  } catch (exc) {
    error.textContent = exc instanceof Error ? exc.message : "Ошибка входа";
    error.classList.remove("hidden");
    $("dashboard-password").focus();
  } finally {
    button.disabled = false;
  }
});

$("dashboard-logout").addEventListener("click", async () => {
  try {
    await fetch("/api/session/logout", { method: "POST" });
  } finally {
    showDashboardLogin();
  }
});

applyLang();
checkDashboardSession();
