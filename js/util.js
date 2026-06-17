"use strict";
//==================================================================
// util.js — tiny shared helpers used everywhere.
// Loaded first. Everything here is global (plain <script>, shared scope).
//   $, uid, toast, textOn, escapeHtml, PALETTE
//==================================================================

// console debug handle: inspect/poke the app from devtools via `TT`
window.TT = window.TT || {};

const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// Readable text colour (black/white) for a given background hex
function textOn(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
  return (r*299 + g*587 + b*114)/1000 > 140 ? "#0b0f14" : "#ffffff";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

const PALETTE = ["#4f9cf9","#f6c453","#3ddc97","#f97066","#b692f6","#fda4af","#7dd3fc","#fbbf24","#86efac","#fca5a5","#c4b5fd","#67e8f9"];

// Whitelist a colour before it goes into a style attribute or input value.
// Stored data (shared #tt= links, imported JSON/XML) is UNTRUSTED — a value
// like `#fff"><img src=x onerror=...>` would otherwise break out of the
// attribute and run as HTML. Only plain hex colours are allowed through.
function safeColor(c, fallback = "#888") {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : fallback;
}
