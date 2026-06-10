"use strict";
//==================================================================
// constraints.js — the rules a valid timetable must satisfy.
// Today: hard clashes only (a class / teacher / room can't be in two
// places in the same slot). This is the file to extend with new rules
// like "subject only in certain rooms" or "teacher day off".
//   conflicts (live Set of clashing assignment ids), computeConflicts()
//==================================================================

// Latest computed conflicts — read by grid.js when drawing cards.
let conflicts = new Set();

// Returns a Set of assignment ids that clash (double-booked in same slot).
function computeConflicts() {
  const found = new Set();
  const slots = {}; // key day|period -> list of assignments
  for (const a of state.assignments) {
    if (a.day == null) continue;
    const k = a.day + "|" + a.period;
    (slots[k] = slots[k] || []).push(a);
  }
  for (const k in slots) {
    const list = slots[k];
    for (let i = 0; i < list.length; i++) {
      for (let j = i+1; j < list.length; j++) {
        const A = lessonInfo(list[i].lessonId), B = lessonInfo(list[j].lessonId);
        if (!A || !B) continue;
        const clash =
          (A.lesson.classId && A.lesson.classId === B.lesson.classId) ||
          (A.lesson.teacherId && A.lesson.teacherId === B.lesson.teacherId) ||
          (A.lesson.roomId && A.lesson.roomId === B.lesson.roomId);
        if (clash) { found.add(list[i].id); found.add(list[j].id); }
      }
    }
  }
  return found;
}
