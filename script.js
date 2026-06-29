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

// ==========================================
// BLOCK 2: UI TEMPLATES & COMPONENTS
// ==========================================
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