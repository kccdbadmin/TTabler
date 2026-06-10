"use strict";
//==================================================================
// storage.js — persistence: localStorage, URL-hash decode, file I/O.
// (Building the share URL lives in share.js; this file only reads/writes.)
//   LS_KEY, save, load, encodeState, readFromUrl, exportFile, importFile
//==================================================================

const LS_KEY = "ttabler_state_v1";

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
}

function load() {
  // priority: URL hash > localStorage > demo
  const fromUrl = readFromUrl();
  if (fromUrl) { setState(fromUrl); toast("Loaded timetable from link"); save(); return; }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { setState(JSON.parse(raw)); return; }
  } catch(e){}
  setState(demoState());
}

// URL share: base64(JSON) in the hash. (Compact enough for typical school sizes.)
function encodeState() {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

function readFromUrl() {
  const h = location.hash;
  if (!h.startsWith("#tt=")) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(h.slice(4))))); }
  catch(e){ return null; }
}

function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "timetable.json"; a.click(); URL.revokeObjectURL(a.href);
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { setState(JSON.parse(reader.result)); save(); boot(); toast("Imported"); }
    catch(e){ toast("Couldn't read that file"); }
  };
  reader.readAsText(file);
}
