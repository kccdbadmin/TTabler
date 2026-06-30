"use strict";
//==================================================================
// state.js — the data model + lookups.
// `state` is the single source of truth, a global mutated in place.
// IMPORTANT: to load/replace data, use setState() (mutates in place) so
// references in other files stay valid — never reassign `state` directly.
//   state, setState, blankState, demoState, byId, lessonInfo,
//   entitiesForMode, currentEntity, periodsOnDay/slotExists/totalSlots,
//   lessonGroup, classGroupOptions, migrateGroups
//==================================================================

let state = null;

// Replace all data without breaking the shared `state` reference.
function setState(next) {
  if (!state) { state = next; }
  else { Object.keys(state).forEach(k => delete state[k]); Object.assign(state, next); }
  return state;
}

// An empty timetable with a sensible default week — used by "New timetable".
function blankState() {
  return {
    days: ["Mon","Tue","Wed","Thu","Fri"],
    periods: ["1","2","3","4","5","6"],
    subjects: [], teachers: [], classes: [], rooms: [], lessons: [], assignments: [],
    ui: { mode:"class", entity:null },
  };
}

function demoState() {
  const days = ["Mon","Tue","Wed","Thu","Fri"];
  const periods = ["1","2","3","4","5","6"];
  const subjects = [
    { id:"s1", name:"Math",    color:"#4f9cf9" },
    { id:"s2", name:"English", color:"#3ddc97" },
    { id:"s3", name:"Science", color:"#f6c453" },
    { id:"s4", name:"History", color:"#b692f6" },
    { id:"s5", name:"P.E.",    color:"#f97066" },
    { id:"s6", name:"Art",     color:"#7dd3fc" },
  ];
  const teachers = [
    { id:"t1", name:"Mr Adams" }, { id:"t2", name:"Ms Brown" },
    { id:"t3", name:"Dr Chen" },  { id:"t4", name:"Mrs Diaz" },
    { id:"t5", name:"Mr Evans" },
  ];
  const classes = [
    { id:"c1", name:"7A" }, { id:"c2", name:"7B" }, { id:"c3", name:"8A" },
  ];
  const rooms = [
    { id:"r1", name:"Room 101" }, { id:"r2", name:"Room 102" },
    { id:"r3", name:"Lab" }, { id:"r4", name:"Gym" },
  ];
  // lessons: required teaching units. count = periods per week.
  const lessons = [
    { id:"l1", classId:"c1", subjectId:"s1", teacherId:"t1", roomId:"r1", count:4 },
    { id:"l2", classId:"c1", subjectId:"s2", teacherId:"t2", roomId:"r1", count:3 },
    { id:"l3", classId:"c1", subjectId:"s3", teacherId:"t3", roomId:"r3", count:3 },
    { id:"l4", classId:"c1", subjectId:"s4", teacherId:"t4", roomId:"r2", count:2 },
    { id:"l5", classId:"c1", subjectId:"s5", teacherId:"t5", roomId:"r4", count:2 },

    { id:"l6", classId:"c2", subjectId:"s1", teacherId:"t1", roomId:"r2", count:4 },
    { id:"l7", classId:"c2", subjectId:"s2", teacherId:"t2", roomId:"r2", count:3 },
    { id:"l8", classId:"c2", subjectId:"s3", teacherId:"t3", roomId:"r3", count:3 },
    { id:"l9", classId:"c2", subjectId:"s6", teacherId:"t4", roomId:"r1", count:2 },

    { id:"l10", classId:"c3", subjectId:"s1", teacherId:"t1", roomId:"r1", count:4 },
    { id:"l11", classId:"c3", subjectId:"s3", teacherId:"t3", roomId:"r3", count:3 },
    { id:"l12", classId:"c3", subjectId:"s4", teacherId:"t4", roomId:"r2", count:3 },
    { id:"l13", classId:"c3", subjectId:"s5", teacherId:"t5", roomId:"r4", count:2 },
  ];
  // assignments: placed cards. one per lesson-unit. slot = {day, period} or null (unplaced)
  const assignments = [];
  lessons.forEach(l => {
    for (let i = 0; i < l.count; i++) assignments.push({ id: uid(), lessonId: l.id, day: null, period: null });
  });
  return { days, periods, subjects, teachers, classes, rooms, lessons, assignments, ui: { mode:"class", entity:"c1" } };
}

// ---------- Lookups ----------
const byId = (arr, id) => arr.find(x => x.id === id);

function lessonInfo(lessonId) {
  const l = byId(state.lessons, lessonId);
  if (!l) return null;
  return {
    lesson: l,
    cls: byId(state.classes, l.classId),
    subject: byId(state.subjects, l.subjectId),
    teacher: byId(state.teachers, l.teacherId),
    room: byId(state.rooms, l.roomId),
  };
}

function entitiesForMode(mode) {
  return { class: state.classes, teacher: state.teachers, room: state.rooms, subject: state.subjects }[mode] || [];
}

