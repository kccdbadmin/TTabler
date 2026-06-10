"use strict";
//==================================================================
// app.js — the entry point. Loaded LAST. Wires up the header buttons
// and toolbar, loads saved/shared/demo data, then boots the first
// render. If a name here is undefined, a module above it didn't load —
// check the <script> order in index.html.
//==================================================================

function boot() {
  renderTabs(); renderTabBody(); renderViewControls(); render();
}

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
if (!state.ui) state.ui = { mode:"class", entity: state.classes[0]?.id || null };

// expose a few handles for debugging in the browser console
Object.assign(TT, { get state(){ return state; }, generate, render, save, load });

boot();
