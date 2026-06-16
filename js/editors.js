"use strict";
//==================================================================
// editors.js — the sidebar data editors (the tabbed panels where you
// add/rename/remove classes, teachers, subjects, rooms and lessons,
// and set days/periods).
//   renderTabs, renderTabBody, removeEntity (+ per-tab renderers)
//==================================================================

const TABS = ["Lessons","Classes","Teachers","Subjects","Rooms","Time"];
let activeTab = "Lessons";

// Toolbar buttons that open the data editor drawer. One per data type, so each
// section is one click away while the grid keeps the full width.
function renderDataButtons() {
  const el = $("#data-buttons"); if (!el) return;
  // entity counts shown as a badge on the button (live: re-rendered each draw)
  const counts = { Classes: state.classes.length, Teachers: state.teachers.length, Subjects: state.subjects.length };
  el.innerHTML = "";
  TABS.forEach(t => {
    const b = document.createElement("button");
    b.className = "ghost data-btn";
    b.dataset.tab = t;
    b.innerHTML = escapeHtml(t) + (t in counts ? ` <span class="count-badge">${counts[t]}</span>` : "");
    b.classList.toggle("active", t === activeTab && $("#drawer").classList.contains("open"));
    b.onclick = () => openDataEditor(t);
    el.appendChild(b);
  });
}

function openDataEditor(tab) {
  activeTab = tab || activeTab;
  renderTabs(); renderTabBody();
  $("#drawer").classList.add("open");
  $("#drawer-backdrop").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#data-buttons").querySelectorAll(".data-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === activeTab));
}

function closeDataEditor() {
  $("#drawer").classList.remove("open");
  $("#drawer-backdrop").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#data-buttons").querySelectorAll(".data-btn").forEach(b => b.classList.remove("active"));
}

// Teaching load for an entity = total periods/week across the lessons that
// reference it (sum of lesson.count). Shown as a badge in the data lists.
function entityLoad(field, id) {
  let periods = 0;
  for (const l of state.lessons) if (l[field] === id) periods += (l.count || 0);
  return periods;
}

