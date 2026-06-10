"use strict";
//==================================================================
// grid.js — the timetable view: toolbar controls, the grid table,
// the unplaced tray, and the stats badges. `render()` is the central
// redraw that every other module calls after changing data.
//   render, refreshViews, renderViewControls, assignmentMatchesView,
//   cardHTML, renderGrid, renderTray, renderStats
//==================================================================

function refreshViews() { renderViewControls(); render(); }

function renderViewControls() {
  $("#view-mode").value = state.ui.mode;
  const sel = $("#view-entity"); sel.innerHTML = "";
  const list = entitiesForMode(state.ui.mode);
  list.forEach(e => { const o = document.createElement("option"); o.value = e.id; o.textContent = e.name; sel.appendChild(o); });
  if (!list.find(e => e.id === state.ui.entity)) state.ui.entity = list.length ? list[0].id : null;
  sel.value = state.ui.entity || "";
}

// which assignments are visible in the current view
function assignmentMatchesView(a) {
  const l = byId(state.lessons, a.lessonId); if (!l) return false;
  if (state.ui.mode === "class")   return l.classId === state.ui.entity;
  if (state.ui.mode === "teacher") return l.teacherId === state.ui.entity;
  if (state.ui.mode === "room")    return l.roomId === state.ui.entity;
  return false;
}

// The central redraw. Recomputes conflicts, then paints everything.
function render() {
  conflicts = computeConflicts();
  const overview = !!(state.ui && state.ui.overview);
  document.body.classList.toggle("overview-on", overview);
  const ob = $("#btn-overview"); if (ob) ob.classList.toggle("active", overview);
  if (overview) {
    renderOverview();
  } else {
    renderViewControls();
    renderGrid();
  }
  renderTray();
  renderStats();
}

