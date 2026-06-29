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
