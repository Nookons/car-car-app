/* CarCar Mini App — мобильный SPA для Telegram WebApp. */

const tg = window.Telegram?.WebApp;
const app = {
  token: localStorage.getItem("carcar.token") || "",
  user: null,
  filters: JSON.parse(localStorage.getItem("carcar.filters") || "{}"),
  list: { items: [], total: 0, offset: 0, loading: false },
  favorites: new Set(),
  screen: "home",
};

const $ = (sel) => document.querySelector(sel);
const screen = $("#screen");

/* ---------- утилиты ---------- */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function fmtPrice(value, currency = "PLN") {
  if (value == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(value);
}

function fmtInt(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fuelLabel(v) {
  return { petrol: "Бензин", diesel: "Дизель", hybrid: "Гибрид", plugin_hybrid: "Гибрид plug-in",
    electric: "Электро", lpg: "Газ", cng: "CNG", other: "Другое" }[v] || v || "";
}

function gearboxLabel(v) {
  return { manual: "Механика", automatic: "Автоматическая", semi_auto: "Полуавтомат", other: "Другое" }[v] || v || "";
}

function askText(title, value = "") {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "sheet-backdrop";
    wrap.style.display = "grid";
    wrap.style.alignItems = "center";
    wrap.style.padding = "0 20px";
    wrap.innerHTML = `
      <div class="card" style="width:100%;display:grid;gap:12px">
        <h2>${esc(title)}</h2>
        <div class="field" style="margin:0">
          <input id="ask-input" value="${esc(value)}" maxlength="120">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn ghost" id="ask-cancel">Отмена</button>
          <button class="btn primary" id="ask-ok">Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector("#ask-input");
    const finish = (result) => { wrap.remove(); resolve(result); };
    wrap.querySelector("#ask-cancel").addEventListener("click", () => finish(null));
    wrap.querySelector("#ask-ok").addEventListener("click", () => finish(input.value.trim() || null));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(input.value.trim() || null);
    });
    setTimeout(() => input.focus(), 50);
  });
}

function toast(text) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- API ---------- */

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (app.token) headers.Authorization = `Bearer ${app.token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401) {
    app.token = "";
    localStorage.removeItem("carcar.token");
    throw new Error("auth");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/* ---------- авторизация ---------- */

async function login() {
  const initData = tg?.initData || "dev";
  const data = await api("/auth", { method: "POST", body: JSON.stringify({ init_data: initData }) });
  app.token = data.token;
  app.user = data.user;
  localStorage.setItem("carcar.token", data.token);
}

async function loadFavorites() {
  try {
    const data = await api("/favorites");
    app.favorites = new Set(data.items.map((item) => item.id));
  } catch {
    app.favorites = new Set();
  }
}

async function ensureUser() {
  if (!app.token) await login();
  try {
    app.user = await api("/me");
  } catch (error) {
    if (String(error.message) === "auth") {
      await login();
    } else {
      throw error;
    }
  }
  await loadFavorites();
}

/* ---------- карточки ---------- */

function listingCard(item) {
  const meta = [item.year, item.mileage_km ? `${fmtInt(item.mileage_km)} км` : null,
    item.distance_km != null ? `${Math.round(item.distance_km)} км` : item.city]
    .filter(Boolean).join(" · ");
  return `
    <a class="listing" href="#/listing/${item.id}">
      <div class="thumb">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" loading="lazy" alt="">` : ""}</div>
      <div class="body">
        <div class="name">${esc(item.title || "—")}</div>
        <div class="price">${fmtPrice(item.price, item.currency)}</div>
        <div class="meta">${esc(meta)}</div>
      </div>
    </a>`;
}

function renderGrid(items) {
  if (!items.length) return `<div class="empty">Ничего не нашлось.<br>Попробуй изменить фильтры.</div>`;
  return `<div class="grid">${items.map(listingCard).join("")}</div>`;
}

/* ---------- главная ---------- */

async function renderHome() {
  screen.innerHTML = `
    <section class="greeting">
      <h2>Привет${app.user?.first_name ? `, ${esc(app.user.first_name)}` : ""} 👋</h2>
      <p>Свежие объявления из Польши — раньше, чем их увидят другие.</p>
    </section>
    <div class="chips">
      <button class="chip" data-quick="cheap">До 30 000 zł</button>
      <button class="chip" data-quick="low">До 100 тыс км</button>
      <button class="chip" data-quick="auto">Автомат</button>
      <button class="chip" data-quick="new">Новые</button>
    </div>
    <section>
      <div class="section-head"><h2>Новые объявления</h2><a href="#/list">Все →</a></div>
      <div id="home-list"><div class="empty">Загружаю…</div></div>
    </section>`;

  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.quick;
      app.filters = {};
      if (kind === "cheap") app.filters.price_max = 30000;
      if (kind === "low") app.filters.mileage_max = 100000;
      if (kind === "auto") app.filters.gearbox = "automatic";
      if (kind === "new") app.filters.year_min = new Date().getFullYear() - 1;
      saveFilters();
      location.hash = "#/list";
    });
  });

  const data = await api("/listings?limit=6&sort=new");
  $("#home-list").innerHTML = renderGrid(data.items);
}

/* ---------- список ---------- */

function filtersQuery(offset = 0) {
  const params = new URLSearchParams({ limit: "20", offset: String(offset), sort: app.filters.sort || "new" });
  Object.entries(app.filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && key !== "sort") params.set(key, value);
  });
  return params.toString();
}

function filtersSummary() {
  const parts = [];
  if (app.filters.make) parts.push(app.filters.make);
  if (app.filters.price_max) parts.push(`до ${fmtInt(app.filters.price_max)} zł`);
  if (app.filters.year_min) parts.push(`от ${app.filters.year_min} г.`);
  if (app.filters.mileage_max) parts.push(`до ${fmtInt(app.filters.mileage_max)} км`);
  if (app.filters.gearbox) parts.push(gearboxLabel(app.filters.gearbox));
  if (app.filters.radius_km) parts.push(`до ${app.filters.radius_km} км от вас`);
  return parts.join(" · ") || "Все объявления";
}

async function renderList(reset = true) {
  if (app.list.loading && !reset) return;
  if (reset) {
    app.list = { items: [], total: 0, offset: 0, loading: true };
    screen.innerHTML = `
      <div class="card">
        <div class="section-head">
          <div><h2>Объявления</h2><p class="muted">${esc(filtersSummary())}</p></div>
          <button class="chip" id="open-filters">Фильтры</button>
        </div>
      </div>
      <div id="list-body"><div class="empty">Загружаю…</div></div>`;
    $("#open-filters").addEventListener("click", openFilters);
  }

  app.list.loading = true;
  let data;
  try {
    data = await api(`/listings?${filtersQuery(app.list.offset)}`);
  } catch (error) {
    app.list.loading = false;
    toast(`Не удалось загрузить: ${error.message}`);
    $("#list-body").innerHTML = `<div class="empty">Ошибка загрузки.<br><button class="btn ghost" id="retry">Повторить</button></div>`;
    $("#retry")?.addEventListener("click", () => renderList(true));
    return;
  }
  app.list.loading = false;
  app.list.items = reset ? data.items : [...app.list.items, ...data.items];
  app.list.total = data.total;
  app.list.offset += data.items.length;

  const more = app.list.items.length < app.list.total
    ? `<button class="btn ghost block" id="more">Показать ещё (${fmtInt(app.list.total - app.list.items.length)})</button>`
    : "";

  $("#list-body").innerHTML = `
    <p class="muted">Найдено: ${fmtInt(app.list.total)}</p>
    ${renderGrid(app.list.items)}
    ${more}`;

  const moreButton = $("#more");
  if (moreButton) moreButton.addEventListener("click", () => renderList(false));
}

/* ---------- объявление ---------- */

async function renderListing(id) {
  screen.innerHTML = `<div class="empty">Загружаю…</div>`;
  const item = await api(`/listings/${id}`);
  const photos = item.photos.length ? item.photos : [];
  const isFav = app.favorites.has(item.id);

  const specs = [
    ["Год", item.year], ["Пробег", item.mileage_km ? `${fmtInt(item.mileage_km)} км` : null],
    ["Топливо", fuelLabel(item.fuel)], ["КПП", gearboxLabel(item.gearbox)],
    ["Объём", item.engine_cm3 ? `${fmtInt(item.engine_cm3)} см³` : null],
    ["Мощность", item.power_hp ? `${item.power_hp} л.с.` : null],
    ["Кузов", item.body], ["Цвет", item.color], ["VIN", item.vin],
    ["Город", [item.city, item.region].filter(Boolean).join(", ")],
    ["Добавлено", item.created_at ? fmtDate(item.created_at) : null],
  ].filter(([, value]) => value);

  screen.innerHTML = `
    <article class="card">
      ${photos.length
        ? `<div class="gallery">${photos.slice(0, 12).map((src) => `<img src="${esc(src)}" alt="">`).join("")}</div>`
        : `<div class="empty">Фото ещё не загружены</div>`}
      <div class="price-big">${fmtPrice(item.price, item.currency)}</div>
      <div class="title-big">${esc(item.title)}</div>
      <div class="chips-row">
        ${[item.year, item.mileage_km ? `${fmtInt(item.mileage_km)} км` : null,
           fuelLabel(item.fuel), gearboxLabel(item.gearbox)]
          .filter(Boolean).map((v) => `<span class="chip-sm">${esc(v)}</span>`).join("")}
      </div>
      <p class="muted">${esc([item.city, item.region].filter(Boolean).join(", "))}</p>
      ${item.seller?.name ? `<p class="muted">Продавец: ${esc(item.seller.name)}${item.seller.type === "dealer" ? " · дилер" : ""}</p>` : ""}
      <div style="display:grid;gap:10px;margin-top:12px">
        <a class="btn primary block" href="${esc(item.url)}" target="_blank" rel="noopener">Открыть на otomoto</a>
        <button class="btn ghost block" id="fav">${isFav ? "★ В избранном" : "☆ В избранное"}</button>
      </div>
    </article>
    <article class="card">
      <h2>Характеристики</h2>
      <div class="kv">
        ${specs.map(([key, value]) => `<div class="kv-row"><span class="kv-key">${esc(key)}</span><span class="kv-val">${esc(value)}</span></div>`).join("")}
      </div>
    </article>`;

  $("#fav").addEventListener("click", async () => {
    if (app.favorites.has(item.id)) {
      await api(`/favorites/${item.id}`, { method: "DELETE" });
      app.favorites.delete(item.id);
      toast("Убрано из избранного");
    } else {
      await api(`/favorites/${item.id}`, { method: "POST" });
      app.favorites.add(item.id);
      toast("Добавлено в избранное");
    }
    renderListing(id);
  });

  if (tg?.BackButton) tg.BackButton.show();
}

/* ---------- аккаунт ---------- */

function criteriaSummary(criteria) {
  const parts = [];
  if (criteria.make) parts.push(criteria.make);
  if (criteria.price_max) parts.push(`до ${fmtInt(criteria.price_max)} zł`);
  if (criteria.year_min) parts.push(`от ${criteria.year_min}`);
  if (criteria.mileage_max) parts.push(`до ${fmtInt(criteria.mileage_max)} км`);
  if (criteria.gearbox) parts.push(gearboxLabel(criteria.gearbox));
  return parts.join(" · ") || "без ограничений";
}

async function renderAccount() {
  const [me, subs, favs] = await Promise.all([
    api("/me"),
    api("/subscriptions"),
    api("/favorites"),
  ]);
  app.user = me;
  app.favorites = new Set(favs.items.map((i) => i.id));

  const initials = (me.first_name?.[0] || "?") + (me.last_name?.[0] || "");

  screen.innerHTML = `
    <section class="card" style="display:flex;gap:12px;align-items:center">
      <div class="logo" style="width:48px;height:48px;border-radius:14px;font-size:16px">${esc(initials)}</div>
      <div>
        <h2>${esc([me.first_name, me.last_name].filter(Boolean).join(" ") || "Пользователь")}</h2>
        <p class="muted">${me.username ? "@" + esc(me.username) : "Telegram ID " + me.tg_id}</p>
      </div>
    </section>

    <section class="card">
      <h2>Настройки</h2>
      <div class="field">
        <label>Язык интерфейса</label>
        <select id="lang">
          ${[["ru", "Русский"], ["pl", "Polski"], ["uk", "Українська"], ["en", "English"]]
            .map(([code, label]) => `<option value="${code}" ${me.lang === code ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <div class="kv">
        <div class="kv-row"><span class="kv-key">Уведомления о новых</span>
          <button class="chip ${me.notify_new ? "active" : ""}" id="notify">${me.notify_new ? "Вкл" : "Выкл"}</button></div>
        <div class="kv-row"><span class="kv-key">Дайджест вместо мгновенных</span>
          <button class="chip ${me.digest ? "active" : ""}" id="digest">${me.digest ? "Вкл" : "Выкл"}</button></div>
      </div>
    </section>

    <section class="card">
      <div class="section-head"><h2>Мои фильтры</h2><span class="muted">${subs.items.length}</span></div>
      <div id="subs">${subs.items.map(subRow).join("") || `<p class="muted">Пока нет — собери фильтр в «Списке» и сохрани.</p>`}</div>
      <button class="btn ghost block" id="save-filter" style="margin-top:10px">Сохранить текущий фильтр</button>
    </section>

    <section class="card">
      <div class="section-head"><h2>Избранное</h2><span class="muted">${favs.items.length}</span></div>
      ${favs.items.length ? renderGrid(favs.items.slice(0, 6)) : `<p class="muted">Пусто — добавляй машины звёздочкой.</p>`}
    </section>`;

  $("#lang").addEventListener("change", async (event) => {
    await api("/me", { method: "PATCH", body: JSON.stringify({ lang: event.target.value }) });
    toast("Язык сохранён");
  });
  $("#notify").addEventListener("click", async () => {
    await api("/me", { method: "PATCH", body: JSON.stringify({ notify_new: !me.notify_new }) });
    renderAccount();
  });
  $("#digest").addEventListener("click", async () => {
    await api("/me", { method: "PATCH", body: JSON.stringify({ digest: !me.digest }) });
    renderAccount();
  });
  $("#save-filter").addEventListener("click", async () => {
    const name = await askText("Название фильтра", filtersSummary());
    if (!name) return;
    await api("/subscriptions", { method: "POST", body: JSON.stringify({ name, criteria: app.filters }) });
    toast("Фильтр сохранён");
    renderAccount();
  });

  document.querySelectorAll("[data-sub-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.subToggle;
      await api(`/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify({ active: button.dataset.active !== "1" }) });
      renderAccount();
    });
  });
  document.querySelectorAll("[data-sub-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/subscriptions/${button.dataset.subDelete}`, { method: "DELETE" });
      renderAccount();
    });
  });
  document.querySelectorAll("[data-sub-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      const sub = subs.items.find((s) => String(s.id) === button.dataset.subApply);
      app.filters = { ...sub.criteria };
      saveFilters();
      location.hash = "#/list";
    });
  });
}

