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
  el.innerHTML = "";
  TABS.forEach(t => {
    const b = document.createElement("button");
    b.className = "ghost data-btn";
    b.textContent = t;
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
    b.classList.toggle("active", b.textContent === activeTab));
}

function closeDataEditor() {
  $("#drawer").classList.remove("open");
  $("#drawer-backdrop").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#data-buttons").querySelectorAll(".data-btn").forEach(b => b.classList.remove("active"));
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
  el.innerHTML = `<h3>${title}</h3><p class="hint">Add, rename or remove. Removing one also removes lessons that use it.</p>`;
  state[key].forEach(item => {
    const row = document.createElement("div"); row.className = "row-item";
    row.innerHTML = `<input class="label" value="${escapeHtml(item.name)}" style="background:transparent;border:none;padding:2px 0" />
                     <span class="x">×</span>`;
    row.querySelector("input").onchange = e => { item.name = e.target.value; save(); refreshViews(); };
    row.querySelector(".x").onclick = () => { removeEntity(key, item.id); };
    el.appendChild(row);
  });
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
  el.innerHTML = `<h3>Subjects</h3><p class="hint">Colours show up on the timetable cards.</p>`;
  state.subjects.forEach(item => {
    const row = document.createElement("div"); row.className = "row-item";
    row.innerHTML = `<span class="swatch" style="background:${safeColor(item.color)}"></span>
      <input class="label" value="${escapeHtml(item.name)}" style="background:transparent;border:none;padding:2px 0" />
      <input type="color" value="${safeColor(item.color)}" style="width:30px;height:24px;padding:1px" />
      <span class="x">×</span>`;
    row.querySelector(".label").onchange = e => { item.name = e.target.value; save(); refreshViews(); };
    row.querySelector('input[type=color]').oninput = e => { item.color = e.target.value; row.querySelector(".swatch").style.background = e.target.value; save(); render(); };
    row.querySelector(".x").onclick = () => removeEntity("subjects", item.id);
    el.appendChild(row);
  });
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
  el.innerHTML = `<h3>Days & periods</h3><p class="hint">Comma-separated. These define the grid columns (days) and rows (periods).</p>
    <label class="fld">Days</label><input id="t-days" value="${state.days.join(', ')}" />
    <label class="fld">Periods</label><input id="t-periods" value="${state.periods.join(', ')}" />
    <button class="primary" id="t-save" style="width:100%;margin-top:12px">Apply</button>`;
  $("#t-save").onclick = () => {
    const days = $("#t-days").value.split(",").map(s=>s.trim()).filter(Boolean);
    const periods = $("#t-periods").value.split(",").map(s=>s.trim()).filter(Boolean);
    if (!days.length || !periods.length) { toast("Need at least one day and period"); return; }
    // clamp existing placements to new bounds
    state.assignments.forEach(a => {
      if (a.day != null && a.day >= days.length) { a.day = null; a.period = null; }
      if (a.period != null && a.period >= periods.length) { a.day = null; a.period = null; }
    });
    state.days = days; state.periods = periods;
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
