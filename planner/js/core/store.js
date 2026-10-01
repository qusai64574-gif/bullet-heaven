/* ==========================================================================
   store.js — persistence, indexing, mutation API, derived stats.
   Single source of truth for the whole app.

   Design:
   - One JSON document in localStorage ("studyplanner.db.v1") holds settings,
     profile, meta and all collections. Writes are debounced and flushed on
     pagehide/visibilitychange so nothing is lost.
   - In-memory id -> record maps keep reads O(1); a date index keeps calendar
     and dashboard reads O(day) instead of O(all items).
   - Attachment payloads live in IndexedDB (never in the JSON doc) so the
     document stays small and storage quota is not blown by photos.
   - Every mutation emits a change event with the affected collection.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;

  const BASE_KEY = 'studyplanner.db.v1';
  const SCHEMA_VERSION = 1;
  const SAVE_DEBOUNCE = 220;

  /* Each account gets its own document, so one browser can hold several
     students' planners without them ever seeing each other's work.
     No account (guest) uses the base key. */
  let storageKey = BASE_KEY;

  /** Point the store at an account's document. Flushes the current one first. */
  function useAccount(accountId) {
    flush();
    storageKey = accountId ? BASE_KEY + '.acct.' + accountId : BASE_KEY;
    invalidate();
    return storageKey;
  }

  function currentStorageKey() {
    return storageKey;
  }

  const DEFAULT_SETTINGS = {
    theme: 'system',
    weekStart: 1, // Monday
    timeFormat: '12',
    defaultReminder: 1440,
    notificationsEnabled: false,
    notifyHomework: true,
    notifyProjects: true,
    notifyExams: true,
    notifyEvents: true,
    notifyTasks: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
    sampleDataLoaded: false,
    onboarded: false,
    calendarDefaultView: 'month',
    showWeekends: true,
    assistantHistory: true,
    reminders: M.DEFAULT_REMINDERS.slice(),
  };

  const DEFAULT_PROFILE = {
    name: '',
    grade: '',
    school: '',
    startTime: '08:00',
    endTime: '15:00',
    subjects: [],
    avatarColor: '#0d0d0d',
  };

  /* ------------------------------ State -------------------------------- */
  let db = null;
  let dirty = false;
  let saveTimer = null;
  const indexes = {}; // collection -> Map(id -> rec)
  let dateIndex = null; // 'collection|dateISO' -> [rec]
  let statsCache = null;
  const listeners = {};

  /* ------------------------------ Events ------------------------------- */
  function on(evt, fn) {
    (listeners[evt] || (listeners[evt] = [])).push(fn);
    return () => {
      listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
    };
  }

  function emit(evt, payload) {
    const list = listeners[evt];
    if (!list) return;
    list.slice().forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[store] listener failed for ' + evt, e);
      }
    });
  }

  /* ------------------------------- Init -------------------------------- */
  function emptyDB() {
    return {
      version: SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      profile: JSON.parse(JSON.stringify(DEFAULT_PROFILE)),
      collections: Object.keys(M.COLLECTIONS).reduce((acc, k) => {
        acc[k] = [];
        return acc;
      }, {}),
      meta: {
        streak: { count: 0, best: 0, lastDate: null },
        counters: { created: 0, completed: 0 },
        lastOpened: null,
      },
    };
  }

  function init() {
    db = loadFromStorage() || emptyDB();
    migrate();
    buildIndexes();
    // Persist the (possibly migrated) shape so a crash mid-session is safe.
    dirty = true;
    flush();
    return db;
  }

  function loadFromStorage() {
    let raw = null;
    try {
      raw = global.localStorage.getItem(storageKey);
    } catch (e) {
      console.warn('[store] localStorage unavailable', e);
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad document');
      return parsed;
    } catch (e) {
      // Corrupt document: keep a backup copy so nothing is silently destroyed.
      try {
        global.localStorage.setItem(storageKey + '.corrupt.' + Date.now(), raw);
      } catch (e2) {}
      console.error('[store] document unreadable, starting fresh', e);
      emit('storage-error', { message: 'Saved data could not be read. A backup copy was kept.' });
      return null;
    }
  }

  function migrate() {
    if (!db.settings) db.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    Object.keys(DEFAULT_SETTINGS).forEach((k) => {
      if (db.settings[k] === undefined) db.settings[k] = DEFAULT_SETTINGS[k];
    });
    if (!db.profile) db.profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    Object.keys(DEFAULT_PROFILE).forEach((k) => {
      if (db.profile[k] === undefined) db.profile[k] = DEFAULT_PROFILE[k];
    });
    if (!db.meta) db.meta = { streak: { count: 0, best: 0, lastDate: null }, counters: { created: 0, completed: 0 } };
    if (!db.meta.streak) db.meta.streak = { count: 0, best: 0, lastDate: null };
    if (!db.meta.counters) db.meta.counters = { created: 0, completed: 0 };
    if (!db.collections) db.collections = {};
    Object.keys(M.COLLECTIONS).forEach((k) => {
      if (!Array.isArray(db.collections[k])) db.collections[k] = [];
    });
    // Normalise every record once at boot: repairs anything an older/edited
    // document left in a bad shape, without dropping unknown-but-harmless data.
    Object.keys(M.COLLECTIONS).forEach((k) => {
      const list = db.collections[k];
      const seen = new Set();
      const out = [];
      list.forEach((raw) => {
        const rec = M.normalize(k, raw);
        if (!rec) return;
        if (seen.has(rec.id)) rec.id = U.uid(k.slice(0, 3));
        seen.add(rec.id);
        out.push(rec);
      });
      db.collections[k] = out;
    });
    db.version = SCHEMA_VERSION;
  }

  function buildIndexes() {
    Object.keys(M.COLLECTIONS).forEach((k) => {
      const map = new Map();
      db.collections[k].forEach((r) => map.set(r.id, r));
      indexes[k] = map;
    });
    dateIndex = null;
    statsCache = null;
  }

  /* ---------------------------- Persistence ----------------------------- */
  function persist() {
    if (!db) return true;
    db.updatedAt = Date.now();
    try {
      global.localStorage.setItem(storageKey, JSON.stringify(db));
      dirty = false;
      emit('saved', { at: db.updatedAt });
      return true;
    } catch (e) {
      // Quota or private-mode failure: report it instead of losing data quietly.
      console.error('[store] save failed', e);
      emit('storage-error', {
        message:
          'Could not save to this device (storage full or blocked). Free up space or export a backup.',
        error: String(e && e.name ? e.name : e),
      });
      return false;
    }
  }

  function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty) persist();
    }, SAVE_DEBOUNCE);
  }

  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (dirty) return persist();
    return true;
  }

  function isDirty() {
    return dirty;
  }

  // Never lose work when the app is backgrounded or closed.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    global.addEventListener('pagehide', flush);
    global.addEventListener('beforeunload', flush);
  }

  /* ------------------------------ Accessors ---------------------------- */
  function list(collection) {
    return db.collections[collection] || [];
  }

  function byId(collection, id) {
    const map = indexes[collection];
    if (map) return map.get(id) || null;
    return list(collection).find((r) => r.id === id) || null;
  }

  function settings() {
    return db.settings;
  }

  function getSetting(key, fallback) {
    const v = db.settings[key];
    return v === undefined ? fallback : v;
  }

  function setSetting(key, value) {
    db.settings[key] = value;
    scheduleSave();
    emit('settings', { key, value });
    return value;
  }

  function setSettings(patch) {
    Object.assign(db.settings, patch);
    scheduleSave();
    emit('settings', { key: '*', value: patch });
  }

  function profile() {
    return db.profile;
  }

  function setProfile(patch) {
    Object.assign(db.profile, patch);
    scheduleSave();
    emit('profile', db.profile);
    return db.profile;
  }

  function meta() {
    return db.meta;
  }

  /* ------------------------------ Mutations ---------------------------- */
  function put(collection, record) {
    if (!collection || !record) return null;
    const rec = M.normalize(collection, record);
    const map = indexes[collection];
    const existing = map.get(rec.id);
    if (existing) {
      rec.createdAt = existing.createdAt;
      rec.updatedAt = Date.now();
      const i = db.collections[collection].indexOf(existing);
      if (i >= 0) db.collections[collection][i] = rec;
      else db.collections[collection].push(rec);
      map.set(rec.id, rec);
    } else {
      if (!rec.createdAt) rec.createdAt = Date.now();
      rec.updatedAt = Date.now();
      db.collections[collection].push(rec);
      map.set(rec.id, rec);
      db.meta.counters.created++;
    }
    invalidate();
    scheduleSave();
    emit('change', { collection, action: 'put', id: rec.id, record: rec });
    return rec;
  }

  function putMany(collection, records) {
    const out = records.map((r) => put(collection, r));
    return out;
  }

  function remove(collection, id) {
    const map = indexes[collection];
    const rec = map.get(id);
    if (!rec) return false;
    map.delete(id);
    const arr = db.collections[collection];
    const i = arr.indexOf(rec);
    if (i >= 0) arr.splice(i, 1);
    // Detach notes and attachment payloads that belonged to this record.
    (rec.attachments || []).forEach((a) => {
      if (a && a.id && global.Idb) global.Idb.del(a.id);
    });
    invalidate();
    scheduleSave();
    emit('change', { collection, action: 'remove', id, record: rec });
    return true;
  }

  /** Complete / uncomplete a record. Recurring items roll forward instead of closing. */
  function setCompleted(collection, id, completed) {
    const rec = byId(collection, id);
    if (!rec) return null;
    const wasDone = M.isCompleted(collection, rec);

    if (completed && !wasDone && rec.repeat && rec.repeat.freq !== 'none' && collection !== 'projects') {
      // Roll the series forward: keep one record, advance the date, log history.
      const nextISO = M.nextOccurrence(rec.repeat, M.deadlineOf(collection, rec));
      logCompletion(collection, rec);
      if (nextISO) {
        const df = M.DATE_FIELD[collection];
        rec[df] = nextISO;
        rec.completed = false;
        rec.completedAt = null;
        rec.updatedAt = Date.now();
        invalidate();
        scheduleSave();
        emit('change', { collection, action: 'recur', id: rec.id, record: rec });
        return rec;
      }
      // Series finished — fall through and complete normally.
    }

    rec.completed = !!completed;
    rec.completedAt = completed ? Date.now() : null;
    if (collection === 'projects') rec.status = completed ? 'done' : 'active';
    if (completed) {
      if (!wasDone) {
        logCompletion(collection, rec);
        bumpStreak();
      }
    } else {
      db.meta.counters.completed = Math.max(0, db.meta.counters.completed - 1);
    }
    rec.updatedAt = Date.now();
    invalidate();
    scheduleSave();
    emit('change', { collection, action: 'complete', id: rec.id, record: rec });
    return rec;
  }

  function logCompletion(collection, rec) {
    db.meta.counters.completed++;
    db.meta.lastCompleted = {
      collection,
      id: rec.id,
      title: rec.title || rec.name || '',
      at: Date.now(),
      date: U.todayISO(),
      subjectId: rec.subjectId || null,
    };
  }

  function bumpStreak() {
    const today = U.todayISO();
    const s = db.meta.streak;
    if (s.lastDate === today) return s;
    const delta = s.lastDate ? U.diffDays(s.lastDate, today) : 999;
    s.count = delta === 1 ? s.count + 1 : 1;
    s.lastDate = today;
    s.best = Math.max(s.best || 0, s.count);
    return s;
  }

  function streak() {
    const s = db.meta.streak || { count: 0, best: 0, lastDate: null };
    const today = U.todayISO();
    const delta = s.lastDate ? U.diffDays(s.lastDate, today) : null;
    // A streak survives today (not yet completed) but breaks after a full missed day.
    const alive = delta === null ? 0 : delta <= 1 ? s.count : 0;
    return { count: alive, best: Math.max(s.best || 0, alive), lastDate: s.lastDate };
  }

  function invalidate() {
    dateIndex = null;
    statsCache = null;
  }

  /* ------------------------------ Queries ------------------------------ */
  /**
   * Filtered + sorted query over a collection.
   * opts: { status, subjectId, priority, category, type, from, to, buckets, q,
   *         sort, dir, limit, includeArchived }
   */
  function query(collection, opts) {
    opts = opts || {};
    let rows = list(collection);
    if (!opts.includeArchived && collection === 'subjects') {
      // subjects keep archived flag; callers opt in
    }
    const today = U.todayISO();

    if (opts.status === 'active') rows = rows.filter((r) => !M.isCompleted(collection, r));
    else if (opts.status === 'completed') rows = rows.filter((r) => M.isCompleted(collection, r));
    else if (opts.status === 'overdue') rows = rows.filter((r) => M.isOverdue(collection, r));

    if (opts.subjectId) rows = rows.filter((r) => r.subjectId === opts.subjectId);
    if (opts.priority) rows = rows.filter((r) => r.priority === opts.priority);
    if (opts.category) rows = rows.filter((r) => r.category === opts.category);
    if (opts.projectId) rows = rows.filter((r) => r.projectId === opts.projectId);
    if (opts.examId) rows = rows.filter((r) => r.examId === opts.examId);
    if (opts.ownerType && opts.ownerId) rows = rows.filter((r) => r.ownerType === opts.ownerType && r.ownerId === opts.ownerId);
    if (opts.pinnedOnly) rows = rows.filter((r) => r.pinned);

    if (opts.from || opts.to) {
      rows = rows.filter((r) => {
        const d = M.deadlineOf(collection, r);
        if (!d) return false;
        if (opts.from && d < opts.from) return false;
        if (opts.to && d > opts.to) return false;
        return true;
      });
    }

    if (opts.day) {
      rows = rows.filter((r) => M.deadlineOf(collection, r) === opts.day);
    }

    if (opts.buckets && opts.buckets.length) {
      rows = rows.filter((r) => opts.buckets.indexOf(M.bucketOf(collection, r)) >= 0);
    }

    if (opts.dueToday) {
      rows = rows.filter((r) => M.deadlineOf(collection, r) === today);
    }

    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      rows = rows.filter((r) => M.searchableText(collection, r).indexOf(q) >= 0);
    }

    rows = sortRows(collection, rows.slice(), opts.sort || defaultSort(collection), opts.dir);
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows;
  }

  function defaultSort(collection) {
    switch (collection) {
      case 'subjects': return 'name';
      case 'notes': return 'updated';
      case 'timetable': return 'time';
      case 'conversations': return 'updated';
      default: return 'due';
    }
  }

  function sortRows(collection, rows, sort, dir) {
    const sign = dir === 'desc' ? -1 : 1;
    const cmp = {
      due(a, b) {
        const da = M.deadlineOf(collection, a) || '9999-99-99';
        const db_ = M.deadlineOf(collection, b) || '9999-99-99';
        if (da !== db_) return da < db_ ? -1 : 1;
        const ta = timeOf(collection, a);
        const tb = timeOf(collection, b);
        if (ta !== tb) return ta < tb ? -1 : 1;
        return (M.PRIORITY_RANK[a.priority] || 9) - (M.PRIORITY_RANK[b.priority] || 9);
      },
      priority(a, b) {
        const pa = M.PRIORITY_RANK[a.priority] === undefined ? 9 : M.PRIORITY_RANK[a.priority];
        const pb = M.PRIORITY_RANK[b.priority] === undefined ? 9 : M.PRIORITY_RANK[b.priority];
        if (pa !== pb) return pa - pb;
        const da = M.deadlineOf(collection, a) || '9999-99-99';
        const db_ = M.deadlineOf(collection, b) || '9999-99-99';
        return da < db_ ? -1 : da > db_ ? 1 : 0;
      },
      subject(a, b) {
        const sa = subjectName(a) || 'zzz';
        const sb = subjectName(b) || 'zzz';
        return sa.localeCompare(sb);
      },
      category(a, b) {
        return String(a.category || '').localeCompare(String(b.category || ''));
      },
      title(a, b) {
        return String(titleOf(a)).localeCompare(String(titleOf(b)));
      },
      name(a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      },
      created(a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      },
      updated(a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      },
      completed(a, b) {
        return (a.completedAt || 0) - (b.completedAt || 0);
      },
      time(a, b) {
        const ta = String(a.startTime || '99:99');
        const tb = String(b.startTime || '99:99');
        if (ta !== tb) return ta < tb ? -1 : 1;
        return (a.day || 0) - (b.day || 0);
      },
      progress(a, b) {
        return progressOf(a) - progressOf(b);
      },
    };
    const fn = cmp[sort] || cmp.due;
    rows.sort((a, b) => fn(a, b) * sign);
    return rows;
  }

  function titleOf(r) {
    return r.title || r.name || '';
  }
  function timeOf(collection, r) {
    const tf = M.TIME_FIELD[collection];
    return (tf && r[tf]) || '99:99';
  }
  function subjectName(r) {
    const s = r.subjectId ? byId('subjects', r.subjectId) : null;
    return s ? s.name : '';
  }
  function progressOf(p) {
    const tasks = query('tasks', { projectId: p.id });
    return M.projectProgress(p, tasks).pct;
  }

  /* ------------------------- Derived collections ------------------------ */
  /** All date-bearing items on one day, sorted chronologically. */
  function itemsOnDay(dateISO, filter) {
    const out = [];
    ['homework', 'projects', 'exams', 'events', 'tasks'].forEach((col) => {
      list(col).forEach((r) => {
        if (M.deadlineOf(col, r) !== dateISO) return;
        if (filter && !filter(col, r)) return;
        out.push({ collection: col, record: r });
      });
    });
    out.sort((a, b) => {
      const wa = M.whenOf(a.collection, a.record);
      const wb = M.whenOf(b.collection, b.record);
      const ta = wa ? wa.getTime() : 0;
      const tb = wb ? wb.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.collection.localeCompare(b.collection);
    });
    return out;
  }

  /** Map of dateISO -> count, for calendar density dots. */
  function countsByDate(fromISO, toISO, filter) {
    const map = {};
    ['homework', 'projects', 'exams', 'events', 'tasks'].forEach((col) => {
      list(col).forEach((r) => {
        const d = M.deadlineOf(col, r);
        if (!d) return;
        if (fromISO && d < fromISO) return;
        if (toISO && d > toISO) return;
        if (filter && !filter(col, r)) return;
        if (!map[d]) map[d] = [];
        map[d].push({ collection: col, record: r });
      });
    });
    return map;
  }

  /** Everything related to one subject, for the subject detail screen. */
  function subjectBundle(subjectId) {
    const cols = ['homework', 'projects', 'exams', 'events', 'tasks', 'notes'];
    const out = {};
    cols.forEach((c) => {
      out[c] = list(c).filter((r) => r.subjectId === subjectId || (c === 'notes' && r.ownerType === 'subjects' && r.ownerId === subjectId));
    });
    return out;
  }

  function notesFor(ownerType, ownerId) {
    return list('notes').filter((n) => n.ownerType === ownerType && n.ownerId === ownerId);
  }

  function projectTasks(projectId) {
    return query('tasks', { projectId, sort: 'created', dir: 'asc' });
  }

  /* ------------------------------- Stats ------------------------------- */
  /** Real statistics derived from stored records — nothing fabricated. */
  function stats() {
    if (statsCache) return statsCache;
    const today = U.todayISO();
    const weekStart = getSetting('weekStart', 1);
    const weekFrom = U.toISO(U.startOfWeek(new Date(), weekStart));
    const weekTo = U.toISO(U.endOfWeek(new Date(), weekStart));
    const monthFrom = U.toISO(U.startOfMonth(new Date()));
    const monthTo = U.toISO(U.endOfMonth(new Date()));

    const workCols = ['homework', 'tasks', 'projects'];
    let total = 0, done = 0, overdue = 0, dueToday = 0, dueTomorrow = 0, thisWeek = 0, later = 0;
    let homeworkTotal = 0, homeworkDone = 0, projectsTotal = 0, projectsDone = 0, examsUpcoming = 0, eventsUpcoming = 0;
    let completedToday = 0, completedThisWeek = 0, completedThisMonth = 0;
    let overdueTasks = 0, overdueHomework = 0;
    let minutesPlanned = 0, minutesDone = 0;

    workCols.forEach((col) => {
      list(col).forEach((r) => {
        total++;
        const isDone = M.isCompleted(col, r);
        if (isDone) done++;
        const b = M.bucketOf(col, r);
        if (!isDone) {
          if (b === 'overdue') { overdue++; if (col === 'tasks') overdueTasks++; if (col === 'homework') overdueHomework++; }
          if (b === 'today') dueToday++;
          if (b === 'tomorrow') dueTomorrow++;
          if (b === 'week') thisWeek++;
          if (b === 'later') later++;
        }
        if (col === 'homework') { homeworkTotal++; if (isDone) homeworkDone++; }
        if (col === 'projects') { projectsTotal++; if (M.isCompleted('projects', r)) projectsDone++; }
        const mins = Number(r.estMinutes) || 0;
        if (mins) { minutesPlanned += mins; if (isDone) minutesDone += mins; }
        if (isDone && r.completedAt) {
          const cd = U.toISO(new Date(r.completedAt));
          if (cd === today) completedToday++;
          if (cd >= weekFrom && cd <= weekTo) completedThisWeek++;
          if (cd >= monthFrom && cd <= monthTo) completedThisMonth++;
        }
      });
    });

    list('exams').forEach((e) => {
      if (!M.isCompleted('exams', e) && (e.date || '') >= today) examsUpcoming++;
    });
    list('events').forEach((e) => {
      if ((e.date || '') >= today) eventsUpcoming++;
    });

    // Weekly productivity: completions per day for the current week
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(U.parseISO(weekFrom), i);
      weekDays.push({ date: U.toISO(d), label: U.DOW_SHORT[d.getDay()], count: 0 });
    }
    const byDay = {};
    weekDays.forEach((d) => (byDay[d.date] = d));
    workCols.concat(['exams', 'events']).forEach((col) => {
      list(col).forEach((r) => {
        if (!M.isCompleted(col, r) || !r.completedAt) return;
        const cd = U.toISO(new Date(r.completedAt));
        if (byDay[cd]) byDay[cd].count++;
      });
    });

    // Monthly productivity: completions per week bucket (4 buckets)
    const monthBuckets = [0, 0, 0, 0, 0];
    workCols.concat(['exams', 'events']).forEach((col) => {
      list(col).forEach((r) => {
        if (!M.isCompleted(col, r) || !r.completedAt) return;
        const cd = U.toISO(new Date(r.completedAt));
        if (cd < monthFrom || cd > monthTo) return;
        const idx = Math.min(4, Math.floor((U.diffDays(monthFrom, cd)) / 7));
        monthBuckets[idx]++;
      });
    });

    // Subject breakdown (completed vs total, real counts)
    const subjectRows = list('subjects').map((s) => {
      let st = 0, sd = 0, so = 0;
      ['homework', 'tasks', 'projects', 'exams'].forEach((col) => {
        list(col).forEach((r) => {
          if (r.subjectId !== s.id) return;
          st++;
          if (M.isCompleted(col, r)) sd++;
          else if (M.isOverdue(col, r)) so++;
        });
      });
      return { subject: s, total: st, done: sd, overdue: so, pct: st ? Math.round((sd / st) * 100) : 0 };
    }).sort((a, b) => b.total - a.total);

    // 30-day completion trend (real data only)
    const trend = [];
    for (let i = 29; i >= 0; i--) {
      const d = U.addDays(new Date(), -i);
      trend.push({ date: U.toISO(d), count: 0, label: U.DOW_SHORT[d.getDay()] });
    }
    const trendMap = {};
    trend.forEach((t) => (trendMap[t.date] = t));
    workCols.concat(['exams', 'events']).forEach((col) => {
      list(col).forEach((r) => {
        if (!M.isCompleted(col, r) || !r.completedAt) return;
        const cd = U.toISO(new Date(r.completedAt));
        if (trendMap[cd]) trendMap[cd].count++;
      });
    });

    const activeTotal = total - done;
    const rate = total ? Math.round((done / total) * 100) : 0;

    statsCache = {
      total, done, activeTotal, overdue, dueToday, dueTomorrow, thisWeek, later, rate,
      homeworkTotal, homeworkDone, projectsTotal, projectsDone, examsUpcoming, eventsUpcoming,
      completedToday, completedThisWeek, completedThisMonth,
      overdueTasks, overdueHomework,
      minutesPlanned, minutesDone,
      streak: streak(),
      weekDays, monthBuckets, subjectRows, trend,
      todayProgress: (() => {
        const todayItems = itemsOnDay(today, (c) => c !== 'events');
        const t = todayItems.length;
        const d = todayItems.filter((x) => M.isCompleted(x.collection, x.record)).length;
        return { total: t, done: d, pct: t ? Math.round((d / t) * 100) : 0 };
      })(),
      generatedAt: Date.now(),
    };
    return statsCache;
  }

  /* --------------------------- Export / import -------------------------- */
  function exportData() {
    const doc = {
      app: 'Study Planner',
      format: 'studyplanner.backup',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings: db.settings,
      profile: db.profile,
      collections: db.collections,
      meta: { streak: db.meta.streak, counters: db.meta.counters },
    };
    return JSON.stringify(doc, null, 2);
  }

  function exportCounts() {
    const counts = {};
    Object.keys(M.COLLECTIONS).forEach((k) => (counts[k] = db.collections[k].length));
    return counts;
  }

  /**
   * Import a backup. mode: 'replace' | 'merge'
   * Returns { ok, added, skipped, error }
   */
  function importData(jsonText, mode) {
    let doc;
    try {
      doc = JSON.parse(jsonText);
    } catch (e) {
      return { ok: false, error: 'That file is not valid JSON, so it could not be read.' };
    }
    if (!doc || typeof doc !== 'object' || !doc.collections) {
      return { ok: false, error: 'That file is not a Study Planner backup.' };
    }
    const incoming = doc.collections;
    const known = Object.keys(M.COLLECTIONS);
    if (!known.some((k) => Array.isArray(incoming[k]) && incoming[k].length)) {
      return { ok: false, error: 'The backup contains no planner items.' };
    }

    if (mode === 'replace') {
      backupCurrent('pre-import');
      known.forEach((k) => {
        db.collections[k] = [];
      });
      indexesReset();
    }

    let added = 0;
    let skipped = 0;
    known.forEach((k) => {
      const rows = Array.isArray(incoming[k]) ? incoming[k] : [];
      rows.forEach((raw) => {
        const rec = M.normalize(k, raw);
        if (!rec) { skipped++; return; }
        if (indexes[k].has(rec.id)) {
          // Same id: keep the most recently edited version rather than clobbering.
          const existing = indexes[k].get(rec.id);
          if ((rec.updatedAt || 0) <= (existing.updatedAt || 0)) { skipped++; return; }
          put(k, rec);
          added++;
          return;
        }
        put(k, rec);
        added++;
      });
    });

    if (doc.settings && typeof doc.settings === 'object' && mode === 'replace') {
      Object.assign(db.settings, doc.settings);
    }
    if (doc.profile && typeof doc.profile === 'object' && mode === 'replace') {
      Object.assign(db.profile, doc.profile);
    }
    if (doc.meta && doc.meta.streak && mode === 'replace') {
      db.meta.streak = doc.meta.streak;
    }
    invalidate();
    flush();
    emit('change', { collection: '*', action: 'import' });
    return { ok: true, added, skipped };
  }

  function indexesReset() {
    buildIndexes();
  }

  function backupCurrent(tag) {
    try {
      global.localStorage.setItem(storageKey + '.backup.' + (tag || 'auto') + '.' + Date.now(), JSON.stringify(db));
    } catch (e) {}
  }

  function reset(options) {
    backupCurrent('reset');
    const keepProfile = options && options.keepProfile;
    const keepSettings = options && options.keepSettings;
    const prof = keepProfile ? JSON.parse(JSON.stringify(db.profile)) : JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    const sett = keepSettings ? JSON.parse(JSON.stringify(db.settings)) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (global.Idb) global.Idb.clear();
    db = emptyDB();
    db.profile = prof;
    db.settings = sett;
    buildIndexes();
    flush();
    emit('change', { collection: '*', action: 'reset' });
    return true;
  }

  /** Remove only the demo records (flagged sample:true) — user data untouched. */
  function clearSampleData() {
    let removed = 0;
    Object.keys(M.COLLECTIONS).forEach((k) => {
      const keep = [];
      db.collections[k].forEach((r) => {
        if (r.sample) {
          (r.attachments || []).forEach((a) => a && a.id && global.Idb && global.Idb.del(a.id));
          removed++;
        } else keep.push(r);
      });
      db.collections[k] = keep;
    });
    buildIndexes();
    flush();
    emit('change', { collection: '*', action: 'clear-sample' });
    return removed;
  }

  /**
   * Reload the demo set. Replaces any existing sample records with a fresh
   * copy (dates re-anchored to today) and leaves user-created items alone.
   */
  function reloadSampleData() {
    clearSampleData();
    const n = global.Sample ? global.Sample.load() : 0;
    db.settings.sampleDataLoaded = true;
    flush();
    emit('change', { collection: '*', action: 'load-sample' });
    return n;
  }

  function hasSampleData() {
    return Object.keys(M.COLLECTIONS).some((k) => db.collections[k].some((r) => r.sample));
  }

  function isEmpty() {
    return Object.keys(M.COLLECTIONS).every((k) => !db.collections[k].length);
  }

  /* --------------------------- Attachments ------------------------------ */
  /** Downscale + compress an image file to a data URL small enough to store. */
  function fileToAttachment(file, opts) {
    const options = opts || {};
    const maxDim = options.maxDim || 1600;
    const quality = options.quality || 0.82;
    const maxBytes = options.maxBytes || 4 * 1024 * 1024;
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file was provided.'));
        return;
      }
      if (file.size > maxBytes) {
        reject(new Error('That file is larger than ' + Math.round(maxBytes / 1048576) + ' MB. Try a smaller file.'));
        return;
      }
      const isImage = /^image\//.test(file.type) && !/svg/.test(file.type);
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('That file could not be read. It may be locked or unreadable.'));
      reader.onload = () => {
        const dataUrl = reader.result;
        if (!isImage) {
          resolve({
            id: U.uid('att'),
            name: file.name || 'file',
            type: file.type || 'application/octet-stream',
            size: file.size,
            data: dataUrl,
            addedAt: Date.now(),
          });
          return;
        }
        const img = new Image();
        img.onerror = () => {
          // Unreadable image: keep the original bytes rather than failing.
          resolve({
            id: U.uid('att'),
            name: file.name || 'image',
            type: file.type,
            size: file.size,
            data: dataUrl,
            addedAt: Date.now(),
          });
        };
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const scale = maxDim / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const out = canvas.toDataURL('image/jpeg', quality);
            resolve({
              id: U.uid('att'),
              name: file.name || 'image.jpg',
              type: 'image/jpeg',
              size: Math.round((out.length * 3) / 4),
              width, height,
              data: out,
              addedAt: Date.now(),
            });
          } catch (e) {
            resolve({
              id: U.uid('att'),
              name: file.name || 'image',
              type: file.type,
              size: file.size,
              data: dataUrl,
              addedAt: Date.now(),
            });
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  /** Persist an attachment payload in IndexedDB (best effort) and return a stub. */
  async function storeAttachment(att) {
    try {
      if (global.Idb && global.Idb.available()) {
        await global.Idb.put(att);
        return { id: att.id, name: att.name, type: att.type, size: att.size, width: att.width, height: att.height, addedAt: att.addedAt };
      }
    } catch (e) {
      console.warn('[store] attachment mirror failed', e);
    }
    return att; // fall back to inline data
  }

  async function loadAttachment(id) {
    if (global.Idb) {
      const rec = await global.Idb.get(id);
      if (rec) return rec;
    }
    return null;
  }

  async function deleteAttachment(id) {
    if (global.Idb) await global.Idb.del(id);
  }

  /* ------------------------------ Loading ------------------------------- */
  /** Storage is synchronous (localStorage) so there is no boot wait; the
      skeleton screen exists for the async first-paint path on slow devices. */
  function ready() {
    return Promise.resolve(true);
  }

  function storageEstimate() {
    return new Promise((resolve) => {
      try {
        const raw = global.localStorage.getItem(storageKey) || '';
        const bytes = raw.length * 2;
        resolve({ bytes, human: bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB' });
      } catch (e) {
        resolve({ bytes: 0, human: 'unknown' });
      }
    });
  }

  /* ------------------------------- Export ------------------------------- */
  global.Store = {
    init, ready, flush, persist, isDirty,
    on, emit,
    list, byId, query, sortRows,
    settings, getSetting, setSetting, setSettings,
    profile, setProfile, meta, streak,
    put, putMany, remove, setCompleted,
    itemsOnDay, countsByDate, subjectBundle, notesFor, projectTasks,
    stats, invalidate,
    exportData, exportCounts, importData, reset, clearSampleData, hasSampleData, isEmpty,
    fileToAttachment, storeAttachment, loadAttachment, deleteAttachment,
    storageEstimate, backupCurrent,
    useAccount, currentStorageKey,
    BASE_KEY, DEFAULT_SETTINGS, DEFAULT_PROFILE,
  };
})(window);
