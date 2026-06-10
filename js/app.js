"use strict";
//==================================================================
// app.js — the EDITOR entry point (editor.html). Loaded LAST. Wires up
// the header/toolbar, loads the one timetable named in the URL, then
// boots the first render. If a name here is undefined, a module above
// didn't load — check the <script> order in editor.html.
//==================================================================

function boot() {
  const ni = $("#tt-name"); if (ni) ni.value = state.name || "";
  renderTabs(); renderTabBody(); renderViewControls(); render();
}

// Explicit Save (the 💾 button). For your own timetables it just confirms
// (autosave already persists). For a shared/imported one with no id yet,
// it creates a library entry and switches the URL to that timetable.
function saveExplicit() {
  if (!state.id) {
    state.id = newId();
    state.createdAt = Date.now();
    state.name = state.name || ($("#tt-name").value.trim() || "Untitled timetable");
    writeTimetable(state);
    history.replaceState(null, "", "#id=" + encodeURIComponent(state.id));
    toast("Saved to your library ✓");
  } else {
    writeTimetable(state);
    toast("Saved ✓");
  }
}

$("#btn-save").onclick = saveExplicit;
$("#tt-name").onchange = e => { state.name = e.target.value.trim() || state.name; save(); };
$("#btn-generate").onclick = generate;
$("#btn-clear").onclick = () => {
  if (!confirm("Move all cards back to the unplaced tray?")) return;
  state.assignments.forEach(a => { a.day = null; a.period = null; });
  save(); render(); toast("Grid cleared");
};
$("#btn-share").onclick = shareLink;
$("#btn-export").onclick = exportFile;
$("#btn-import").onclick = () => $("#file-input").click();
$("#file-input").onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); };
$("#view-mode").onchange = e => { state.ui.mode = e.target.value; const l = entitiesForMode(e.target.value); state.ui.entity = l.length?l[0].id:null; save(); render(); };
$("#view-entity").onchange = e => { state.ui.entity = e.target.value; save(); render(); };

load();
if (state) { // load() redirects to the library when there's nothing to open
  if (!state.ui) state.ui = { mode:"class", entity: state.classes[0]?.id || null };
  // expose a few handles for debugging in the browser console
  Object.assign(TT, { get state(){ return state; }, generate, render, save, load });
  boot();
}
