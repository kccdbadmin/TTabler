"use strict";
//==================================================================
// library.js — the landing page (index.html). Lists every timetable in
// the browser, and lets you create / open / rename / duplicate / delete
// them. Opening one navigates to editor.html#id=<id>. The actual storage
// lives in storage.js; this file is just the UI around it.
//==================================================================

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" }) +
         " " + d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
}

function openTimetable(id) { location.href = "editor.html#id=" + encodeURIComponent(id); }

function newTimetable() {
  const name = prompt("Name your timetable:", "New timetable");
  if (name === null) return;
  const s = createTimetable(name.trim() || "Untitled timetable", blankState());
  openTimetable(s.id);
}

function newSample() {
  const s = createTimetable("Sample school", demoState());
  openTimetable(s.id);
}

function importToLibrary(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      const name = parsed.name || file.name.replace(/\.json$/i, "");
      const s = createTimetable(name, parsed);
      openTimetable(s.id);
    } catch(e) { toast("Couldn't read that file"); }
  };
  r.readAsText(file);
}

function renderLibrary() {
  const wrap = $("#lib");
  const list = listTimetables();

  if (!list.length) {
    wrap.innerHTML = `<div class="lib-empty">
      <p>No timetables yet — create one to get started.</p>
      <p style="margin-top:14px">
        <button class="primary" id="empty-new">＋ Create your first timetable</button>
        <button id="empty-sample">Load sample school</button>
      </p></div>`;
    $("#empty-new").onclick = newTimetable;
    $("#empty-sample").onclick = newSample;
    return;
  }

  wrap.innerHTML = `<div class="lib-grid">` + list.map(s => `
    <div class="lib-card" data-id="${s.id}">
      <h3>${escapeHtml(s.name || "Untitled")}</h3>
      <div class="meta">${(s.classes||[]).length} classes · ${(s.lessons||[]).length} lessons · ${(s.subjects||[]).length} subjects</div>
      <div class="meta">updated ${fmtDate(s.updatedAt)}</div>
      <div class="acts">
        <button class="primary act-open">Open</button>
        <button class="act-rename">Rename</button>
        <button class="act-dup">Duplicate</button>
        <button class="danger act-del">Delete</button>
      </div>
    </div>`).join("") + `</div>`;

  wrap.querySelectorAll(".lib-card").forEach(card => {
    const id = card.dataset.id;
    card.onclick = () => openTimetable(id);
    card.querySelector(".act-open").onclick = e => { e.stopPropagation(); openTimetable(id); };
    card.querySelector(".act-rename").onclick = e => {
      e.stopPropagation();
      const s = loadTimetable(id); if (!s) return;
      const n = prompt("Rename timetable:", s.name || "");
      if (n !== null) { s.name = n.trim() || s.name; writeTimetable(s); renderLibrary(); }
    };
    card.querySelector(".act-dup").onclick = e => {
      e.stopPropagation(); duplicateTimetable(id); renderLibrary(); toast("Duplicated");
    };
    card.querySelector(".act-del").onclick = e => {
      e.stopPropagation();
      const s = loadTimetable(id);
      if (confirm(`Delete "${(s && s.name) || "this timetable"}"? This cannot be undone.`)) {
        deleteTimetable(id); renderLibrary();
      }
    };
  });
}

// ---------- boot ----------
(function () {
  migrateOldIfNeeded();

  // Honour shared "#tt=" links that land on the library root: import the
  // timetable into the library and jump straight into the editor.
  if ((location.hash || "").startsWith("#tt=")) {
    const s = readFromUrl();
    if (s) {
      delete s.id;
      const t = createTimetable(s.name || "Shared timetable", s);
      location.replace("editor.html#id=" + encodeURIComponent(t.id));
      return;
    }
  }

  $("#btn-new").onclick = newTimetable;
  $("#btn-sample").onclick = newSample;
  $("#btn-import").onclick = () => $("#lib-file").click();
  $("#lib-file").onchange = e => { if (e.target.files[0]) importToLibrary(e.target.files[0]); };
  renderLibrary();
})();
