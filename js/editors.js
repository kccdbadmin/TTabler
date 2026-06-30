"use strict";
//==================================================================
// editors.js — the data editor drawer (opened from the toolbar). Tabbed
// panels to add/rename/remove classes, teachers, subjects, rooms and lessons,
// edit per-class divisions/groups, set load caps, and set days/periods.
//   renderDataButtons, openDataEditor/closeDataEditor, renderTabs,
//   renderTabBody, renderSimpleTab/renderSubjectsTab/renderLessonsTab,
//   renderClassGroups, renderTimeTab, viewEntity, removeEntity
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

// Slots an entity can actually use = all existing slots minus its own time-off.
// Drives the fullness meter (load vs available).
function entityAvailable(key, id) {
  const e = byId(state[key], id);
  const off = (e && e.off) || [];
  let blocked = 0;
  for (const k of off) { const [d, p] = k.split("|").map(Number); if (slotExists(d, p)) blocked++; }
  return Math.max(0, totalSlots() - blocked);
}

// Set per-week / per-day ceilings on an entity (teacher/class/room).
function editCaps(key, id) {
  const e = byId(state[key], id); if (!e) return;
  const w = prompt("Max periods per WEEK for " + (e.name || "this") + " (blank = no limit):", e.maxWeek != null ? e.maxWeek : "");
  if (w === null) return;
  const d = prompt("Max periods per DAY (blank = no limit):", e.maxDay != null ? e.maxDay : "");
  if (d === null) return;
  e.maxWeek = w.trim() === "" ? null : Math.max(0, parseInt(w) || 0);
  e.maxDay  = d.trim() === "" ? null : Math.max(0, parseInt(d) || 0);
  save(); renderTabBody(); render();
}

// The load badge doubles as a fullness meter: fill = load ÷ periods in the
// week (built from the per-day period counts, so short days count for less).
// Red when load exceeds the ⚙ cap or the slots actually available (time-off).
function loadMeterHTML(key, field, item) {
  const load = entityLoad(field, item.id);
  const weekSlots = totalSlots();                 // how many periods there are in the week
  const avail = entityAvailable(key, item.id);    // minus this entity's own time-off
  const cap = item.maxWeek;
  const pct = Math.min(100, Math.round(load / (weekSlots || 1) * 100));
  const over = (cap != null && load > cap) || load > avail;
  const parts = [`${load} of ${weekSlots} periods this week (${pct}% full)`];
  if (avail < weekSlots) parts.push(`${avail} available after time-off`);
  if (cap != null) parts.push(`cap ${cap}/wk${item.maxDay != null ? `, ${item.maxDay}/day` : ""}`);
  return `<span class="load-meter${over ? " over" : ""}" style="--fill:${pct}%" title="${escapeHtml(parts.join(" · "))}">${load}${cap != null ? "/" + cap : ""}</span>`;
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
  if (activeTab === "Classes")  groupsEditClassId ? renderClassGroups(el, groupsEditClassId)
                                                   : renderSimpleTab(el, "classes", "Classes", "e.g. 7A, 8B, Year 9");
  if (activeTab === "Teachers") renderSimpleTab(el, "teachers", "Teachers", "e.g. Mr Adams");
  if (activeTab === "Subjects") renderSubjectsTab(el);
  if (activeTab === "Rooms")    renderSimpleTab(el, "rooms", "Rooms", "e.g. Room 101, Lab, Gym");
  if (activeTab === "Time")     renderTimeTab(el);
}

