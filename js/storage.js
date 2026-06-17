"use strict";
//==================================================================
// storage.js — persistence for a LIBRARY of timetables.
// Each timetable is stored independently under "ttabler_tt_<id>" and
// carries its own id / name / createdAt / updatedAt. The landing page
// (library.js) lists them; the editor loads/saves one at a time.
//
//   library:  listTimetables, loadTimetable, writeTimetable,
//             createTimetable, duplicateTimetable, deleteTimetable,
//             newId, migrateOldIfNeeded
//   editor:   save (autosave), load (from URL), encodeState,
//             readFromUrl, exportFile, importFile
//==================================================================

const TT_PREFIX = "ttabler_tt_";
const OLD_SINGLE_KEY = "ttabler_state_v1"; // pre-library single timetable

function newId() {
  return "tt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

// ---------- Library (collection) operations ----------
function listTimetables() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(TT_PREFIX)) {
      try { out.push(JSON.parse(localStorage.getItem(k))); } catch(e){}
    }
  }
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

function loadTimetable(id) {
  try { const raw = localStorage.getItem(TT_PREFIX + id); return raw ? JSON.parse(raw) : null; }
  catch(e) { return null; }
}

function writeTimetable(s) {
  s.updatedAt = Date.now();
  try { localStorage.setItem(TT_PREFIX + s.id, JSON.stringify(s)); } catch(e){}
}

function createTimetable(name, seed) {
  const s = seed || blankState();
  s.id = newId();
  s.name = name || "Untitled timetable";
  s.createdAt = Date.now();
  writeTimetable(s);
  return s;
}

function duplicateTimetable(id) {
  const s = loadTimetable(id); if (!s) return null;
  const copy = JSON.parse(JSON.stringify(s));
  copy.id = newId();
  copy.name = (s.name || "Untitled") + " (copy)";
  copy.createdAt = Date.now();
  writeTimetable(copy);
  return copy;
}

function deleteTimetable(id) { localStorage.removeItem(TT_PREFIX + id); }

// One-time: fold the old single-timetable app into the new library.
function migrateOldIfNeeded() {
  if (listTimetables().length) return;
  try {
    const raw = localStorage.getItem(OLD_SINGLE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      createTimetable(s.name || "My timetable", s);
      localStorage.removeItem(OLD_SINGLE_KEY);
    }
  } catch(e){}
}

// ---------- Editor: current-timetable persistence ----------
// Autosave, debounced. Called after every edit/drag; on a big board writing
// the whole JSON each time is wasteful, so coalesce rapid changes and flush
// before the page goes away. No-op until the open timetable has an id (e.g. a
// shared link not yet saved into the library — see app.js saveExplicit).
let _saveTimer = null;
function save() {
  if (!state || !state.id) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { _saveTimer = null; writeTimetable(state); }, 250);
}
function flushSave() {
  if (!_saveTimer) return;
  clearTimeout(_saveTimer); _saveTimer = null;
  if (state && state.id) writeTimetable(state);
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);
}

// Editor entry: load the timetable named by the URL.
//   #tt=<base64>  → a shared timetable (imported, unsaved until Save)
//   #id=<id>      → one of your own timetables
// Anything else → back to the library.
function load() {
  const h = location.hash || "";
  if (h.startsWith("#tt=")) {
    const s = readFromUrl();
    if (s) { delete s.id; setState(s); return; } // unsaved until the user Saves
  }
  const m = h.match(/#id=([^&]+)/);
  if (m) {
    const s = loadTimetable(decodeURIComponent(m[1]));
    if (s) { setState(s); return; }
  }
  location.replace("index.html"); // nothing valid to open
}

// ---------- Share link encode/decode + file I/O ----------
function encodeState() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function readFromUrl() {
  const h = location.hash;
  if (!h.startsWith("#tt=")) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(h.slice(4))))); }
  catch(e) { return null; }
}

function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = (state.name || "timetable").replace(/[^\w.-]+/g, "_") + ".json";
  a.click(); URL.revokeObjectURL(a.href);
}

// Replace THIS timetable's contents from a file (keeps its id + name).
function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      incoming.id = state.id; incoming.name = state.name;
      setState(incoming); save(); boot(); toast("Imported into this timetable");
    } catch(e) { toast("Couldn't read that file"); }
  };
  reader.readAsText(file);
}
