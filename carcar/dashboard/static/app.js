/* Дашборд сборщика: опрос /api/status раз в 3 секунды, пауза — POST /api/control. */

const I18N = {
  ru: {
    title: "панель управления",
    userAnalytics: "Пользователи",
    userAnalyticsHint: "Активность, поиски, сессии и доступ к аккаунту.",
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
      "Доступ к управлению ограничен паролем администратора.",
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
    title: "operations dashboard",
    userAnalytics: "Users",
    userAnalyticsHint: "Activity, searches, sessions, and account access.",
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
    footer: "Administrative controls are restricted to dashboard password holders.",
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
let geo = readGeo();
let lastMetrics = null;
let dashboardStarted = false;
let dashboardIntervals = [];
let userSearchTimer = null;
let userAnalyticsRequest = 0;
let userDetailRequest = 0;
let activeSupportUserId = null;
let activeSupportTab = "overview";
let notificationsRequest = 0;
let notificationCursors = [null];
let notificationPage = 0;
let nextNotificationCursor = null;
let sessionsRequest = 0;
let userOffset = 0;
const userPageSize = 50;

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
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", { hour12: false });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { hour12: false });
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
}

function renderState(status) {
  const state = status.state;
  const pill = $("state-pill");
  pill.dataset.state = state;
  pill.title = lang === "ru" ? "Состояние сбора по времени последнего опроса" : "Collection status based on the latest poll";
  $("state-text").textContent = state === "stale" ? (lang === "ru" ? "Нет опросов" : "No recent polls") : t("states")[state] || state;

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
  const platforms = (status.collectors || []).map((collector) => collector.source).filter(Boolean).join(" · ");
  $("subtitle").textContent = [platforms || "Сервисы и состояние сбора", ...parts].join(" · ");

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
  const storage = status.storage || {};
  const collectors = status.collectors || [];
  $("kpi-total-listings").textContent = fmtInt(storage.listings);
  $("kpi-active-listings").textContent = fmtInt(storage.active);
  $("kpi-collectors").textContent = fmtInt(collectors.length);
  $("kpi-collector-issues").textContent = fmtInt(collectors.filter((collector) =>
    ["error", "stale"].includes(String(collector.status || "").toLowerCase()),
  ).length);
  const sweep = status.sweep || {};
  const sweepText =
    sweep.total_pages && sweep.next_page
      ? ` · ${lang === "ru" ? "обход" : "sweep"} ${Math.min(sweep.next_page - 1, sweep.total_pages)}/${sweep.total_pages}`
      : "";
  $("kpi-total-hint").textContent = [storage.size || "", sweepText.replace(/^ · /, "")].filter(Boolean).join(" · ") || "в базе";
}

function renderChart(polls) {
  const data = [...polls].filter(p => p.at || p.ts).sort((a,b) => new Date(a.at || a.ts) - new Date(b.at || b.ts)).slice(-40);
  const labels = data.map(p => p.at || p.ts);
  const series = [{source: "Новых объявлений", color:"#2563eb", values:data.map(p => Number(p.new || 0))}];
  $("chart-hint").textContent = data.length ? `Последние ${data.length} опросов` : "Опросов пока нет";
  drawStack($("chart"), labels, series, d => fmtTime(d));
}

function renderPolls(polls) {
  const body = $("polls");
  body.innerHTML = "";
  if (!polls.length) {
    body.innerHTML = `<tr><td colspan="3" class="muted">${t("noData")}</td></tr>`;
    return;
  }
  polls
    .slice()
    .reverse()
    .slice(0, 10)
    .forEach((poll) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${fmtDateTime(poll.ts || poll.at)}</td>
        <td class="num">${fmtInt(poll.new)}</td>
        <td class="num">${fmtInt(poll.errors)}</td>`;
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
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${esc(run.source || "—")}</td>
      <td>${fmtDateTime(run.started_at)}</td>
      <td class="num">${fmtInt(run.new)}</td>
      <td class="num">${fmtInt(run.errors)}</td>`;
    body.appendChild(row);
  });
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

const pendingDashboardReads = new Map();
function dashboardFetch(url, options = {}) {
  if (pendingDashboardReads.has(url)) return pendingDashboardReads.get(url).then(r => r.clone());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const request = fetch(url, {...options, signal:controller.signal}).finally(() => { clearTimeout(timer); pendingDashboardReads.delete(url); });
  pendingDashboardReads.set(url, request);
  return request.then(r => r.clone());
}
let listingRequest = 0;
async function loadListings() {
  const requestId = ++listingRequest;
  try {
    const params = new URLSearchParams({ limit: "50", offset: String(listingOffset) });
    const source = $("listing-source").value;
    if (source) params.set("source", source);
    params.set("status", $("listing-status").value);
    const query = $("listing-query").value.trim();
    if (query) params.set("query", query);
    const response = await dashboardFetch(`/api/manage/listings?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestId === listingRequest) renderManagedListings(data);
  } catch {
    $("listing-page").textContent = "Не удалось загрузить объявления";
  }
}

let listingOffset = 0;
let listingSearchTimer;
function renderManagedListings(data) {
  const body = $("managed-listings");
  body.replaceChildren();
  (data.items || []).forEach((item) => {
    const row = document.createElement("tr");
    const link = document.createElement("a");
    link.href = `/listing/${encodeURIComponent(item.id)}`;
    link.textContent = item.title || `${item.make || ""} ${item.model || ""}`.trim() || `Объявление #${item.id}`;
    const title = document.createElement("td"); title.appendChild(link); row.appendChild(title);
    [item.source, item.status === "active" ? "Активно" : "Неактивно", item.price ? fmtPrice(item.price, item.currency) : "—", item.city || "—", item.last_seen_at ? new Date(item.last_seen_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB") : "—"].forEach((value) => {
      const cell = document.createElement("td"); cell.textContent = String(value); row.appendChild(cell);
    });
    const actions = document.createElement("td");
    actions.className = "listing-row-actions";
    const toggle = document.createElement("button");
    toggle.className = "admin-button admin-button-outline"; toggle.type = "button";
    toggle.textContent = item.status === "active" ? "Деактивировать" : "Восстановить";
    toggle.addEventListener("click", async () => {
      toggle.disabled = true;
      try {
        const response = await fetch(`/api/listings/${item.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "active" ? "removed" : "active" }) });
        if (!response.ok) throw new Error("Не удалось изменить статус");
        await loadListings();
      } catch (error) { toggle.disabled = false; $("listing-page").textContent = error.message || "Не удалось изменить статус"; }
    });
    const remove = document.createElement("button");
    remove.className = "admin-button admin-button-destructive"; remove.type = "button"; remove.textContent = "Удалить";
    remove.addEventListener("click", async () => {
      if (!confirm("Удалить объявление навсегда вместе с избранным и статистикой?")) return;
      remove.disabled = true;
      try {
        const response = await fetch(`/api/listings/${item.id}`, { method: "DELETE" });
        if (!response.ok) { const result = await response.json(); throw new Error(result.detail || "Не удалось удалить"); }
        if (data.items.length === 1 && listingOffset > 0) listingOffset -= 50;
        await loadListings();
      } catch (error) { remove.disabled = false; $("listing-page").textContent = error.message; }
    });
    actions.append(toggle, remove); row.appendChild(actions);
    body.appendChild(row);
  });
  const total = Number(data.total || 0), start = total ? data.offset + 1 : 0, end = Math.min(data.offset + data.limit, total);
  $("listing-page").textContent = `${start}–${end} из ${fmtInt(total)}`;
  $("listing-prev").disabled = data.offset <= 0;
  $("listing-next").disabled = data.offset + data.limit >= total;
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

function buildSeries(rows, key, valueKey = "count", sourceFilter = "") {
  if (sourceFilter) rows = rows.filter((r) => r.source === sourceFilter);
  const labels = [...new Set(rows.map((r) => r[key]))].sort();
  const sources = [...new Set(rows.map((r) => r.source))].sort();
  const index = new Map(rows.map((r) => [`${r[key]}|${r.source}`, Number(r[valueKey] || 0)]));
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

  const left = 42;
  const right = 8;
  const top = 10;
  const bottom = 24;
  const count = Math.max(labels.length, 1);
  const totals = labels.map((_, i) =>
    series.reduce((sum, item) => sum + (item.values[i] || 0), 0),
  );
  canvas.setAttribute("aria-label", labels.length ? labels.map((label, i) => `${label}: ${totals[i]}`).join("; ") : "Нет данных за выбранный период");
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const i = Math.min(labels.length - 1, Math.max(0, Math.floor((event.clientX - rect.left - 42) / ((width - 50) / Math.max(1, labels.length)))));
    canvas.title = labels[i] ? `${labels[i]} · ${series.map(item => `${item.source}: ${fmtInt(item.values[i])}`).join(" · ")}` : "Нет данных";
  };
  const max = Math.max(1, ...totals);
  const gap = count > 20 ? 2 : 4;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const barWidth = Math.max(2, (plotWidth - gap * (count - 1)) / count);

  ctx.strokeStyle = "#eef0f3";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = top + (plotHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "right";
    ctx.fillText(fmtInt(Math.round((max * (4 - i)) / 4)), left - 6, y + 4);
  }

  labels.forEach((label, i) => {
    let y = height - bottom;
    series.forEach((item) => {
      const value = item.values[i] || 0;
      if (!value) return;
      const barHeight = (plotHeight * value) / max;
      const x = left + i * (barWidth + gap);
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - barHeight, barWidth, barHeight);
      y -= barHeight;
    });
  });

  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";

  const step = Math.ceil(count / 6);
  labels.forEach((label, i) => {
    if (i !== count - 1 && (i % step !== 0 || count - 1 - i < step)) return;
    const x = left + i * (barWidth + gap) + barWidth / 2;
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
  if (charts) charts.hidden = dashboardView() !== "overview";

  $("kpi-today").textContent = fmtInt(data.totals.today);
  $("kpi-week").textContent = fmtInt(data.totals.week);
  $("kpi-month").textContent = fmtInt(data.totals.month);
  $("kpi-sources").textContent = fmtInt(data.totals.sources);
  if (current?.storage) {
    $("kpi-total-listings").textContent = fmtInt(current.storage.listings);
    $("kpi-active-listings").textContent = fmtInt(data.totals.active);
  }

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

  const select = $("chart-source");
  const selectedChartSource = select.value;
  select.innerHTML = `<option value="">${t("allSources")}</option>`;
  data.by_source.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.source;
    option.textContent = row.source;
    select.appendChild(option);
  });
  select.value = selectedChartSource;
  const listingSource = $("listing-source");
  const selectedListingSource = listingSource.value;
  listingSource.innerHTML = `<option value="">${t("allSources")}</option>`;
  data.by_source.forEach((row) => {
    const option = document.createElement("option"); option.value = row.source; option.textContent = row.source; listingSource.appendChild(option);
  });
  listingSource.value = selectedListingSource;
  if (dashboardView() !== "overview") return;
  const days = Number($("chart-days").value || 30);
  const metric = $("chart-metric").value || "inserted";
  const sourceFilter = $("chart-source").value;
  const monthlyMode = days > 90;
  const runs = new Map();
  (data.runs || []).forEach((r) => {
    const key = `${monthlyMode ? r.day.slice(0, 7) : r.day}|${r.source}`;
    runs.set(key, (runs.get(key) || 0) + Number(r[metric] || 0));
  });
  const dateKey = monthlyMode ? "month" : "day";
  const chartRows = (monthlyMode ? data.monthly : data.daily).map((r) => ({...r, count: metric === "inserted" ? r.count : runs.get(`${r[dateKey]}|${r.source}`) || 0}));
  const daily = buildSeries(chartRows, dateKey, "count", sourceFilter);
  drawStack($("chart-daily"), daily.labels, daily.series, (d) => monthlyMode ? d.slice(2).replace("-", "/") : `${d.slice(8, 10)}.${d.slice(5, 7)}`);
  renderLegend($("legend-daily"), daily.series);
  $("daily-range").textContent = `${daily.labels.length} ${monthlyMode ? "месяцев" : "дней"}`;

  const monthly = buildSeries(data.monthly, "month", "count", sourceFilter);
  drawStack($("chart-monthly"), monthly.labels, monthly.series, (m) => m.slice(2).replace("-", "/"));
  renderLegend($("legend-monthly"), monthly.series);
  $("monthly-range").textContent = `${monthly.labels.length} ${lang === "ru" ? "мес." : "mo"}`;


}

async function loadMetrics() {
  try {
    const days = Number($("chart-days").value || 30);
    const response = await dashboardFetch(`/api/metrics?days=${days}&months=12`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    lastMetrics = await response.json();
    renderMetrics();
  } catch {
    $("daily-range").textContent = "Не удалось загрузить график";
    if (!lastMetrics) $("platforms").innerHTML = '<tr><td colspan="7" class="muted">Не удалось загрузить данные. <button type="button" id="retry-platforms" class="ghost">Повторить</button></td></tr>';
    $("retry-platforms")?.addEventListener("click", loadMetrics);
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
    ? { visit: "Посетители", search: "Искали", saved_search: "Сохраняли поиск", alert_open: "Открывали алерты" }
    : { visit: "Visits", search: "Searches", saved_search: "Saved searches", alert_open: "Alerts" };
  box.innerHTML = funnel.stages.map((stage) => {
    const conv = "";
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
    link.textContent = "Статистика и доступ";
    cell.appendChild(link);
    tr.appendChild(cell);
  }, 8);
  if (funnel) renderFunnel(funnel);
  const total = Number(data.total_users || 0);
  const start = total ? userOffset + 1 : 0;
  const end = Math.min(userOffset + (data.users || []).length, total);
  $("ua-users-title").textContent = `Пользователи · ${fmtInt(total)}`;
  $("ua-user-page").textContent = `${fmtInt(start)}–${fmtInt(end)} из ${fmtInt(total)}`;
  $("ua-user-prev").disabled = userOffset <= 0;
  $("ua-user-next").disabled = userOffset + userPageSize >= total;
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
    const params = new URLSearchParams({ days: "30", limit: String(userPageSize), offset: String(userOffset) });
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
  userOffset = 0;
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(loadUserAnalytics, 350);
});
$("ua-user-prev").addEventListener("click", () => {
  userOffset = Math.max(0, userOffset - userPageSize);
  void loadUserAnalytics();
});
$("ua-user-next").addEventListener("click", () => {
  userOffset += userPageSize;
  void loadUserAnalytics();
});

async function loadUserDetail(userId) {
  const requestId = ++userDetailRequest;
  const dialog = $("ua-user-dialog");
  const error = $("ua-user-error");
  const content = $("ua-user-content");
  if (!dialog.open) dialog.showModal();
  if (activeSupportUserId !== String(userId)) {
    activeSupportTab = "overview";
    notificationCursors = [null]; notificationPage = 0; nextNotificationCursor = null;
    $("ua-new-password").value = "";
    $("ua-admin-action-error").classList.add("hidden");
    $("ua-admin-action-success").classList.add("hidden");
    $("ua-notifications-list").replaceChildren();
    $("ua-notifications-totals").replaceChildren();
    $("ua-sessions").replaceChildren();
  }
  activeSupportUserId = String(userId);
  error.classList.add("hidden");
  content.classList.add("hidden");
  $("ua-user-meta").textContent = "Загрузка…";
  $("ua-subscription-message").textContent = "";
  $("ua-user-title").textContent = `Пользователь #${userId}`;
  try {
    const response = await dashboardFetch(`/api/user-metrics/${encodeURIComponent(userId)}?days=30&search_limit=100`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    if (requestId !== userDetailRequest) return;
    const user = data.user;
    const label = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(" ") || `ID ${user.id}`;
    $("ua-user-title").textContent = label;
    const lastSeen = user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("ru-RU") : "—";
    const identity = [user.email, user.phone, user.tg_id ? `Telegram ${user.tg_id}` : null].filter(Boolean).join(" · ");
    $("ua-user-meta").textContent = [`ID ${user.id}`, identity, `регистрация ${fmtDateTime(user.created_at)}`, `последний визит ${lastSeen}`].filter(Boolean).join(" · ");
    $("ua-password-form").classList.toggle("hidden", !user.can_set_password);
    $("ua-password-unavailable").classList.toggle("hidden", Boolean(user.can_set_password));
    const totals = data.totals || {};
    $("ua-user-sessions").textContent = fmtInt(totals.sessions);
    $("ua-user-searches").textContent = fmtInt(totals.searches);
    $("ua-user-views").textContent = fmtInt(totals.listing_views);
    $("ua-user-favorites").textContent = fmtInt(totals.favorites_added);
    $("ua-user-subscriptions").textContent = fmtInt(data.subscription_counts?.active);
    fillAnalyticsTable("ua-user-subscription-list", data.subscriptions, (tr, sub) => {
      addAnalyticsCell(tr, sub.name || `#${sub.id}`);
      addAnalyticsCell(tr, sub.active ? "Активна" : "На паузе");
      addAnalyticsCell(tr, formatSupportFilters(sub.criteria));
      const conflicts = supportFilterConflicts(sub.criteria);
      if (conflicts.length) {
        const warning = document.createElement("small");
        warning.className = "filter-conflict";
        warning.textContent = `Конфликт сохранённых полей: ${conflicts.join(", ")}.`;
        tr.lastElementChild.appendChild(warning);
      }
      addAnalyticsCell(tr, fmtDateTime(sub.created_at));
      const actions = document.createElement("td");
      actions.className = "subscription-actions";
      const toggle = document.createElement("button");
      toggle.type="button"; toggle.className="admin-button admin-button-outline";
      toggle.textContent=sub.active ? "Пауза" : "Возобновить";
      toggle.setAttribute("aria-label", `${toggle.textContent}: ${sub.name || sub.id}`);
      toggle.addEventListener("click", () => toggleUserSubscription(userId,sub,toggle));
      actions.appendChild(toggle);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "admin-button admin-button-destructive";
      remove.textContent = "Удалить";
      remove.setAttribute("aria-label", `Удалить подписку «${sub.name || sub.id}»`);
      remove.addEventListener("click", () => openSubscriptionDelete(userId, sub));
      actions.appendChild(remove);
      tr.appendChild(actions);
    }, 5);
    $("ua-user-days").textContent = fmtInt(totals.active_days);
    fillAnalyticsTable("ua-user-searches-list", data.searches, (tr, item) => {
      addAnalyticsCell(tr, new Date(item.at).toLocaleString("ru-RU"));
      addAnalyticsCell(tr, item.query || "—");
      const filters = formatSupportFilters(item.filters);
      addAnalyticsCell(tr, filters || "—");
      addAnalyticsCell(tr, ({new:"Сначала новые",price_asc:"Дешевле",price_desc:"Дороже"})[item.sort] || item.sort || "Сначала новые");
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
    renderSupportTab();
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

function showUserActionMessage(kind, message) {
  const error = $("ua-admin-action-error");
  const success = $("ua-admin-action-success");
  error.classList.add("hidden");
  success.classList.add("hidden");
  const target = kind === "error" ? error : success;
  target.textContent = message;
  target.classList.remove("hidden");
}

const supportFilterLabels = {q:"Поиск",make:"Марка",makes:"Марки",model:"Модель",body:"Кузов",bodies:"Кузова",fuel:"Топливо",fuels:"Топливо",gearbox:"КПП",gearboxes:"КПП",price_min:"Цена от",price_max:"Цена до",year_min:"Год от",year_max:"Год до",mileage_min:"Пробег от",mileage_max:"Пробег до",power_min:"Мощность от",power_max:"Мощность до",engine_min:"Объём от",engine_max:"Объём до",radius_km:"Радиус, км",lat:"Широта",lon:"Долгота",source:"Площадка",drive:"Привод",seller_type:"Продавец",condition:"Состояние",color:"Цвет",doors:"Двери",seats:"Места",published_days:"Опубликовано за дней"};
const supportValues = {sedan:"Седан",van:"Фургон",suv:"Внедорожник",wagon:"Универсал",hatchback:"Хэтчбек",coupe:"Купе",petrol:"Бензин",diesel:"Дизель",electric:"Электро",hybrid:"Гибрид",automatic:"Автомат",manual:"Механика",private:"Частный",dealer:"Дилер",used:"С пробегом",new:"Новый"};
function formatSupportFilters(filters = {}) {
  return Object.entries(filters || {}).filter(([key,value])=>key!=="sort" && value!=null && value!=="" && (!Array.isArray(value)||value.length)).map(([key,value])=>{
    const display=Array.isArray(value) ? value.map(v=>supportValues[v]||v).join(", ") : typeof value==="number" ? (/^year_/.test(key) ? String(value) : value.toLocaleString("ru-RU",{maximumFractionDigits:6})) : supportValues[value]||value;
    return `${supportFilterLabels[key]||key}: ${display}`;
  }).join(" · ");
}
function supportFilterConflicts(filters = {}) {
  return [["make","makes"],["body","bodies"],["fuel","fuels"],["gearbox","gearboxes"]]
    .filter(([single,multi]) => filters?.[single] && Array.isArray(filters[multi]) && !filters[multi].includes(filters[single]))
    .map(([single,multi]) => `«${supportFilterLabels[single]}» / «${supportFilterLabels[multi]}»`);
}
function renderSupportTab() {
  document.querySelectorAll("[data-support-tab]").forEach(el=>{const on=el.dataset.supportTab===activeSupportTab; el.setAttribute("aria-selected",String(on)); el.tabIndex=on?0:-1;});
  document.querySelectorAll("[data-support-panel]").forEach(el=>{el.hidden=el.dataset.supportPanel!==activeSupportTab;});
  if(activeSupportTab==="access") void loadUserSessions();
  if(activeSupportTab==="notifications") void loadUserNotifications();
}
document.querySelectorAll("[data-support-tab]").forEach((button,index,buttons)=>{
  button.addEventListener("click",()=>{activeSupportTab=button.dataset.supportTab; renderSupportTab();});
  button.addEventListener("keydown",event=>{
    let next;
    if(event.key==="ArrowRight") next=(index+1)%buttons.length;
    if(event.key==="ArrowLeft") next=(index-1+buttons.length)%buttons.length;
    if(event.key==="Home") next=0;
    if(event.key==="End") next=buttons.length-1;
    if(next!=null){event.preventDefault();buttons[next].click();buttons[next].focus();}
  });
});
$("ua-user-refresh").addEventListener("click",()=>{if(activeSupportUserId) void loadUserDetail(activeSupportUserId);});
const subscriptionChanges = new Set();
async function toggleUserSubscription(userId,sub,button) {
  const key=`${userId}:${sub.id}`;
  if(subscriptionChanges.has(key)) return;
  subscriptionChanges.add(key);button.disabled=true;
  try {
    const response=await fetch(`/api/users/${encodeURIComponent(userId)}/subscriptions/${sub.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!sub.active})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(typeof result.detail==="string"?result.detail:"Не удалось изменить подписку");
    if(String(activeSupportUserId)===String(userId)) {
      await loadUserDetail(userId);
      $("ua-subscription-message").textContent=sub.active ? `Подписка на паузе. Отменено уведомлений: ${fmtInt(result.cancelled_notifications)}.` : "Подписка возобновлена.";
      void loadUserAnalytics();
    }
  } catch(error){if(String(activeSupportUserId)===String(userId))$("ua-subscription-message").textContent=error.message;}
  finally {subscriptionChanges.delete(key);button.disabled=false;}
}
const deliveryLabels={sent:"Доставлено",pending:"В очереди",held:"Ожидает дайджеста",failed:"Повтор отправки",dead:"Ошибка доставки",cancelled:"Отменено"};
async function loadUserNotifications() {
  if(!activeSupportUserId) return;
  const userId=String(activeSupportUserId),requestId=++notificationsRequest;
  $("ua-notifications-state").textContent="Загрузка истории…";
  $("ua-notifications-prev").disabled=true;
  $("ua-notifications-next").disabled=true;
  const params = new URLSearchParams({days:"30", limit:"50"});
  if(notificationCursors[notificationPage]!=null) params.set("before_id",notificationCursors[notificationPage]);
  try {
    const response=await dashboardFetch(`/api/users/${userId}/notifications?${params}`,{cache:"no-store"});
    const data=await response.json();
    if(requestId!==notificationsRequest || userId!==String(activeSupportUserId))return;
    if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Не удалось загрузить историю");
    $("ua-notifications-totals").replaceChildren();
    for(const [state,total] of Object.entries(data.totals||{})) {
      const badge=document.createElement("span");badge.className=`delivery-badge delivery-${state}`;
      badge.textContent=`${deliveryLabels[state]||state}: ${fmtInt(total)}`;$("ua-notifications-totals").appendChild(badge);
    }
    fillAnalyticsTable("ua-notifications-list",data.items,(tr,item)=>{
      addAnalyticsCell(tr,fmtDateTime(item.created_at));
      const td=document.createElement("td"),link=document.createElement("a");
      link.href=`/listing/${encodeURIComponent(item.listing_id)}`;link.target="_blank";link.rel="noopener";link.textContent=item.title||`#${item.listing_id}`;td.appendChild(link);tr.appendChild(td);
      addAnalyticsCell(tr,deliveryLabels[item.status]||item.status);
      if(item.sent_at) tr.lastElementChild.title=`Доставлено: ${fmtDateTime(item.sent_at)}`;
      addAnalyticsCell(tr,fmtInt(item.attempts));
      addAnalyticsCell(tr,item.matches_current_filters==null ? "Снижение цены" : item.matches_current_filters ? "Соответствует" : "Не соответствует",item.matches_current_filters===false?"filter-mismatch":"");
      addAnalyticsCell(tr,item.error||"—");
    },6);
    nextNotificationCursor=data.next_before_id;
    $("ua-notifications-prev").disabled=notificationPage===0;
    $("ua-notifications-next").disabled=nextNotificationCursor==null;
    $("ua-notifications-page").textContent=`Страница ${notificationPage+1}`;
    $("ua-notifications-state").textContent=data.items.length ? `Показано ${data.items.length} уведомлений` : "Уведомлений за этот период нет";
  }catch(error){
    if(requestId!==notificationsRequest || userId!==String(activeSupportUserId)) return;
    $("ua-notifications-state").textContent=error.message;
    $("ua-notifications-list").replaceChildren();
    $("ua-notifications-prev").disabled=notificationPage===0;
  }
}
$("ua-notifications-refresh").addEventListener("click",()=>{
  notificationCursors=[null]; notificationPage=0; void loadUserNotifications();
});
$("ua-notifications-prev").addEventListener("click",()=>{
  if(notificationPage>0){notificationPage--; void loadUserNotifications();}
});
$("ua-notifications-next").addEventListener("click",()=>{
  if(nextNotificationCursor!=null){notificationPage++; notificationCursors[notificationPage]=nextNotificationCursor; void loadUserNotifications();}
});

let pendingSubscriptionDelete = null;
let subscriptionDeleteBusy = false;
function openSubscriptionDelete(userId, sub) {
  pendingSubscriptionDelete = {userId:String(userId), subId:sub.id};
  $("subscription-delete-description").textContent = `Подписка «${sub.name || `#${sub.id}`}» будет удалена. Ожидающие уведомления, которые больше не подходят под другие активные подписки, будут отменены. Восстановить подписку можно только созданием заново.`;
  $("subscription-delete-error").classList.add("hidden");
  $("subscription-delete-dialog").showModal();
}
$("subscription-delete-cancel").addEventListener("click", () => $("subscription-delete-dialog").close());
$("subscription-delete-dialog").addEventListener("cancel", event => { if (subscriptionDeleteBusy) event.preventDefault(); });
$("subscription-delete-dialog").addEventListener("close", () => { if (!subscriptionDeleteBusy) pendingSubscriptionDelete = null; });
$("subscription-delete-confirm").addEventListener("click", async () => {
  if (!pendingSubscriptionDelete || subscriptionDeleteBusy) return;
  const {userId, subId} = pendingSubscriptionDelete;
  subscriptionDeleteBusy = true;
  $("subscription-delete-confirm").disabled = true;
  $("subscription-delete-cancel").disabled = true;
  $("subscription-delete-error").classList.add("hidden");
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}/subscriptions/${encodeURIComponent(subId)}`, {method:"DELETE"});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Не удалось удалить подписку");
    $("subscription-delete-dialog").close();
    pendingSubscriptionDelete = null;
    if (String(activeSupportUserId) === userId && $("ua-user-dialog").open) {
      await loadUserDetail(userId);
      $("ua-subscription-message").textContent = `Подписка удалена. Отменено ожидающих уведомлений: ${fmtInt(result.cancelled_notifications)}.`;
    }
    void loadUserAnalytics();
  } catch (error) {
    $("subscription-delete-error").textContent = error.message || "Ошибка удаления";
    $("subscription-delete-error").classList.remove("hidden");
  } finally {
    subscriptionDeleteBusy = false;
    $("subscription-delete-confirm").disabled = false;
    $("subscription-delete-cancel").disabled = false;
  }
});

function sessionDeviceLabel(ua) {
  if (!ua) return "Неизвестное устройство";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Устройство";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Version.*Safari/.test(ua) ? "Safari" : "Приложение";
  return `${os} · ${browser}`;
}

async function loadUserSessions(userId = activeSupportUserId) {
  if (!userId) return;
  const status = $("ua-sessions-status");
  const requestId=++sessionsRequest;
  status.textContent = "Загружаю…";
  try {
    const response = await dashboardFetch(`/api/users/${encodeURIComponent(userId)}/sessions`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    if (requestId!==sessionsRequest || String(userId)!==String(activeSupportUserId)) return;
    const body = $("ua-sessions");
    body.replaceChildren();
    const sessions = data.items || [];
    sessions.forEach((session) => {
      const row = document.createElement("tr");
      addAnalyticsCell(row, sessionDeviceLabel(session.user_agent));
      row.firstElementChild.title = session.user_agent || "";
      addAnalyticsCell(row, fmtDateTime(session.last_seen_at));
      const cell = document.createElement("td");
      const button = document.createElement("button");
      button.className = "ghost danger-action";
      button.type = "button";
      button.textContent = "Завершить";
      button.addEventListener("click", () => revokeUserSession(userId, session.id));
      cell.appendChild(button);
      row.appendChild(cell);
      body.appendChild(row);
    });
    status.textContent = sessions.length ? `Активных сессий: ${sessions.length}` : "Активных сессий нет";
  } catch (error) {
    if (requestId!==sessionsRequest || String(userId)!==String(activeSupportUserId)) return;
    status.textContent = error instanceof Error ? error.message : "Не удалось загрузить сессии";
  }
}

async function revokeUserSession(userId, sessionId = null) {
  const message = sessionId
    ? "Завершить эту сессию?"
    : "Завершить все активные сессии этого пользователя?";
  if (!window.confirm(message)) return;
  const endpoint = sessionId
    ? `/api/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}/revoke`
    : `/api/users/${encodeURIComponent(userId)}/sessions/revoke`;
  try {
    const response = await fetch(endpoint, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    await loadUserSessions(userId);
    showUserActionMessage("success", sessionId ? "Сессия завершена." : `Все сессии и старые токены отозваны. Записанных сессий: ${data.revoked}.`);
  } catch (error) {
    showUserActionMessage("error", error instanceof Error ? error.message : "Не удалось завершить сессии");
  }
}

$("ua-sessions-refresh").addEventListener("click", () => loadUserSessions());
$("ua-sessions-revoke-all").addEventListener("click", () => {
  if (activeSupportUserId) void revokeUserSession(activeSupportUserId);
});
$("ua-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeSupportUserId) return;
  const password = $("ua-new-password").value;
  if (password.length < 12) {
    showUserActionMessage("error", "Пароль должен содержать не менее 12 символов.");
    return;
  }
  if (!window.confirm("Задать новый пароль? Все активные сессии пользователя будут завершены.")) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(activeSupportUserId)}/password`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    $("ua-new-password").value = "";
    await loadUserSessions();
    showUserActionMessage("success", "Пароль задан. Все активные сессии пользователя завершены.");
  } catch (error) {
    showUserActionMessage("error", error instanceof Error ? error.message : "Не удалось задать пароль");
  } finally {
    button.disabled = false;
  }
});

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
      <td>${fmtDateTime(row.last_poll_at)}</td>
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
    const response = await dashboardFetch("/api/logs?limit=100", { cache: "no-store" });
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
  renderCollectors(status);
}

async function load() {
  try {
    const response = await dashboardFetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    render(await response.json());
    $("dashboard-main").classList.remove("is-loading");
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

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

async function loadAnnouncement() {
  try {
    const response = await fetch("/api/app-announcement", { cache: "no-store" });
    if (!response.ok) return;
    const { announcement } = await response.json();
    if (announcement) {
      $("announcement-message").value = announcement.message;
      $("announcement-start").value = toLocalInput(announcement.starts_at);
      $("announcement-end").value = toLocalInput(announcement.ends_at);
      const from = new Date(announcement.starts_at), until = new Date(announcement.ends_at), now = new Date();
      const state = until <= now ? "Завершено" : from > now ? "Запланировано" : "Показывается";
      const locale = lang === "ru" ? "ru-RU" : "en-GB";
      $("announcement-state").textContent = `${state} · ${from.toLocaleString(locale, {timeZone:"Europe/Warsaw"})} — ${until.toLocaleString(locale, {timeZone:"Europe/Warsaw"})} (Варшава)`;
    } else {
      $("announcement-form").reset();
      $("announcement-state").textContent = "Не запланировано";
    }
  } catch { $("announcement-state").textContent = "Не удалось загрузить расписание"; }
}

$("announcement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("announcement-form").querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const response = await fetch("/api/app-announcement", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: $("announcement-message").value,
        starts_at: new Date($("announcement-start").value).toISOString(),
        ends_at: new Date($("announcement-end").value).toISOString(),
      }),
    });
    if (!response.ok) throw new Error((await response.json()).detail || "Ошибка сохранения");
    await loadAnnouncement();
  } catch (error) { $("announcement-state").textContent = error.message || "Ошибка сохранения"; }
  finally { button.disabled = false; }
});

$("announcement-clear").addEventListener("click", async () => {
  const response = await fetch("/api/app-announcement", { method: "DELETE" });
  if (response.ok) {
    $("announcement-form").reset();
    $("announcement-state").textContent = "Объявление снято";
  } else $("announcement-state").textContent = "Не удалось снять объявление";
});

$("listing-status").addEventListener("change", () => { listingOffset = 0; loadListings(); });
$("listing-source").addEventListener("change", () => { listingOffset = 0; loadListings(); });
$("listing-query").addEventListener("input", () => {
  clearTimeout(listingSearchTimer);
  listingSearchTimer = setTimeout(() => { listingOffset = 0; loadListings(); }, 350);
});
$("listing-prev").addEventListener("click", () => { listingOffset = Math.max(0, listingOffset - 50); loadListings(); });
$("listing-next").addEventListener("click", () => { listingOffset += 50; loadListings(); });
$("chart-days").addEventListener("change", () => loadMetrics());
$("chart-metric").addEventListener("change", () => renderMetrics());
$("chart-source").addEventListener("change", () => renderMetrics());
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
  $("dashboard-sidebar").classList.add("hidden");
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
  $("dashboard-sidebar").classList.remove("hidden");
  renderDashboardView();
  $("dashboard-footer").classList.remove("hidden");
  if (dashboardStarted) return;
  dashboardStarted = true;
  $("dashboard-main").classList.add("is-loading");
  load();
  loadMetrics();
  loadUserAnalytics();
  showUserFromHash();
  loadLogs();
  loadListings();
  loadAnnouncement();
  if (dashboardView() === "services") loadRailway();
  if (dashboardView() === "supabase") loadSupabase();
  dashboardIntervals = [setInterval(() => { if (!document.hidden && dashboardView() === "services") loadRailway(); if (!document.hidden && dashboardView() === "supabase") loadSupabase(); }, 60000), setInterval(() => { if (!document.hidden) load(); }, 15000), setInterval(() => { if (!document.hidden && ["overview", "services"].includes(dashboardView())) loadMetrics(); }, 60000), setInterval(() => { if (!document.hidden && dashboardView() === "logs") loadLogs(); }, 30000), setInterval(() => { if (!document.hidden && dashboardView() === "listings" && !$("listing-query").matches(":focus")) loadListings(); }, 60000)];
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

const railwayStateLabels = {running:"Работает",deploying:"Развёртывается",failed:"Ошибка",not_deployed:"Не запускался",sleeping:"Спит",stopped:"Остановлен",unknown:"Нет данных"};
const deploymentLabels = {SUCCESS:"Успешно",FAILED:"Ошибка сборки",CRASHED:"Процесс завершился с ошибкой",BUILDING:"Сборка",DEPLOYING:"Запуск",QUEUED:"В очереди",INITIALIZING:"Подготовка",WAITING:"Ожидание",REMOVED:"Удалён",CANCELED:"Отменён",SLEEPING:"Спит"};
function platformTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU",{timeZone:"Europe/Warsaw",hour12:false});
}
function platformNumber(value,unit="count") {
  if (value==null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("ru-RU",{maximumFractionDigits:unit==="GB"?3:0}).format(value)+(unit==="GB"?" ГБ":"");
}
function platformMeter(data,accessibleLabel="Использование квоты",unit="count") {
  const wrapper=document.createElement("div"); wrapper.className=`resource-meter meter-${data.state||"unknown"}`;
  const track=document.createElement("div");track.className="resource-track"; track.setAttribute("role","progressbar");
  track.setAttribute("aria-label",accessibleLabel);track.setAttribute("aria-valuemin","0");track.setAttribute("aria-valuemax","100");
  if(data.percent!=null){
    track.setAttribute("aria-valuenow",String(Math.min(100,data.percent)));
    track.setAttribute("aria-valuetext",`${platformNumber(data.used,unit)} из ${platformNumber(data.limit,unit)}`);
    const fill=document.createElement("span"); fill.style.width=`${Math.max(0,Math.min(100,data.percent))}%`;track.appendChild(fill);
  } else track.setAttribute("aria-valuetext","Данные недоступны");
  const label=document.createElement("span");label.textContent=data.percent==null?"Нет данных":new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(data.percent)+"%";
  wrapper.append(track,label);return wrapper;
}
async function loadRailway() {
  const button=$("railway-refresh"),error=$("railway-error"); button.disabled=true;
  $("railway-section").setAttribute("aria-busy","true");
  try {
    const response=await dashboardFetch("/api/platform/railway",{cache:"no-store"});
    if(!response.ok) throw new Error("Не удалось загрузить сервисы Railway");
    const data=await response.json();
    error.classList.toggle("hidden",!data.error);error.textContent=data.error||"";
    $("railway-environment").textContent=data.configured ? `${data.project_name} · ${data.environment}` : "Railway: мониторинг не подключён";
    const services=data.services||[];
    $("railway-summary").replaceChildren();
    if(data.configured) for(const [label,total] of [["Всего",services.length],["Работают",services.filter(s=>s.state==="running").length],["Требуют внимания",services.filter(s=>s.latest_failed||s.state==="failed").length],["Не запущены",services.filter(s=>["not_deployed","stopped","sleeping"].includes(s.state)).length]]){
      const item=document.createElement("span"); item.textContent=`${label}: ${total}`;$("railway-summary").appendChild(item);
    }
    fillAnalyticsTable("railway-services",services,(tr,service)=>{
      addAnalyticsCell(tr,service.name);
      const cell=document.createElement("td"),badge=document.createElement("span");badge.className=`platform-state state-${data.stale?"unknown":service.state}`;
      badge.textContent=(railwayStateLabels[service.state]||service.state)+(data.stale?" · устарело":"");cell.appendChild(badge);tr.appendChild(cell);
      addAnalyticsCell(tr,deploymentLabels[service.latest_status]||service.latest_status||"Не было",service.latest_failed?"danger-action":"");
      addAnalyticsCell(tr,platformTime(service.deployed_at));addAnalyticsCell(tr,service.replicas);
      const td=document.createElement("td"),link=document.createElement("a");link.href=service.url;link.target="_blank";link.rel="noopener";link.textContent="Railway ↗";td.appendChild(link);tr.appendChild(td);
    },6);
    $("railway-updated").textContent=(data.stale?"Последние известные данные: ":"Обновлено: ")+platformTime(data.updated_at)+" · автоматически раз в минуту";
  } catch(cause){
    error.textContent=cause.message;error.classList.remove("hidden");
    document.querySelectorAll("#railway-services .platform-state").forEach(badge=>{
      badge.className="platform-state state-unknown";
      if(!badge.textContent.includes("нет связи")) badge.textContent+=" · нет связи";
    });
  }
  finally{button.disabled=false;$("railway-section").setAttribute("aria-busy","false");}
}
async function loadSupabase() {
  const button=$("supabase-refresh"),error=$("supabase-error");button.disabled=true;
  $("supabase-section").setAttribute("aria-busy","true");
  try {
    const response=await dashboardFetch("/api/platform/supabase",{cache:"no-store"});
    if(!response.ok)throw new Error("Не удалось получить ресурсы Supabase");
    const data=await response.json(),billing=data.billing||{},connections=data.connections||{};
    error.textContent=data.error||"";error.classList.toggle("hidden",!data.error);
    $("supabase-db-size").textContent=data.database_bytes==null?"—":new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(data.database_bytes/(1024**3))+" ГиБ";
    $("supabase-connections").textContent=`${platformNumber(connections.used)} / ${platformNumber(connections.limit)}`;
    $("supabase-connections-meter").replaceChildren(platformMeter(data.stale?{...connections,state:"unknown"}:connections,"Подключения PostgreSQL"));
    $("supabase-connections-note").textContent=`Активных: ${platformNumber(connections.active)}. Резерв: ${platformNumber(connections.reserved)}. Лимит сервера: ${platformNumber(connections.server_max)}.`;
    $("supabase-disk").textContent=platformNumber(billing.allocated_disk_gb,"GB");
    $("supabase-disk-note").textContent=`Выделенный объём, не занятое место. В пакет входит ${platformNumber(billing.included_disk_gb,"GB")}. Данные — из снимка Usage.`;
    $("supabase-live-updated").textContent=(data.stale?"Последние известные данные БД: ":"БД обновлена: ")+platformTime(data.updated_at);
    const dateOnly=value=>value?new Date(value+"T12:00:00Z").toLocaleDateString("ru-RU",{timeZone:"Europe/Warsaw"}):"—";
    $("supabase-period").textContent=`Расчётный период: ${dateOnly(billing.period_start)} — ${dateOnly(billing.period_end)} · квоты организации CarCar`;
    $("supabase-source").href=data.usage_url||"https://supabase.com/dashboard";
    $("supabase-billing-freshness").textContent=!billing.valid_period?"Нужен снимок текущего периода":billing.stale?"Снимок требует обновления":"Проверенный снимок";
    $("supabase-billing-freshness").classList.toggle("is-stale",!billing.valid_period||billing.stale);
    $("supabase-billing-note").textContent=`Сверено в Supabase: ${platformTime(billing.verified_at)}. Месячные показатели не обновляются кнопкой «Обновить БД».`;
    fillAnalyticsTable("supabase-quotas",billing.metrics,(tr,metric)=>{
      addAnalyticsCell(tr,metric.label);
      if(metric.note){const note=document.createElement("small");note.className="quota-note";note.textContent=metric.note;tr.lastElementChild.appendChild(note);}
      addAnalyticsCell(tr,`${platformNumber(metric.used,metric.unit)} / ${platformNumber(metric.limit,metric.unit)}`);
      addAnalyticsCell(tr,platformNumber(metric.remaining,metric.unit));
      const td=document.createElement("td");td.appendChild(platformMeter(metric,metric.label,metric.unit));tr.appendChild(td);
    },4);
    $("supabase-section").classList.remove("platform-loading");
  }catch(cause){error.textContent=cause.message;error.classList.remove("hidden");}
  finally{button.disabled=false;$("supabase-section").setAttribute("aria-busy","false");}
}
$("railway-refresh").addEventListener("click",loadRailway);
$("supabase-refresh").addEventListener("click",loadSupabase);

const viewTitles = {overview:"Обзор",users:"Пользователи",listings:"Объявления",services:"Сервисы приложения",supabase:"Ресурсы Supabase",logs:"Ошибки и события",notices:"Уведомления"};
function dashboardView() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("user=") || hash === "user-analytics") return "users";
  if (hash === "collectors-section") return "services";
  return Object.hasOwn(viewTitles, hash) ? hash : "overview";
}
function renderDashboardView() {
  const view = dashboardView();
  $("dashboard-main").dataset.view = view;
  document.querySelectorAll("[data-views]").forEach(el => { el.hidden = !el.dataset.views.split(" ").includes(view); });
  document.querySelectorAll(".sidebar-link").forEach(el => { const selected = el.dataset.view === view; el.classList.toggle("selected", selected); if (selected) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); });
  $("dashboard-view-title").textContent = viewTitles[view];
  if (lastMetrics && ["overview", "services"].includes(view)) renderMetrics();
  else if (dashboardStarted && ["overview", "services"].includes(view)) loadMetrics();
  if (current && view === "services") renderChart(current.polls || []);
  if (dashboardStarted && view === "services") loadRailway();
  if (dashboardStarted && view === "supabase") loadSupabase();
}
window.addEventListener("hashchange", renderDashboardView);
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (lastMetrics && ["overview", "services"].includes(dashboardView())) renderMetrics(); if (current && dashboardView() === "services") renderChart(current.polls || []); }, 150); });
applyLang();
checkDashboardSession();
