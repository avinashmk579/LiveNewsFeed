"use strict";

const API_KEY = "test", SEARCH_URL = "https://content.guardianapis.com/search", PAGE_SIZE = 13;
const CATEGORIES = [
  { name: "All Wire", value: "", icon: "ti-news" }, { name: "World", value: "world", icon: "ti-world" },
  { name: "Politics", value: "politics", icon: "ti-building-bank" }, { name: "Business", value: "business", icon: "ti-chart-line" },
  { name: "Technology", value: "technology", icon: "ti-cpu" }, { name: "Sport", value: "sport", icon: "ti-ball-football" },
  { name: "Culture", value: "culture", icon: "ti-palette" }, { name: "Science", value: "science", icon: "ti-flask" },
  { name: "Environment", value: "environment", icon: "ti-leaf" }
];
const CATEGORY_COLORS = { "": "#e8344a", world: "#4da3ff", politics: "#b388ff", business: "#34d399", technology: "#22d3ee", sport: "#fb923c", culture: "#f472b6", science: "#facc15", environment: "#84cc16" };

const state = { query: "", category: "", sort: "newest", page: 1, totalPages: 1, viewMode: "feed", saved: {}, savedOrder: [], firstSeenId: null, liveOn: true, requestToken: 0 };

const el = Object.fromEntries(
  ["categoryBox", "savedToggle", "savedCount", "searchForm", "searchInput", "clearSearch", "sortSelect", "statusText", "heroSlot", "newsGrid", "pagination", "newBanner", "refreshBtn", "liveToggle", "tickerContent", "clockTime", "clockDate", "modalOverlay", "modalInner", "modalClose", "toast", "toastText"]
  .map(id => [id, document.getElementById(id)])
);