function subRow(sub) {
  return `
    <div class="kv-row">
      <div>
        <div style="font-weight:600">${esc(sub.name)}</div>
        <div class="muted">${esc(criteriaSummary(sub.criteria))}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="chip" data-sub-apply="${sub.id}">Показать</button>
        <button class="chip" data-sub-toggle="${sub.id}" data-active="${sub.active ? 1 : 0}">${sub.active ? "Вкл" : "Выкл"}</button>
        <button class="chip" data-sub-delete="${sub.id}">✕</button>
      </div>
    </div>`;
}

/* ---------- фильтры ---------- */

function saveFilters() {
  localStorage.setItem("carcar.filters", JSON.stringify(app.filters));
}

function openFilters() {
  const f = app.filters;
  $("#sheet-title").textContent = "Фильтры";
  $("#sheet-body").innerHTML = `
    <div class="field"><label>Поиск</label>
      <input id="f-q" value="${esc(f.q || "")}" placeholder="BMW 320d, Passat…"></div>
    <div class="field"><label>Марка</label>
      <input id="f-make" value="${esc(f.make || "")}" placeholder="BMW"></div>
    <div class="field"><label>Цена, zł</label>
      <div class="row">
        <input id="f-price-min" type="number" inputmode="numeric" placeholder="от" value="${f.price_min || ""}">
        <input id="f-price-max" type="number" inputmode="numeric" placeholder="до" value="${f.price_max || ""}">
      </div></div>
    <div class="field"><label>Год от</label>
      <input id="f-year-min" type="number" inputmode="numeric" placeholder="2015" value="${f.year_min || ""}"></div>
    <div class="field"><label>Пробег до, км</label>
      <input id="f-mileage" type="number" inputmode="numeric" placeholder="200000" value="${f.mileage_max || ""}"></div>
    <div class="field"><label>Топливо</label>
      <select id="f-fuel">
        <option value="">Любое</option>
        ${[["petrol","Бензин"],["diesel","Дизель"],["hybrid","Гибрид"],["electric","Электро"],["lpg","Газ"]]
          .map(([v,l]) => `<option value="${v}" ${f.fuel === v ? "selected" : ""}>${l}</option>`).join("")}
      </select></div>
    <div class="field"><label>КПП</label>
      <select id="f-gearbox">
        <option value="">Любая</option>
        ${[["manual","Механика"],["automatic","Автоматическая"]]
          .map(([v,l]) => `<option value="${v}" ${f.gearbox === v ? "selected" : ""}>${l}</option>`).join("")}
      </select></div>
    <div class="field"><label>Где искать</label>
      <div class="row">
        <button class="btn ghost" id="f-geo">Рядом со мной</button>
        <select id="f-radius">
          ${[25, 50, 100, 200].map((km) => `<option value="${km}" ${String(f.radius_km) === String(km) ? "selected" : ""}>${km} км</option>`).join("")}
        </select>
      </div>
      <p class="muted" id="f-geo-note">${f.lat ? "Геолокация включена" : "Геолокация не задана"}</p>
    </div>`;

  $("#sheet-backdrop").hidden = false;
  $("#sheet").hidden = false;

  $("#f-geo").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Геолокация недоступна");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        app.filters.lat = pos.coords.latitude;
        app.filters.lon = pos.coords.longitude;
        $("#f-geo-note").textContent = "Геолокация включена";
        toast("Локация получена");
      },
      () => toast("Не удалось получить локацию"),
      { timeout: 8000 },
    );
  });
}

