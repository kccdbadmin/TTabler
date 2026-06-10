"use strict";
//==================================================================
// dnd.js — drag & drop. Re-attached after every grid/tray redraw.
// Dropping a card on a cell sets its day/period; dropping on the tray
// un-places it. After any move it saves and re-renders (which re-runs
// conflict detection, so clashes light up immediately).
//   attachDnD()
//==================================================================

let dragAid = null;

function attachDnD() {
  document.querySelectorAll(".card[draggable=true]").forEach(card => {
    card.addEventListener("dragstart", e => {
      dragAid = card.dataset.aid; card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragAid);
    });
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); dragAid = null;
      document.querySelectorAll(".drop-hover").forEach(x=>x.classList.remove("drop-hover")); });
  });
  document.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("dragover", e => { e.preventDefault(); cell.classList.add("drop-hover"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("drop-hover"));
    cell.addEventListener("drop", e => {
      e.preventDefault(); cell.classList.remove("drop-hover");
      const aid = dragAid || e.dataTransfer.getData("text/plain"); if (!aid) return;
      const a = byId(state.assignments, aid); if (!a) return;
      a.day = parseInt(cell.dataset.day); a.period = parseInt(cell.dataset.period);
      save(); render();
    });
  });
  const tray = $("#tray");
  tray.ondragover = e => { e.preventDefault(); tray.classList.add("drop-hover"); };
  tray.ondragleave = () => tray.classList.remove("drop-hover");
  tray.ondrop = e => {
    e.preventDefault(); tray.classList.remove("drop-hover");
    const aid = dragAid || e.dataTransfer.getData("text/plain"); if (!aid) return;
    const a = byId(state.assignments, aid); if (!a) return;
    a.day = null; a.period = null; save(); render();
  };
}