const escapeHtml = str => !str ? "" : String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const stripTags = html => !html ? "" : html.replace(/<[^>]*>?/gm, "").trim();
const formatDate = iso => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const catColor = sec => CATEGORY_COLORS[sec] || CATEGORY_COLORS[""];
const catName = val => (CATEGORIES.find(c => c.value === val) || { name: val || "Wire" }).name;
const isSaved = id => !!state.saved[id];

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
function tickClock() {
  const now = new Date();
  el.clockTime.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  el.clockDate.textContent = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function renderSavedToggle() {
  el.savedToggle.classList.toggle("active", state.viewMode === "saved");
  el.savedCount.textContent = state.savedOrder.length;
}

function refreshSaveButtons() {
  document.querySelectorAll("[data-save]").forEach(btn => {
    const saved = isSaved(btn.getAttribute("data-save"));
    btn.classList.toggle("saved", saved);
    if (btn.querySelector("i")) btn.querySelector("i").className = `ti ti-bookmark${saved ? "-filled" : ""}`;
  });
}

function showToast(msg, icon) {
  el.toastText.textContent = msg;
  el.toast.querySelector("i").className = `ti ${icon || "ti-bookmark-filled"}`;
  el.toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}

const getImgHtml = img => img ? `<img src="${img}" alt="" loading="lazy">` : `<div class="card-placeholder" style="height:100%"><i class="ti ti-photo"></i></div>`;

function heroTemplate(a) {
  return `<div class="hero" style="--cat-color:${catColor(a.section)}">
    <div class="hero-img-wrap" data-open="${a.id}">${getImgHtml(a.img)}<span class="hero-tag">Top Story</span></div>
    <div class="hero-body">
      <div class="hero-meta"><span class="dot"></span><span class="section-label">${escapeHtml(a.sectionName)}</span><span>·</span><span>${formatDate(a.date)}</span></div>
      <div class="hero-title serif" data-open="${a.id}" style="cursor:pointer">${escapeHtml(a.title)}</div>
      <p class="hero-desc">${escapeHtml(a.desc || "Tap to read the full story from the wire.")}</p>
      <div class="hero-actions">
        <button class="btn-primary" data-open="${a.id}"><i class="ti ti-news"></i> Read story</button>
        <button class="save-btn ${isSaved(a.id) ? "saved" : ""}" data-save="${a.id}" aria-label="Save story"><i class="ti ti-bookmark${isSaved(a.id) ? "-filled" : ""}"></i></button>
      </div>
    </div>
  </div>`;
}

function cardTemplate(a) {
  return `<div class="card" style="--cat-color:${catColor(a.section)}">
    <div class="card-img-wrap" data-open="${a.id}">${a.img ? `<img src="${a.img}" alt="" loading="lazy">` : '<div class="card-placeholder"><i class="ti ti-photo"></i></div>'}<button class="card-save ${isSaved(a.id) ? "saved" : ""}" data-save="${a.id}" aria-label="Save story"><i class="ti ti-bookmark${isSaved(a.id) ? "-filled" : ""}"></i></button></div>
    <div class="perforation"></div>
    <div class="card-body" data-open="${a.id}">
      <div class="card-meta"><span class="tag"><span class="dot"></span>${escapeHtml(a.sectionName)}</span><span>${formatDate(a.date)}</span></div>
      <div class="card-title serif">${escapeHtml(a.title)}</div>
      <p class="card-desc">${escapeHtml(a.desc)}</p>
    </div>
    <div class="card-foot" style="padding:0 16px 14px;"><a class="read-link" data-open="${a.id}">Read story <i class="ti ti-arrow-up-right"></i></a></div>
  </div>`;
}

function toggleSave(a) {
  if (!a) return;
  if (state.saved[a.id]) {
    delete state.saved[a.id];
    state.savedOrder = state.savedOrder.filter(id => id !== a.id);
    showToast("Removed from saved stories", "ti-bookmark");
  } else {
    state.saved[a.id] = a;
    state.savedOrder.unshift(a.id);
    showToast("Saved to read later", "ti-bookmark-filled");
  }
  renderSavedToggle();
  if (state.viewMode === "saved") renderSavedView(); else refreshSaveButtons();
}

function renderSavedView() {
  el.heroSlot.innerHTML = el.pagination.innerHTML = "";
  if (!state.savedOrder.length) {
    el.statusText.textContent = "Nothing saved yet";
    el.newsGrid.innerHTML = '<div class="message"><i class="ti ti-bookmark"></i><h2>No saved stories</h2><p>Tap the bookmark icon on any story to keep it here.</p></div>';
    return;
  }
  el.statusText.textContent = `${state.savedOrder.length} stor${state.savedOrder.length === 1 ? "y" : "ies"} saved for later`;
  const lookup = {};
  el.newsGrid.innerHTML = state.savedOrder.map(id => { lookup[id] = state.saved[id]; return cardTemplate(state.saved[id]); }).join("");
  wireUpCards(el.newsGrid, lookup);
}
document.querySelectorAll(".theme-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const theme = btn.getAttribute("data-theme-btn");
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".theme-btn").forEach(b => {
      const active = b.getAttribute("data-theme-btn") === theme;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active);
    });
  });
});

function renderCategories() {
  el.categoryBox.innerHTML = CATEGORIES.map(cat => {
    const active = cat.value === state.category && state.viewMode === "feed" ? "active" : "";
    return `<button class="cat-btn ${active}" style="--cat-color:${catColor(cat.value)}" data-cat="${cat.value}"><i class="ti ${cat.icon}"></i><span>${cat.name}</span></button>`;
  }).join("");

  el.categoryBox.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.category = btn.getAttribute("data-cat");
      state.query = ""; state.viewMode = "feed"; state.page = 1;
      el.searchInput.value = ""; el.clearSearch.hidden = true;
      renderCategories(); renderSavedToggle(); fetchFeed();
    });
  });
}

function wireUpCards(container, lookup) {
  container.querySelectorAll("[data-save]").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); toggleSave(lookup[btn.getAttribute("data-save")]); }));
  container.querySelectorAll("[data-open]").forEach(node => node.addEventListener("click", () => openModal(lookup[node.getAttribute("data-open")])));
}

async function fetchTicker() {
  try {
    const res = await fetch(`${SEARCH_URL}?api-key=${API_KEY}&order-by=newest&page-size=10`);
    const data = await res.json();
    if (data?.response?.status !== "ok") return;
    const items = data.response.results || [];
    if (!items.length) return;
    
    el.tickerContent.innerHTML = [...items, ...items].map(a => 
      `<span class="seg">${escapeHtml(a.sectionName)} — ${escapeHtml(a.webTitle)}</span>`
    ).join("") + '<span class="ticker-cursor"></span>';
  } catch {
    el.tickerContent.textContent = "Wire temporarily quiet — reconnecting…";
  }
}