// The single entity currently being viewed (the one the grid is drawn for).
// Used by the time-off painter so clicks toggle availability for THIS entity.
function currentEntity() {
  const list = entitiesForMode(state.ui.mode);
  return byId(list, state.ui.entity) || null;
}

// ---- Period structure -------------------------------------------------------
// `state.periods` is the master list of period labels (the most any day has).
// `state.periodsPerDay[d]` optionally shortens a given day (e.g. Friday). When
// absent, every day uses all periods. Slots beyond a day's count don't exist:
// the grid blocks them, the generator skips them, fullness ignores them.
function periodsOnDay(d) {
  const ppd = state.periodsPerDay;
  const n = (ppd && ppd[d] != null) ? ppd[d] : state.periods.length;
  return Math.max(0, Math.min(n, state.periods.length));
}
function slotExists(d, p) { return p < periodsOnDay(d); }
function totalSlots() {
  let n = 0;
  for (let d = 0; d < state.days.length; d++) n += periodsOnDay(d);
  return n;
}
// Period clock times: state.periodTimes[pi] = { start:"HH:MM", end:"HH:MM" },
// parallel to state.periods. Helpers tolerate missing entries (and legacy
// free-text strings, which migratePeriodTimes() upgrades on load).
function timeToMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim());
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function periodStart(pi) { const e = state.periodTimes && state.periodTimes[pi]; return (e && typeof e === "object" && e.start) || ""; }
function periodEnd(pi)   { const e = state.periodTimes && state.periodTimes[pi]; return (e && typeof e === "object" && e.end)   || ""; }
function periodMinutes(pi) {
  const s = timeToMin(periodStart(pi)), e = timeToMin(periodEnd(pi));
  return (s != null && e != null && e > s) ? e - s : 0;
}
// Display label like "08:20–09:00" (or a legacy string as-is). Empty when unset.
function periodTime(pi) {
  const e = state.periodTimes && state.periodTimes[pi];
  if (!e) return "";
  if (typeof e === "string") return e;
  return (e.start && e.end) ? `${e.start}–${e.end}` : (e.start || e.end || "");
}
// 5-minute clock options for the start/end dropdowns, across a school day.
function timeOptions() {
  const out = [];
  for (let m = 6 * 60; m <= 20 * 60; m += 5)
    out.push(String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"));
  return out;
}
// One-time: upgrade legacy free-text period times ("8:20–9:00") to {start,end}.
function migratePeriodTimes() {
  if (!Array.isArray(state.periodTimes)) return false;
  let changed = false;
  const norm = t => { const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim()); return m ? String(+m[1]).padStart(2, "0") + ":" + m[2] : ""; };
  state.periodTimes = state.periodTimes.map(e => {
    if (typeof e === "string") { changed = true; const p = e.split(/[–-]/); return { start: norm(p[0]), end: norm(p[1]) }; }
    return e || { start: "", end: "" };
  });
  return changed;
}

// ---- Groups / divisions -----------------------------------------------------
// Groups are first-class, defined per class: class.divisions = [{ id, name,
// groups:[{id,name}] }]. A lesson references one via lesson.groupId (blank =
// whole class). lessonGroup() resolves that to a unified shape, falling back to
// the legacy free-text lesson.group {name, division} so old/imported data still
// works until migrateGroups() folds it in.
function lessonGroup(lesson) {
  if (!lesson) return null;
  if (lesson.groupId) {
    const cls = byId(state.classes, lesson.classId);
    if (cls && cls.divisions) {
      for (const d of cls.divisions) {
        const g = d.groups.find(x => x.id === lesson.groupId);
        if (g) return { divisionKey: d.id, groupKey: g.id, divisionName: d.name, groupName: g.name };
      }
    }
  }
  if (lesson.group) return { divisionKey: "L:" + lesson.group.division, groupKey: "L:" + lesson.group.name,
                             divisionName: lesson.group.division, groupName: lesson.group.name };
  return null;
}

// Flat list of a class's groups for dropdowns: [{ id, label }].
function classGroupOptions(classId) {
  const cls = byId(state.classes, classId);
  if (!cls || !cls.divisions) return [];
  const out = [];
  cls.divisions.forEach(d => d.groups.forEach(g => out.push({ id: g.id, label: `${g.name} (${d.name})` })));
  return out;
}

// One-time: fold legacy free-text lesson.group into structured per-class
// divisions/groups and point lessons at the created group ids. Idempotent.
function migrateGroups() {
  let changed = false;
  for (const cls of state.classes) if (!cls.divisions) { cls.divisions = []; changed = true; }
  for (const l of state.lessons) {
    if (l.groupId || !l.group) continue;
    const cls = byId(state.classes, l.classId); if (!cls) continue;
    const divName = l.group.division || "Groups";
    let div = cls.divisions.find(d => d.name === divName);
    if (!div) { div = { id: uid(), name: divName, groups: [] }; cls.divisions.push(div); }
    let g = div.groups.find(x => x.name === l.group.name);
    if (!g) { g = { id: uid(), name: l.group.name }; div.groups.push(g); }
    l.groupId = g.id;
    delete l.group;
    changed = true;
  }
  return changed;
}
