/* ==========================================================================
   sample.js — realistic demo data so every screen can be tested.
   Every generated record carries sample:true, and Settings → "Remove sample
   data" deletes exactly those records (nothing else is touched).
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;

  function rel(days) {
    return U.toISO(U.addDays(new Date(), days));
  }

  function build() {
    const out = { subjects: [], homework: [], projects: [], exams: [], events: [], tasks: [], timetable: [], notes: [] };

    /* ---------------------------- Subjects ---------------------------- */
    const subjectDefs = [
      { name: 'Mathematics', teacher: 'Ms. Haddad', room: 'Room 204', color: '#4f6bed', icon: 'chart' },
      { name: 'Science', teacher: 'Mr. Okafor', room: 'Lab 2', color: '#0f9d76', icon: 'gauge' },
      { name: 'English', teacher: 'Ms. Reid', room: 'Room 112', color: '#8b5cf6', icon: 'book' },
      { name: 'Computer Science', teacher: 'Mr. Lindqvist', room: 'IT Suite', color: '#0ea5e9', icon: 'layers' },
      { name: 'History', teacher: 'Mr. Bennett', room: 'Room 305', color: '#b7791f', icon: 'pin' },
      { name: 'Arabic', teacher: 'Ms. Nour', room: 'Room 118', color: '#14b8a6', icon: 'cap' },
    ];
    subjectDefs.forEach((s) => {
      out.subjects.push(M.create('subjects', Object.assign({ sample: true }, s)));
    });
    const S = {};
    out.subjects.forEach((s) => (S[s.name] = s.id));

    /* ---------------------------- Homework ---------------------------- */
    const homeworkDefs = [
      { title: 'Chapter 4 exercises (Q1–Q18)', subject: 'Mathematics', dueDate: rel(-2), dueTime: '23:59', priority: 'high', estMinutes: 60, unit: 'Unit 3 — Fractions', teacher: 'Ms. Haddad', description: 'Show all working. Q14–Q18 are the stretch questions.' },
      { title: 'Photosynthesis lab write-up', subject: 'Science', dueDate: rel(0), dueTime: '16:00', priority: 'urgent', estMinutes: 90, teacher: 'Mr. Okafor', description: 'Include method, results table and a conclusion.' },
      { title: 'Essay: character analysis (800 words)', subject: 'English', dueDate: rel(0), dueTime: '23:59', priority: 'high', estMinutes: 120, teacher: 'Ms. Reid', unit: 'Unit 5 — The Outsiders' },
      { title: 'Build a to-do app in JavaScript', subject: 'Computer Science', dueDate: rel(2), dueTime: '09:00', priority: 'medium', estMinutes: 150, teacher: 'Mr. Lindqvist' },
      { title: 'Read Chapter 7 + notes', subject: 'History', dueDate: rel(3), dueTime: '20:00', priority: 'low', estMinutes: 40, teacher: 'Mr. Bennett' },
      { title: 'Vocabulary list 12 — memorise', subject: 'Arabic', dueDate: rel(4), dueTime: '07:30', priority: 'medium', estMinutes: 25, teacher: 'Ms. Nour' },
      { title: 'Problem set 6 (past paper)', subject: 'Mathematics', dueDate: rel(6), dueTime: '23:59', priority: 'medium', estMinutes: 75, teacher: 'Ms. Haddad' },
      { title: 'Binary & logic gates worksheet', subject: 'Computer Science', dueDate: rel(-5), dueTime: '23:59', priority: 'medium', estMinutes: 45, completed: true, completedAt: Date.now() - 4 * 86400000 },
      { title: 'Poetry annotation task', subject: 'English', dueDate: rel(-1), dueTime: '23:59', priority: 'low', estMinutes: 35, completed: true, completedAt: Date.now() - 86400000 * 0.6 },
      { title: 'Weekly reading log', subject: 'English', dueDate: rel(1), dueTime: '18:00', priority: 'low', estMinutes: 20, repeat: { freq: 'weekly', days: [4], until: null } },
    ];
    homeworkDefs.forEach((d) => {
      const { subject, ...rest } = d;
      out.homework.push(M.create('homework', Object.assign({ sample: true, subjectId: S[subject] || null, reminders: d.completed ? [] : [1440] }, rest)));
    });

    /* ---------------------------- Projects ---------------------------- */
    const scienceProject = M.create('projects', {
      sample: true,
      title: 'Science fair project — solar water heater',
      subjectId: S['Science'],
      description: 'Design, build and test a small solar water heater, then present the results at the fair.',
      dueDate: rel(19),
      priority: 'high',
      teacher: 'Mr. Okafor',
      members: ['Layla', 'Omar'],
      milestones: [
        { id: U.uid('mst'), name: 'Proposal approved', date: rel(2) },
        { id: U.uid('mst'), name: 'Build finished', date: rel(12) },
        { id: U.uid('mst'), name: 'Presentation ready', date: rel(17) },
      ],
      reminders: [1440, 4320],
    });
    out.projects.push(scienceProject);

    const historyProject = M.create('projects', {
      sample: true,
      title: 'History presentation — Silk Road',
      subjectId: S['History'],
      description: '10-minute presentation on trade routes and cultural exchange.',
      dueDate: rel(9),
      priority: 'medium',
      teacher: 'Mr. Bennett',
      reminders: [1440],
    });
    out.projects.push(historyProject);

    const projectTasks = {
      [scienceProject.id]: [
        ['Research solar heating basics', true, -3],
        ['Gather sources and cite them', true, -2],
        ['Sketch the design', true, -1],
        ['Buy materials', false, 1],
        ['Build the collector', false, 6],
        ['Run the temperature test', false, 9],
        ['Write up results', false, 13],
        ['Make the presentation slides', false, 15],
        ['Practise the presentation', false, 17],
      ],
      [historyProject.id]: [
        ['Read the textbook chapter', true, -1],
        ['Pick three trade goods to cover', false, 3],
        ['Collect images for slides', false, 5],
        ['Write the script', false, 7],
        ['Rehearse with a timer', false, 8],
      ],
    };
    Object.keys(projectTasks).forEach((pid) => {
      projectTasks[pid].forEach(([title, done, dayOffset]) => {
        out.tasks.push(
          M.create('tasks', {
            sample: true,
            title,
            projectId: pid,
            subjectId: out.projects.find((p) => p.id === pid).subjectId,
            category: 'project',
            dueDate: rel(dayOffset),
            estMinutes: 45,
            priority: dayOffset < 0 ? 'medium' : 'high',
            completed: done,
            completedAt: done ? Date.now() - 86400000 : null,
            reminders: [],
          })
        );
      });
    });

    /* ------------------------------ Exams ----------------------------- */
    const mathExam = M.create('exams', {
      sample: true,
      title: 'Term 1 final exam',
      subjectId: S['Mathematics'],
      date: rel(5),
      time: '09:00',
      location: 'Main hall',
      importance: 'critical',
      topics: ['Fractions & decimals', 'Linear equations', 'Geometry: angles', 'Word problems'],
      notes: 'Calculator allowed. Formula sheet provided.',
      reminders: [10080, 4320, 1440, 60],
    });
    out.exams.push(mathExam);

    out.exams.push(M.create('exams', {
      sample: true,
      title: 'Unit test — chemical reactions',
      subjectId: S['Science'],
      date: rel(11),
      time: '11:30',
      location: 'Lab 2',
      importance: 'high',
      topics: ['Balancing equations', 'Exothermic vs endothermic', 'Rates of reaction'],
      reminders: [1440],
    }));

    out.exams.push(M.create('exams', {
      sample: true,
      title: 'Reading comprehension quiz',
      subjectId: S['English'],
      date: rel(-3),
      time: '10:00',
      location: 'Room 112',
      importance: 'medium',
      topics: ['Chapter 5–6'],
      completed: true,
      completedAt: Date.now() - 3 * 86400000,
      reminders: [],
    }));

    /* ------------------------------ Events ---------------------------- */
    out.events.push(M.create('events', {
      sample: true,
      title: 'School trip — natural history museum',
      date: rel(2),
      startTime: '08:30',
      endTime: '15:30',
      location: 'City Museum',
      description: 'Bring a packed lunch and your notebook. Coach leaves from the front gate.',
      category: 'school',
      reminders: [1440],
    }));
    out.events.push(M.create('events', {
      sample: true,
      title: 'Parent–teacher meeting',
      date: rel(4),
      startTime: '17:00',
      endTime: '19:00',
      location: 'Main hall',
      description: '15-minute slots — parents book online.',
      category: 'school',
      reminders: [1440, 180],
    }));
    out.events.push(M.create('events', {
      sample: true,
      title: 'Basketball practice',
      date: rel(0),
      startTime: '16:30',
      endTime: '18:00',
      location: 'Sports hall',
      category: 'personal',
      repeat: { freq: 'weekly', days: [new Date().getDay()], until: null },
      reminders: [60],
    }));
    out.events.push(M.create('events', {
      sample: true,
      title: 'Debate club meeting',
      date: rel(6),
      startTime: '15:30',
      endTime: '16:30',
      location: 'Room 210',
      category: 'school',
      reminders: [60],
    }));

    /* ------------------------------ Tasks ----------------------------- */
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Read 20 minutes',
      dueDate: rel(0),
      dueTime: '21:00',
      category: 'study',
      estMinutes: 20,
      priority: 'low',
      repeat: { freq: 'daily', days: [], until: null },
      reminders: [15],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Study: Fractions & decimals',
      dueDate: rel(0),
      dueTime: '17:30',
      category: 'study',
      subjectId: S['Mathematics'],
      estMinutes: 45,
      priority: 'high',
      examId: mathExam.id,
      source: 'study-plan',
      reminders: [15],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Study: Linear equations',
      dueDate: rel(1),
      dueTime: '17:30',
      category: 'study',
      subjectId: S['Mathematics'],
      estMinutes: 45,
      priority: 'high',
      examId: mathExam.id,
      source: 'study-plan',
      reminders: [60],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Practice questions + review mistakes',
      dueDate: rel(4),
      dueTime: '17:00',
      category: 'study',
      subjectId: S['Mathematics'],
      estMinutes: 60,
      priority: 'urgent',
      examId: mathExam.id,
      source: 'study-plan',
      reminders: [60],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Tidy desk and print the formula sheet',
      dueDate: rel(-1),
      dueTime: '19:00',
      category: 'personal',
      estMinutes: 15,
      priority: 'low',
      reminders: [],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Submit weekly homework',
      dueDate: rel(3),
      dueTime: '08:00',
      category: 'school',
      estMinutes: 10,
      priority: 'medium',
      repeat: { freq: 'weekly', days: [new Date(Date.now() + 3 * 86400000).getDay()], until: null },
      reminders: [1440],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Revision: balancing equations',
      dueDate: rel(8),
      dueTime: '18:00',
      category: 'study',
      subjectId: S['Science'],
      estMinutes: 40,
      priority: 'medium',
      reminders: [1440],
    }));
    out.tasks.push(M.create('tasks', {
      sample: true,
      title: 'Morning stretch routine',
      dueDate: rel(0),
      dueTime: '07:00',
      category: 'personal',
      estMinutes: 10,
      priority: 'low',
      repeat: { freq: 'weekdays', days: [], until: null },
      reminders: [],
    }));
    // A couple of completed history items so Statistics has real data.
    for (let i = 1; i <= 12; i++) {
      out.tasks.push(M.create('tasks', {
        sample: true,
        title: 'Study session #' + i,
        dueDate: rel(-i),
        dueTime: '17:00',
        category: 'study',
        estMinutes: 30 + (i % 3) * 15,
        priority: 'medium',
        completed: true,
        completedAt: Date.now() - i * 86400000 + 3600000,
        reminders: [],
      }));
    }

    /* ---------------------------- Timetable --------------------------- */
    const periods = [
      ['08:00', '09:00', 'Mathematics'],
      ['09:00', '10:00', 'English'],
      ['10:00', '10:20', null, 'Break', 'break'],
      ['10:20', '11:20', 'Science'],
      ['11:20', '12:20', 'Computer Science'],
      ['12:20', '13:10', null, 'Lunch', 'break'],
      ['13:10', '14:10', 'History'],
      ['14:10', '15:00', 'Arabic'],
    ];
    for (let day = 0; day <= 4; day++) {
      periods.forEach((p, idx) => {
        const [start, end, subjectName, label, kind] = p;
        // Shuffle subjects slightly per day so the timetable looks real.
        const rotated = periods.filter((x) => x[2]);
        const pick = rotated[(idx + day) % rotated.length][2];
        out.timetable.push(M.create('timetable', {
          sample: true,
          day,
          startTime: start,
          endTime: end,
          subjectId: kind === 'break' ? null : S[subjectName || pick] || null,
          label: label || null,
          kind: kind || 'class',
          room: kind === 'break' ? null : 'Room ' + (100 + ((idx * 7 + day * 3) % 20)),
        }));
      });
    }

    /* ------------------------------ Notes ----------------------------- */
    out.notes.push(M.create('notes', {
      sample: true,
      title: 'Maths formulas to memorise',
      ownerType: 'subjects',
      ownerId: S['Mathematics'],
      body: 'Area of a circle = πr²\nCircumference = 2πr\nQuadratic formula: x = (−b ± √(b²−4ac)) / 2a',
      checklist: [
        { id: U.uid('chk'), text: 'Practise the quadratic formula', done: true },
        { id: U.uid('chk'), text: 'Memorise circle formulas', done: false },
      ],
    }));
    out.notes.push(M.create('notes', {
      sample: true,
      title: 'Presentation tips',
      ownerType: 'projects',
      ownerId: historyProject.id,
      body: 'Slow down. Pause after each main point. Look at the audience, not the slides.',
      checklist: [
        { id: U.uid('chk'), text: 'Time it under 10 minutes', done: false },
        { id: U.uid('chk'), text: 'Prepare an answer for Q&A', done: false },
      ],
    }));
    out.notes.push(M.create('notes', {
      sample: true,
      title: 'Exam day checklist',
      ownerType: 'exams',
      ownerId: mathExam.id,
      body: 'Calculator, spare pens, water bottle, formula sheet.',
      checklist: [],
    }));

    return out;
  }

  /** Write the sample set into the store. Returns the number of records. */
  function load() {
    const data = build();
    let count = 0;
    Object.keys(data).forEach((collection) => {
      data[collection].forEach((rec) => {
        Store.put(collection, rec);
        count++;
      });
    });
    // Point the study sessions at the created exam/project ids where needed.
    Store.flush();
    return count;
  }

  function ensureProfileDefaults() {
    const p = Store.profile();
    if (!p.name) {
      Store.setProfile({ name: 'Ahmed', grade: 'Grade 10', school: 'Al Noor Secondary School' });
    }
    if (!Store.list('subjects').length) return;
  }

  global.Sample = { build, load, ensureProfileDefaults, rel };
})(window);
