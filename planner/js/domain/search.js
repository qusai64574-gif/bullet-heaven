/* ==========================================================================
   search.js — global search across every collection, grouped by type,
   with real ranking (title matches beat body matches) and highlighting.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;

  const GROUPS = [
    { key: 'homework', label: 'Homework', icon: 'book', route: 'homework' },
    { key: 'projects', label: 'Projects', icon: 'folder', route: 'projects' },
    { key: 'exams', label: 'Exams', icon: 'clipboard', route: 'exams' },
    { key: 'events', label: 'Events', icon: 'calendar', route: 'events' },
    { key: 'tasks', label: 'Tasks', icon: 'checkCircle', route: 'tasks' },
    { key: 'notes', label: 'Notes', icon: 'file', route: 'notes' },
    { key: 'subjects', label: 'Subjects', icon: 'cap', route: 'subjects' },
    { key: 'timetable', label: 'Timetable', icon: 'clock', route: 'timetable' },
  ];

  /**
   * run(query, opts) -> { query, groups: [{key,label,icon,items:[{collection,record,score}]}], total }
   * opts: { includeCompleted (default true), limit }
   */
  function run(query, opts) {
    const o = opts || {};
    const q = String(query || '').trim().toLowerCase();
    const result = { query: q, groups: [], total: 0 };
    if (!q) return result;

    const limit = o.limit || 40;

    GROUPS.forEach((g) => {
      const items = [];
      Store.list(g.key).forEach((rec) => {
        const score = scoreRecord(g.key, rec, q);
        if (score <= 0) return;
        items.push({ collection: g.key, record: rec, score });
      });
      items.sort((a, b) => b.score - a.score);
      if (items.length) {
        result.groups.push({
          key: g.key,
          label: g.label,
          icon: g.icon,
          items: items.slice(0, limit),
          total: items.length,
        });
        result.total += items.length;
      }
    });

    return result;
  }

  /** 0 = no match. Higher is better. Title/name hits rank above body hits. */
  function scoreRecord(collection, rec, q) {
    const title = String(rec.title || rec.name || '').toLowerCase();
    const fields = M.SEARCH_FIELDS[collection] || ['title'];
    let score = 0;

    if (title === q) score += 120;
    else if (title.startsWith(q)) score += 90;
    else if (title.indexOf(q) >= 0) score += 70;

    fields.forEach((f) => {
      if (f === 'title' || f === 'name') return;
      const v = String(rec[f] || '').toLowerCase();
      if (!v) return;
      if (v.startsWith(q)) score += 24;
      else if (v.indexOf(q) >= 0) score += 14;
    });

    if (Array.isArray(rec.topics) && rec.topics.join(' ').toLowerCase().indexOf(q) >= 0) score += 20;
    if (Array.isArray(rec.members) && rec.members.join(' ').toLowerCase().indexOf(q) >= 0) score += 12;
    if (Array.isArray(rec.checklist) && rec.checklist.map((c) => c.text).join(' ').toLowerCase().indexOf(q) >= 0) score += 12;

    const subject = rec.subjectId ? Store.byId('subjects', rec.subjectId) : null;
    if (subject && subject.name.toLowerCase().indexOf(q) >= 0) score += 26;

    if (score > 0) {
      // Prefer live work over long-finished items, and recent over ancient.
      if (!M.isCompleted(collection, rec)) score += 8;
      if (M.isOverdue(collection, rec)) score += 6;
      const ageDays = (Date.now() - (rec.updatedAt || rec.createdAt || 0)) / 86400000;
      score += Math.max(0, 6 - Math.min(6, ageDays / 15));
    }
    return score;
  }

  /** A one-line context snippet with the matched term highlighted. */
  function snippet(collection, rec, q) {
    const fields = M.SEARCH_FIELDS[collection] || ['title'];
    const title = rec.title || rec.name || 'Untitled';
    for (const f of fields) {
      if (f === 'title' || f === 'name') continue;
      const v = String(rec[f] || '');
      if (v && v.toLowerCase().indexOf(q) >= 0) return v.slice(0, 140);
    }
    if (Array.isArray(rec.checklist)) {
      const hit = rec.checklist.find((c) => c.text.toLowerCase().indexOf(q) >= 0);
      if (hit) return hit.text;
    }
    if (Array.isArray(rec.topics)) {
      const hit = rec.topics.find((t) => t.toLowerCase().indexOf(q) >= 0);
      if (hit) return hit;
    }
    const subject = rec.subjectId ? Store.byId('subjects', rec.subjectId) : null;
    if (subject && subject.name.toLowerCase().indexOf(q) >= 0) return subject.name;
    return title;
  }

  global.Search = { run, snippet, GROUPS };
})(window);
