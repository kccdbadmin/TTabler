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

  // O(1) lesson lookup — byId() is a linear scan, and the inner loops below
  // hit it thousands of times. On a big timetable that alone froze the tab.
  const lessonById = new Map(state.lessons.map(l => [l.id, l]));

  // Is a slot free for this lesson? `placement[key]` holds the LESSONS already
  // sitting in that slot, so no per-check lookup is needed.
  function fits(placement, lesson, slot) {
    if (slotOff(lesson, slot.day, slot.period)) return false; // entity unavailable here
    const here = placement[slot.day + "|" + slot.period];
    if (!here) return true;
    for (const ol of here) {
      if (classSlotClash(lesson, ol)) return false;
      if (lesson.teacherId && lesson.teacherId === ol.teacherId) return false;
      if (roomClash(lesson, ol)) return false;
    }
    return true;
  }

  // Soft constraint, kept incrementally instead of rescanning all placements
  // for every card (that was the O(cards²) blow-up). Counts, per class+subject,
  // how many of its periods already sit on each day.
  function bumpSpread(spread, lesson, day) {
    if (lesson.classId == null) return;
    const k = lesson.classId + "|" + lesson.subjectId;
    let byDay = spread.get(k);
    if (!byDay) spread.set(k, byDay = {});
    byDay[day] = (byDay[day] || 0) + 1;
  }

  // Locked + placed cards are kept exactly where they are.
  const isPinned = a => a.locked && a.day != null;

  let best = null, bestPlaced = -1;
  const RESTARTS = 40;
  for (let r = 0; r < RESTARTS; r++) {
    const placement = {}; // key -> [lesson]
    const spread = new Map(); // "classId|subjectId" -> { day: count }
    // keep pinned cards in place; reset the rest to unplaced
    const result = state.assignments.map(a => isPinned(a) ? { ...a } : ({ ...a, day:null, period:null }));
    for (const a of result) {
      if (!(a.locked && a.day != null)) continue;
      const l = lessonById.get(a.lessonId); if (!l) continue;
      (placement[a.day + "|" + a.period] = placement[a.day + "|" + a.period] || []).push(l);
      bumpSpread(spread, l, a.day);
    }
    // schedule hardest first: more constrained lessons (bigger count) first, shuffle for variety
    const order = result.filter(a => !(a.locked && a.day != null)).sort((a,b) => {
      const la = lessonById.get(a.lessonId), lb = lessonById.get(b.lessonId);
      return lb.count - la.count || Math.random() - .5;
    });
    let placed = result.length - order.length; // pinned count
    for (const a of order) {
      const lesson = lessonById.get(a.lessonId); if (!lesson) continue;
      const cand = slotList.filter(s => fits(placement, lesson, s));
      if (!cand.length) continue;
      // prefer days with fewer of this class+subject already on them (spread out)
      const byDay = spread.get(lesson.classId + "|" + lesson.subjectId);
      cand.sort((s1,s2) => (byDay ? (byDay[s1.day]||0) - (byDay[s2.day]||0) : 0) || Math.random()-.5);
      const slot = cand[0];
      a.day = slot.day; a.period = slot.period;
      (placement[slot.day + "|" + slot.period] = placement[slot.day + "|" + slot.period] || []).push(lesson);
      bumpSpread(spread, lesson, slot.day);
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
