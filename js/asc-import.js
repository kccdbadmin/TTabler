"use strict";
//==================================================================
// asc-import.js — parse an aSc Timetables XML export into our state.
// v1 scope: periods (short names), subjects, teachers, classes,
// classrooms→rooms, lessons, and placed cards→assignments. Not yet
// modelled (planned, one by one): groups/divisions, per-lesson day
// constraints, terms/weeks, double periods, multi-teacher/class.
// NOTE: group-split lessons (e.g. Boys/Girls) import as whole-class
// lessons, so they can show as "conflicts" until groups are modelled.
//   parseAscXml(xmlText) -> { state, stats }
//==================================================================

function parseAscXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not valid XML");
  if (!doc.querySelector("timetable")) throw new Error("Not an aSc timetable XML");

  const attr = (el, n) => el.getAttribute(n) || "";
  // multi-id fields are comma- (this export) or space-separated
  const allIds = (el, n) => attr(el, n).trim().split(/[\s,]+/).filter(Boolean);
  const firstId = (el, n) => allIds(el, n)[0] || null;

  // ---- periods: order by their numeric index; label with short name ----
  const periodEls = [...doc.querySelectorAll("periods > period")]
    .sort((a, b) => parseInt(attr(a, "period")) - parseInt(attr(b, "period")));
  const periods = periodEls.map(p => attr(p, "short") || attr(p, "name") || attr(p, "period"));
  const periodIdx = {}; // aSc "period" attr -> our row index
  periodEls.forEach((p, i) => { periodIdx[attr(p, "period")] = i; });

  // ---- day labels: bitmask position -> day. aSc exports are Mon-first. ----
  const maskLen = (attr(doc.querySelector("card[days]") || doc.createElement("x"), "days") || "10000").length;
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0, maskLen);

  // ---- entities: map aSc hex ids -> fresh ids in our model ----
  const subjects = [], teachers = [], classes = [], rooms = [];
  const subMap = {}, teaMap = {}, claMap = {}, rooMap = {};

  doc.querySelectorAll("subjects > subject").forEach((el, i) => {
    const s = { id: uid(), name: attr(el, "name") || attr(el, "short") || "Subject",
                short: attr(el, "short"), color: PALETTE[i % PALETTE.length] };
    subjects.push(s); subMap[attr(el, "id")] = s.id;
  });
  doc.querySelectorAll("teachers > teacher").forEach(el => {
    const name = attr(el, "name") || (attr(el, "firstname") + " " + attr(el, "lastname")).trim() || "Teacher";
    const t = { id: uid(), name, short: attr(el, "short"), color: attr(el, "color") || null };
    teachers.push(t); teaMap[attr(el, "id")] = t.id;
  });
  doc.querySelectorAll("classes > class").forEach(el => {
    const c = { id: uid(), name: attr(el, "name") || attr(el, "short") || "Class",
                short: attr(el, "short"), grade: attr(el, "grade") || null };
    classes.push(c); claMap[attr(el, "id")] = c.id;
  });
  doc.querySelectorAll("classrooms > classroom").forEach(el => {
    const r = { id: uid(), name: attr(el, "name") || attr(el, "short") || "Room", short: attr(el, "short") };
    rooms.push(r); rooMap[attr(el, "id")] = r.id;
  });

  // ---- groups (class divisions like Boys/Girls or sets) ----
  // Imported as legacy per-lesson {name, division}; migrateGroups() folds these
  // into structured per-class divisions when the timetable opens in the editor.
  const grpMap = {}; // aSc group id -> {name, division, entire}
  doc.querySelectorAll("groups > group").forEach(el => {
    grpMap[attr(el, "id")] = {
      name: attr(el, "name"),
      division: attr(el, "divisiontag"),
      entire: attr(el, "entireclass") === "1",
    };
  });

  // ---- lessons ----
  const lessons = [];
  const lesMap = {}; // aSc lesson id -> our lesson
  let skippedLessons = 0;
  doc.querySelectorAll("lessons > lesson").forEach(el => {
    const subjectId = subMap[firstId(el, "subjectid")];
    if (!subjectId) { skippedLessons++; return; } // a lesson without a subject can't render
    const count = Math.max(1, Math.round(parseFloat(attr(el, "periodsperweek")) || 1));
    const classIds = allIds(el, "classids").map(id => claMap[id]).filter(Boolean);
    const l = {
      id: uid(),
      classId: classIds[0] || null, // null = no class (e.g. duty); visible in teacher view
      classIdsAll: classIds.length > 1 ? classIds : undefined, // combined classes — kept for future multi-class support
      subjectId,
      teacherId: teaMap[firstId(el, "teacherids")] || null,
      roomId: rooMap[firstId(el, "classroomids")] || null,
      count,
    };
    const g = grpMap[firstId(el, "groupids")];
    if (g && !g.entire) l.group = { name: g.name, division: g.division };
    lessons.push(l); lesMap[attr(el, "id")] = l;
  });

  // ---- cards -> placed assignments ----
  const assignments = [];
  const placedPerLesson = {};
  let skippedCards = 0;
  doc.querySelectorAll("cards > card").forEach(el => {
    const l = lesMap[attr(el, "lessonid")];
    const day = attr(el, "days").indexOf("1");
    const period = periodIdx[attr(el, "period")];
    if (!l || day < 0 || period === undefined) { skippedCards++; return; }
    assignments.push({ id: uid(), lessonId: l.id, day, period });
    placedPerLesson[l.id] = (placedPerLesson[l.id] || 0) + 1;
  });

  // top up unplaced units so each lesson has exactly `count` cards
  lessons.forEach(l => {
    const placed = placedPerLesson[l.id] || 0;
    if (placed > l.count) l.count = placed; // trust the placed timetable
    for (let i = placed; i < l.count; i++)
      assignments.push({ id: uid(), lessonId: l.id, day: null, period: null });
  });

  const state = {
    days, periods, subjects, teachers, classes, rooms, lessons, assignments,
    ui: { mode: "class", entity: classes[0] ? classes[0].id : null },
  };
  const stats = {
    subjects: subjects.length, teachers: teachers.length, classes: classes.length,
    rooms: rooms.length, lessons: lessons.length,
    placed: assignments.filter(a => a.day != null).length,
    unplaced: assignments.filter(a => a.day == null).length,
    skippedLessons, skippedCards,
  };
  return { state, stats };
}