// ---- list sorting (Name / Load), shared by the entity tabs ----
// "manual" keeps the stored order until the user clicks a sort header.
let entitySort = { key: "manual", dir: 1 };
function sortedEntities(list, field) {
  if (entitySort.key === "manual") return list;
  const copy = [...list];
  copy.sort((a, b) => {
    let va, vb;
    if (entitySort.key === "load") { va = entityLoad(field, a.id); vb = entityLoad(field, b.id); }
    else { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
    return (va < vb ? -1 : va > vb ? 1 : 0) * entitySort.dir;
  });
  return copy;
}
function sortBarHTML() {
  const ind = k => entitySort.key === k ? `<span class="dir">${entitySort.dir > 0 ? "▲" : "▼"}</span>` : "";
  const cls = k => "sort-btn" + (entitySort.key === k ? " active" : "");
  return `<div class="sort-bar"><span class="sb-label">Sort</span>
    <button class="${cls('name')}" data-sort="name">Name ${ind('name')}</button>
    <button class="${cls('load')}" data-sort="load">Load ${ind('load')}</button></div>`;
}
function bindSortBar(el) {
  el.querySelectorAll(".sort-bar .sort-btn").forEach(b => b.onclick = () => {
    const k = b.dataset.sort;
    if (entitySort.key === k) entitySort.dir *= -1;        // toggle direction
    else entitySort = { key: k, dir: k === "load" ? -1 : 1 }; // load defaults heaviest-first
    renderTabBody();
  });
}

// Focus the grid on a single entity and show every card related to it
// (aSc-style drill-in). Leaves the overview and closes the drawer.
function viewEntity(mode, id) {
  state.ui.mode = mode;
  state.ui.entity = id;
  state.ui.overview = false;
  save();
  closeDataEditor();
  refreshViews();
}

function renderTabs() {
  const el = $("#tabs"); el.innerHTML = "";
  TABS.forEach(t => {
    const b = document.createElement("button");
    b.textContent = t; b.className = t === activeTab ? "active" : "";
    b.onclick = () => { activeTab = t; renderTabs(); renderTabBody(); };
    el.appendChild(b);
  });
}

function renderTabBody() {
  const el = $("#tab-body"); el.innerHTML = "";
  if (activeTab === "Lessons")  renderLessonsTab(el);
  if (activeTab === "Classes")  renderSimpleTab(el, "classes", "Classes", "e.g. 7A, 8B, Year 9");
  if (activeTab === "Teachers") renderSimpleTab(el, "teachers", "Teachers", "e.g. Mr Adams");
  if (activeTab === "Subjects") renderSubjectsTab(el);
  if (activeTab === "Rooms")    renderSimpleTab(el, "rooms", "Rooms", "e.g. Room 101, Lab, Gym");
  if (activeTab === "Time")     renderTimeTab(el);
}

function renderSimpleTab(el, key, title, placeholder) {
  const mode = { classes:"class", teachers:"teacher", rooms:"room" }[key];
  const field = { classes:"classId", teachers:"teacherId", rooms:"roomId" }[key];
  el.innerHTML = `<h3>${title}</h3><p class="hint">Small box = abbreviation · badge = periods/week (load). Click 👁 to see its timetable.</p>` + sortBarHTML();
  sortedEntities(state[key], field).forEach(item => {
    const load = entityLoad(field, item.id);
    const row = document.createElement("div"); row.className = "row-item";
    row.innerHTML = `<input class="label" value="${escapeHtml(item.name)}" style="background:transparent;border:none;padding:2px 0" />
                     <input class="abbr" value="${escapeHtml(item.short || '')}" placeholder="abbr" title="Abbreviation" />
                     <span class="load" title="${load} periods/week">${load}</span>
                     <span class="view-ent" title="Show this timetable">👁</span>
                     <span class="x">×</span>`;
    row.querySelector(".label").onchange = e => { item.name = e.target.value; save(); refreshViews(); };
    row.querySelector(".abbr").onchange = e => { item.short = e.target.value.trim(); save(); refreshViews(); };
    row.querySelector(".view-ent").onclick = () => viewEntity(mode, item.id);
    row.querySelector(".x").onclick = () => { removeEntity(key, item.id); };
    el.appendChild(row);
  });
  bindSortBar(el);
  const add = document.createElement("div"); add.className = "add-card";
  add.innerHTML = `<input id="new-name" placeholder="${placeholder}" /><button class="primary">+ Add</button>`;
  add.querySelector("button").onclick = () => {
    const v = add.querySelector("input").value.trim(); if (!v) return;
    state[key].push({ id: uid(), name: v }); save(); renderTabBody(); refreshViews();
  };
  add.querySelector("input").addEventListener("keydown", e => { if (e.key === "Enter") add.querySelector("button").click(); });
  el.appendChild(add);
}

function renderSubjectsTab(el) {
  el.innerHTML = `<h3>Subjects</h3><p class="hint">Small box = abbreviation · badge = periods/week (load). Colours show on the cards. Click 👁 to see every lesson.</p>` + sortBarHTML();
  sortedEntities(state.subjects, "subjectId").forEach(item => {
    const load = entityLoad("subjectId", item.id);
    const row = document.createElement("div"); row.className = "row-item";
    row.innerHTML = `<span class="swatch" style="background:${safeColor(item.color)}"></span>
      <input class="label" value="${escapeHtml(item.name)}" style="background:transparent;border:none;padding:2px 0" />
      <input class="abbr" value="${escapeHtml(item.short || '')}" placeholder="abbr" title="Abbreviation" />
      <input type="color" value="${safeColor(item.color)}" style="width:28px;height:24px;padding:1px" />
      <span class="load" title="${load} periods/week">${load}</span>
      <span class="view-ent" title="Show this subject's lessons">👁</span>
      <span class="x">×</span>`;
    row.querySelector(".label").onchange = e => { item.name = e.target.value; save(); refreshViews(); };
    row.querySelector(".abbr").onchange = e => { item.short = e.target.value.trim(); save(); refreshViews(); };
    row.querySelector('input[type=color]').oninput = e => { item.color = e.target.value; row.querySelector(".swatch").style.background = e.target.value; save(); render(); };
    row.querySelector(".view-ent").onclick = () => viewEntity("subject", item.id);
    row.querySelector(".x").onclick = () => removeEntity("subjects", item.id);
    el.appendChild(row);
  });
  bindSortBar(el);
  const add = document.createElement("div"); add.className = "add-card";
  add.innerHTML = `<input id="new-name" placeholder="e.g. Geography" /><button class="primary">+ Add subject</button>`;
  add.querySelector("button").onclick = () => {
    const v = add.querySelector("input").value.trim(); if (!v) return;
    state.subjects.push({ id: uid(), name: v, color: PALETTE[state.subjects.length % PALETTE.length] });
    save(); renderTabBody();
  };
  el.appendChild(add);
}

function renderLessonsTab(el) {
  el.innerHTML = `<h3>Lessons</h3><p class="hint">A lesson = a class studies a subject with a teacher, N periods/week. This is what gets scheduled.</p>`;
  if (!state.classes.length || !state.subjects.length) {
    el.innerHTML += `<p class="hint" style="color:var(--warn)">Add at least one class and subject first.</p>`;
  }
  state.lessons.forEach(l => {
    const info = lessonInfo(l.id);
    const row = document.createElement("div"); row.className = "row-item";
    const grp = l.group ? ` · <b>${escapeHtml(l.group.name)}</b>${l.group.division?` <span class="div-tag">${escapeHtml(l.group.division)}</span>`:''}` : "";
    row.innerHTML = `<span class="swatch" style="background:${info.subject?safeColor(info.subject.color):'#888'}"></span>
      <span class="label">${info.cls?escapeHtml(info.cls.name):'?'} · ${info.subject?escapeHtml(info.subject.name):'?'}
        <span class="sub">${info.teacher?escapeHtml(info.teacher.name):'—'} · ${info.room?escapeHtml(info.room.name):'—'} · ${l.count}/wk${grp}</span></span>
      <span class="grp-edit" title="Set group / division (lets two splits of a class share a slot)">👥</span>
      <span class="x">×</span>`;
    row.querySelector(".grp-edit").onclick = () => editGroup(l.id);
    row.querySelector(".x").onclick = () => {
      state.lessons = state.lessons.filter(x => x.id !== l.id);
      state.assignments = state.assignments.filter(a => a.lessonId !== l.id);
      save(); renderTabBody(); render();
    };
    el.appendChild(row);
  });

  const add = document.createElement("div"); add.className = "add-card";
  const opt = (arr, blank) => (blank?`<option value="">${blank}</option>`:"") + arr.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
  add.innerHTML = `
    <div class="form-grid">
      <div><label class="fld">Class</label><select id="nl-class">${opt(state.classes)}</select></div>
      <div><label class="fld">Subject</label><select id="nl-subject">${opt(state.subjects)}</select></div>
      <div><label class="fld">Teacher</label><select id="nl-teacher">${opt(state.teachers,"—")}</select></div>
      <div><label class="fld">Room</label><select id="nl-room">${opt(state.rooms,"—")}</select></div>
      <div><label class="fld">Periods / week</label><input id="nl-count" type="number" min="1" max="20" value="3" /></div>
    </div>
    <button class="primary">+ Add lesson</button>`;
  add.querySelector("button").onclick = () => {
    const classId = $("#nl-class").value, subjectId = $("#nl-subject").value;
    if (!classId || !subjectId) { toast("Pick a class and subject"); return; }
    const count = Math.max(1, parseInt($("#nl-count").value) || 1);
    const lesson = { id: uid(), classId, subjectId, teacherId: $("#nl-teacher").value || null, roomId: $("#nl-room").value || null, count };
    state.lessons.push(lesson);
    for (let i = 0; i < count; i++) state.assignments.push({ id: uid(), lessonId: lesson.id, day:null, period:null });
    save(); renderTabBody(); render();
  };
  el.appendChild(add);
}

// Set / change / clear a lesson's group + division. Two lessons of the same
// class in the same division but different groups (e.g. Boys vs Girls) are
// allowed to share a slot — see classSlotClash() in constraints.js.
function editGroup(lessonId) {
  const l = byId(state.lessons, lessonId); if (!l) return;
  const name = prompt("Group name (e.g. Boys, Girls, Set 1). Leave blank to clear:", l.group ? l.group.name : "");
  if (name === null) return;
  if (!name.trim()) { delete l.group; save(); renderTabBody(); render(); toast("Group cleared"); return; }
  const division = prompt("Division this group belongs to (e.g. Gender, Ability).\nGroups in the SAME division can share a time slot.", l.group ? l.group.division : "") || "";
  l.group = { name: name.trim(), division: division.trim() };
  save(); renderTabBody(); render(); toast("Group set");
}

function renderTimeTab(el) {
  el.innerHTML = `<h3>Days &amp; periods</h3><p class="hint">Comma-separated. Days are columns, periods are rows. Per-day counts let a day be shorter (e.g. Friday) — set how many of the periods above each day actually has.</p>
    <label class="fld">Days</label><input id="t-days" value="${escapeHtml(state.days.join(', '))}" />
    <label class="fld">Periods</label><input id="t-periods" value="${escapeHtml(state.periods.join(', '))}" />
    <label class="fld">Periods per day</label>
    <div class="ppd-grid" id="t-ppd">
      ${state.days.map((d, i) => `<div class="ppd-cell"><span>${escapeHtml(d)}</span><input type="number" min="0" max="${state.periods.length}" value="${periodsOnDay(i)}" data-day="${i}" /></div>`).join("")}
    </div>
    <p class="hint" style="margin-top:8px">Editing Days resets per-day counts to full — set Days first, Apply, then adjust per-day counts.</p>
    <button class="primary" id="t-save" style="width:100%;margin-top:8px">Apply</button>`;
  $("#t-save").onclick = () => {
    const days = $("#t-days").value.split(",").map(s=>s.trim()).filter(Boolean);
    const periods = $("#t-periods").value.split(",").map(s=>s.trim()).filter(Boolean);
    if (!days.length || !periods.length) { toast("Need at least one day and period"); return; }
    // per-day period counts — keep only if the day list is unchanged, else default to full
    let perDay = null;
    const sameDays = days.length === state.days.length && days.every((d, i) => d === state.days[i]);
    if (sameDays) {
      perDay = [...$("#t-ppd").querySelectorAll("input")].map(inp => {
        const n = parseInt(inp.value); return isNaN(n) ? periods.length : Math.max(0, Math.min(n, periods.length));
      });
    }
    state.days = days; state.periods = periods;
    state.periodsPerDay = perDay; // null => every day uses all periods
    // clamp existing placements to slots that still exist
    state.assignments.forEach(a => {
      if (a.day != null && (a.day >= days.length || a.period >= periods.length || !slotExists(a.day, a.period))) {
        a.day = null; a.period = null;
      }
    });
    save(); render(); toast("Time structure updated");
  };
}

function removeEntity(key, id) {
  state[key] = state[key].filter(x => x.id !== id);
  // cascade: remove lessons referencing it
  const field = { classes:"classId", teachers:"teacherId", subjects:"subjectId", rooms:"roomId" }[key];
  if (field) {
    const goneLessonIds = state.lessons.filter(l => l[field] === id).map(l => l.id);
    state.lessons = state.lessons.filter(l => l[field] !== id);
    state.assignments = state.assignments.filter(a => !goneLessonIds.includes(a.lessonId));
  }
  save(); renderTabBody(); render();
}
