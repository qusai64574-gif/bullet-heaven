/* ==========================================================================
   assistant.js — the planner assistant.
   A real, local reasoning layer over the student's own data: it answers
   questions about their planner, and can create items from plain language.
   No network required (works offline); the reply text is generated from the
   actual stored records — nothing is invented.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;

  /* ------------------------------ Intents ------------------------------- */
  const INTENTS = [
    { id: 'help', test: (t) => /^(help|what can you do|how do you work|commands|what can i ask)/.test(t) },
    { id: 'greeting', test: (t) => /^(hi|hey|hello|yo|good (morning|afternoon|evening)|salam|marhaba)\b/.test(t) },
    { id: 'overdue', test: (t) => /\b(overdue|late|missed|behind)\b/.test(t) },
    { id: 'due_today', test: (t) => /\b(today|due today|tonight|this evening)\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'due_tomorrow', test: (t) => /\btomorrow\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'due_week', test: (t) => /\b(this week|next week|coming week|week ahead|upcoming week)\b/.test(t) },
    { id: 'next_exam', test: (t) => /\b(exam|test|quiz)\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'focus', test: (t) => /\b(focus|should i do|what should i|priority|first|next up|start with)\b/.test(t) },
    { id: 'stats', test: (t) => /\b(stats|statistics|progress|how am i doing|productivity|streak|how many)\b/.test(t) },
    { id: 'timetable', test: (t) => /\b(timetable|schedule|classes|class today|lessons|periods)\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'subjects', test: (t) => /\b(subjects?|courses?)\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'projects', test: (t) => /\b(projects?)\b/.test(t) && !/\badd|create|new\b/.test(t) },
    { id: 'plan_week', test: (t) => /\b(plan|organi[sz]e|schedule my|make a plan|study plan|revise|revision)\b/.test(t) },
    { id: 'navigate', test: (t) => /\b(show|open|go to|take me to|view)\b/.test(t) },
    { id: 'add', test: (t) => /\b(add|create|new|remind me to|i have|log)\b/.test(t) },
  ];

  const QUESTION_STARTS = /^(what|whats|what's|when|where|how|why|which|who|do i|did i|have i|is there|are there|any |show me|list|tell me|can you|could you|give me|am i)\b/;
  const NEGATION = /\b(don't|dont|do not|not|no need|nothing|never|cancel|skip)\b/;
  const ADD_VERB = /\b(add|create|new|log|remind me to|i have|i need to|i need|schedule)\b/;

  function classify(text, history) {
    const t = normalise(text);
    const prevUser = lastUserMessage(history);
    const asksQuestion = /\?\s*$/.test(t) || QUESTION_STARTS.test(t);

    // Follow-ups ("yes", "and tomorrow?") inherit the previous topic.
    if (prevUser && /^(yes|yeah|yep|ok|okay|sure|please do|go ahead|and|also|what about|how about)\b/.test(t)) {
      const prevIntent = baseClassify(normalise(prevUser), true);
      if (prevIntent !== 'unknown') return prevIntent;
    }

    // "don't add anything" / "no new tasks" must not create records.
    if (NEGATION.test(t) && !/\b(what|when|where|how|why|which|show|list)\b/.test(t)) {
      if (/\b(remind|notif|alert)\b/.test(t)) return 'help';
      return 'help';
    }

    // A question never creates anything, even if it contains "due"/"add".
    if (asksQuestion && !ADD_VERB.test(t.replace(/^\s*(what|when|where|how|why|which|who)\b/, ''))) {
      const q = baseClassify(t, true);
      if (q !== 'add') return q;
    }

    return baseClassify(t, asksQuestion);
  }

  function lastUserMessage(history) {
    if (!Array.isArray(history)) return '';
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].role === 'user') return history[i].text || '';
    }
    return '';
  }

  function baseClassify(t, isQuestion) {
    for (const intent of INTENTS) {
      if (intent.id === 'add' && isQuestion) continue;
      if (intent.test(t)) return intent.id;
    }
    return 'unknown';
  }

  function normalise(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------------------------- Date parsing ---------------------------- */
  /** Pull a date out of free text. Returns ISO or null. */
  function parseDate(text, reference) {
    const t = normalise(text);
    const ref = reference ? U.parseISO(reference) : new Date();
    if (!ref) return null;

    if (/\bday after tomorrow\b/.test(t)) return U.toISO(U.addDays(ref, 2));
    if (/\btomorrow\b/.test(t)) return U.toISO(U.addDays(ref, 1));
    if (/\btoday\b|\btonight\b|\bthis evening\b/.test(t)) return U.toISO(ref);
    if (/\bnext week\b/.test(t)) return U.toISO(U.addDays(ref, 7));
    if (/\bnext month\b/.test(t)) return U.toISO(U.addMonths(ref, 1));

    const inDays = /\bin (\d{1,2}) days?\b/.exec(t);
    if (inDays) return U.toISO(U.addDays(ref, Number(inDays[1])));

    const inWeeks = /\bin (\d{1,2}) weeks?\b/.exec(t);
    if (inWeeks) return U.toISO(U.addDays(ref, Number(inWeeks[1]) * 7));

    // Explicit dates: 12/10, 12-10-2026, 2026-10-12, Oct 12, 12 October
    let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
    if (m) {
      const iso = m[1] + '-' + m[2] + '-' + m[3];
      return U.isValidISO(iso) ? iso : null;
    }
    m = /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/.exec(t);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = m[3] ? Number(m[3]) : ref.getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if (d.getMonth() === month - 1 && d.getDate() === day) {
        if (!m[3] && U.toISO(d) < U.toISO(ref)) d.setFullYear(year + 1);
        return U.toISO(d);
      }
      return null;
    }
    const monthNames = U.MONTH_LONG.concat(U.MONTH_SHORT).map((x) => x.toLowerCase());
    const words = t.split(/[\s,]+/);
    for (let i = 0; i < words.length; i++) {
      const idx = monthNames.indexOf(words[i].replace(/[^a-z]/g, ''));
      if (idx < 0) continue;
      const month = idx % 12;
      const numMatch = (words[i + 1] || '').match(/^(\d{1,2})/);
      const prevMatch = (words[i - 1] || '').match(/^(\d{1,2})$/);
      const day = numMatch ? Number(numMatch[1]) : prevMatch ? Number(prevMatch[1]) : null;
      if (day) {
        const d = new Date(ref.getFullYear(), month, day);
        if (!/\d{4}/.test(t) && U.toISO(d) < U.toISO(ref)) d.setFullYear(ref.getFullYear() + 1);
        if (d.getMonth() === month) return U.toISO(d);
      }
    }

    // Weekday names -> the next occurrence
    const dows = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dows.length; i++) {
      if (new RegExp('\\b' + dows[i] + '\\b').test(t)) {
        const cur = ref.getDay();
        let delta = (i - cur + 7) % 7;
        if (delta === 0) delta = 7;
        return U.toISO(U.addDays(ref, delta));
      }
    }
    return null;
  }

  /** Pull a time out of free text ("at 5pm", "17:30", "9 am"). */
  function parseTime(text) {
    const t = normalise(text);
    let m = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/.exec(t);
    if (m) {
      let h = Number(m[1]);
      const mi = Number(m[2]);
      const ap = m[3];
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 24 && mi < 60) return U.pad2(h) + ':' + U.pad2(mi);
    }
    m = /\b(?:at|by)\s*(\d{1,2})\s*(am|pm)\b/.exec(t);
    if (m) {
      let h = Number(m[1]);
      if (m[2] === 'pm' && h < 12) h += 12;
      if (m[2] === 'am' && h === 12) h = 0;
      if (h < 24) return U.pad2(h) + ':00';
    }
    return null;
  }

  function parsePriority(text) {
    const t = normalise(text);
    if (/\b(urgent|asap|right now|critical)\b/.test(t)) return 'urgent';
    if (/\b(important|high priority|high)\b/.test(t)) return 'high';
    if (/\b(low priority|not important|low)\b/.test(t)) return 'low';
    return null;
  }

  function parseSubject(text) {
    const t = normalise(text);
    const subjects = Store.list('subjects');
    for (const s of subjects) {
      const name = normalise(s.name);
      if (name && t.indexOf(name) >= 0) return s;
    }
    return null;
  }

  function parseCategory(text) {
    const t = normalise(text);
    const found = M.CATEGORIES.find((c) => new RegExp('\\b' + c.value + '\\b').test(t));
    return found ? found.value : null;
  }

  const STOP_WORDS = /\b(add|create|new|a|an|the|for|to|my|due|on|at|by|please|remind me|remind|log|i have|homework|task|exam|test|quiz|event|project|note|tomorrow|today|tonight|next|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|urgent|important|high|low|priority)\b/g;

  function parseTitle(text, type) {
    let t = ' ' + normalise(text) + ' ';
    // Remove date/time fragments first so they don't leak into the title.
    t = t.replace(/\b(at|by)\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b/g, ' ');
    t = t.replace(/\b\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\b/g, ' ');
    t = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
    t = t.replace(/\bin \d{1,2} (days?|weeks?)\b/g, ' ');
    t = t.replace(/\bday after tomorrow\b/g, ' ');
    t = t.replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/g, ' ');
    t = t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b/g, ' ');
    t = t.replace(/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g, ' ');
    t = t.replace(/\b(today|tonight|tomorrow|this evening|next week|next month)\b/g, ' ');
    // Remove the subject name if it appeared.
    const subj = parseSubject(text);
    if (subj) t = t.replace(new RegExp('\\b' + escapeRe(normalise(subj.name)) + '\\b', 'g'), ' ');
    // Remove the leading verb/type words.
    t = t.replace(/^\s*(add|create|new|log|remind me to|remind me|i have|i need to|i need)\s+/g, ' ');
    if (type) {
      const typeWords = {
        homework: /homework|assignment|hw/,
        tasks: /task|to-?do|reminder/,
        exams: /exam|test|quiz/,
        events: /event|appointment|meeting|trip/,
        projects: /project/,
        notes: /note/,
      };
      if (typeWords[type]) t = t.replace(new RegExp('\\b(' + typeWords[type].source + ')\\b', 'g'), ' ');
    }
    t = t.replace(STOP_WORDS, ' ');
    t = t.replace(/\b(for|about|on)\b/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/^[\-–—:,.\s]+|[\-–—:,.\s]+$/g, '');
    return t;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseAddType(text) {
    const t = normalise(text);
    if (/\b(homework|assignment|hw)\b/.test(t)) return 'homework';
    if (/\b(exam|test|quiz|midterm|final)\b/.test(t)) return 'exams';
    if (/\b(event|appointment|meeting|trip|birthday|assembly)\b/.test(t)) return 'events';
    if (/\b(project)\b/.test(t)) return 'projects';
    if (/\b(note)\b/.test(t)) return 'notes';
    if (/\b(task|to-?do|reminder)\b/.test(t)) return 'tasks';
    return null;
  }

  /* ------------------------------ Replies ------------------------------- */
  function label(collection) {
    return M.SCHEMAS[collection] ? M.SCHEMAS[collection].label.toLowerCase() : 'item';
  }

  function itemsPayload(collection, rows, title) {
    return {
      kind: 'items',
      title: title || M.TYPE_META[collection].label + ' · ' + rows.length,
      collection,
      rows: rows.slice(0, 12).map((r) => ({
        id: r.id,
        title: r.title || r.name || 'Untitled',
        meta: metaLine(collection, r),
        done: M.isCompleted(collection, r),
        overdue: M.isOverdue(collection, r),
        route: '/' + collection + '/' + r.id,
      })),
      more: Math.max(0, rows.length - 12),
    };
  }

  function metaLine(collection, r) {
    const bits = [];
    const s = r.subjectId ? Store.byId('subjects', r.subjectId) : null;
    if (s) bits.push(s.name);
    const d = M.deadlineOf(collection, r);
    if (d) {
      if (M.isOverdue(collection, r)) bits.push(U.fmtOverdue(d));
      else bits.push(U.fmtDateRelative(d));
      const tf = M.TIME_FIELD[collection];
      if (tf && r[tf]) bits.push(U.fmtTime(r[tf]));
    }
    if (r.priority && r.priority !== 'medium') bits.push(M.priorityMeta(r.priority).label);
    return bits.join(' · ');
  }

  /** The core: turn user text into { text, payload } from real data. */
  function reply(input, history) {
    const raw = String(input || '').trim();
    if (!raw) return { text: 'Ask me about your planner — or tell me what to add.', payload: null };
    const intent = classify(raw, history);
    const today = U.todayISO();

    switch (intent) {
      case 'help':
        return {
          text:
            "I work entirely from **your planner** — offline, no account needed.\n\n" +
            'Try things like:\n' +
            '• *What’s due today?*\n' +
            '• *What did I miss?*\n' +
            '• *When is my next exam?*\n' +
            '• *Add math homework due Friday*\n' +
            '• *Plan my study week*\n' +
            '• *How am I doing?*',
          payload: null,
        };

      case 'greeting': {
        const s = Store.stats();
        const due = s.dueToday + s.overdue;
        return {
          text:
            U.greeting(Store.profile().name) + '.\n' +
            (due
              ? 'You have **' + due + ' item' + (due === 1 ? '' : 's') + '** that need attention today' + (s.overdue ? ', including ' + s.overdue + ' overdue' : '') + '.'
              : 'Nothing is due today — a good moment to get ahead.'),
          payload: due ? itemsPayload('homework', Store.query('homework', { status: 'active', buckets: ['overdue', 'today'], sort: 'due' }), 'Needs attention') : null,
        };
      }

      case 'overdue': {
        const all = [];
        ['homework', 'tasks', 'projects', 'exams'].forEach((c) => {
          Store.query(c, { status: 'overdue', sort: 'due' }).forEach((r) => all.push({ collection: c, record: r }));
        });
        all.sort((a, b) => (M.deadlineOf(a.collection, a.record) || '').localeCompare(M.deadlineOf(b.collection, b.record) || ''));
        if (!all.length) return { text: 'Nothing is overdue. **You’re on top of it.**', payload: null };
        const byCol = {};
        all.forEach((x) => (byCol[x.collection] = (byCol[x.collection] || 0) + 1));
        const summary = Object.keys(byCol).map((c) => byCol[c] + ' ' + label(c) + (byCol[c] === 1 ? '' : 's')).join(', ');
        return {
          text: 'You have **' + all.length + ' overdue** item' + (all.length === 1 ? '' : 's') + ' — ' + summary + '.\n\nStart with the oldest, or reschedule what no longer matters.',
          payload: itemsPayload(all[0].collection, all.filter((x) => x.collection === all[0].collection).map((x) => x.record), 'Overdue'),
        };
      }

      case 'due_today': {
        const rows = [];
        ['homework', 'tasks', 'projects', 'exams', 'events'].forEach((c) => {
          Store.query(c, { day: today, sort: 'due' }).forEach((r) => rows.push({ collection: c, record: r }));
        });
        const open = rows.filter((x) => !M.isCompleted(x.collection, x.record));
        if (!rows.length) return { text: 'Nothing is scheduled for today. Want to **get ahead** on this week’s work?', payload: null };
        const byCol = {};
        open.forEach((x) => (byCol[x.collection] = (byCol[x.collection] || 0) + 1));
        const breakdown = Object.keys(byCol).map((c) => byCol[c] + ' ' + label(c) + (byCol[c] === 1 ? '' : 's')).join(', ');
        return {
          text:
            'Today you have **' + open.length + ' open item' + (open.length === 1 ? '' : 's') + '**' + (breakdown ? ' — ' + breakdown : '') + '.' +
            (rows.length !== open.length ? '\n(' + (rows.length - open.length) + ' already done.)' : ''),
          payload: itemsPayload(open.length ? open[0].collection : 'homework', open.map((x) => x.record), 'Today'),
        };
      }

      case 'due_tomorrow': {
        const iso = U.toISO(U.addDays(new Date(), 1));
        const rows = [];
        ['homework', 'tasks', 'projects', 'exams', 'events'].forEach((c) => {
          Store.query(c, { day: iso, sort: 'due' }).forEach((r) => rows.push({ collection: c, record: r }));
        });
        if (!rows.length) return { text: 'Tomorrow is clear. **No deadlines.**', payload: null };
        return {
          text: 'Tomorrow: **' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + '**. ' + (rows.some((x) => x.collection === 'exams') ? 'There’s an exam in there — worth preparing tonight.' : 'Nothing on fire yet.'),
          payload: itemsPayload(rows[0].collection, rows.map((x) => x.record), 'Tomorrow'),
        };
      }

      case 'due_week': {
        const from = U.toISO(new Date());
        const to = U.toISO(U.addDays(new Date(), 7));
        const rows = [];
        ['homework', 'tasks', 'projects', 'exams', 'events'].forEach((c) => {
          Store.query(c, { from, to, status: 'active', sort: 'due' }).forEach((r) => rows.push({ collection: c, record: r }));
        });
        if (!rows.length) return { text: 'The next seven days are empty. Enjoy it — or **plan ahead**.', payload: null };
        const exams = rows.filter((x) => x.collection === 'exams').length;
        return {
          text:
            'Over the next 7 days you have **' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + '**' +
            (exams ? ', including **' + exams + ' exam' + (exams === 1 ? '' : 's') + '**' : '') +
            '.\n\nWant a study plan? Ask me to *plan my study week*.',
          payload: itemsPayload(rows[0].collection, rows.map((x) => x.record), 'Next 7 days'),
        };
      }

      case 'next_exam': {
        const exams = Store.query('exams', { status: 'active', sort: 'due' }).filter((e) => (e.date || '') >= today);
        if (!exams.length) return { text: 'No exams on the calendar. When you add one, I can build a study plan for it.', payload: null };
        const next = exams[0];
        const delta = U.diffDays(today, next.date);
        const subject = next.subjectId ? Store.byId('subjects', next.subjectId) : null;
        return {
          text:
            '**' + (subject ? subject.name + ' ' : '') + (next.title || 'Exam') + '** is ' + U.fmtCountdown(next.date).toLowerCase() +
            (next.time ? ' at ' + U.fmtTime(next.time) : '') + '.' +
            (next.topics && next.topics.length ? '\n\nTopics: ' + next.topics.join(', ') + '.' : '') +
            (delta <= 3 ? '\n\nThat’s close — ask me to *make a study plan*.' : ''),
          payload: itemsPayload('exams', exams, 'Upcoming exams'),
        };
      }

      case 'focus': {
        const picked = pickFocus();
        if (!picked.length) return { text: 'Nothing urgent. If you want, add something and I’ll keep track of it.', payload: null };
        const first = picked[0];
        return {
          text:
            'Start with **' + (first.record.title || first.record.name) + '**' +
            (M.isOverdue(first.collection, first.record) ? ' — it’s ' + U.fmtOverdue(M.deadlineOf(first.collection, first.record)) + '.' : '.') +
            '\n\nAfter that:\n' +
            picked.slice(1, 4).map((p, i) => (i + 2) + '. ' + (p.record.title || p.record.name) + ' — ' + metaLine(p.collection, p.record)).join('\n'),
          payload: itemsPayload(picked[0].collection, picked.map((p) => p.record), 'Suggested order'),
        };
      }

      case 'stats': {
        const s = Store.stats();
        const streak = s.streak.count;
        return {
          text:
            'Here’s where you stand:\n\n' +
            '• Completed: **' + s.done + ' of ' + s.total + '** items (' + s.rate + '%)\n' +
            '• Open: **' + s.activeTotal + '** · Overdue: **' + s.overdue + '**\n' +
            '• Homework: **' + s.homeworkDone + '/' + s.homeworkTotal + '** · Projects: **' + s.projectsDone + '/' + s.projectsTotal + '**\n' +
            '• Done today: **' + s.completedToday + '** · this week: **' + s.completedThisWeek + '**\n' +
            (streak ? '• Streak: **' + streak + ' day' + (streak === 1 ? '' : 's') + '**\n' : '') +
            (s.overdue ? '\nYour weak spot is overdue work — clear that first.' : '\nNothing overdue. Keep the streak alive.'),
          payload: { kind: 'stats', title: 'Progress', stats: { done: s.done, total: s.total, rate: s.rate, overdue: s.overdue, streak } },
        };
      }

      case 'timetable': {
        const classes = global.Planner.todayClasses();
        if (!classes.length) return { text: 'No classes in your timetable for today. You can add them in **More → Timetable**.', payload: null };
        const lines = classes.map((c) => {
          const s = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
          return '• ' + U.fmtTime(c.startTime) + ' — ' + (s ? s.name : c.label || 'Class') + (c.room ? ' (' + c.room + ')' : '');
        });
        return {
          text: 'Today’s timetable:\n\n' + lines.join('\n'),
          payload: { kind: 'list', title: 'Today’s classes', rows: classes.map((c) => {
            const s = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
            return { title: (s ? s.name : c.label || 'Class'), meta: U.fmtTime(c.startTime) + (c.endTime ? ' – ' + U.fmtTime(c.endTime) : '') + (c.room ? ' · ' + c.room : ''), route: '/timetable' };
          }) },
        };
      }

      case 'subjects': {
        const subjects = Store.query('subjects', { sort: 'name' });
        if (!subjects.length) return { text: 'No subjects yet. Add them in **More → Subjects** and everything else gets easier to organise.', payload: null };
        return {
          text: 'You’re tracking **' + subjects.length + ' subject' + (subjects.length === 1 ? '' : 's') + '**. Tap one to see everything inside it.',
          payload: { kind: 'list', title: 'Subjects', rows: subjects.map((s) => {
            const st = Store.stats().subjectRows.find((r) => r.subject.id === s.id);
            return { title: s.name, meta: [s.teacher, st ? st.total + ' items · ' + st.pct + '% done' : null].filter(Boolean).join(' · '), route: '/subjects/' + s.id, color: s.color };
          }) },
        };
      }

      case 'projects': {
        const projects = Store.query('projects', { status: 'active', sort: 'due' });
        if (!projects.length) return { text: 'No active projects. Add one and I’ll track its subtasks and progress.', payload: null };
        return {
          text: 'You have **' + projects.length + ' active project' + (projects.length === 1 ? '' : 's') + '**.',
          payload: itemsPayload('projects', projects, 'Active projects'),
        };
      }

      case 'plan_week': {
        const plan = weekPlan();
        if (!plan.length) return { text: 'Nothing to plan yet — add homework or an exam and I’ll build the week around it.', payload: null };
        return {
          text:
            'Here’s a workable order for the week, based on deadlines and effort:\n\n' +
            plan.map((p, i) => (i + 1) + '. **' + U.fmtDateRelative(p.date) + '** — ' + p.title).join('\n') +
            '\n\nTell me *make a study plan for <exam>* and I’ll add study sessions to your calendar.',
          payload: { kind: 'list', title: 'Suggested week', rows: plan.map((p) => ({ title: p.title, meta: U.fmtDateRelative(p.date) + ' · ' + U.fmtDuration(p.minutes), route: p.route })) },
        };
      }

      case 'navigate': {
        const dest = detectDestination(raw);
        if (!dest) return { text: 'Where would you like to go? Calendar, Tasks, Projects, Deadlines, Statistics or Subjects.', payload: null };
        return {
          text: 'Opening **' + dest.label + '**.',
          payload: { kind: 'navigate', route: dest.route, label: dest.label },
        };
      }

      case 'add':
        return handleAdd(raw);

      default: {
        // Unknown phrasing: still try to be useful with a keyword search.
        const found = global.Search.run(raw, { limit: 6 });
        if (found.total) {
          const first = found.groups[0];
          return {
            text: 'I found **' + found.total + ' match' + (found.total === 1 ? '' : 'es') + '** for “' + raw + '”.',
            payload: itemsPayload(first.key, first.items.map((i) => i.record), first.label),
          };
        }
        return {
          text:
            'I’m not sure what you mean by “' + raw + '”.\n\nI can answer questions about your planner, or add things for you. Try *What’s due today?* or *Add math homework due Friday*.',
          payload: { kind: 'suggestions', title: 'Try one of these', rows: [
            { title: 'What’s due today?', route: null, prompt: 'What’s due today?' },
            { title: 'What’s overdue?', route: null, prompt: 'What’s overdue?' },
            { title: 'Plan my study week', route: null, prompt: 'Plan my study week' },
          ] },
        };
      }
    }
  }

  function pickFocus() {
    const out = [];
    ['homework', 'tasks', 'projects', 'exams'].forEach((c) => {
      Store.query(c, { status: 'active', sort: 'due' }).forEach((r) => out.push({ collection: c, record: r }));
    });
    const score = (x) => {
      const d = M.deadlineOf(x.collection, x.record);
      let s = 0;
      if (M.isOverdue(x.collection, x.record)) s -= 1000;
      if (d) s += U.diffDays(U.todayISO(), d) * 10;
      const pr = M.PRIORITY_RANK[x.record.priority];
      if (pr !== undefined) s += pr * 3;
      if (x.collection === 'exams') s -= 20;
      if (x.collection === 'projects') s -= 8;
      return s;
    };
    out.sort((a, b) => score(a) - score(b));
    return out.slice(0, 5);
  }

  function weekPlan() {
    const plan = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const iso = U.toISO(U.addDays(today, i));
      const rows = [];
      ['homework', 'tasks', 'projects', 'exams', 'events'].forEach((c) => {
        Store.query(c, { day: iso, status: c === 'events' ? undefined : 'active' }).forEach((r) => rows.push({ collection: c, record: r }));
      });
      if (!rows.length) continue;
      rows.sort((a, b) => (M.PRIORITY_RANK[a.record.priority] || 9) - (M.PRIORITY_RANK[b.record.priority] || 9));
      const top = rows[0];
      const mins = rows.reduce((acc, r) => acc + (Number(r.record.estMinutes) || 0), 0);
      plan.push({
        date: iso,
        title: rows.length > 1
          ? (top.record.title || top.record.name) + ' + ' + (rows.length - 1) + ' more'
          : top.record.title || top.record.name,
        minutes: mins || rows.length * 30,
        route: '/' + top.collection + '/' + top.record.id,
      });
    }
    return plan;
  }

  function detectDestination(text) {
    const t = normalise(text);
    const map = [
      { re: /\bhome ?work\b/, label: 'Homework', route: '/homework' },
      { re: /\bcalendar\b/, label: 'Calendar', route: '/calendar' },
      { re: /\bdeadlines?\b/, label: 'Deadlines', route: '/deadlines' },
      { re: /\bstat(s|istics)\b/, label: 'Statistics', route: '/statistics' },
      { re: /\bprojects?\b/, label: 'Projects', route: '/projects' },
      { re: /\bexams?\b/, label: 'Exams', route: '/exams' },
      { re: /\bevents?\b/, label: 'Events', route: '/events' },
      { re: /\bsubjects?\b/, label: 'Subjects', route: '/subjects' },
      { re: /\btimetable\b|\bschedule\b/, label: 'Timetable', route: '/timetable' },
      { re: /\btasks?\b|\bto-?do\b/, label: 'Tasks', route: '/tasks' },
      { re: /\bnotes?\b/, label: 'Notes', route: '/notes' },
      { re: /\bhistory\b/, label: 'History', route: '/history' },
      { re: /\bsettings\b/, label: 'Settings', route: '/settings' },
      { re: /\btoday\b/, label: 'Today', route: '/today' },
      { re: /\bhome\b/, label: 'Home', route: '/home' },
    ];
    for (const m of map) if (m.re.test(t)) return m;
    return null;
  }

  /* -------------------------------- Add --------------------------------- */
  function handleAdd(text) {
    const type = parseAddType(text);
    if (!type) {
      return {
        text: 'What would you like to add — **homework**, a **task**, an **exam**, an **event** or a **project**?',
        payload: null,
      };
    }
    const date = parseDate(text) || (type === 'homework' || type === 'projects' || type === 'tasks' ? U.todayISO() : U.todayISO());
    const time = parseTime(text);
    const subject = parseSubject(text);
    const priority = parsePriority(text);
    const category = parseCategory(text);
    const title = parseTitle(text, type) || defaultTitle(type, subject);

    const patch = { title };
    if (type === 'homework') {
      patch.dueDate = date;
      if (time) patch.dueTime = time;
      if (subject) patch.subjectId = subject.id;
      if (priority) patch.priority = priority;
      patch.reminders = [Store.getSetting('defaultReminder', 1440)].filter((x) => x !== null);
    } else if (type === 'tasks') {
      patch.dueDate = date;
      if (time) patch.dueTime = time;
      if (subject) patch.subjectId = subject.id;
      if (priority) patch.priority = priority;
      patch.category = category || 'study';
      patch.reminders = [Store.getSetting('defaultReminder', 1440)].filter((x) => x !== null);
    } else if (type === 'exams') {
      patch.date = date;
      if (time) patch.time = time;
      if (subject) patch.subjectId = subject.id;
      patch.importance = priority === 'urgent' || priority === 'high' ? 'critical' : 'high';
      patch.reminders = [1440, 60];
    } else if (type === 'events') {
      patch.date = date;
      if (time) {
        patch.startTime = time;
        patch.endTime = U.pad2(Math.min(23, Number(time.slice(0, 2)) + 1)) + ':' + time.slice(3);
      }
      patch.category = category || 'school';
      patch.reminders = [60];
    } else if (type === 'projects') {
      patch.dueDate = date;
      if (subject) patch.subjectId = subject.id;
      if (priority) patch.priority = priority;
      patch.reminders = [1440];
    } else if (type === 'notes') {
      patch.body = '';
    }

    const record = Store.put(type, M.create(type, patch));
    if (global.Notify) global.Notify.reschedule();

    const s = Store.byId('subjects', record.subjectId);
    return {
      text:
        'Added **' + record.title + '** as ' + label(type) + ' — ' + U.fmtDateRelative(date) +
        (time ? ' at ' + U.fmtTime(time) : '') +
        (s ? ', for **' + s.name + '**' : '') + '.',
      payload: {
        kind: 'created',
        title: 'Just added',
        collection: type,
        rows: [{ id: record.id, title: record.title, meta: metaLine(type, record), route: '/' + type + '/' + record.id }],
      },
    };
  }

  function defaultTitle(type, subject) {
    const s = subject ? subject.name + ' ' : '';
    switch (type) {
      case 'homework': return s + 'homework';
      case 'tasks': return s + 'task';
      case 'exams': return s + 'exam';
      case 'events': return 'New event';
      case 'projects': return s + 'project';
      default: return 'New note';
    }
  }

  /* --------------------------- Conversations ---------------------------- */
  function newConversation() {
    const conv = Store.put('conversations', {
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return conv;
  }

  function conversations() {
    return Store.query('conversations', { sort: 'updated' });
  }

  function groupConversations() {
    const list = conversations();
    const now = new Date();
    const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
    list.forEach((c) => {
      const d = U.toISO(new Date(c.updatedAt || c.createdAt));
      const delta = U.diffDays(d, U.todayISO());
      if (delta === 0) groups.Today.push(c);
      else if (delta === -1) groups.Yesterday.push(c);
      else if (delta >= -7) groups['Previous 7 days'].push(c);
      else groups.Older.push(c);
    });
    return groups;
  }

  function appendMessage(convId, message) {
    const conv = Store.byId('conversations', convId);
    if (!conv) return null;
    const messages = (conv.messages || []).slice();
    messages.push(Object.assign({ ts: Date.now() }, message));
    const patch = { messages, updatedAt: Date.now() };
    if (conv.title === 'New chat' && message.role === 'user') {
      patch.title = String(message.text || 'New chat').slice(0, 48);
    }
    return Store.put('conversations', Object.assign({}, conv, patch));
  }

  function clearHistory() {
    Store.list('conversations').forEach((c) => Store.remove('conversations', c.id));
  }

  /* ------------------------------ Suggestions --------------------------- */
  function suggestions() {
    const s = Store.stats();
    const out = [];
    if (s.overdue) out.push({ icon: 'alert', text: 'What’s overdue?' });
    out.push({ icon: 'clock', text: 'What’s due today?' });
    if (s.examsUpcoming) out.push({ icon: 'clipboard', text: 'When is my next exam?' });
    out.push({ icon: 'sparkles', text: 'Plan my study week' });
    out.push({ icon: 'trending', text: 'How am I doing?' });
    out.push({ icon: 'target', text: 'What should I focus on?' });
    return out.slice(0, 6);
  }

  global.Assistant = {
    reply, classify, parseDate, parseTime, parseTitle, parseAddType, parseSubject,
    newConversation, conversations, groupConversations, appendMessage, clearHistory,
    suggestions, weekPlan, pickFocus, detectDestination,
  };
})(window);