function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
}

function applyFilters() {
  const value = (id) => $(id)?.value?.trim() || "";
  const num = (id) => {
    const v = value(id);
    return v ? Number(v) : undefined;
  };
  app.filters = {
    ...app.filters,
    q: value("#f-q") || undefined,
    make: value("#f-make") || undefined,
    price_min: num("#f-price-min"),
    price_max: num("#f-price-max"),
    year_min: num("#f-year-min"),
    mileage_max: num("#f-mileage"),
    fuel: value("#f-fuel") || undefined,
    gearbox: value("#f-gearbox") || undefined,
    radius_km: app.filters.lat ? Number($("#f-radius").value) : undefined,
    sort: app.filters.sort || "new",
  };
  Object.keys(app.filters).forEach((key) => {
    if (app.filters[key] === undefined || app.filters[key] === "") delete app.filters[key];
  });
  saveFilters();
  closeSheet();
  location.hash = "#/list";
}

/* ---------- роутер ---------- */

let backBound = false;

async function route() {
  if (tg) {
    tg.ready();
    tg.expand();
    if (!backBound) {
      tg.BackButton?.onClick(() => {
        if (location.hash.startsWith("#/listing/")) location.hash = "#/list";
        else history.length > 1 ? history.back() : (location.hash = "#/");
      });
      backBound = true;
    }
  }

  const hash = location.hash || "#/";
  const [, page, param] = hash.split("/");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  const filtersButton = $("#filters-btn");
  filtersButton.hidden = true;

  try {
    if (!app.user) await ensureUser();

    if (page === "listing" && param) {
      app.screen = "list";
      $("#screen-title").textContent = "Объявление";
      $("#screen-subtitle").textContent = "CarCar";
      document.querySelector('[data-tab="list"]')?.classList.add("active");
      await renderListing(param);
    } else if (page === "list") {
      tg?.BackButton?.hide();
      app.screen = "list";
      $("#screen-title").textContent = "Объявления";
      $("#screen-subtitle").textContent = filtersSummary();
      document.querySelector('[data-tab="list"]')?.classList.add("active");
      filtersButton.hidden = false;
      await renderList(true);
    } else if (page === "account") {
      tg?.BackButton?.hide();
      app.screen = "account";
      $("#screen-title").textContent = "Аккаунт";
      $("#screen-subtitle").textContent = "настройки и фильтры";
      document.querySelector('[data-tab="account"]')?.classList.add("active");
      await renderAccount();
    } else {
      tg?.BackButton?.hide();
      app.screen = "home";
      $("#screen-title").textContent = "CarCar";
      $("#screen-subtitle").textContent = "машины из Польши";
      document.querySelector('[data-tab="home"]')?.classList.add("active");
      await renderHome();
    }
  } catch (error) {
    if (String(error.message) === "auth" && !tg?.initData) {
      screen.innerHTML = `<div class="empty">Открой приложение внутри Telegram — авторизация через Telegram.</div>`;
    } else {
      screen.innerHTML = `<div class="empty">Ошибка: ${esc(error.message)}</div>`;
    }
  }
}

/* ---------- запуск ---------- */

$("#filters-btn").addEventListener("click", openFilters);
$("#sheet-close").addEventListener("click", closeSheet);
$("#sheet-backdrop").addEventListener("click", closeSheet);
$("#sheet-apply").addEventListener("click", applyFilters);
$("#sheet-reset").addEventListener("click", () => {
  app.filters = { sort: "new" };
  saveFilters();
  closeSheet();
  location.hash = "#/list";
  route();
});

window.addEventListener("hashchange", route);

if (tg?.themeParams) {
  const root = document.documentElement;
  Object.entries(tg.themeParams).forEach(([key, value]) => {
    root.style.setProperty(`--tg-theme-${key.replace(/_/g, "-")}`, value);
  });
}

route();
