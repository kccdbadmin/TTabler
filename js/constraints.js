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
// Per-assignment human-readable reasons, e.g. "Mr Adams also teaches 8A".
// Populated alongside `conflicts` and shown in card tooltips.
let conflictDetails = new Map();
function addReason(aid, reason) {
  let s = conflictDetails.get(aid);
  if (!s) conflictDetails.set(aid, s = new Set());
  s.add(reason);
}

// ---- Time-off / availability ----------------------------------------------
// Each class / teacher / room may carry an `off` array of "day|period" keys
// (set by painting on the grid). A lesson placed in a slot where its class,
// teacher, OR room is marked off is a violation — flagged like a clash.
function entityOff(arr, id) {
  const e = byId(arr, id);
  return (e && e.off) || [];
}
function slotOff(lesson, day, period) {
  const key = day + "|" + period;
  return (lesson.classId   && entityOff(state.classes,  lesson.classId).includes(key)) ||
         (lesson.teacherId && entityOff(state.teachers, lesson.teacherId).includes(key)) ||
         (lesson.roomId    && entityOff(state.rooms,    lesson.roomId).includes(key));
}

// Rooms are NOT treated as a hard resource. Most schools (and this one in
// particular: far fewer rooms than classes) use the room field nominally —
// two lessons sharing a room is fine. Flip this to true to make a shared room
// count as a clash again, for schools where rooms are genuinely exclusive.
const ENFORCE_ROOM_CLASHES = false;
function roomClash(la, lb) {
  return ENFORCE_ROOM_CLASHES && !!la.roomId && la.roomId === lb.roomId;
}

// Two lessons of the SAME class may share a slot when they are different
// groups of the same division (e.g. Boys vs Girls — disjoint students).
// Anything else — entire-class vs group, different divisions, same group —
// is a real clash. (computeConflicts inlines this with cached groups; this
// stays the single source of truth for the rule, used by the generator.)
function classSlotClash(la, lb) {
  if (!la.classId || la.classId !== lb.classId) return false;
  const ga = lessonGroup(la), gb = lessonGroup(lb);
  if (ga && gb && ga.divisionKey === gb.divisionKey && ga.groupKey !== gb.groupKey) return false;
  return true;
}

// Returns a Set of assignment ids that clash (double-booked in same slot).
// Hot path: runs on every render. lessonInfo()/lessonGroup() do linear scans,
// so we resolve each placed lesson ONCE into caches and the per-pair loop then
// only does Map lookups (keeps big boards responsive).
function computeConflicts() {
  const found = new Set();
  conflictDetails = new Map();
  const nm = (e, fallback) => (e && e.name) ? e.name : fallback;
  const lessonById = new Map(state.lessons.map(l => [l.id, l]));

  const infoById = new Map(), grpById = new Map();
  const info  = id => { let v = infoById.get(id); if (v === undefined) infoById.set(id, v = lessonInfo(id)); return v; };
  const grpOf = l  => { let v = grpById.get(l.id); if (v === undefined) grpById.set(l.id, v = lessonGroup(l)); return v; };

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
        const A = info(list[i].lessonId), B = info(list[j].lessonId);
        if (!A || !B) continue;
        const ai = list[i].id, aj = list[j].id;
        let clash = false;
        // class clash, unless two disjoint groups of the same division
        if (A.lesson.classId && A.lesson.classId === B.lesson.classId) {
          const ga = grpOf(A.lesson), gb = grpOf(B.lesson);
          const disjoint = ga && gb && ga.divisionKey === gb.divisionKey && ga.groupKey !== gb.groupKey;
          if (!disjoint) {
            clash = true;
            const r = `${nm(A.cls,'This class')} double-booked here`;
            addReason(ai, r); addReason(aj, r);
          }
        }
        if (A.lesson.teacherId && A.lesson.teacherId === B.lesson.teacherId) {
          clash = true;
          const t = nm(A.teacher, 'Teacher');
          addReason(ai, `${t} also teaches ${nm(B.cls,'another class')} here`);
          addReason(aj, `${t} also teaches ${nm(A.cls,'another class')} here`);
        }
        if (roomClash(A.lesson, B.lesson)) {
          clash = true;
          const rm = nm(A.room, 'Room');
          addReason(ai, `${rm} also used by ${nm(B.cls,'another class')} here`);
          addReason(aj, `${rm} also used by ${nm(A.cls,'another class')} here`);
        }
        if (clash) { found.add(ai); found.add(aj); }
      }
    }
  }
  // time-off: a placed card sitting on an unavailable slot is also a violation
  for (const a of state.assignments) {
    if (a.day == null) continue;
    const l = lessonById.get(a.lessonId);
    if (l && slotOff(l, a.day, a.period)) { found.add(a.id); addReason(a.id, "Placed on a time-off slot"); }
  }
  return found;
}

// Tooltip text for a (possibly clashing) card.
function clashTitle(aid) {
  const r = conflictDetails.get(aid);
  return r ? "⚠ " + [...r].join("; ") : "";
}
