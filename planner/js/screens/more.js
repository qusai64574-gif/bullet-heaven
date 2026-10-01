/* ==========================================================================
   screens/more.js — More hub, Subjects, Subject detail, Timetable,
   Statistics, Search, Settings, About.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  /* =============================== MORE ================================= */
  function more() {
    const root = U.el('div', { class: 'screen' });
    const profile = Store.profile();
    const stats = Store.stats();

    /* Profile card */
    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        U.el('div', { class: 'row', style: { gap: '14px' } }, [
          UI.avatar(profile.name, null, ''),
          U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
            U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: profile.name || 'Add your name' }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: [profile.grade, profile.school].filter(Boolean).join(' · ') || 'Set up your school details' }),
          ]),
          U.el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Edit profile', onclick: () => global.Router.go('/settings') }, [U.icon('edit', 18)]),
        ]),
        U.el('div', { class: 'row', style: { gap: '10px', marginTop: '14px' } }, [
          U.el('div', { class: 'grow col', style: { alignItems: 'center' } }, [
            U.el('div', { style: { fontWeight: '600', fontVariantNumeric: 'tabular-nums' }, text: String(stats.done) }),
            U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'completed' }),
          ]),
          U.el('div', { class: 'grow col', style: { alignItems: 'center' } }, [
            U.el('div', { style: { fontWeight: '600', fontVariantNumeric: 'tabular-nums' }, text: String(stats.activeTotal) }),
            U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'open' }),
          ]),
          U.el('div', { class: 'grow col', style: { alignItems: 'center' } }, [
            U.el('div', { style: { fontWeight: '600', fontVariantNumeric: 'tabular-nums' }, text: stats.streak.count + '' }),
            U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'day streak' }),
          ]),
        ]),
      ])
    );

    /* Assistant entry — the ChatGPT-style surface, prominent but not shouty */
    root.appendChild(
      U.el('button', {
        class: 'card card--pad card--tap',
        type: 'button',
        style: { width: '100%', textAlign: 'left', marginBottom: '18px' },
        onclick: () => global.Router.go('/assistant'),
      }, [
        U.el('div', { class: 'row', style: { gap: '12px' } }, [
          U.el('span', { class: 'list__icon', style: { background: 'var(--accent)', color: 'var(--accent-ink)' } }, [U.icon('sparkles', 18)]),
          U.el('div', { class: 'grow col' }, [
            U.el('div', { style: { fontWeight: '600' }, text: 'Planner assistant' }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: 'Ask about your work, or add things by typing.' }),
          ]),
          U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]),
        ]),
      ])
    );

    /* Organise */
    root.appendChild(UI.sectionHead('Organise'));
    const organise = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
    [
      { label: 'Subjects', icon: 'cap', value: Store.list('subjects').length + '', route: '/subjects' },
      { label: 'Timetable', icon: 'clock', value: Store.list('timetable').length ? Store.list('timetable').length + ' classes' : 'Not set', route: '/timetable' },
      { label: 'Notes', icon: 'file', value: Store.list('notes').length + '', route: '/notes' },
      { label: 'Deadlines', icon: 'alert', value: (stats.overdue ? stats.overdue + ' overdue' : 'All clear'), route: '/deadlines' },
    ].forEach((r, i) => {
      organise.appendChild(
        UI.fieldRow(r.label, r.value, {
          icon: r.icon,
          onClick: () => global.Router.go(r.route),
        })
      );
    });
    root.appendChild(organise);

    /* Insights */
    root.appendChild(UI.sectionHead('Insights'));
    const insights = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
    insights.appendChild(UI.fieldRow('Statistics', stats.rate + '% complete', { icon: 'trending', onClick: () => global.Router.go('/statistics') }));
    insights.appendChild(UI.fieldRow('History', stats.done + ' completed', { icon: 'history', onClick: () => global.Router.go('/history') }));
    insights.appendChild(UI.fieldRow('Search everything', '', { icon: 'search', onClick: () => global.Router.go('/search') }));
    root.appendChild(insights);

    /* Settings */
    root.appendChild(UI.sectionHead('App'));
    const app = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
    app.appendChild(UI.fieldRow('Settings', '', { icon: 'settings', onClick: () => global.Router.go('/settings') }));
    app.appendChild(UI.fieldRow('Notifications', Store.getSetting('notificationsEnabled', false) ? 'On' : 'Off', { icon: 'bell', onClick: () => global.Router.go('/settings') }));
    app.appendChild(UI.fieldRow('Appearance', themeLabel(Store.getSetting('theme', 'system')), { icon: 'palette', onClick: () => themeSheet() }));
    app.appendChild(UI.fieldRow('About', 'v1.0.0', { icon: 'info', onClick: () => global.Router.go('/about') }));
    root.appendChild(app);

    return {
      node: root,
      title: 'More',
      back: false,
      actions: [
        { icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') },
        { icon: 'settings', label: 'Settings', onClick: () => global.Router.go('/settings') },
      ],
    };
  }

  function themeLabel(mode) {
    return mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System';
  }

  function themeSheet() {
    const current = Store.getSetting('theme', 'system');
    const s = UI.sheet({
      title: 'Appearance',
      body: [
        U.el('div', { class: 'list list--plain' }, [
          { value: 'light', label: 'Light', icon: 'sun' },
          { value: 'dark', label: 'Dark', icon: 'moon' },
          { value: 'system', label: 'System default', icon: 'monitor' },
        ].map((o) =>
          U.el('button', {
            class: 'list__row',
            type: 'button',
            onclick: () => {
              Store.setSetting('theme', o.value);
              UI.applyTheme(o.value, { animate: true });
              s.close();
              UI.toast('Theme set to ' + o.label.toLowerCase() + '.');
            },
          }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon(o.icon, 17)]),
            U.el('span', { class: 'list__label grow', text: o.label }),
            current === o.value ? U.el('span', { class: 'list__chev', style: { color: 'var(--text-primary)' } }, [U.icon('check', 16)]) : null,
          ])
        )),
      ],
    });
  }

  /* ============================= SUBJECTS =============================== */
  function subjects() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);

    function paint() {
      U.clear(body);
      const rows = Store.query('subjects', { sort: 'name' });
      if (!rows.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'cap',
            title: 'No subjects yet',
            body: 'Subjects colour-code your homework, exams and projects, and can hold their own notes.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add a subject', onclick: () => P.createItem('subjects', {}) }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Load sample data', onclick: () => loadSample() }),
            ],
          })
        );
        return;
      }
      const list = U.el('div', { class: 'stack-3' });
      rows.forEach((s) => {
        const bundle = Store.subjectBundle(s.id);
        const total = ['homework', 'tasks', 'projects', 'exams'].reduce((acc, c) => acc + bundle[c].length, 0);
        const open = ['homework', 'tasks', 'projects', 'exams'].reduce((acc, c) => acc + bundle[c].filter((r) => !M.isCompleted(c, r)).length, 0);
        const overdue = ['homework', 'tasks', 'projects', 'exams'].reduce((acc, c) => acc + bundle[c].filter((r) => M.isOverdue(c, r)).length, 0);
        const card = U.el('div', { class: 'card card--pad card--tap' }, [
          U.el('div', { class: 'row', style: { gap: '12px' } }, [
            U.el('span', { class: 'subject-head__swatch', style: { background: s.color, width: '42px', height: '42px' } }, [U.icon(s.icon || 'book', 20)]),
            U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
              U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: s.name }),
              U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)' }, text: [s.teacher, s.room].filter(Boolean).join(' · ') || 'No teacher set' }),
            ]),
            U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]),
          ]),
          U.el('div', { class: 'row', style: { gap: '8px', marginTop: '12px', flexWrap: 'wrap' } }, [
            U.el('span', { class: 'badge badge--neutral', text: total + ' item' + (total === 1 ? '' : 's') }),
            open ? U.el('span', { class: 'badge badge--info', text: open + ' open' }) : null,
            overdue ? U.el('span', { class: 'badge badge--overdue', text: overdue + ' overdue' }) : null,
          ]),
        ]);
        card.addEventListener('click', () => global.Router.go('/subjects/' + s.id));
        list.appendChild(card);
      });
      body.appendChild(list);
    }

    paint();
    return {
      node: root,
      title: 'Subjects',
      back: true,
      actions: [{ icon: 'plus', label: 'Add subject', onClick: () => P.createItem('subjects', {}) }],
    };
  }

  function subjectDetail(params) {
    const subject = Store.byId('subjects', params.id);
    const root = U.el('div', { class: 'screen' });
    if (!subject) {
      root.appendChild(UI.emptyState({ icon: 'alert', title: 'Subject not found', body: 'It may have been deleted.' }));
      return { node: root, title: 'Subject', back: true };
    }
    const subjectMap = P.subjectMap();
    const bundle = Store.subjectBundle(subject.id);
    const all = [];
    ['homework', 'projects', 'exams', 'events', 'tasks'].forEach((c) => bundle[c].forEach((r) => all.push({ collection: c, record: r })));

    root.appendChild(
      U.el('div', { class: 'detail-hero' }, [
        U.el('div', { class: 'row', style: { gap: '14px' } }, [
          U.el('span', { class: 'subject-head__swatch', style: { background: subject.color, width: '52px', height: '52px' } }, [U.icon(subject.icon || 'book', 24)]),
          U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
            U.el('h1', { class: 'detail-hero__title', text: subject.name }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)', marginTop: '2px' }, text: [subject.teacher, subject.room].filter(Boolean).join(' · ') || 'No teacher or room set' }),
          ]),
          U.el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Edit subject', onclick: () => P.editItem('subjects', subject.id) }, [U.icon('edit', 18)]),
        ]),
        U.el('div', { class: 'row', style: { gap: '8px', marginTop: '14px', flexWrap: 'wrap' } }, [
          U.el('span', { class: 'badge badge--neutral', text: all.length + ' linked items' }),
          U.el('span', { class: 'badge badge--neutral', text: bundle.notes.length + ' notes' }),
          U.el('span', { class: 'badge badge--neutral', text: Store.list('timetable').filter((c) => c.subjectId === subject.id).length + ' classes/week' }),
        ]),
      ])
    );

    // Deadlines for this subject
    const upcoming = all.filter((x) => !M.isCompleted(x.collection, x.record) && M.DATE_FIELD[x.collection]);
    const overdue = upcoming.filter((x) => M.isOverdue(x.collection, x.record));
    const next7 = upcoming.filter((x) => {
      const d = M.deadlineOf(x.collection, x.record);
      return !M.isOverdue(x.collection, x.record) && d >= U.todayISO() && d <= U.toISO(U.addDays(new Date(), 7));
    });

    if (overdue.length || next7.length) {
      root.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
          U.el('div', { class: 'field__label', text: 'Upcoming deadlines' }),
          U.el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
            overdue.length ? U.el('span', { class: 'badge badge--overdue', text: overdue.length + ' overdue' }) : null,
            next7.length ? U.el('span', { class: 'badge badge--today', text: next7.length + ' due within 7 days' }) : null,
            !overdue.length && !next7.length ? U.el('span', { class: 'badge badge--done', text: 'Nothing due soon' }) : null,
          ]),
        ])
      );
    }

    // Sections
    const sections = [
      { key: 'homework', label: 'Homework' },
      { key: 'projects', label: 'Projects' },
      { key: 'exams', label: 'Exams' },
      { key: 'tasks', label: 'Tasks' },
      { key: 'events', label: 'Events' },
    ];
    let any = false;
    sections.forEach((sec) => {
      const rows = bundle[sec.key];
      if (!rows.length) return;
      any = true;
      const head = UI.sectionHead(sec.label, { count: rows.length });
      head.appendChild(
        U.el('button', {
          class: 'section__action',
          type: 'button',
          onclick: () => P.createItem(sec.key, { subjectId: subject.id }),
        }, [U.icon('plus', 13), U.el('span', { text: 'Add' })])
      );
      root.appendChild(head);
      const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      rows
        .slice()
        .sort((a, b) => (M.deadlineOf(sec.key, a) || '').localeCompare(M.deadlineOf(sec.key, b) || ''))
        .forEach((r, i) =>
          list.appendChild(
            UI.swipeRow({
              content: UI.itemRow(sec.key, r, { subjectMap, bordered: i > 0, onOpen: (c, x) => global.Router.go('/' + c + '/' + x.id) }),
              onComplete: () => UI.toggleComplete(sec.key, r.id),
              onDelete: () => P.deleteItem(sec.key, r.id),
              onReschedule: M.DATE_FIELD[sec.key] ? () => P.snoozeTomorrow(sec.key, r.id) : null,
            })
          )
        );
      root.appendChild(list);
    });

    if (bundle.notes.length) {
      const head = UI.sectionHead('Notes', { count: bundle.notes.length });
      head.appendChild(U.el('button', { class: 'section__action', type: 'button', onclick: () => P.openNotes('subjects', subject.id) }, [U.icon('file', 13), U.el('span', { text: 'Manage' })]));
      root.appendChild(head);
      bundle.notes.forEach((n) => {
        const card = U.el('div', { class: 'note-card card--tap', style: { marginBottom: '8px' } });
        card.appendChild(U.el('div', { class: 'note-card__title', text: n.title }));
        if (n.body) card.appendChild(U.el('div', { class: 'note-card__body clamp-2', text: n.body }));
        card.addEventListener('click', () => global.Router.go('/notes/' + n.id));
        root.appendChild(card);
      });
    }

    if (!any && !bundle.notes.length) {
      root.appendChild(
        UI.emptyState({
          icon: 'sparkles',
          title: 'Nothing linked yet',
          body: 'Add homework, a project or an exam for ' + subject.name + ' and it will all appear here.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', { subjectId: subject.id }) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add exam', onclick: () => P.createItem('exams', { subjectId: subject.id }) }),
          ],
        })
      );
    }

    // Weekly classes for this subject
    const classes = Store.list('timetable').filter((c) => c.subjectId === subject.id).sort((a, b) => (Number(a.day) - Number(b.day)) || (a.startTime || '').localeCompare(b.startTime || ''));
    if (classes.length) {
      root.appendChild(UI.sectionHead('Weekly classes', { count: classes.length }));
      const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      classes.forEach((c, i) => {
        list.appendChild(
          U.el('button', {
            class: 'list__row',
            type: 'button',
            onclick: () => P.editItem('timetable', c.id),
          }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: subject.color } }, [U.icon('clock', 16)]),
            U.el('div', { class: 'grow col' }, [
              U.el('span', { class: 'list__label', text: U.DOW_LONG[Number(c.day)] }),
              U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtTime(c.startTime) + ' – ' + U.fmtTime(c.endTime || c.startTime) + (c.room ? ' · ' + c.room : '') }),
            ]),
            U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 15)]),
          ])
        );
      });
      root.appendChild(list);
    }

    root.appendChild(
      U.el('div', { class: 'action-bar' }, [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => P.editItem('subjects', subject.id) }, [U.icon('edit', 16), U.el('span', { text: 'Edit subject' })]),
        U.el('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'Notes', onclick: () => P.openNotes('subjects', subject.id) }, [U.icon('file', 16)]),
        U.el('button', { class: 'btn btn--danger', type: 'button', 'aria-label': 'Delete subject', onclick: async () => { const ok = await P.deleteItem('subjects', subject.id); if (ok) global.Router.back(); } }, [U.icon('trash', 16)]),
      ])
    );

    return {
      node: root,
      title: subject.name,
      back: true,
      actions: [
        { icon: 'plus', label: 'Add homework', onClick: () => P.createItem('homework', { subjectId: subject.id }) },
        { icon: 'edit', label: 'Edit', onClick: () => P.editItem('subjects', subject.id) },
      ],
    };
  }

  function loadSample() {
    const n = global.Sample.load();
    global.Sample.ensureProfileDefaults();
    Store.setSetting('sampleDataLoaded', true);
    UI.toast(n + ' sample items added. Remove them anytime in Settings.');
    global.Router.handle(true);
  }

  /* ============================ TIMETABLE =============================== */
  function timetable() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);
    const today = new Date().getDay();
    let day = today;

    function paint() {
      U.clear(body);
      const ws = Store.getSetting('weekStart', 1);
      const order = [];
      for (let i = 0; i < 7; i++) order.push((ws + i) % 7);

      const strip = U.el('div', { class: 'chip-row chip-row--padless', style: { flexWrap: 'wrap', overflow: 'visible', marginBottom: '14px' } });
      order.forEach((d) => {
        const count = Store.list('timetable').filter((c) => Number(c.day) === d).length;
        strip.appendChild(
          U.el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(day === d),
            onclick: () => {
              day = d;
              paint();
            },
          }, [U.el('span', { text: U.DOW_SHORT[d] }), count ? U.el('span', { class: 'chip__count', text: String(count) }) : null])
        );
      });
      body.appendChild(strip);

      const classes = P.classesForDay(day);
      if (!classes.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'clock',
            title: 'No classes on ' + U.DOW_LONG[day],
            body: 'Build your weekly timetable once and today’s classes appear on the Home screen automatically.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add a class', onclick: () => addClassAndRepaint() }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Copy from another day', onclick: () => copyDaySheet() }),
            ],
          })
        );
        return;
      }

      const grid = U.el('div', { class: 'tt' });
      classes.forEach((c) => {
        const subject = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
        const row = U.el('button', {
          class: 'tt__row' + (c.kind === 'break' ? ' tt__row--break' : ''),
          type: 'button',
          style: { width: '100%', textAlign: 'left' },
          onclick: () => P.editItem('timetable', c.id),
        }, [
          U.el('div', { class: 'tt__time', text: U.fmtTime(c.startTime) }),
          U.el('div', { class: 'tt__body' }, [
            U.el('span', { class: 'subject-dot', style: { background: subject ? subject.color : 'var(--text-tertiary)' } }),
            U.el('span', { class: 'grow truncate', style: { fontWeight: c.kind === 'break' ? '400' : '500' }, text: subject ? subject.name : c.label || 'Class' }),
            c.room ? U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: c.room }) : null,
          ]),
        ]);
        grid.appendChild(row);
      });
      body.appendChild(grid);

      body.appendChild(
        U.el('div', { class: 'row', style: { gap: '8px', marginTop: '16px' } }, [
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => addClassAndRepaint() }, [U.icon('plus', 15), U.el('span', { text: 'Add class' })]),
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => copyDaySheet() }, [U.icon('copy', 15), U.el('span', { text: 'Copy a day' })]),
        ])
      );
    }

    function addClassAndRepaint() {
      P.addClass(day).then((r) => {
        if (r) paint();
      });
    }

    function copyDaySheet() {
      const s = UI.sheet({
        title: 'Copy classes from',
        subtitle: 'Into ' + U.DOW_LONG[day],
        body: [
          U.el('div', { class: 'list list--plain' }, U.DOW_LONG.map((label, idx) =>
            U.el('button', {
              class: 'list__row',
              type: 'button',
              disabled: idx === day,
              onclick: () => {
                const src = Store.list('timetable').filter((c) => Number(c.day) === idx);
                if (!src.length) {
                  UI.toast('No classes on ' + label + '.');
                  return;
                }
                src.forEach((c) => {
                  Store.put('timetable', Object.assign({}, M.create('timetable', {}), {
                    day,
                    startTime: c.startTime,
                    endTime: c.endTime,
                    subjectId: c.subjectId,
                    label: c.label,
                    room: c.room,
                    kind: c.kind,
                    sample: c.sample,
                  }));
                });
                s.close();
                UI.toast(src.length + ' classes copied from ' + label + '.');
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon('copy', 16)]),
              U.el('span', { class: 'list__label grow', text: label }),
              U.el('span', { class: 'list__value', text: Store.list('timetable').filter((c) => Number(c.day) === idx).length + ' classes' }),
            ])
          )),
        ],
      });
    }

    paint();
    return {
      node: root,
      title: 'Timetable',
      back: true,
      actions: [
        { icon: 'plus', label: 'Add class', onClick: () => addClassAndRepaint() },
      ],
    };
  }

  /* =========================== STATISTICS =============================== */
  function statistics() {
    const root = U.el('div', { class: 'screen' });
    const stats = Store.stats();
    const hasData = stats.total > 0;

    if (!hasData) {
      root.appendChild(
        UI.emptyState({
          icon: 'trending',
          title: 'No statistics yet',
          body: 'Add homework, tasks or projects and this page fills up with your real progress.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', {}) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Load sample data', onclick: () => loadSample() }),
          ],
        })
      );
      return { node: root, title: 'Statistics', back: true };
    }

    /* Overview */
    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        U.el('div', { class: 'row', style: { gap: '18px', alignItems: 'center' } }, [
          UI.ring(stats.rate, 72),
          U.el('div', { class: 'grow col' }, [
            U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: stats.rate + '% complete' }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: stats.done + ' of ' + stats.total + ' tracked items finished' }),
            U.el('div', { class: 'row', style: { gap: '8px', marginTop: '10px', flexWrap: 'wrap' } }, [
              stats.streak.count ? U.el('span', { class: 'streak' }, [U.icon('zap', 13), U.el('span', { text: stats.streak.count + ' day streak' })]) : null,
              stats.streak.best ? U.el('span', { class: 'badge badge--neutral', text: 'Best: ' + stats.streak.best + ' days' }) : null,
            ]),
          ]),
        ]),
      ])
    );

    root.appendChild(
      U.el('div', { class: 'stat-grid', style: { marginBottom: '18px' } }, [
        UI.statTile(stats.done, 'Completed', { hint: stats.completedToday + ' today · ' + stats.completedThisWeek + ' this week' }),
        UI.statTile(stats.activeTotal, 'Still open', { hint: stats.dueToday + ' due today' }),
        UI.statTile(stats.overdue, 'Overdue', { hint: stats.overdue ? 'Needs attention' : 'All clear', color: stats.overdue ? 'var(--danger)' : 'var(--success)' }),
        UI.statTile(stats.rate + '%', 'Completion rate', { hint: stats.completedThisMonth + ' done this month' }),
      ])
    );

    /* Weekly productivity */
    root.appendChild(UI.sectionHead('This week', { count: stats.completedThisWeek }));
    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        UI.barChart(stats.weekDays, { ariaLabel: 'Items completed each day this week' }),
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', marginTop: '8px', textAlign: 'center' }, text: 'Items completed per day — week of ' + U.fmtDateShort(U.toISO(U.startOfWeek(new Date(), Store.getSetting('weekStart', 1)))) }),
      ])
    );

    /* 30 day trend */
    const trendData = stats.trend.filter((_, i) => i % 3 === 0);
    root.appendChild(UI.sectionHead('Last 30 days'));
    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        UI.barChart(trendData, { ariaLabel: 'Completions over the last 30 days' }),
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', marginTop: '8px', textAlign: 'center' }, text: 'Every third day is labelled. Total: ' + stats.trend.reduce((a, t) => a + t.count, 0) + ' completions.' }),
      ])
    );

    /* By type */
    root.appendChild(UI.sectionHead('By type'));
    const typeRows = [
      { label: 'Homework', total: stats.homeworkTotal, done: stats.homeworkDone, icon: 'book' },
      { label: 'Projects', total: stats.projectsTotal, done: stats.projectsDone, icon: 'folder' },
      { label: 'Tasks', total: Store.list('tasks').length, done: Store.list('tasks').filter((t) => t.completed).length, icon: 'checkCircle' },
      { label: 'Exams', total: Store.list('exams').length, done: Store.list('exams').filter((e) => M.isCompleted('exams', e)).length, icon: 'clipboard' },
      { label: 'Events', total: Store.list('events').length, done: Store.list('events').filter((e) => M.isCompleted('events', e)).length, icon: 'calendar' },
    ];
    const typeCard = U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } });
    typeRows.forEach((r, i) => {
      const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
      typeCard.appendChild(
        U.el('div', { style: i ? { marginTop: '16px' } : null }, [
          U.el('div', { class: 'row row--between', style: { marginBottom: '6px' } }, [
            U.el('div', { class: 'row', style: { gap: '8px' } }, [
              U.el('span', { class: 'type-chip ' + M.typeMeta(['homework', 'projects', 'tasks', 'exams', 'events'][i]).chip }, [U.icon(r.icon, 11), U.el('span', { text: r.label })]),
            ]),
            U.el('span', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)', fontVariantNumeric: 'tabular-nums' }, text: r.done + '/' + r.total + ' · ' + pct + '%' }),
          ]),
          UI.progressBar(pct),
        ])
      );
    });
    root.appendChild(typeCard);

    /* Per subject */
    if (stats.subjectRows.length) {
      root.appendChild(UI.sectionHead('By subject', { count: stats.subjectRows.length }));
      const subjCard = U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } });
      stats.subjectRows.forEach((row, i) => {
        subjCard.appendChild(
          U.el('div', { style: i ? { marginTop: '16px' } : null }, [
            U.el('div', { class: 'row row--between', style: { marginBottom: '6px' } }, [
              U.el('button', {
                class: 'row',
                type: 'button',
                style: { gap: '8px' },
                onclick: () => global.Router.go('/subjects/' + row.subject.id),
              }, [
                U.el('span', { class: 'subject-dot', style: { background: row.subject.color } }),
                U.el('span', { style: { fontSize: 'var(--fs-callout)', fontWeight: '500' }, text: row.subject.name }),
              ]),
              U.el('span', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)', fontVariantNumeric: 'tabular-nums' }, text: row.done + '/' + row.total + (row.overdue ? ' · ' + row.overdue + ' overdue' : '') }),
            ]),
            UI.progressBar(row.pct),
          ])
        );
      });
      root.appendChild(subjCard);
    }

    /* Workload */
    if (stats.minutesPlanned) {
      root.appendChild(UI.sectionHead('Estimated workload'));
      root.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
          U.el('div', { class: 'row', style: { gap: '16px' } }, [
            U.el('div', { class: 'grow col' }, [
              U.el('div', { class: 'stat__value', text: U.fmtDuration(stats.minutesPlanned) }),
              U.el('div', { class: 'stat__label', text: 'Total estimated' }),
            ]),
            U.el('div', { class: 'grow col' }, [
              U.el('div', { class: 'stat__value', text: U.fmtDuration(stats.minutesDone) }),
              U.el('div', { class: 'stat__label', text: 'Completed' }),
            ]),
          ]),
        ])
      );
    }

    root.appendChild(
      U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', textAlign: 'center', padding: '8px 0 20px' }, text: 'All figures come from your own records — nothing is estimated or invented.' })
    );

    return { node: root, title: 'Statistics', back: true };
  }

  /* ============================= SEARCH ================================= */
  function search(params, query) {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    let q = query && query.q ? query.q : '';
    const input = U.el('input', {
      type: 'search',
      placeholder: 'Search homework, projects, exams, events, tasks, subjects, notes…',
      value: q,
      'aria-label': 'Search everything',
    });
    const bar = U.el('div', { class: 'search-bar', style: { marginBottom: '16px' } });
    bar.appendChild(U.icon('search', 17));
    bar.appendChild(input);
    if (q) {
      bar.appendChild(
        U.el('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': 'Clear search', onclick: () => { input.value = ''; q = ''; paint(); input.focus(); } }, [U.icon('x', 15)])
      );
    }
    root.appendChild(bar);
    root.appendChild(body);

    input.addEventListener(
      'input',
      U.debounce(() => {
        q = input.value.trim();
        paint();
      }, 160)
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        q = '';
        paint();
      }
    });

    function paint() {
      U.clear(body);
      if (!q) {
        const suggestions = [
          { label: 'Homework', route: '/homework' },
          { label: 'Projects', route: '/projects' },
          { label: 'Exams', route: '/exams' },
          { label: 'Events', route: '/events' },
          { label: 'Tasks', route: '/tasks' },
          { label: 'Notes', route: '/notes' },
          { label: 'Subjects', route: '/subjects' },
        ];
        body.appendChild(
          UI.emptyState({
            icon: 'search',
            title: 'Search everything',
            body: 'Find any homework, project, exam, event, task, subject or note. Results are grouped by type.',
            actions: suggestions.slice(0, 4).map((s) => U.el('button', { class: 'btn btn--secondary', type: 'button', text: s.label, onclick: () => global.Router.go(s.route) })),
          })
        );
        return;
      }

      const res = global.Search.run(q, { limit: 12 });
      if (!res.total) {
        body.appendChild(
          UI.emptyState({
            icon: 'search',
            title: 'No results for “' + q + '”',
            body: 'Try a shorter word, or search for a subject name.',
            actions: [U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Clear', onclick: () => { input.value = ''; q = ''; paint(); } })],
          })
        );
        return;
      }

      body.appendChild(
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)', marginBottom: '14px' }, text: res.total + ' result' + (res.total === 1 ? '' : 's') + ' across ' + res.groups.length + ' type' + (res.groups.length === 1 ? '' : 's') })
      );

      res.groups.forEach((g) => {
        body.appendChild(UI.sectionHead(g.label, { count: g.total }));
        const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
        g.items.forEach((it, i) => {
          const rec = it.record;
          const row = UI.itemRow(it.collection, rec, {
            bordered: i > 0,
            showType: false,
            onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id),
          });
          // Highlight the matched snippet.
          const titleEl = row.querySelector('.item__title');
          const title = rec.title || rec.name || 'Untitled';
          if (titleEl) titleEl.innerHTML = U.highlight(U.escapeHtml(title), q);
          const snip = global.Search.snippet(it.collection, rec, q.toLowerCase());
          if (snip && snip.toLowerCase() !== title.toLowerCase()) {
            const meta = row.querySelector('.item__meta');
            if (meta) {
              meta.appendChild(U.el('span', { class: 'item__meta-dot' }));
              const s2 = U.el('span', { class: 'truncate', style: { maxWidth: '100%' } });
              s2.innerHTML = U.highlight(U.escapeHtml(snip.slice(0, 90)), q);
              meta.appendChild(s2);
            }
          }
          list.appendChild(row);
        });
        body.appendChild(list);
      });
    }

    paint();
    return {
      node: root,
      title: 'Search',
      back: true,
      afterRender() {
        if (!q) setTimeout(() => input.focus(), 120);
      },
    };
  }

  /* ============================ SETTINGS ================================ */
  function settings() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);

    function paint() {
      U.clear(body);
      const profile = Store.profile();

      /* Account */
      const me = global.Auth.current();
      body.appendChild(UI.sectionHead('Account'));
      const accountCard = U.el('div', { class: 'card card--pad', style: { marginBottom: '12px' } });
      if (me) {
        const info = global.Auth.statsFor(me.id);
        const sync = global.Auth.syncStatus();
        const syncLabel =
          sync.status === 'working' ? 'Syncing…'
          : sync.status === 'ok' ? 'Synced ' + (sync.lastSyncAt ? U.fmtDateStamp(sync.lastSyncAt) : '')
          : sync.status === 'offline' ? 'Offline — will sync later'
          : sync.status === 'error' ? 'Sync problem'
          : 'Not synced yet';
        accountCard.appendChild(
          U.el('div', { class: 'row', style: { gap: '12px' } }, [
            U.el('span', { class: 'avatar', style: { background: me.avatarColor }, text: global.UI.initials(me.name) }),
            U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
              U.el('div', { style: { fontWeight: '600' }, text: me.name }),
              U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'Signed in · ' + info.items + ' items · ' + syncLabel }),
            ]),
          ])
        );
        if (sync.status === 'error' && sync.error) {
          accountCard.appendChild(
            U.el('div', { class: 'field__error', style: { marginTop: '10px' } }, [U.icon('alert', 14), U.el('span', { text: sync.error })])
          );
        }
      } else {
        accountCard.appendChild(
          U.el('div', { class: 'row', style: { gap: '12px' } }, [
            U.el('span', { class: 'avatar', text: 'G' }),
            U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
              U.el('div', { style: { fontWeight: '600' }, text: 'Guest' }),
              U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'No account — your work is not separated from other users of this browser.' }),
            ]),
          ])
        );
      }
      body.appendChild(accountCard);

      const accountList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      if (me) {
        accountList.appendChild(
          UI.fieldRow('Sync now', (function () {
            const s = global.Auth.syncStatus();
            if (s.status === 'working') return 'Syncing…';
            if (s.status === 'error') return 'Failed — tap to retry';
            if (s.lastSyncAt) return 'Last synced ' + U.fmtDateStamp(s.lastSyncAt);
            return 'Not synced yet';
          })(), {
            icon: 'refresh',
            onClick: async () => {
              UI.toast('Syncing…');
              const res = await global.Auth.sync({ reason: 'manual' });
              if (res.ok) UI.toast('Your planner is up to date on the server.');
              else UI.toast(res.error || 'Sync failed.');
              paint();
            },
          })
        );
        accountList.appendChild(
          UI.fieldRow('Send this device’s copy up', 'Replaces the server copy', {
            icon: 'upload',
            chevron: false,
            onClick: async () => {
              const ok = await UI.confirm({
                title: 'Upload this device’s planner?',
                message: 'The copy on the server will be replaced by what is on this device. Use this if this device has the newer work.',
                confirmLabel: 'Upload',
              });
              if (!ok) return;
              const res = await global.Auth.uploadLocal();
              UI.toast(res.ok ? 'Uploaded.' : res.error || 'Upload failed.');
              paint();
            },
          })
        );
        accountList.appendChild(
          UI.fieldRow('Pull the server’s copy down', 'Replaces what is here', {
            icon: 'download',
            chevron: false,
            onClick: async () => {
              const ok = await UI.confirm({
                title: 'Download the server’s planner?',
                message: 'Everything on this device will be replaced by the copy on the server. Use this if another device has the newer work.',
                confirmLabel: 'Download',
                danger: true,
              });
              if (!ok) return;
              const res = await global.Auth.downloadRemote();
              UI.toast(res.ok ? 'Downloaded. Your planner is up to date.' : res.error || 'Download failed.');
              global.Router.handle(true);
            },
          })
        );
        accountList.appendChild(
          UI.fieldRow('Test the connection', 'Checks the sync server', {
            icon: 'zap',
            chevron: false,
            onClick: async () => {
              UI.toast('Testing…');
              const res = await global.Cloud.selfTest();
              UI.toast(res.ok ? 'Sync server is reachable and working.' : 'Test failed: ' + (res.error || res.step));
            },
          })
        );
        accountList.appendChild(
          UI.fieldRow('Change my name', me.name, {
            icon: 'user',
            onClick: async () => {
              const v = await UI.prompt({ title: 'Change your name', message: 'You will sign in with this name.', value: me.name, required: true, confirmLabel: 'Save' });
              if (v === null) return;
              const res = global.Auth.rename(me.id, v);
              if (!res.ok) {
                UI.toast(res.error);
                return;
              }
              UI.toast('Name updated.');
              paint();
            },
          })
        );
        accountList.appendChild(UI.fieldRow('Change my password', '••••••••', { icon: 'lock', onClick: () => changePasswordSheet(me) }));
        accountList.appendChild(
          UI.fieldRow('Switch account', global.Auth.count() + ' on this device', {
            icon: 'users',
            onClick: async () => {
              const ok = await UI.confirm({ title: 'Switch account?', message: 'You will be taken back to the sign-in screen. Nothing is deleted.', confirmLabel: 'Switch' });
              if (!ok) return;
              global.Auth.logout();
              location.hash = '';
              location.reload();
            },
          })
        );
        accountList.appendChild(
          UI.fieldRow('Delete this account', 'Removes its planner too', {
            icon: 'trash',
            onClick: () => deleteAccountSheet(me),
          })
        );
      } else {
        accountList.appendChild(
          UI.fieldRow('Create an account', 'Keep your work separate', {
            icon: 'user',
            onClick: () => {
              location.hash = '#/signin';
            },
          })
        );
      }
      body.appendChild(accountList);

      /* Profile */
      body.appendChild(UI.sectionHead('Profile'));
      const profileList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      profileList.appendChild(UI.fieldRow('Name', profile.name || 'Not set', { icon: 'user', onClick: () => editProfileField('name', 'Your name', 'What should we call you?') }));
      profileList.appendChild(UI.fieldRow('Grade / year', profile.grade || 'Not set', { icon: 'cap', onClick: () => editProfileField('grade', 'Grade or year', 'e.g. Grade 10') }));
      profileList.appendChild(UI.fieldRow('School', profile.school || 'Not set', { icon: 'school', onClick: () => editProfileField('school', 'School name', '') }));
      profileList.appendChild(UI.fieldRow('School starts', U.fmtTime(profile.startTime), { icon: 'clock', onClick: () => editProfileTime('startTime', 'School start time') }));
      profileList.appendChild(UI.fieldRow('School ends', U.fmtTime(profile.endTime), { icon: 'clock', onClick: () => editProfileTime('endTime', 'School end time') }));
      body.appendChild(profileList);

      /* Subjects & timetable */
      body.appendChild(UI.sectionHead('School'));
      const schoolList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      schoolList.appendChild(UI.fieldRow('Subjects', Store.list('subjects').length + '', { icon: 'cap', onClick: () => global.Router.go('/subjects') }));
      schoolList.appendChild(UI.fieldRow('Timetable', Store.list('timetable').length ? Store.list('timetable').length + ' classes' : 'Not set', { icon: 'clock', onClick: () => global.Router.go('/timetable') }));
      body.appendChild(schoolList);

      /* Appearance */
      body.appendChild(UI.sectionHead('Appearance'));
      const appearance = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      appearance.appendChild(
        UI.fieldRow('Theme', themeLabel(Store.getSetting('theme', 'system')), { icon: 'palette', chevron: false, onClick: () => themeSheet() })
      );
      appearance.appendChild(
        U.el('div', { class: 'list__row', style: { cursor: 'default' } }, [
          U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('monitor', 17)]),
          U.el('span', { class: 'list__label grow', text: 'Preview' }),
          U.el('div', { style: { display: 'flex', gap: '6px' } }, [
            U.el('button', { class: 'btn btn--sm btn--secondary', type: 'button', text: 'Light', onclick: () => { Store.setSetting('theme', 'light'); UI.applyTheme('light', { animate: true }); paint(); } }),
            U.el('button', { class: 'btn btn--sm btn--secondary', type: 'button', text: 'Dark', onclick: () => { Store.setSetting('theme', 'dark'); UI.applyTheme('dark', { animate: true }); paint(); } }),
          ]),
        ])
      );
      body.appendChild(appearance);

      /* Notifications */
      body.appendChild(UI.sectionHead('Notifications'));
      const notifList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      const enabled = Store.getSetting('notificationsEnabled', false);
      notifList.appendChild(
        UI.switchRow('Notifications', enabled, async (on) => {
          if (on) {
            const res = await global.Notify.enable();
            if (!res.ok) {
              UI.toast(res.message || 'Notifications could not be switched on.');
              paint();
              return;
            }
            UI.toast('Notifications on. You’ll get reminders for what you schedule.');
          } else {
            global.Notify.disable();
            UI.toast('Notifications off.');
          }
          paint();
        }, { icon: 'bell', hint: global.Notify.isNative() ? 'Delivered by your device, even when the app is closed.' : 'Delivered while the app is open, and by your device when installed.' })
      );
      ['homework', 'projects', 'exams', 'events', 'tasks'].forEach((c) => {
        const key = 'notify' + c.charAt(0).toUpperCase() + c.slice(1);
        notifList.appendChild(
          UI.switchRow(M.SCHEMAS[c].label + ' reminders', Store.getSetting(key, true), (on) => {
            Store.setSetting(key, on);
            global.Notify.reschedule();
          }, { icon: M.typeMeta(c).icon })
        );
      });
      notifList.appendChild(UI.fieldRow('Default reminder', M.reminderLabel(Store.getSetting('defaultReminder', 1440)), { icon: 'clock', onClick: defaultReminderSheet }));
      notifList.appendChild(
        UI.switchRow('Quiet hours', (Store.getSetting('quietHours', {}) || {}).enabled, (on) => {
          const q = Object.assign({ start: '22:00', end: '07:00' }, Store.getSetting('quietHours', {}), { enabled: on });
          Store.setSetting('quietHours', q);
          global.Notify.reschedule();
          paint();
        }, { icon: 'moon', hint: 'Silence reminders overnight.' })
      );
      notifList.appendChild(
        UI.fieldRow('Send a test reminder', '', {
          icon: 'zap',
          chevron: false,
          onClick: async () => {
            const res = await global.Notify.test();
            UI.toast(res.ok ? 'Test reminder sent.' : res.inApp ? 'Shown in-app — system notifications are blocked.' : res.message || 'Could not send a reminder.');
          },
        })
      );
      body.appendChild(notifList);

      const status = global.Notify.status();
      body.appendChild(
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', margin: '-8px 4px 18px' }, text: 'Permission: ' + status.permission + ' · ' + status.scheduled + ' reminder' + (status.scheduled === 1 ? '' : 's') + ' scheduled' + (status.next ? ' · next ' + U.fmtDateStamp(status.next.at.getTime()) : '') })
      );

      /* Calendar */
      body.appendChild(UI.sectionHead('Calendar'));
      const calList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      calList.appendChild(
        UI.fieldRow('Week starts on', U.DOW_LONG[Store.getSetting('weekStart', 1)], { icon: 'calendar', onClick: weekStartSheet })
      );
      calList.appendChild(
        UI.fieldRow('Default view', capitalise(Store.getSetting('calendarDefaultView', 'month')), {
          icon: 'grid',
          onClick: () => {
            const s = UI.sheet({
              title: 'Default calendar view',
              body: [U.el('div', { class: 'list list--plain' }, ['month', 'week', 'day'].map((v) =>
                U.el('button', {
                  class: 'list__row',
                  type: 'button',
                  onclick: () => {
                    Store.setSetting('calendarDefaultView', v);
                    s.close();
                    paint();
                  },
                }, [
                  U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon(Store.getSetting('calendarDefaultView', 'month') === v ? 'check' : 'calendar', 16)]),
                  U.el('span', { class: 'list__label grow', text: capitalise(v) }),
                ])
              ))],
            });
          },
        })
      );
      calList.appendChild(
        UI.fieldRow('Time format', Store.getSetting('timeFormat', '12') === '24' ? '24-hour' : '12-hour', {
          icon: 'clock',
          onClick: () => {
            Store.setSetting('timeFormat', Store.getSetting('timeFormat', '12') === '24' ? '12' : '24');
            paint();
            UI.toast('Times will now show in ' + (Store.getSetting('timeFormat') === '24' ? '24-hour' : '12-hour') + ' format.');
          },
        })
      );
      body.appendChild(calList);

      /* Data */
      body.appendChild(UI.sectionHead('Data'));
      const dataList = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
      dataList.appendChild(UI.fieldRow('Export a backup', '', { icon: 'download', chevron: false, onClick: exportSheet }));
      dataList.appendChild(UI.fieldRow('Import a backup', '', { icon: 'upload', chevron: false, onClick: importSheet }));
      if (Store.hasSampleData()) {
        dataList.appendChild(
          UI.fieldRow('Remove sample data', '', {
            icon: 'trash',
            chevron: false,
            onClick: async () => {
              const ok = await UI.confirm({
                title: 'Remove sample data?',
                message: 'Only the demo items that came with the app are removed. Anything you created stays.',
                confirmLabel: 'Remove samples',
              });
              if (!ok) return;
              const n = Store.clearSampleData();
              Store.setSetting('sampleDataLoaded', false);
              UI.toast(n + ' sample items removed.');
              global.Router.handle(true);
            },
          })
        );
      } else if (!Store.list('homework').length && !Store.list('tasks').length) {
        dataList.appendChild(UI.fieldRow('Load sample data', '', { icon: 'sparkles', chevron: false, onClick: () => loadSample() }));
      }
      dataList.appendChild(
        UI.fieldRow('Reset everything', '', {
          icon: 'alert',
          chevron: false,
          onClick: () => resetSheet(),
        })
      );
      body.appendChild(dataList);

      Store.storageEstimate().then((est) => {
        const el2 = body.querySelector('[data-storage]');
        if (el2) el2.textContent = 'Stored on this device: ' + est.human;
      });
      body.appendChild(U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', margin: '-8px 4px 18px' }, dataset: { storage: '1' }, text: 'Stored on this device: …' }));

      /* About */
      body.appendChild(UI.sectionHead('About'));
      const aboutList = U.el('div', { class: 'list' });
      aboutList.appendChild(UI.fieldRow('Study Planner', 'v1.0.0', { icon: 'info', onClick: () => global.Router.go('/about') }));
      aboutList.appendChild(UI.fieldRow('Works offline', 'Yes', { icon: 'wifiOff', chevron: false }));
      body.appendChild(aboutList);
    }

    function capitalise(s) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    /* ------------------------- Account management ------------------------ */
    function changePasswordSheet(me) {
      const current = U.el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
      const next = U.el('input', { class: 'input', type: 'password', placeholder: 'New password (4+ characters)', autocomplete: 'new-password' });
      const confirm = U.el('input', { class: 'input', type: 'password', placeholder: 'Repeat the new password', autocomplete: 'new-password' });
      const err = U.el('div', { class: 'field__error hidden' });
      const s = UI.sheet({
        title: 'Change password',
        subtitle: me.name,
        body: [
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Current password' }), current]),
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'New password' }), next]),
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Confirm new password' }), confirm, err]),
        ],
        footer: [
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
          U.el('button', {
            class: 'btn btn--primary grow',
            type: 'button',
            text: 'Change password',
            onclick: async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.textContent = 'Saving…';
              const res = await global.Auth.changePassword(me.id, current.value, next.value, confirm.value);
              btn.disabled = false;
              btn.textContent = 'Change password';
              if (!res.ok) {
                err.textContent = res.error;
                err.classList.remove('hidden');
                return;
              }
              s.close();
              UI.toast('Password changed. Use the new one next time you sign in.');
            },
          }),
        ],
      });
    }

    function deleteAccountSheet(me) {
      const pass = U.el('input', { class: 'input', type: 'password', placeholder: 'Your password', autocomplete: 'current-password' });
      const err = U.el('div', { class: 'field__error hidden' });
      const s = UI.sheet({
        title: 'Delete “' + me.name + '”?',
        body: [
          U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55', marginBottom: '14px' }, text: 'This deletes the account and everything in its planner on this device. It cannot be undone — export a backup first if you might want it later.' }),
          U.el('div', { class: 'field' }, [
            U.el('label', { class: 'field__label', text: 'Confirm with your password' }),
            pass, err,
          ]),
        ],
        footer: [
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
          U.el('button', {
            class: 'btn btn--danger grow',
            type: 'button',
            text: 'Delete account',
            onclick: async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.textContent = 'Deleting…';
              const res = await global.Auth.remove(me.id, pass.value);
              btn.disabled = false;
              btn.textContent = 'Delete account';
              if (!res.ok) {
                err.textContent = res.error;
                err.classList.remove('hidden');
                return;
              }
              s.close();
              UI.toast('Account deleted.');
              location.hash = '';
              location.reload();
            },
          }),
        ],
      });
    }

    function editProfileField(key, title, message) {
      UI.prompt({ title, message, value: Store.profile()[key] || '', confirmLabel: 'Save' }).then((v) => {
        if (v === null) return;
        Store.setProfile({ [key]: v });
        UI.toast('Saved.');
        paint();
      });
    }

    function editProfileTime(key, title) {
      const input = U.el('input', { class: 'input', type: 'time', value: Store.profile()[key] || '08:00' });
      const s = UI.sheet({
        title,
        body: [U.el('div', { class: 'field' }, [input])],
        footer: [
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
          U.el('button', {
            class: 'btn btn--primary grow',
            type: 'button',
            text: 'Save',
            onclick: () => {
              Store.setProfile({ [key]: input.value || '08:00' });
              s.close();
              paint();
            },
          }),
        ],
      });
    }

    function defaultReminderSheet() {
      const s = UI.sheet({
        title: 'Default reminder',
        subtitle: 'Used for new items',
        body: [
          U.el('div', { class: 'list list--plain' }, M.REMINDER_OPTIONS.map((r) =>
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                Store.setSetting('defaultReminder', r.value);
                global.Notify.reschedule();
                s.close();
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon(Store.getSetting('defaultReminder', 1440) === r.value ? 'check' : 'bell', 16)]),
              U.el('span', { class: 'list__label grow', text: r.label }),
            ])
          ).concat([
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                Store.setSetting('defaultReminder', null);
                s.close();
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon(Store.getSetting('defaultReminder', 1440) === null ? 'check' : 'x', 16)]),
              U.el('span', { class: 'list__label grow', text: 'No reminder by default' }),
            ]),
          ])),
        ],
      });
    }

    function weekStartSheet() {
      const s = UI.sheet({
        title: 'Week starts on',
        body: [
          U.el('div', { class: 'list list--plain' }, U.DOW_LONG.map((label, idx) =>
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                Store.setSetting('weekStart', idx);
                s.close();
                UI.toast('Weeks now start on ' + label + '.');
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon(Store.getSetting('weekStart', 1) === idx ? 'check' : 'calendar', 16)]),
              U.el('span', { class: 'list__label grow', text: label }),
            ])
          )),
        ],
      });
    }

    function exportSheet() {
      const json = Store.exportData();
      const counts = Store.exportCounts();
      const filename = 'study-planner-backup-' + U.todayISO() + '.json';
      const summary = Object.keys(counts)
        .filter((k) => counts[k])
        .map((k) => counts[k] + ' ' + M.typeMeta(k).label.toLowerCase())
        .join(', ');
      const s = UI.sheet({
        title: 'Export backup',
        subtitle: filename,
        body: [
          U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55', marginBottom: '14px' }, text: 'This file contains everything: ' + (summary || 'your planner data') + '. Keep it somewhere safe.' }),
          U.el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
            U.el('button', {
              class: 'btn btn--primary',
              type: 'button',
              onclick: () => {
                downloadText(filename, json);
                UI.toast('Backup downloaded.');
              },
            }, [U.icon('download', 16), U.el('span', { text: 'Download file' })]),
            U.el('button', {
              class: 'btn btn--secondary',
              type: 'button',
              onclick: async () => {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(json);
                    UI.toast('Backup copied to the clipboard.');
                    return;
                  }
                  throw new Error('no clipboard');
                } catch (e) {
                  UI.toast('Copying is blocked here — use “Download file”.');
                }
              },
            }, [U.icon('copy', 16), U.el('span', { text: 'Copy' })]),
            U.el('button', {
              class: 'btn btn--secondary',
              type: 'button',
              onclick: () => {
                const w = window.open('', '_blank');
                if (!w) {
                  UI.toast('Your browser blocked the new window.');
                  return;
                }
                w.document.write('<title>Study Planner backup</title><pre style="white-space:pre-wrap;font:12px ui-monospace,monospace;padding:16px">' + U.escapeHtml(json) + '</pre>');
              },
            }, [U.icon('eye', 16), U.el('span', { text: 'View' })]),
          ]),
          U.el('div', { class: 'field__hint', style: { marginTop: '14px' }, text: 'Size: ' + Math.max(1, Math.round(json.length / 1024)) + ' KB' }),
        ],
      });
    }

    function importSheet() {
      const input = U.el('input', { type: 'file', accept: '.json,application/json', class: 'sr-only' });
      let pending = null;
      const preview = U.el('div', { class: 'stack-2', style: { marginBottom: '14px' } });
      const modeWrap = U.el('div', { class: 'field hidden' });
      let mode = 'merge';

      const modeRow = U.el('div', { class: 'opt-grid opt-grid--2' }, [
        U.el('button', { class: 'opt', type: 'button', 'aria-pressed': 'true', text: 'Merge with mine', onclick: (e) => { mode = 'merge'; U.$$('.opt', modeRow).forEach((n) => n.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }),
        U.el('button', { class: 'opt', type: 'button', 'aria-pressed': 'false', text: 'Replace everything', onclick: (e) => { mode = 'replace'; U.$$('.opt', modeRow).forEach((n) => n.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }),
      ]);
      modeWrap.appendChild(U.el('div', { class: 'field__label', text: 'How should it be imported?' }));
      modeWrap.appendChild(modeRow);

      const s = UI.sheet({
        title: 'Import a backup',
        body: [
          U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55', marginBottom: '14px' }, text: 'Pick a Study Planner backup file (.json). Merging keeps both sets and skips duplicates.' }),
          U.el('button', { class: 'btn btn--secondary btn--block', type: 'button', onclick: () => input.click() }, [U.icon('upload', 16), U.el('span', { text: 'Choose file' })]),
          input,
          preview,
          modeWrap,
        ],
        footer: [
          U.el('button', {
            class: 'btn btn--primary grow',
            type: 'button',
            text: 'Import',
            onclick: () => {
              if (!pending) {
                UI.toast('Choose a backup file first.');
                return;
              }
              if (mode === 'replace') {
                UI.confirm({
                  title: 'Replace all current data?',
                  message: 'Everything on this device will be replaced by the backup.',
                  detail: 'A safety copy of your current data is kept on the device.',
                  confirmLabel: 'Replace',
                  danger: true,
                }).then((ok) => {
                  if (!ok) return;
                  finish('replace');
                });
                return;
              }
              finish('merge');
            },
          }),
        ],
      });

      function finish(m) {
        const res = Store.importData(pending, m);
        if (!res.ok) {
          UI.toast(res.error || 'That backup could not be imported.');
          return;
        }
        s.close();
        UI.toast('Imported ' + res.added + ' item' + (res.added === 1 ? '' : 's') + (res.skipped ? ' · ' + res.skipped + ' skipped' : '') + '.');
        if (global.Notify) global.Notify.reschedule();
        global.Router.handle(true);
      }

      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        if (f.size > 12 * 1024 * 1024) {
          UI.toast('That file is too large to be a planner backup.');
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => UI.toast('That file could not be read.');
        reader.onload = () => {
          pending = String(reader.result || '');
          let doc = null;
          try {
            doc = JSON.parse(pending);
          } catch (e) {
            pending = null;
            U.clear(preview);
            preview.appendChild(U.el('div', { class: 'field__error' }, [U.icon('alert', 14), U.el('span', { text: 'That file is not valid JSON, so it could not be read.' })]));
            return;
          }
          if (!doc || !doc.collections) {
            pending = null;
            U.clear(preview);
            preview.appendChild(U.el('div', { class: 'field__error' }, [U.icon('alert', 14), U.el('span', { text: 'That file is not a Study Planner backup.' })]));
            return;
          }
          const counts = Object.keys(doc.collections).reduce((acc, k) => acc + (Array.isArray(doc.collections[k]) ? doc.collections[k].length : 0), 0);
          U.clear(preview);
          preview.appendChild(
            U.el('div', { class: 'card card--pad' }, [
              U.el('div', { class: 'row', style: { gap: '10px' } }, [
                U.el('span', { class: 'list__icon', style: { background: 'var(--success-soft)', color: 'var(--success)' } }, [U.icon('file', 16)]),
                U.el('div', { class: 'grow col' }, [
                  U.el('div', { style: { fontWeight: '500' }, text: f.name }),
                  U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: counts + ' items · exported ' + (doc.exportedAt ? U.fmtDateStamp(new Date(doc.exportedAt).getTime()) : 'unknown date') }),
                ]),
              ]),
            ])
          );
          modeWrap.classList.remove('hidden');
        };
        reader.readAsText(f);
      });
    }

    function resetSheet() {
      const keepProfile = U.el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Keep profile' });
      const keepSettings = U.el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Keep settings' });
      let keepP = true;
      let keepS = true;
      keepProfile.addEventListener('click', () => {
        keepP = keepProfile.getAttribute('aria-checked') !== 'true';
        keepProfile.setAttribute('aria-checked', String(keepP));
      });
      keepSettings.addEventListener('click', () => {
        keepS = keepSettings.getAttribute('aria-checked') !== 'true';
        keepSettings.setAttribute('aria-checked', String(keepS));
      });
      const s = UI.sheet({
        title: 'Reset everything',
        subtitle: 'This clears all planner items',
        body: [
          U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55', marginBottom: '14px' }, text: 'Homework, tasks, projects, exams, events, subjects, timetable and notes will be deleted from this device. A safety copy is kept automatically.' }),
          U.el('div', { class: 'list list--plain' }, [
            U.el('div', { class: 'list__row' }, [U.el('span', { class: 'list__label grow', text: 'Keep my name and school' }), keepProfile]),
            U.el('div', { class: 'list__row' }, [U.el('span', { class: 'list__label grow', text: 'Keep my settings' }), keepSettings]),
          ]),
        ],
        footer: [
          U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
          U.el('button', {
            class: 'btn btn--danger grow',
            type: 'button',
            text: 'Reset',
            onclick: async () => {
              const ok = await UI.confirm({
                title: 'Really reset everything?',
                message: 'This cannot be undone from inside the app.',
                detail: 'Export a backup first if you are unsure.',
                confirmLabel: 'Reset now',
                danger: true,
              });
              if (!ok) return;
              Store.reset({ keepProfile: keepP, keepSettings: keepS });
              s.close();
              UI.toast('Everything has been reset.');
              global.Router.go('/home');
              global.Router.handle(true);
            },
          }),
        ],
      });
    }

    function downloadText(filename, text) {
      try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = U.el('a', { href: url, download: filename, style: { display: 'none' } });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 1000);
        return true;
      } catch (e) {
        UI.toast('Downloading is not available here — use Copy instead.');
        return false;
      }
    }

    paint();
    return { node: root, title: 'Settings', back: true };
  }

  /* ============================== ABOUT ================================= */
  function about() {
    const root = U.el('div', { class: 'screen' });
    root.appendChild(
      U.el('div', { style: { textAlign: 'center', padding: '28px 0 22px' } }, [
        U.el('div', {
          style: {
            width: '72px',
            height: '72px',
            borderRadius: 'var(--r-xl)',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px',
          },
        }, [U.icon('cap', 34)]),
        U.el('div', { style: { fontSize: 'var(--fs-title)', fontWeight: '600' }, text: 'Study Planner' }),
        U.el('div', { class: 'text-secondary', style: { marginTop: '4px' }, text: 'Version 1.0.0' }),
      ])
    );

    const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
    list.appendChild(
      U.el('div', { class: 'list__row', style: { cursor: 'default' } }, [
        U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('wifiOff', 17)]),
        U.el('div', { class: 'grow col' }, [
          U.el('span', { class: 'list__label', text: 'Works fully offline' }),
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Nothing leaves your device. No account, no tracking.' }),
        ]),
      ])
    );
    list.appendChild(
      U.el('div', { class: 'list__row', style: { cursor: 'default' } }, [
        U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('lock', 17)]),
        U.el('div', { class: 'grow col' }, [
          U.el('span', { class: 'list__label', text: 'Your data stays local' }),
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Stored in this app on this device. Export a backup any time.' }),
        ]),
      ])
    );
    list.appendChild(
      U.el('div', { class: 'list__row', style: { cursor: 'default' } }, [
        U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('sparkles', 17)]),
        U.el('div', { class: 'grow col' }, [
          U.el('span', { class: 'list__label', text: 'Assistant included' }),
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Ask questions about your planner and add items by typing.' }),
        ]),
      ])
    );
    root.appendChild(list);

    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        U.el('div', { class: 'field__label', text: 'What you can do' }),
        U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)', lineHeight: '1.7' }, text:
          '• Track homework, tasks, projects, exams and events in one place\n' +
          '• See deadlines grouped by urgency, with overdue detection\n' +
          '• Break projects into subtasks and watch progress update\n' +
          '• Generate study plans from an exam or project\n' +
          '• Keep subjects, a weekly timetable, notes and attachments\n' +
          '• Get reminders, export backups and read real statistics' }),
      ])
    );

    root.appendChild(
      U.el('div', { class: 'row', style: { gap: '8px' } }, [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Settings', onclick: () => global.Router.go('/settings') }),
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Load sample data', onclick: () => loadSample() }),
      ])
    );

    root.appendChild(U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', textAlign: 'center', marginTop: '22px' }, text: 'Made for students who want one place for everything.' }));

    return { node: root, title: 'About', back: true };
  }

  global.Screens = global.Screens || {};
  global.Screens.more = more;
  global.Screens.subjects = subjects;
  global.Screens.subjectDetail = subjectDetail;
  global.Screens.timetable = timetable;
  global.Screens.statistics = statistics;
  global.Screens.search = search;
  global.Screens.settings = settings;
  global.Screens.about = about;
  global.Screens._loadSample = loadSample;
})(window);
