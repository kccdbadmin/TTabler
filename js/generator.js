"use strict";
//==================================================================
// generator.js — the auto-scheduler.
// Greedy placement with 40 randomised restarts; keeps the best attempt.
// Hard rules enforced inline (no class/teacher/room double-book); soft
// rule spreads a subject across different days. Keep this consistent
// with constraints.js when you add new hard rules.
//   generate()
//==================================================================

function generate() {
  const { days, periods } = state;
  const slotList = [];
  for (let d = 0; d < days.length; d++) for (let p = 0; p < periods.length; p++) slotList.push({ day:d, period:p });

  // Is a slot free for this lesson given the current placement map?
  function fits(placement, lesson, slot) {
    const key = slot.day + "|" + slot.period;
    const here = placement[key] || [];
    for (const other of here) {
      const ol = byId(state.lessons, other.lessonId);
      if (lesson.classId === ol.classId) return false;
      if (lesson.teacherId && lesson.teacherId === ol.teacherId) return false;
      if (lesson.roomId && lesson.roomId === ol.roomId) return false;
    }
    return true;
  }

  let best = null, bestPlaced = -1;
  const RESTARTS = 40;
  for (let r = 0; r < RESTARTS; r++) {
    const placement = {}; // key -> [assignment]
    const result = state.assignments.map(a => ({ ...a, day:null, period:null }));
    // schedule hardest first: more constrained lessons (bigger count) first, shuffle for variety
    const order = [...result].sort((a,b) => {
      const la = byId(state.lessons, a.lessonId), lb = byId(state.lessons, b.lessonId);
      return lb.count - la.count || Math.random() - .5;
    });
    let placed = 0;
    for (const a of order) {
      const lesson = byId(state.lessons, a.lessonId);
      // candidate slots, prefer days with fewer of this class's lessons (spread out)
      const cand = slotList.filter(s => fits(placement, lesson, s));
      if (!cand.length) continue;
      // soft: avoid same subject twice same day for the class
      const dayUsed = {};
      for (const k in placement) for (const o of placement[k]) {
        const ol = byId(state.lessons, o.lessonId);
        if (ol.classId === lesson.classId && ol.subjectId === lesson.subjectId)
          dayUsed[o.day] = (dayUsed[o.day]||0)+1;
      }
      cand.sort((s1,s2) => (dayUsed[s1.day]||0) - (dayUsed[s2.day]||0) || Math.random()-.5);
      const slot = cand[0];
      a.day = slot.day; a.period = slot.period;
      const key = slot.day + "|" + slot.period;
      (placement[key] = placement[key] || []).push(a);
      placed++;
    }
    if (placed > bestPlaced) { bestPlaced = placed; best = result; if (placed === result.length) break; }
  }
  state.assignments = best;
  save(); render();
  const total = state.assignments.length;
  toast(bestPlaced === total ? `✅ Generated — all ${total} lessons placed, no clashes`
                             : `⚠ Placed ${bestPlaced}/${total}. ${total-bestPlaced} couldn't fit — see tray.`);
}