async function openModal(a) {
  if (!a) return;
  el.modalInner.innerHTML = `${a.img ? `<img class="modal-img" src="${a.img}" alt="">` : ""}<div class="modal-content">
    <div class="modal-meta" style="--cat-color:${catColor(a.section)}"><span class="dot"></span><span style="color:var(--cat-color)">${escapeHtml(a.sectionName)}</span><span>·</span><span>${formatDate(a.date)}</span>${a.byline ? `<span>·</span><span>${escapeHtml(a.byline)}</span>` : ""}</div>
    <h2 class="modal-title serif">${escapeHtml(a.title)}</h2>
    <div class="modal-body-text" id="modalBodyText"><div class="modal-loading"><div class="skel-line" style="width:95%"></div><div class="skel-line" style="width:88%"></div><div class="skel-line" style="width:60%"></div></div></div>
    <div class="modal-footer"><a class="modal-original" href="${a.url}" target="_blank" rel="noopener">Open on theguardian.com <i class="ti ti-external-link"></i></a><button class="save-btn ${isSaved(a.id) ? "saved" : ""}" data-save="${a.id}" aria-label="Save story"><i class="ti ti-bookmark${isSaved(a.id) ? "-filled" : ""}"></i></button></div>
  </div>`;

  el.modalInner.querySelector("[data-save]").addEventListener("click", () => {
    toggleSave(a); refreshSaveButtons();
    const btn = el.modalInner.querySelector("[data-save]"), saved = isSaved(a.id);
    btn.classList.toggle("saved", saved); btn.querySelector("i").className = `ti ti-bookmark${saved ? "-filled" : ""}`;
  });

  el.modalOverlay.hidden = false; document.body.style.overflow = "hidden";
  const myToken = ++state.requestToken;

  try {
    const res = await fetch(`https://content.guardianapis.com/${a.id}?api-key=${API_KEY}&show-fields=bodyText,trailText`);
    const data = await res.json();
    if (myToken !== state.requestToken) return;
    const body = data?.response?.content?.fields?.bodyText;
    const holder = document.getElementById("modalBodyText");
    if (holder) holder.innerHTML = body?.trim() ? body.split(/\n+/).slice(0, 14).map(p => `<p>${escapeHtml(p)}</p>`).join("") : `<p>${escapeHtml(a.desc || "A full preview isn't available...")}</p>`;
  } catch {
    if (myToken === state.requestToken && document.getElementById("modalBodyText")) document.getElementById("modalBodyText").innerHTML = `<p>${escapeHtml(a.desc || "Couldn't load the full story right now.")}</p>`;
  }
}

const closeModal = () => { el.modalOverlay.hidden = true; document.body.style.overflow = ""; state.requestToken++; };
el.modalClose.addEventListener("click", closeModal);
el.modalOverlay.addEventListener("click", e => e.target === el.modalOverlay && closeModal());
document.addEventListener("keydown", e => e.key === "Escape" && !el.modalOverlay.hidden && closeModal());

