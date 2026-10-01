/* ==========================================================================
   screens/home.js — Home dashboard + Today (daily planner)
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  const ALL_WORK = ['homework', 'tasks', 'projects', 'exams', 'events'];

  /* ------------------------------- HOME --------------------------------- */
  function home() {
    const node = U.el('div', { class: 'screen' });
    const profile = Store.profile();
    const today = U.todayISO();
    const stats = Store.stats();
    const todayItems = Store.itemsOnDay(today);

    /* Hero ---------------------------------------------------------------- */
    const hero = U.el('div', { class: 'hero' });
    hero.appendChild(U.el('div', { class: 'hero__greet', text: U.greeting(profile.name || 'there') }));
    hero.appendChild(
      U.el('div', { class: 'row row--between', style: { marginTop: '6px', alignItems: 'flex-start' } }, [
        U.el('div', { class: 'col grow', style: { minWidth: 0 } }, [
          U.el('div', { class: 'hero__date', text: U.fmtDateLong(today) }),
          U.el('div', { class: 'row', style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap' } }, [
            profile.grade ? U.el('span', { class: 'badge badge--neutral' }, [U.icon('cap', 12), U.el('span', { text: profile.grade })]) : null,
            stats.streak.count ? U.el('span', { class: 'streak' }, [U.icon('zap', 13), U.el('span', { text: stats.streak.count + ' day streak' })]) : null,
            stats.overdue ? U.el('span', { class: 'badge badge--overdue' }, [U.icon('alert', 12), U.el('span', { text: stats.overdue + ' overdue' })]) : null,
          ]),
        ]),
        dayRing(stats.todayProgress),
      ])
    );
    node.appendChild(hero);

    /* Quick actions -------------------------------------------------------- */
    const quick = U.el('div', { class: 'quick-grid' });
    [
      { label: 'Homework', icon: 'book', chip: 't-homework', collection: 'homework' },
      { label: 'Project', icon: 'folder', chip: 't-project', collection: 'projects' },
      { label: 'Exam', icon: 'clipboard', chip: 't-exam', collection: 'exams' },
      { label: 'Event', icon: 'calendar', chip: 't-event', collection: 'events' },
      { label: 'Task', icon: 'checkCircle', chip: 't-task', collection: 'tasks' },
    ].forEach((q) => {
      quick.appendChild(
        U.el('button', {
          class: 'quick',
          type: 'button',
          'aria-label': 'Add ' + q.label,
          onclick: () => P.createItem(q.collection, {}, { title: 'New ' + q.label.toLowerCase() }),
        }, [
          U.el('span', { class: 'quick__icon ' + q.chip }, [U.icon(q.icon, 17)]),
          U.el('span', { class: 'quick__label', text: q.label }),
        ])
      );
    });
    node.appendChild(U.el('div', { class: 'section' }, [quick]));

    /* Today ---------------------------------------------------------------- */
    const todaySection = U.el('div', { class: 'section' });
    const todayOpen = todayItems.filter((x) => !M.isCompleted(x.collection, x.record));
    todaySection.appendChild(
      UI.sectionHead('Today', {
        count: todayOpen.length,
        action: todayOpen.length ? { label: 'See all', onClick: () => global.Router.go('/today') } : null,
      })
    );

    const classes = P.todayClasses();
    if (classes.length) {
      const classList = U.el('div', { class: 'list', style: { marginBottom: '12px' } });
      const nowMins = U.minutesOf(U.nowHM());
      classes.slice(0, 3).forEach((c, i) => {
        const subject = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
        const isNow = nowMins >= U.minutesOf(c.startTime) && nowMins < U.minutesOf(c.endTime || c.startTime);
        classList.appendChild(
          U.el('div', { class: 'list__row', style: i ? null : { borderTop: '0' } }, [
            U.el('span', { class: 'list__icon', style: { background: subject ? hexA(subject.color, 0.14) : 'var(--bg-sunken)', color: subject ? subject.color : 'var(--text-tertiary)' } }, [
              U.icon(subject ? subject.icon : 'coffee', 17),
            ]),
            U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
              U.el('span', { class: 'list__label truncate', text: subject ? subject.name : c.label || 'Class' }),
              U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtTime(c.startTime) + ' – ' + U.fmtTime(c.endTime || c.startTime) + (c.room ? ' · ' + c.room : '') }),
            ]),
            isNow ? U.el('span', { class: 'badge badge--today', text: 'Now' }) : null,
          ])
        );
      });
      if (classes.length > 3) {
        classList.appendChild(
          U.el('button', { class: 'list__row', type: 'button', onclick: () => global.Router.go('/timetable') }, [
            U.el('span', { class: 'list__label grow text-secondary', text: (classes.length - 3) + ' more class' + (classes.length - 3 === 1 ? '' : 'es') + ' today' }),
            U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]),
          ])
        );
      }
      todaySection.appendChild(classList);
    }

    if (!todayItems.length) {
      todaySection.appendChild(
        UI.emptyState({
          icon: 'sun',
          title: 'Nothing due today',
          body: 'A clear day. Add something or get ahead on this week’s work.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', {}) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'See the week', onclick: () => global.Router.go('/calendar') }),
          ],
        })
      );
    } else {
      todaySection.appendChild(itemList(todayItems, { sortByTime: true, max: 6 }));
    }
    node.appendChild(todaySection);

    /* Upcoming ------------------------------------------------------------- */
    const upcoming = upcomingGroups(7);
    const upcomingSection = U.el('div', { class: 'section' });
    upcomingSection.appendChild(
      UI.sectionHead('Upcoming', {
        count: upcoming.total,
        action: upcoming.total ? { label: 'Calendar', onClick: () => global.Router.go('/calendar') } : null,
      })
    );
    if (!upcoming.groups.length) {
      upcomingSection.appendChild(
        UI.emptyState({
          icon: 'calendar',
          title: 'Nothing coming up',
          body: 'The next seven days are clear. Add an exam or project to plan ahead.',
          actions: [U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add an exam', onclick: () => P.createItem('exams', {}) })],
        })
      );
    } else {
      upcoming.groups.forEach((g) => {
        upcomingSection.appendChild(
          U.el('div', { class: 'row row--between', style: { margin: '14px 0 6px' } }, [
            U.el('span', { class: 'section__title', style: { fontSize: 'var(--fs-footnote)' }, text: g.label }),
            U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: g.items.length + '' }),
          ])
        );
        upcomingSection.appendChild(itemList(g.items, { max: 3 }));
      });
    }
    node.appendChild(upcomingSection);

    /* Progress ------------------------------------------------------------- */
    const progressSection = U.el('div', { class: 'section' });
    progressSection.appendChild(
      UI.sectionHead('Progress', { action: { label: 'Statistics', onClick: () => global.Router.go('/statistics') } })
    );
    progressSection.appendChild(
      U.el('div', { class: 'card card--pad' }, [
        U.el('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } }, [
          UI.ring(stats.todayProgress.pct, 58),
          U.el('div', { class: 'grow col' }, [
            U.el('div', { style: { fontWeight: '600' }, text: stats.todayProgress.total ? stats.todayProgress.done + ' of ' + stats.todayProgress.total + ' done today' : 'Nothing scheduled today' }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)', marginTop: '2px' }, text: stats.activeTotal + ' open · ' + stats.dueToday + ' due today · ' + stats.overdue + ' overdue' }),
          ]),
        ]),
        U.el('div', { class: 'stat-grid', style: { marginTop: '16px' } }, [
          UI.statTile(stats.completedThisWeek, 'Completed this week', { hint: 'Week of ' + U.fmtDateShort(U.toISO(U.startOfWeek(new Date(), Store.getSetting('weekStart', 1)))) }),
          UI.statTile(stats.rate + '%', 'Overall completion', { hint: stats.done + ' of ' + stats.total + ' items' }),
        ]),
        U.el('div', { style: { marginTop: '16px' } }, [
          U.el('div', { class: 'field__label', style: { marginBottom: '6px' }, text: 'This week' }),
          UI.barChart(stats.weekDays, { ariaLabel: 'Items completed each day this week' }),
        ]),
      ])
    );
    node.appendChild(progressSection);

    /* Deadlines teaser ----------------------------------------------------- */
    const overdue = Store.query('homework', { status: 'overdue' }).length + Store.query('tasks', { status: 'overdue' }).length + Store.query('projects', { status: 'overdue' }).length;
    if (overdue) {
      node.appendChild(
        U.el('div', { class: 'section' }, [
          U.el('button', {
            class: 'card card--tap card--pad',
            type: 'button',
            style: { width: '100%', textAlign: 'left', display: 'block' },
            onclick: () => global.Router.go('/deadlines'),
          }, [
            U.el('div', { class: 'row', style: { gap: '12px' } }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--danger-soft)', color: 'var(--danger)' } }, [U.icon('alert', 18)]),
              U.el('div', { class: 'grow col' }, [
                U.el('div', { style: { fontWeight: '600' }, text: overdue + ' item' + (overdue === 1 ? '' : 's') + ' overdue' }),
                U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: 'Tap to review and reschedule in one place.' }),
              ]),
              U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]),
            ]),
          ]),
        ])
      );
    }

    return {
      node,
      title: 'Home',
      subtitle: '',
      back: false,
      actions: [
        { icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') },
        { icon: 'sparkles', label: 'Assistant', onClick: () => global.Router.go('/assistant') },
      ],
    };
  }

  function dayRing(tp) {
    return UI.progressRing(tp.pct, 68, U.el('div', { class: 'day-ring__inner' }, [
      U.el('div', { class: 'day-ring__pct', text: tp.pct + '%' }),
      U.el('div', { class: 'text-tertiary', style: { fontSize: '10px' }, text: 'today' }),
    ]));
  }

  function hexA(hex, alpha) {
    const h = String(hex || '#888888').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  /** A simple list of {collection, record} pairs with swipe + completion. */
  function itemList(items, opts) {
    const o = opts || {};
    const list = U.el('div', { class: 'list' });
    const subjectMap = P.subjectMap();
    const rowCap = o.max || 12;
    items.slice(0, rowCap).forEach((it, i) => {
      const row = UI.swipeRow({
        content: UI.itemRow(it.collection, it.record, {
          subjectMap,
          bordered: i > 0,
          onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id),
        }),
        onComplete: () => UI.toggleComplete(it.collection, it.record.id),
        onDelete: () => P.deleteItem(it.collection, it.record.id),
        onReschedule: M.DATE_FIELD[it.collection] ? () => P.snoozeTomorrow(it.collection, it.record.id) : null,
      });
      list.appendChild(row);
    });
    if (items.length > rowCap) {
      list.appendChild(
        U.el('button', {
          class: 'list__row',
          type: 'button',
          onclick: () => {
            const first = items[0];
            global.Router.go('/' + (first.collection === 'events' ? 'events' : 'deadlines'));
          },
        }, [
          U.el('span', { class: 'list__label grow text-secondary', text: (items.length - rowCap) + ' more — see everything' }),
          U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]),
        ])
      );
    }
    return list;
  }

  /** Items in the next `days` days, grouped by relative day (single pass). */
  function upcomingGroups(days) {
    const from = U.toISO(U.addDays(new Date(), 1));
    const to = U.toISO(U.addDays(new Date(), days));
    const map = Store.countsByDate(from, to, (col, rec) => !M.isCompleted(col, rec));
    const groups = [];
    let total = 0;
    Object.keys(map)
      .sort()
      .forEach((iso) => {
        const items = map[iso].slice().sort((a, b) => {
          const ta = M.whenOf(a.collection, a.record);
          const tb = M.whenOf(b.collection, b.record);
          return (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
        });
        total += items.length;
        const idx = U.diffDays(from, iso) + 1;
        groups.push({
          label: idx === 1 ? 'Tomorrow' : U.DOW_LONG[U.parseISO(iso).getDay()] + ' · ' + U.fmtDateShort(iso),
          date: iso,
          items,
        });
      });
    return { groups, total };
  }

  /* ------------------------------- TODAY -------------------------------- */
  function today() {
    const node = U.el('div', { class: 'screen' });
    const iso = U.todayISO();
    const classes = P.todayClasses();
    const items = Store.itemsOnDay(iso).filter((x) => !M.isCompleted(x.collection, x.record));

    // Chronological merge: classes and tasks interleaved by start time.
    const entries = [];
    classes.forEach((c) => {
      const subject = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
      entries.push({
        kind: 'class',
        at: U.minutesOf(c.startTime) || 0,
        time: c.startTime,
        endTime: c.endTime,
        title: subject ? subject.name : c.label || 'Class',
        meta: [c.room, subject && subject.teacher].filter(Boolean).join(' · '),
        color: subject ? subject.color : 'var(--text-tertiary)',
        icon: subject ? subject.icon : 'coffee',
        record: c,
      });
    });
    items.forEach((it) => {
      const tf = M.TIME_FIELD[it.collection];
      const t = tf && it.record[tf] ? it.record[tf] : null;
      const subject = it.record.subjectId ? Store.byId('subjects', it.record.subjectId) : null;
      entries.push({
        kind: it.collection,
        at: t ? U.minutesOf(t) : 23 * 60 + 59,
        time: t,
        title: it.record.title || it.record.name,
        meta: [subject ? subject.name : null, M.typeMeta(it.collection).label, it.record.estMinutes ? U.fmtDuration(it.record.estMinutes) : null].filter(Boolean).join(' · '),
        collection: it.collection,
        record: it.record,
        overdue: M.isOverdue(it.collection, it.record),
      });
    });
    entries.sort((a, b) => a.at - b.at);

    const done = Store.itemsOnDay(iso).filter((x) => M.isCompleted(x.collection, x.record));
    const total = entries.filter((e) => e.kind !== 'class').length + done.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;

    node.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '16px' } }, [
        U.el('div', { class: 'row', style: { gap: '16px' } }, [
          UI.ring(pct, 54),
          U.el('div', { class: 'grow col' }, [
            U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: U.fmtDateMedium(iso) }),
            U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: done.length + ' done · ' + (total - done.length) + ' left' + (classes.length ? ' · ' + classes.length + ' classes' : '') }),
          ]),
        ]),
      ])
    );

    if (!entries.length) {
      node.appendChild(
        UI.emptyState({
          icon: 'sun',
          title: 'Nothing scheduled',
          body: 'Add classes to your timetable, or plan something for today.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add a task', onclick: () => P.createItem('tasks', { dueDate: iso }) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Set up timetable', onclick: () => global.Router.go('/timetable') }),
          ],
        })
      );
    } else {
      const nowMins = U.minutesOf(U.nowHM());
      let nowMarkerPlaced = false;
      const timeline = U.el('div', { class: 'timeline' });
      entries.forEach((e) => {
        if (!nowMarkerPlaced && e.at > nowMins) {
          timeline.appendChild(nowMarker(e.at));
          nowMarkerPlaced = true;
        }
        timeline.appendChild(entryRow(e));
      });
      node.appendChild(timeline);

      if (done.length) {
        node.appendChild(
          U.el('div', { class: 'section', style: { marginTop: '24px' } }, [
            UI.sectionHead('Completed today', { count: done.length }),
            itemList(done, {}),
          ])
        );
      }
    }

    // "Later today" quick add
    node.appendChild(
      U.el('div', { class: 'row', style: { gap: '8px', marginTop: '20px' } }, [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => P.createItem('tasks', { dueDate: iso, dueTime: U.nowHM() }) }, [U.icon('plus', 16), U.el('span', { text: 'Task now' })]),
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => P.createItem('homework', { dueDate: iso }) }, [U.icon('plus', 16), U.el('span', { text: 'Homework' })]),
      ])
    );

    return {
      node,
      title: 'Today',
      subtitle: U.fmtDateLong(iso),
      actions: [{ icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') }],
    };
  }

  function nowMarker(nextAt) {
    return U.el('div', { class: 'timeline__item' }, [
      U.el('div', { class: 'timeline__dot timeline__dot--now' }),
      U.el('div', { class: 'timeline__time', style: { color: 'var(--danger)' }, text: 'Now' }),
    ]);
  }

  function entryRow(e) {
    const item = U.el('div', { class: 'timeline__item' });
    item.appendChild(U.el('div', { class: 'timeline__dot', style: e.color ? { borderColor: e.color } : null }));
    item.appendChild(U.el('div', { class: 'timeline__time', text: e.time ? U.fmtTime(e.time) + (e.endTime ? ' – ' + U.fmtTime(e.endTime) : '') : 'Any time' }));
    const card = U.el('div', { class: 'card card--pad card--tap', style: { padding: '12px 14px' } }, [
      U.el('div', { class: 'row', style: { gap: '10px' } }, [
        U.el('span', { class: 'list__icon', style: { width: '30px', height: '30px', background: e.color ? hexA(e.color, 0.14) : 'var(--bg-sunken)', color: e.color || 'var(--text-tertiary)' } }, [
          U.icon(e.icon || (e.kind !== 'class' ? M.typeMeta(e.kind).icon : 'book'), 16),
        ]),
        U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
          U.el('div', { style: { fontWeight: '500' }, text: e.title }),
          e.meta ? U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)', marginTop: '2px' }, text: e.meta }) : null,
        ]),
        e.kind !== 'class'
          ? U.el('button', {
              class: 'item__check' + (M.isCompleted(e.collection, e.record) ? ' is-done' : ''),
              type: 'button',
              'aria-label': 'Mark complete',
              onclick: (ev) => {
                ev.stopPropagation();
                UI.toggleComplete(e.collection, e.record.id);
                global.Router.handle(true);
              },
            }, [U.icon('check', 14)])
          : U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 15)]),
      ]),
    ]);
    card.addEventListener('click', () => {
      if (e.kind === 'class') global.Router.go('/timetable');
      else global.Router.go('/' + e.collection + '/' + e.record.id);
    });
    item.appendChild(card);
    return item;
  }

  global.Screens = global.Screens || {};
  global.Screens.home = home;
  global.Screens.today = today;
  global.Screens._itemList = itemList;
  global.Screens._hexA = hexA;
})(window);