function renderSimpleTab(el, key, title, placeholder) {
  const mode = { classes:"class", teachers:"teacher", rooms:"room" }[key];
  const field = { classes:"classId", teachers:"teacherId", rooms:"roomId" }[key];
  el.innerHTML = `<h3>${title}</h3><p class="hint">Abbrev box · the badge is load (periods/week), filled to show how full the week is and red when over the ⚙ cap or available slots. Click 👁 to see its timetable.</p>` + sortBarHTML();
  sortedEntities(state[key], field).forEach(item => {
    const row = document.createElement("div"); row.className = "row-item";
    const groupCount = key === "classes" ? classGroupOptions(item.id).length : 0;
    const grpBtn = key === "classes" ? `<span class="grp-btn" title="Divisions / groups">⊞${groupCount ? `<b>${groupCount}</b>` : ""}</span>` : "";
    row.innerHTML = `<input class="label" value="${escapeHtml(item.name)}" style="background:transparent;border:none;padding:2px 0" />
                     <input class="abbr" value="${escapeHtml(item.short || '')}" placeholder="abbr" title="Abbreviation" />
                     ${loadMeterHTML(key, field, item)}
                     ${grpBtn}
                     <span class="cap-edit" title="Set max periods per week / per day">⚙</span>
                     <span class="view-ent" title="Show this timetable">👁</span>
                     <span class="x">×</span>`;
    row.querySelector(".label").onchange = e => { item.name = e.target.value; save(); refreshViews(); };
    row.querySelector(".abbr").onchange = e => { item.short = e.target.value.trim(); save(); refreshViews(); };
    if (key === "classes") row.querySelector(".grp-btn").onclick = () => { groupsEditClassId = item.id; renderTabBody(); };
    row.querySelector(".cap-edit").onclick = () => editCaps(key, item.id);
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
    const opts = classGroupOptions(l.classId);
    const grpSel = `<select class="grp-sel" title="Group (define groups on the class with ⊞)">
        <option value="">Whole class</option>
        ${opts.map(o => `<option value="${o.id}"${o.id === l.groupId ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
      </select>`;
    row.innerHTML = `<span class="swatch" style="background:${info.subject?safeColor(info.subject.color):'#888'}"></span>
      <span class="label">${info.cls?escapeHtml(info.cls.name):'?'} · ${info.subject?escapeHtml(info.subject.name):'?'}
        <span class="sub">${info.teacher?escapeHtml(info.teacher.name):'—'} · ${info.room?escapeHtml(info.room.name):'—'} · ${l.count}/wk</span></span>
      ${grpSel}
      <span class="x">×</span>`;
    row.querySelector(".grp-sel").onchange = e => { l.groupId = e.target.value || null; save(); render(); };
    row.querySelector(".x").onclick = () => {
      state.lessons = state.lessons.filter(x => x.id !== l.id);
      state.assignments = state.assignments.filter(a => a.lessonId !== l.id);
      save(); renderTabBody(); render();
    };
    el.appendChild(row);
  });

  const add = document.createElement("div"); add.className = "add-card";
  const opt = (arr, blank) => (blank?`<option value="">${blank}</option>`:"") + arr.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
  const grpOpt = cid => `<option value="">Whole class</option>` +
    classGroupOptions(cid).map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join("");
  add.innerHTML = `
    <div class="form-grid">
      <div><label class="fld">Class</label><select id="nl-class">${opt(state.classes)}</select></div>
      <div><label class="fld">Subject</label><select id="nl-subject">${opt(state.subjects)}</select></div>
      <div><label class="fld">Teacher</label><select id="nl-teacher">${opt(state.teachers,"—")}</select></div>
      <div><label class="fld">Room</label><select id="nl-room">${opt(state.rooms,"—")}</select></div>
      <div><label class="fld">Group</label><select id="nl-group">${grpOpt(state.classes[0] ? state.classes[0].id : "")}</select></div>
      <div><label class="fld">Periods / week</label><input id="nl-count" type="number" min="1" max="20" value="3" /></div>
    </div>
    <button class="primary">+ Add lesson</button>`;
  // group options depend on the chosen class
  add.querySelector("#nl-class").onchange = e => { $("#nl-group").innerHTML = grpOpt(e.target.value); };
  add.querySelector("button").onclick = () => {
    const classId = $("#nl-class").value, subjectId = $("#nl-subject").value;
    if (!classId || !subjectId) { toast("Pick a class and subject"); return; }
    const count = Math.max(1, parseInt($("#nl-count").value) || 1);
    const lesson = { id: uid(), classId, subjectId, teacherId: $("#nl-teacher").value || null, roomId: $("#nl-room").value || null, groupId: $("#nl-group").value || null, count };
    state.lessons.push(lesson);
    for (let i = 0; i < count; i++) state.assignments.push({ id: uid(), lessonId: lesson.id, day:null, period:null });
    save(); renderTabBody(); render();
  };
  el.appendChild(add);
}

// Which class's divisions/groups are being edited (a sub-screen of the
// Classes tab). null = show the normal class list.
let groupsEditClassId = null;

// Per-class divisions & groups editor. Pure structure: a division is a way the
// class splits (e.g. "Gender"); a group is a part of it (e.g. "Boys").
function renderClassGroups(el, classId) {
  const cls = byId(state.classes, classId);
  if (!cls) { groupsEditClassId = null; renderSimpleTab(el, "classes", "Classes", ""); return; }
  cls.divisions = cls.divisions || [];

  const head = document.createElement("div");
  head.innerHTML = `<button class="ghost" id="grp-back" style="margin-bottom:8px">← Classes</button>
    <h3>Groups — ${escapeHtml(cls.name)}</h3>
    <p class="hint">A <b>division</b> is a way this class splits (Gender, Ability). Two different groups of the <b>same</b> division can share a time slot (disjoint students); different divisions can't.</p>`;
  el.appendChild(head);
  head.querySelector("#grp-back").onclick = () => { groupsEditClassId = null; renderTabBody(); };

  cls.divisions.forEach(div => {
    const box = document.createElement("div"); box.className = "div-box";
    box.innerHTML = `<div class="div-head">
        <input class="div-name label" value="${escapeHtml(div.name)}" />
        <span class="x" title="Remove division">×</span>
      </div>
      <div class="grp-list"></div>
      <div class="grp-add"><input placeholder="+ group (e.g. Boys)" /><button class="ghost">Add</button></div>`;
    box.querySelector(".div-name").onchange = e => { div.name = e.target.value.trim() || div.name; save(); render(); };
    box.querySelector(".div-head .x").onclick = () => {
      const goneIds = div.groups.map(g => g.id);
      state.lessons.forEach(l => { if (goneIds.includes(l.groupId)) l.groupId = null; });
      cls.divisions = cls.divisions.filter(d => d.id !== div.id);
      save(); renderTabBody(); render();
    };
    const list = box.querySelector(".grp-list");
    div.groups.forEach(g => {
      const r = document.createElement("div"); r.className = "grp-row";
      r.innerHTML = `<input class="label" value="${escapeHtml(g.name)}" /><span class="x" title="Remove group">×</span>`;
      r.querySelector("input").onchange = e => { g.name = e.target.value.trim() || g.name; save(); render(); };
      r.querySelector(".x").onclick = () => {
        state.lessons.forEach(l => { if (l.groupId === g.id) l.groupId = null; });
        div.groups = div.groups.filter(x => x.id !== g.id);
        save(); renderTabBody(); render();
      };
      list.appendChild(r);
    });
    const addG = box.querySelector(".grp-add");
    addG.querySelector("button").onclick = () => {
      const v = addG.querySelector("input").value.trim(); if (!v) return;
      div.groups.push({ id: uid(), name: v }); save(); renderTabBody();
    };
    addG.querySelector("input").addEventListener("keydown", e => { if (e.key === "Enter") addG.querySelector("button").click(); });
    el.appendChild(box);
  });

  const addDiv = document.createElement("div"); addDiv.className = "add-card";
  addDiv.innerHTML = `<input placeholder="+ division (e.g. Gender, Ability)" /><button class="primary">+ Add division</button>`;
  addDiv.querySelector("button").onclick = () => {
    const v = addDiv.querySelector("input").value.trim(); if (!v) return;
    cls.divisions.push({ id: uid(), name: v, groups: [] }); save(); renderTabBody();
  };
  el.appendChild(addDiv);
}

function renderTimeTab(el) {
  el.innerHTML = `<h3>Days &amp; periods</h3><p class="hint">Comma-separated. Days are columns, periods are rows. Per-day counts let a day be shorter (e.g. Friday) — set how many of the periods above each day actually has.</p>
    <label class="fld">Days</label><input id="t-days" value="${escapeHtml(state.days.join(', '))}" />
    <label class="fld">Periods</label><input id="t-periods" value="${escapeHtml(state.periods.join(', '))}" />
    <label class="fld">Periods per day</label>
    <div class="ppd-grid" id="t-ppd">
      ${state.days.map((d, i) => `<div class="ppd-cell"><span>${escapeHtml(d)}</span><input type="number" min="0" max="${state.periods.length}" value="${periodsOnDay(i)}" data-day="${i}" /></div>`).join("")}
    </div>
    <label class="fld">Period times (optional)</label>
    <div class="ptimes" id="t-ptimes">
      ${state.periods.map((p, i) => {
        const opt = sel => `<option value=""></option>` + timeOptions().map(t => `<option value="${t}"${t === sel ? " selected" : ""}>${t}</option>`).join("");
        return `<div class="ptime-cell" data-p="${i}">
          <span class="pt-label">${escapeHtml(p)}</span>
          <select class="pt-start">${opt(periodStart(i))}</select>
          <span class="pt-dash">–</span>
          <select class="pt-end">${opt(periodEnd(i))}</select>
          <span class="pt-min">${periodMinutes(i) ? periodMinutes(i) + " min" : ""}</span>
        </div>`;
      }).join("")}
    </div>
    <p class="hint" style="margin-top:8px">Editing Days/Periods resets the grids above — set them first, Apply, then adjust per-day counts and times.</p>
    <button class="primary" id="t-save" style="width:100%;margin-top:8px">Apply</button>`;
  // live minute readout as the dropdowns change (before Apply)
  el.querySelectorAll(".ptime-cell").forEach(cell => {
    const upd = () => {
      const s = timeToMin(cell.querySelector(".pt-start").value), e = timeToMin(cell.querySelector(".pt-end").value);
      cell.querySelector(".pt-min").textContent = (s != null && e != null && e > s) ? (e - s) + " min" : "";
    };
    cell.querySelector(".pt-start").onchange = upd;
    cell.querySelector(".pt-end").onchange = upd;
  });
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
    // period times — {start,end} per period, aligned positionally to the new list
    const times = [...$("#t-ptimes").querySelectorAll(".ptime-cell")].map(c => ({
      start: c.querySelector(".pt-start").value, end: c.querySelector(".pt-end").value
    }));
    const periodTimes = periods.map((_, i) => times[i] || { start: "", end: "" });
    state.days = days; state.periods = periods;
    state.periodsPerDay = perDay;                               // null => every day uses all periods
    state.periodTimes = periodTimes.some(t => t.start || t.end) ? periodTimes : null; // null => no times set
    // clamp existing placements to slots that still exist
    state.assignments.forEach(a => {
      if (a.day != null && (a.day >= days.length || a.period >= periods.length || !slotExists(a.day, a.period))) {
        a.day = null; a.period = null;
      }
    });
    save(); render(); renderTabBody(); toast("Time structure updated");
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
