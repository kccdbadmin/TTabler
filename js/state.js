"use strict";
//==================================================================
// state.js — the data model + lookups.
// `state` is the single source of truth, a global mutated in place.
// IMPORTANT: to load/replace data, use setState() (mutates in place) so
// references in other files stay valid — never reassign `state` directly.
//   state, setState, demoState, byId, lessonInfo, entitiesForMode
//==================================================================

let state = null;

// Replace all data without breaking the shared `state` reference.
function setState(next) {
  if (!state) { state = next; }
  else { Object.keys(state).forEach(k => delete state[k]); Object.assign(state, next); }
  return state;
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
  return { class: state.classes, teacher: state.teachers, room: state.rooms }[mode] || [];
}