async function fetchFeed() {
  state.viewMode = "feed"; renderSavedToggle(); renderCategories(); el.newBanner.hidden = true; el.statusText.textContent = "Searching the wire…";
  el.newsGrid.innerHTML = Array.from({ length: PAGE_SIZE }, () => '<div class="skel-card"><div class="skel-img"></div><div class="skel-line w40"></div><div class="skel-line w90"></div><div class="skel-line w60"></div></div>').join("");
  el.heroSlot.innerHTML = el.pagination.innerHTML = "";

  const myToken = ++state.requestToken;
  let url = `${SEARCH_URL}?api-key=${API_KEY}&show-fields=thumbnail,trailText,byline&page-size=${PAGE_SIZE}&page=${state.page}&order-by=${state.sort}`;
  if (state.query) url += `&q=${encodeURIComponent(state.query)}`;
  if (state.category) url += `&section=${state.category}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (myToken !== state.requestToken) return;
    if (data?.response?.status !== "ok") throw new Error();
    
    const resp = data.response, results = resp.results || [];
    state.totalPages = resp.pages || 1;

    if (!results.length) {
      el.statusText.textContent = "";
      el.newsGrid.innerHTML = '<div class="message"><i class="ti ti-search"></i><h2>No stories matched</h2><p>Try a different search term.</p></div>';
      return;
    }

    const articles = results.map(a => ({ id: a.id, section: a.sectionId || "", sectionName: a.sectionName || catName(a.sectionId), title: a.webTitle || "Untitled story", desc: a.fields?.trailText ? stripTags(a.fields.trailText) : "", img: a.fields?.thumbnail || "", byline: a.fields?.byline || "", date: a.webPublicationDate, url: a.webUrl }));
    if (state.page === 1) state.firstSeenId = articles[0].id;
    el.statusText.textContent = `Showing ${articles.length} of about ${resp.total} stories`;

    const lookup = {}, showHero = state.page === 1, gridArticles = showHero ? articles.slice(1) : articles;
    if (showHero) { lookup[articles[0].id] = articles[0]; el.heroSlot.innerHTML = heroTemplate(articles[0]); wireUpCards(el.heroSlot, lookup); }
    
    el.newsGrid.innerHTML = gridArticles.map(a => { lookup[a.id] = a; return cardTemplate(a); }).join("");
    wireUpCards(el.newsGrid, lookup);

    if (state.totalPages > 1) {
      el.pagination.innerHTML = `<button class="page-btn" id="prevPage" ${state.page <= 1 ? "disabled" : ""}><i class="ti ti-chevron-left"></i></button><span class="page-info">Page ${state.page} of ${state.totalPages}</span><button class="page-btn" id="nextPage" ${state.page >= state.totalPages ? "disabled" : ""}><i class="ti ti-chevron-right"></i></button>`;
      document.getElementById("prevPage")?.addEventListener("click", () => { state.page--; fetchFeed(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      document.getElementById("nextPage")?.addEventListener("click", () => { state.page++; fetchFeed(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    }
  } catch {
    if (myToken !== state.requestToken) return;
    el.statusText.textContent = "Connection Refused";
    el.newsGrid.innerHTML = '<div class="message"><i class="ti ti-plug-connected-x"></i><h2>API Rate Limit Hit</h2><button class="retry-btn" id="retryBtn">Try again</button></div>';
    document.getElementById("retryBtn")?.addEventListener("click", fetchFeed);
  }
}

async function checkForNewStories() {
  if (!state.liveOn || state.viewMode !== "feed" || state.page !== 1) return;
  let url = `${SEARCH_URL}?api-key=${API_KEY}&page-size=1&order-by=${state.sort}`;
  if (state.query) url += `&q=${encodeURIComponent(state.query)}`;
  if (state.category) url += `&section=${state.category}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.response?.results?.[0]?.id !== state.firstSeenId) el.newBanner.hidden = false;
  } catch {}
}

const runSearch = val => { if (val === "" && state.query === "" && state.viewMode === "feed") return; state.query = val; state.category = ""; state.viewMode = "feed"; state.page = 1; renderCategories(); renderSavedToggle(); fetchFeed(); };
const debouncedSearch = debounce(val => runSearch(val), 450);

el.searchForm.addEventListener("submit", e => { e.preventDefault(); runSearch(el.searchInput.value.trim()); });
el.searchInput.addEventListener("input", () => { el.clearSearch.hidden = !el.searchInput.value.length; debouncedSearch(el.searchInput.value.trim()); });
el.clearSearch.addEventListener("click", () => { el.searchInput.value = ""; el.clearSearch.hidden = true; runSearch(""); });
el.sortSelect.addEventListener("change", () => { state.sort = el.sortSelect.value; state.page = 1; if (state.viewMode === "feed") fetchFeed(); });
el.liveToggle.addEventListener("change", () => state.liveOn = el.liveToggle.checked);
el.refreshBtn.addEventListener("click", () => { el.newBanner.hidden = true; state.page = 1; fetchFeed(); });
el.savedToggle.addEventListener("click", () => { state.viewMode = state.viewMode === "saved" ? "feed" : "saved"; renderSavedToggle(); renderCategories(); if (state.viewMode === "saved") { el.statusText.textContent = ""; renderSavedView(); } else fetchFeed(); });

// Initialization Setup
renderCategories(); renderSavedToggle(); tickClock(); fetchTicker(); fetchFeed();
setInterval(tickClock, 30000); setInterval(fetchTicker, 180000); setInterval(checkForNewStories, 75000);
