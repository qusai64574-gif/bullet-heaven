/* ==========================================================================
   models.js — data model: collections, schemas, factories, domain logic
   Pure logic over records; no storage or DOM.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;

  /* ============================ Collections ============================= */
  const COLLECTIONS = {
    homework: 'homework',
    projects: 'projects',
    exams: 'exams',
    events: 'events',
    tasks: 'tasks',
    subjects: 'subjects',
    timetable: 'timetable',
    notes: 'notes',
    conversations: 'conversations',
  };

  const TYPE_META = {
    homework: { key: 'homework', label: 'Homework', icon: 'book', chip: 't-homework', color: 'var(--type-homework)', form: 'homework' },
    projects: { key: 'project', label: 'Project', icon: 'folder', chip: 't-project', color: 'var(--type-project)', form: 'project' },
    exams: { key: 'exam', label: 'Exam', icon: 'clipboard', chip: 't-exam', color: 'var(--type-exam)', form: 'exam' },
    events: { key: 'event', label: 'Event', icon: 'calendar', chip: 't-event', color: 'var(--type-event)', form: 'event' },
    tasks: { key: 'task', label: 'Task', icon: 'checkCircle', chip: 't-task', color: 'var(--type-task)', form: 'task' },
    notes: { key: 'note', label: 'Note', icon: 'file', chip: 't-note', color: 'var(--type-note)', form: 'note' },
  };

  const PRIORITIES = [
    { value: 'low', label: 'Low', icon: 'arrowDown' },
    { value: 'medium', label: 'Medium', icon: 'arrowUp' },
    { value: 'high', label: 'High', icon: 'warning' },
    { value: 'urgent', label: 'Urgent', icon: 'zap' },
  ];
  const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

  const CATEGORIES = [
    { value: 'homework', label: 'Homework', icon: 'book' },
    { value: 'study', label: 'Study', icon: 'cap' },
    { value: 'project', label: 'Project', icon: 'folder' },
    { value: 'personal', label: 'Personal', icon: 'user' },
    { value: 'school', label: 'School', icon: 'school' },
    { value: 'other', label: 'Other', icon: 'more' },
  ];

  const IMPORTANCE = [
    { value: 'low', label: 'Low stakes' },
    { value: 'medium', label: 'Normal' },
    { value: 'high', label: 'Important' },
    { value: 'critical', label: 'Critical' },
  ];

  const REPEAT_FREQ = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'weekdays', label: 'Every weekday' },
    { value: 'custom', label: 'Custom days' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const REMINDER_OPTIONS = [
    { value: 0, label: 'At due time' },
    { value: 15, label: '15 min before' },
    { value: 60, label: '1 hour before' },
    { value: 180, label: '3 hours before' },
    { value: 1440, label: '1 day before' },
    { value: 4320, label: '3 days before' },
    { value: 10080, label: '1 week before' },
  ];

  const SUBJECT_COLORS = [
    '#4f6bed', '#8b5cf6', '#d9544d', '#0f9d76', '#b7791f',
    '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    '#64748b', '#a855f7',
  ];

  const SUBJECT_ICONS = ['book', 'cap', 'chart', 'coffee', 'file', 'folder', 'gauge', 'layers', 'pin', 'star', 'target', 'zap'];

  const DEFAULT_REMINDERS = [1440, 60]; // 1 day + 1 hour before

  /* ============================== Schemas =============================== */
  /** Field types: text, textarea, select, date, time, number, priority, category,
      subject, importance, repeat, reminders, tags, members, attachments, checklist */
  const SCHEMAS = {
    homework: {
      label: 'Homework',
      singular: 'Homework',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Chapter 4 exercises', autofocus: true },
        { key: 'subjectId', label: 'Subject', type: 'subject' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What exactly is required?' },
        { key: 'dueDate', label: 'Due date', type: 'date', required: true, default: 'today' },
        { key: 'dueTime', label: 'Due time', type: 'time', default: '23:59' },
        { key: 'priority', label: 'Priority', type: 'priority', default: 'medium' },
        { key: 'estMinutes', label: 'Estimated time', type: 'duration', default: 45 },
        { key: 'teacher', label: 'Teacher (optional)', type: 'text', placeholder: 'e.g. Ms. Haddad' },
        { key: 'unit', label: 'Chapter / unit (optional)', type: 'text', placeholder: 'e.g. Unit 3 — Fractions' },
        { key: 'repeat', label: 'Repeat', type: 'repeat' },
        { key: 'reminders', label: 'Reminders', type: 'reminders' },
        { key: 'attachments', label: 'Attachments', type: 'attachments' },
      ],
    },
    projects: {
      label: 'Project',
      singular: 'Project',
      fields: [
        { key: 'title', label: 'Project name', type: 'text', required: true, placeholder: 'e.g. Science fair project', autofocus: true },
        { key: 'subjectId', label: 'Subject', type: 'subject' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Goal, requirements, deliverable…' },
        { key: 'dueDate', label: 'Due date', type: 'date', required: true, default: 'today' },
        { key: 'priority', label: 'Priority', type: 'priority', default: 'medium' },
        { key: 'teacher', label: 'Teacher (optional)', type: 'text' },
        { key: 'members', label: 'Team members', type: 'members', placeholder: 'Add a teammate' },
        { key: 'milestones', label: 'Milestones', type: 'milestones' },
        { key: 'reminders', label: 'Reminders', type: 'reminders' },
        { key: 'attachments', label: 'Attachments', type: 'attachments' },
      ],
    },
    exams: {
      label: 'Exam',
      singular: 'Exam',
      fields: [
        { key: 'title', label: 'Exam name', type: 'text', required: true, placeholder: 'e.g. Math — Term 1 final', autofocus: true },
        { key: 'subjectId', label: 'Subject', type: 'subject' },
        { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
        { key: 'time', label: 'Start time', type: 'time', default: '09:00' },
        { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Room 204' },
        { key: 'importance', label: 'Exam importance', type: 'importance', default: 'high' },
        { key: 'topics', label: 'Topics covered', type: 'topics', placeholder: 'Add a topic' },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Allowed materials, format, tips…' },
        { key: 'reminders', label: 'Reminders', type: 'reminders' },
        { key: 'attachments', label: 'Attachments', type: 'attachments' },
      ],
    },
    events: {
      label: 'Event',
      singular: 'Event',
      fields: [
        { key: 'title', label: 'Event title', type: 'text', required: true, placeholder: 'e.g. School trip to the museum', autofocus: true },
        { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
        { key: 'startTime', label: 'Start time', type: 'time', default: '09:00' },
        { key: 'endTime', label: 'End time', type: 'time', default: '10:00' },
        { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Main hall' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'category', label: 'Category', type: 'category', default: 'school' },
        { key: 'repeat', label: 'Repeat', type: 'repeat' },
        { key: 'reminders', label: 'Reminders', type: 'reminders' },
      ],
    },
    tasks: {
      label: 'Task',
      singular: 'Task',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Read 20 minutes', autofocus: true },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'dueDate', label: 'Due date', type: 'date', default: 'today' },
        { key: 'dueTime', label: 'Due time', type: 'time', default: '18:00' },
        { key: 'priority', label: 'Priority', type: 'priority', default: 'medium' },
        { key: 'category', label: 'Category', type: 'category', default: 'study' },
        { key: 'subjectId', label: 'Subject', type: 'subject' },
        { key: 'estMinutes', label: 'Estimated duration', type: 'duration', default: 30 },
        { key: 'repeat', label: 'Recurrence', type: 'repeat' },
        { key: 'reminders', label: 'Reminders', type: 'reminders' },
      ],
    },
    subjects: {
      label: 'Subject',
      singular: 'Subject',
      fields: [
        { key: 'name', label: 'Subject name', type: 'text', required: true, placeholder: 'e.g. Mathematics', autofocus: true },
        { key: 'teacher', label: 'Teacher', type: 'text' },
        { key: 'room', label: 'Room', type: 'text' },
        { key: 'color', label: 'Color', type: 'color', default: '#4f6bed' },
        { key: 'icon', label: 'Icon', type: 'iconpick', default: 'book' },
      ],
    },
    notes: {
      label: 'Note',
      singular: 'Note',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Formulas to memorise', autofocus: true },
        { key: 'body', label: 'Note', type: 'textarea', placeholder: 'Write anything…' },
        { key: 'checklist', label: 'Checklist', type: 'checklist' },
      ],
    },
    timetable: {
      label: 'Class',
      singular: 'Class',
      fields: [
        { key: 'day', label: 'Day', type: 'select', options: U.DOW_LONG.map((d, i) => ({ value: i, label: d })), required: true },
        { key: 'startTime', label: 'Starts', type: 'time', default: '08:00', required: true },
        { key: 'endTime', label: 'Ends', type: 'time', default: '09:00' },
        { key: 'subjectId', label: 'Subject', type: 'subject' },
        { key: 'label', label: 'Label', type: 'text', placeholder: 'e.g. Break, Assembly' },
        { key: 'room', label: 'Room', type: 'text' },
        { key: 'kind', label: 'Type', type: 'select', default: 'class', options: [
          { value: 'class', label: 'Class' },
          { value: 'break', label: 'Break' },
        ] },
      ],
    },
  };

  /* ============================ Factories =============================== */
  function defaultValue(field) {
    if (field.default === 'today') return U.todayISO();
    if (field.default !== undefined) return field.default;
    switch (field.type) {
      case 'priority': return 'medium';
      case 'category': return 'other';
      case 'importance': return 'medium';
      case 'duration': return 30;
      case 'color': return SUBJECT_COLORS[0];
      case 'iconpick': return 'book';
      case 'reminders': return [];
      case 'attachments': return [];
      case 'members': return [];
      case 'milestones': return [];
      case 'topics': return [];
      case 'checklist': return [];
      case 'repeat': return repeatNone();
      case 'number': return 0;
      case 'date': return U.todayISO();
      case 'time': return '';
      case 'select': return field.options && field.options.length ? field.options[0].value : '';
      default: return '';
    }
  }

  function repeatNone() {
    return { freq: 'none', days: [], until: null };
  }

  /** Build a fully-formed record for a collection from a partial patch. */
  function create(collection, patch) {
    const schema = SCHEMAS[collection];
    const now = Date.now();
    const rec = {
      id: U.uid(collection.slice(0, 3)),
      createdAt: now,
      updatedAt: now,
      completed: false,
      completedAt: null,
      archived: false,
    };
    if (schema) {
      schema.fields.forEach((f) => {
        rec[f.key] = defaultValue(f);
      });
    }
    if (collection === 'projects') {
      rec.progressOverride = null;
      rec.status = 'active';
    }
    if (collection === 'subjects') {
      rec.archived = false;
      rec.schedule = [];
    }
    if (collection === 'notes') {
      rec.ownerType = null;
      rec.ownerId = null;
      rec.pinned = false;
      rec.body = '';
      rec.checklist = [];
    }
    Object.assign(rec, patch || {});
    return rec;
  }

  /** Sanitise a record coming from storage/import: unknown shapes are repaired. */
  function normalize(collection, raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rec = create(collection, {});
    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      if (v === undefined) return;
      rec[k] = v;
    });
    if (!rec.id || typeof rec.id !== 'string') rec.id = U.uid(collection.slice(0, 3));
    rec.createdAt = Number(rec.createdAt) || Date.now();
    rec.updatedAt = Number(rec.updatedAt) || rec.createdAt;
    rec.completed = !!rec.completed;
    if (rec.completed && !rec.completedAt) rec.completedAt = rec.updatedAt;

    // Repair typed fields
    if (SCHEMAS[collection]) {
      SCHEMAS[collection].fields.forEach((f) => {
        const v = rec[f.key];
        switch (f.type) {
          case 'date':
            if (!U.isValidISO(v)) rec[f.key] = f.key === 'dueDate' || f.key === 'date' ? U.todayISO() : null;
            break;
          case 'time':
            if (v && !/^\d{1,2}:\d{2}$/.test(String(v))) rec[f.key] = '';
            break;
          case 'duration':
          case 'number':
            rec[f.key] = Math.max(0, Number(v) || 0);
            break;
          case 'reminders':
            rec[f.key] = Array.isArray(v) ? v.map(Number).filter((n) => !isNaN(n) && n >= 0) : [];
            break;
          case 'attachments':
          case 'members':
          case 'milestones':
          case 'topics':
          case 'checklist':
            rec[f.key] = Array.isArray(v) ? v : [];
            break;
          case 'repeat':
            rec[f.key] = normalizeRepeat(v);
            break;
          case 'priority':
            if (!PRIORITY_RANK.hasOwnProperty(v)) rec[f.key] = 'medium';
            break;
          case 'category':
            if (!CATEGORIES.some((c) => c.value === v)) rec[f.key] = 'other';
            break;
          case 'importance':
            if (!IMPORTANCE.some((c) => c.value === v)) rec[f.key] = 'medium';
            break;
          default:
            if (rec[f.key] === undefined || rec[f.key] === null) rec[f.key] = defaultValue(f);
        }
      });
    }
    if (collection === 'projects') {
      if (rec.progressOverride !== null && rec.progressOverride !== undefined) {
        const n = Number(rec.progressOverride);
        rec.progressOverride = isNaN(n) ? null : U.clamp(Math.round(n), 0, 100);
      } else rec.progressOverride = null;
      rec.status = rec.status === 'done' ? 'done' : 'active';
      rec.members = (rec.members || []).map((m) => (typeof m === 'string' ? m : (m && m.name) || '')).filter(Boolean);
    }
    if (collection === 'subjects') {
      rec.color = /^#[0-9a-f]{3,8}$/i.test(rec.color || '') ? rec.color : SUBJECT_COLORS[0];
      rec.icon = SUBJECT_ICONS.indexOf(rec.icon) >= 0 ? rec.icon : 'book';
      rec.schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
    }
    if (collection === 'notes') {
      rec.checklist = (rec.checklist || []).map((c) => ({
        id: c && c.id ? c.id : U.uid('chk'),
        text: String((c && c.text) || ''),
        done: !!(c && c.done),
      }));
    }
    return rec;
  }

  function normalizeRepeat(v) {
    if (!v || typeof v !== 'object') return repeatNone();
    const freq = REPEAT_FREQ.some((f) => f.value === v.freq) ? v.freq : 'none';
    const days = Array.isArray(v.days) ? v.days.map(Number).filter((d) => d >= 0 && d <= 6) : [];
    const until = U.isValidISO(v.until) ? v.until : null;
    return { freq, days, until };
  }

  /* ============================ Domain logic ============================ */

  /** Which date field carries the deadline for a collection. */
  const DATE_FIELD = { homework: 'dueDate', projects: 'dueDate', exams: 'date', events: 'date', tasks: 'dueDate' };
  const TIME_FIELD = { homework: 'dueTime', projects: null, exams: 'time', events: 'startTime', tasks: 'dueTime' };

  function deadlineOf(collection, rec) {
    const df = DATE_FIELD[collection];
    return df && rec ? rec[df] : null;
  }

  /** When does this item happen (Date) — used for chronological ordering. */
  function whenOf(collection, rec) {
    const d = deadlineOf(collection, rec);
    if (!d) return null;
    const tf = TIME_FIELD[collection];
    return U.combine(d, tf ? rec[tf] : null);
  }

  function isCompleted(collection, rec) {
    if (!rec) return false;
    if (collection === 'projects') return rec.status === 'done' || !!rec.completed;
    if (collection === 'notes') return false;
    return !!rec.completed;
  }

  /** Overdue = past due date AND not completed. Completed items are never overdue. */
  function isOverdue(collection, rec) {
    if (!rec || isCompleted(collection, rec)) return false;
    if (collection === 'notes' || collection === 'subjects') return false;
    const d = deadlineOf(collection, rec);
    if (!d) return false;
    const today = U.todayISO();
    if (d < today) return true;
    if (d === today) {
      const tf = TIME_FIELD[collection];
      const t = tf ? rec[tf] : null;
      if (!t) return false;
      const due = U.combine(d, t);
      return !!(due && due.getTime() < Date.now());
    }
    return false;
  }

  function overdueDays(collection, rec) {
    const d = deadlineOf(collection, rec);
    if (!d) return 0;
    const delta = U.diffDays(d, U.todayISO());
    return Math.max(0, delta);
  }

  /** Deadline buckets used by Home / Tasks / Deadlines views. */
  function bucketOf(collection, rec) {
    if (isCompleted(collection, rec)) return 'done';
    const d = deadlineOf(collection, rec);
    if (!d) return 'later';
    const delta = U.diffDays(U.todayISO(), d);
    if (delta < 0) return 'overdue';
    if (delta === 0) return 'today';
    if (delta === 1) return 'tomorrow';
    if (delta <= 7) return 'week';
    return 'later';
  }

  const BUCKET_LABELS = {
    overdue: 'Overdue',
    today: 'Due today',
    tomorrow: 'Due tomorrow',
    week: 'This week',
    later: 'Later',
    done: 'Completed',
  };

  /** Project progress: subtasks drive it unless manually overridden. */
  function projectProgress(project, projectTasks) {
    const tasks = projectTasks || [];
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    if (project && project.progressOverride !== null && project.progressOverride !== undefined) {
      return { pct: U.clamp(Math.round(project.progressOverride), 0, 100), done, total, manual: true };
    }
    if (!total) return { pct: isCompleted('projects', project) ? 100 : 0, done: 0, total: 0, manual: false };
    return { pct: Math.round((done / total) * 100), done, total, manual: false };
  }

  /* ------------------------------ Recurrence ---------------------------- */
  /**
   * Next date (ISO) for a repeat spec after `fromISO`, or null.
   * daily/weekly/weekdays/custom/monthly.
   */
  function nextOccurrence(repeat, fromISO) {
    const r = normalizeRepeat(repeat);
    if (r.freq === 'none') return null;
    const base = U.parseISO(fromISO);
    if (!base) return null;
    let cursor = U.addDays(base, 1);
    for (let i = 0; i < 400; i++) {
      const iso = U.toISO(cursor);
      if (r.until && iso > r.until) return null;
      if (matchesRepeat(r, cursor)) return iso;
      cursor = U.addDays(cursor, 1);
    }
    return null;
  }

  function matchesRepeat(r, date) {
    const dow = date.getDay();
    switch (r.freq) {
      case 'daily': return true;
      case 'weekly': return r.days.length ? r.days.indexOf(dow) >= 0 : dow === U.parseISO(U.todayISO()).getDay();
      case 'weekdays': return dow >= 1 && dow <= 5;
      case 'custom': return r.days.indexOf(dow) >= 0;
      case 'monthly': return date.getDate() === 1 ? true : false;
      default: return false;
    }
  }

  function repeatLabel(repeat) {
    const r = normalizeRepeat(repeat);
    if (r.freq === 'none') return '';
    if (r.freq === 'weekly' && !r.days.length) return 'Weekly';
    if (r.freq === 'custom') {
      if (!r.days.length) return 'Custom';
      return r.days.slice().sort().map((d) => U.DOW_SHORT[d]).join(', ');
    }
    const found = REPEAT_FREQ.find((f) => f.value === r.freq);
    return found ? found.label : '';
  }

  /**
   * Roll a recurring item forward to its next occurrence (in place on a copy).
   * Returns the new date ISO, or null when the series has ended.
   */
  function rollForward(collection, rec) {
    const df = DATE_FIELD[collection];
    if (!df) return null;
    const next = nextOccurrence(rec.repeat, rec[df]);
    if (!next) return null;
    return next;
  }

  /* -------------------------------- Labels ------------------------------ */
  function priorityMeta(v) {
    return PRIORITIES.find((p) => p.value === v) || PRIORITIES[1];
  }

  function categoryMeta(v) {
    return CATEGORIES.find((c) => c.value === v) || CATEGORIES[5];
  }

  function importanceMeta(v) {
    return IMPORTANCE.find((c) => c.value === v) || IMPORTANCE[1];
  }

  function typeMeta(collection) {
    return TYPE_META[collection] || TYPE_META.tasks;
  }

  function reminderLabel(minutes) {
    const found = REMINDER_OPTIONS.find((r) => r.value === Number(minutes));
    if (found) return found.label;
    const m = Number(minutes);
    if (m % 1440 === 0) return m / 1440 + ' days before';
    if (m % 60 === 0) return m / 60 + ' hours before';
    return m + ' min before';
  }

  /** Human summary line for an item: "Math · Due today, 11:59 PM" */
  function summaryLine(collection, rec, subjectMap) {
    const parts = [];
    const subj = rec.subjectId && subjectMap ? subjectMap[rec.subjectId] : null;
    if (subj) parts.push(subj.name);
    const d = deadlineOf(collection, rec);
    if (d) {
      const tf = TIME_FIELD[collection];
      const t = tf && rec[tf] ? ', ' + U.fmtTime(rec[tf]) : '';
      if (isOverdue(collection, rec)) parts.push(U.fmtOverdue(d));
      else parts.push(U.fmtDateRelative(d) + t);
    }
    if (collection === 'projects' && rec.progressOverride === null) {
      // progress shown separately
    }
    return parts.join(' · ');
  }

  /** Duplicate-safe clone: new id, "copy" title, cleared completion. */
  function cloneRecord(collection, rec) {
    const copy = JSON.parse(JSON.stringify(rec));
    copy.id = U.uid(collection.slice(0, 3));
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.completed = false;
    copy.completedAt = null;
    if (collection === 'projects') {
      copy.status = 'active';
      copy.title = rec.title;
    }
    if (copy.title) copy.title = rec.title;
    if (copy.name) copy.name = rec.name;
    if (collection === 'homework' || collection === 'tasks') {
      const d = deadlineOf(collection, rec);
      if (d && rec.repeat && rec.repeat.freq === 'none') {
        copy[DATE_FIELD[collection]] = U.toISO(U.addDays(U.parseISO(d), 1));
      }
    }
    (copy.attachments || []).forEach((a) => {
      if (a.id) a.id = U.uid('att');
    });
    return copy;
  }

  /* --------------------------- Search helpers --------------------------- */
  /** Fields searched per collection for global search. */
  const SEARCH_FIELDS = {
    homework: ['title', 'description', 'teacher', 'unit'],
    projects: ['title', 'description', 'teacher'],
    exams: ['title', 'location', 'notes'],
    events: ['title', 'location', 'description'],
    tasks: ['title', 'description'],
    subjects: ['name', 'teacher', 'room'],
    notes: ['title', 'body'],
  };

  function searchableText(collection, rec) {
    const fields = SEARCH_FIELDS[collection] || ['title'];
    const chunks = [];
    fields.forEach((f) => {
      if (rec[f]) chunks.push(String(rec[f]));
    });
    if (Array.isArray(rec.topics)) chunks.push(rec.topics.join(' '));
    if (Array.isArray(rec.members)) chunks.push(rec.members.join(' '));
    if (Array.isArray(rec.checklist)) chunks.push(rec.checklist.map((c) => c.text).join(' '));
    if (Array.isArray(rec.notes) && collection !== 'notes') chunks.push(rec.notes.map((n) => (n.title || '') + ' ' + (n.body || '')).join(' '));
    return chunks.join(' \u2022 ').toLowerCase();
  }

  /* ------------------------------- Export ------------------------------- */
  global.Models = {
    COLLECTIONS, TYPE_META, PRIORITIES, PRIORITY_RANK, CATEGORIES, IMPORTANCE,
    REPEAT_FREQ, REMINDER_OPTIONS, SUBJECT_COLORS, SUBJECT_ICONS, DEFAULT_REMINDERS,
    SCHEMAS, BUCKET_LABELS, DATE_FIELD, TIME_FIELD,
    create, normalize, defaultValue, repeatNone, normalizeRepeat,
    deadlineOf, whenOf, isCompleted, isOverdue, overdueDays, bucketOf,
    projectProgress, nextOccurrence, matchesRepeat, repeatLabel, rollForward,
    priorityMeta, categoryMeta, importanceMeta, typeMeta, reminderLabel, summaryLine,
    cloneRecord, searchableText, SEARCH_FIELDS,
  };
})(window);