// All-classes overview: a dense, read-only grid — classes down the side,
// day×period across the top — for eyeballing the whole school and spotting
// clashes at a glance. Editing happens in the per-entity view (drag/drop).
function renderOverview() {
  const wrap = $("#grid-wrap");
  if (!state.classes.length) { wrap.innerHTML = `<div class="empty-state">No classes yet. Add some from the toolbar.</div>`; return; }
  const D = state.days.length, P = state.periods.length;
  const byClass = {}; // classId -> "day|period" -> [assignment]
  state.assignments.forEach(a => {
    if (a.day == null) return;
    const l = byId(state.lessons, a.lessonId); if (!l || !l.classId) return;
    const m = byClass[l.classId] = byClass[l.classId] || {};
    (m[a.day + "|" + a.period] = m[a.day + "|" + a.period] || []).push(a);
  });

  let html = `<table class="tt overview"><thead><tr><th class="ov-corner" rowspan="2">Class</th>`;
  state.days.forEach(d => html += `<th class="day-h" colspan="${P}">${escapeHtml(d)}</th>`);
  html += `</tr><tr>`;
  state.days.forEach(() => state.periods.forEach(p => html += `<th class="per-h">${escapeHtml(p)}</th>`));
  html += `</tr></thead><tbody>`;
  state.classes.forEach(c => {
    html += `<tr><th class="cls-h">${escapeHtml(c.name)}</th>`;
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
      const cards = ((byClass[c.id] || {})[d + "|" + p] || []).map(ovCardHTML).join("");
      html += `<td class="ov-cell">${cards}</td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

function ovCardHTML(a) {
  const info = lessonInfo(a.lessonId); if (!info) return "";
  const bg = info.subject ? safeColor(info.subject.color) : "#888";
  const fg = textOn(bg);
  const short = info.subject ? (info.subject.short || info.subject.name) : "?";
  const conf = conflicts.has(a.id) ? " conflict" : "";
  const detail = `${info.subject ? info.subject.name : '?'} — ${info.teacher ? info.teacher.name : '—'}`;
  const title = conf ? clashTitle(a.id) + " · " + detail : detail;
  return `<span class="ov-card${conf}" style="background:${bg};color:${fg}" title="${escapeHtml(title)}">${escapeHtml(short).slice(0,5)}</span>`;
}

function cardHTML(a) {
  const info = lessonInfo(a.lessonId); if (!info) return "";
  const bg = info.subject ? safeColor(info.subject.color) : "#888";
  const fg = textOn(bg);
  // what meta to show depends on view
  let line2;
  if (state.ui.mode === "class")        line2 = `${info.teacher?escapeHtml(info.teacher.name):'—'} · ${info.room?escapeHtml(info.room.name):'—'}`;
  else if (state.ui.mode === "teacher") line2 = `${info.cls?escapeHtml(info.cls.name):'—'} · ${info.room?escapeHtml(info.room.name):'—'}`;
  else                                  line2 = `${info.cls?escapeHtml(info.cls.name):'—'} · ${info.teacher?escapeHtml(info.teacher.name):'—'}`;
  if (info.lesson.group) line2 += ` · ${escapeHtml(info.lesson.group.name)}`;
  const conf = conflicts.has(a.id) ? " conflict" : "";
  const placed = a.day != null;
  const locked = placed && a.locked;
  // lock toggle only on placed cards; locked cards can't be dragged (or auto-moved)
  const lockBtn = placed
    ? `<span class="lock" data-lock="${a.id}" title="${locked?'Locked — Generate and Clear won’t touch it. Click to unlock.':'Click to lock in place'}">${locked?'🔒':'🔓'}</span>`
    : "";
  return `<div class="card${conf}${locked?' locked':''}" style="background:${bg};color:${fg}" draggable="${locked?'false':'true'}" data-aid="${a.id}" title="${escapeHtml(clashTitle(a.id))}">
    ${lockBtn}
    <span class="c-sub">${info.subject?escapeHtml(info.subject.name):'?'}</span>
    <span class="c-meta">${line2}</span>
  </div>`;
}

function renderGrid() {
  const wrap = $("#grid-wrap");
  const list = entitiesForMode(state.ui.mode);
  if (!list.length) { wrap.innerHTML = `<div class="empty-state">No ${state.ui.mode}s yet. Add some in the sidebar.</div>`; return; }
  if (!state.ui.entity) { wrap.innerHTML = `<div class="empty-state">Select one to view.</div>`; return; }

  // map slot -> assignment(s) visible in view
  const grid = {};
  state.assignments.forEach(a => {
    if (a.day == null) return;
    if (!assignmentMatchesView(a)) return;
    (grid[a.day + "|" + a.period] = grid[a.day + "|" + a.period] || []).push(a);
  });

  // slots where the viewed entity is marked unavailable (time-off)
  const offSet = new Set((currentEntity() || {}).off || []);

  let html = `<table class="tt"><thead><tr><th></th>`;
  state.days.forEach(d => html += `<th>${escapeHtml(d)}</th>`);
  html += `</tr></thead><tbody>`;
  state.periods.forEach((p, pi) => {
    html += `<tr><th>${escapeHtml(p)}</th>`;
    state.days.forEach((d, di) => {
      const cards = (grid[di + "|" + pi] || []).map(cardHTML).join("");
      const off = offSet.has(di + "|" + pi) ? " off" : "";
      html += `<td class="cell${off}" data-day="${di}" data-period="${pi}"><div class="cell-cards">${cards}</div></td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
  attachDnD();
  attachCardTools();
  if (timeOffMode) attachTimeOff();
}

// ---- card lock toggle ------------------------------------------------------
function toggleLock(aid) {
  const a = byId(state.assignments, aid);
  if (!a || a.day == null) return;
  a.locked = !a.locked; save(); render();
}
function attachCardTools() {
  document.querySelectorAll(".card .lock").forEach(el => {
    el.addEventListener("mousedown", e => e.stopPropagation()); // don't start a drag
    el.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); toggleLock(el.dataset.lock); });
  });
}

// ---- time-off paint mode ---------------------------------------------------
// When on, clicking a cell toggles availability for the VIEWED entity.
let timeOffMode = false;
function toggleTimeOffMode() {
  timeOffMode = !timeOffMode;
  $("#btn-timeoff").classList.toggle("active", timeOffMode);
  document.body.classList.toggle("timeoff-mode", timeOffMode);
  render();
}
function attachTimeOff() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const e = currentEntity(); if (!e) return;
      e.off = e.off || [];
      const key = cell.dataset.day + "|" + cell.dataset.period;
      const i = e.off.indexOf(key);
      if (i >= 0) e.off.splice(i, 1); else e.off.push(key);
      save(); render();
    });
  });
}

function renderTray() {
  const overview = !!(state.ui && state.ui.overview);
  const cards = state.assignments.filter(a => a.day == null && (overview || assignmentMatchesView(a)));
  $("#tray-cards").innerHTML = cards.map(cardHTML).join("");
  $("#tray-count").textContent = cards.length ? `${cards.length}${overview ? " unplaced" : " for this view"}` : "all placed ✓";
  attachDnD();
  attachCardTools();
}

function renderStats() {
  const placed = state.assignments.filter(a => a.day != null).length;
  const total = state.assignments.length;
  $("#stat-placed").textContent = placed;
  $("#stat-total").textContent = total;
  const badge = $("#stat-conflicts");
  if (conflicts.size === 0) { badge.className = "badge ok"; badge.textContent = "No conflicts"; }
  else { badge.className = "badge bad"; badge.textContent = `${conflicts.size} in conflict`; }
}
