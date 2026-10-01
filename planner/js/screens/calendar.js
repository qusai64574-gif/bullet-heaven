/* ==========================================================================
   screens/calendar.js — month / week / day views with real data, type
   indicators, tap-to-open details and create-from-date.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  const TYPES = [
    { key: 'homework', label: 'Homework', icon: 'book', color: 'var(--type-homework)' },
    { key: 'projects', label: 'Projects', icon: 'folder', color: 'var(--type-project)' },
    { key: 'exams', label: 'Exams', icon: 'clipboard', color: 'var(--type-exam)' },
    { key: 'events', label: 'Events', icon: 'calendar', color: 'var(--type-event)' },
    { key: 'tasks', label: 'Tasks', icon: 'checkCircle', color: 'var(--type-task)' },
  ];

  const ALL_TYPES = TYPES.map((t) => t.key);

  function calendar(params, query) {
    const state = {
      view: query && query.view ? query.view : Store.getSetting('calendarDefaultView', 'month'),
      anchor: U.todayISO(),
      selected: U.todayISO(),
      types: ALL_TYPES.slice(),
      hideCompleted: query && query.completed === 'hide',
    };
    if (query && query.date && U.isValidISO(query.date)) {
      state.anchor = query.date;
      state.selected = query.date;
    }

    const root = U.el('div', { class: 'screen' });
    const viewWrap = U.el('div');
    root.appendChild(viewWrap);

    function typeFilter(col, rec) {
      if (state.types.indexOf(col) < 0) return false;
      if (state.hideCompleted && M.isCompleted(col, rec)) return false;
      return true;
    }

    function countsFor(from, to) {
      return Store.countsByDate(from, to, typeFilter);
    }

    /* ------------------------------ Header ------------------------------ */
    function toolbar() {
      const label =
        state.view === 'month'
          ? U.fmtMonthYear(U.parseISO(state.anchor))
          : state.view === 'week'
          ? weekLabel(state.anchor)
          : U.fmtDateLong(state.anchor);

      const wrap = U.el('div', { class: 'col', style: { gap: '12px', marginBottom: '14px' } });
      wrap.appendChild(
        U.el('div', { class: 'row row--between' }, [
          U.el('div', { class: 'row', style: { gap: '2px' } }, [
            U.el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous', onclick: () => shift(-1) }, [U.icon('chevronLeft', 20)]),
            U.el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next', onclick: () => shift(1) }, [U.icon('chevronRight', 20)]),
          ]),
          U.el('div', { class: 'grow', style: { textAlign: 'center', fontWeight: '600', fontSize: 'var(--fs-callout)' }, text: label }),
          U.el('button', {
            class: 'chip',
            type: 'button',
            text: 'Today',
            onclick: () => {
              state.anchor = U.todayISO();
              state.selected = U.todayISO();
              paint();
            },
          }),
        ])
      );

      wrap.appendChild(
        UI.segmented(
          [
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ],
          state.view,
          (v) => {
            state.view = v;
            Store.setSetting('calendarDefaultView', v);
            paint();
          }
        )
      );

      wrap.appendChild(
        UI.chipRow(
          TYPES.map((t) => ({
            label: t.label,
            icon: t.icon,
            active: state.types.indexOf(t.key) >= 0,
            onClick: (it) => {
              const on = state.types.indexOf(t.key) >= 0;
              state.types = on ? state.types.filter((k) => k !== t.key) : state.types.concat([t.key]);
              paint();
            },
          })).concat([
            {
              label: 'Hide done',
              icon: 'eye',
              active: state.hideCompleted,
              onClick: () => {
                state.hideCompleted = !state.hideCompleted;
                paint();
              },
            },
          ]),
          { padless: true }
        )
      );
      return wrap;
    }

    function shift(dir) {
      const d = U.parseISO(state.anchor);
      if (state.view === 'month') state.anchor = U.toISO(U.addMonths(d, dir));
      else if (state.view === 'week') state.anchor = U.toISO(U.addDays(d, dir * 7));
      else state.anchor = U.toISO(U.addDays(d, dir));
      paint();
    }

    function weekLabel(iso) {
      const ws = Store.getSetting('weekStart', 1);
      const start = U.startOfWeek(U.parseISO(iso), ws);
      const end = U.addDays(start, 6);
      return U.fmtDateShort(U.toISO(start)) + ' – ' + U.fmtDateShort(U.toISO(end));
    }

    /* ------------------------------- Month ------------------------------ */
    function monthView() {
      const ws = Store.getSetting('weekStart', 1);
      const d = U.parseISO(state.anchor);
      const matrix = U.monthMatrix(d.getFullYear(), d.getMonth(), ws);
      const first = U.toISO(matrix[0][0]);
      const last = U.toISO(matrix[5][6]);
      const counts = countsFor(first, last);

      const wrap = U.el('div', { class: 'cal' });
      const dow = U.el('div', { class: 'cal__dow' });
      for (let i = 0; i < 7; i++) {
        dow.appendChild(U.el('span', { text: U.DOW_SHORT[(ws + i) % 7] }));
      }
      wrap.appendChild(dow);

      const grid = U.el('div', { class: 'cal__grid' });
      const today = U.todayISO();
      matrix.forEach((row) => {
        row.forEach((date) => {
          const iso = U.toISO(date);
          const inMonth = date.getMonth() === d.getMonth();
          const items = counts[iso] || [];
          const cell = U.el('button', {
            class:
              'cal__cell' +
              (inMonth ? '' : ' cal__cell--muted') +
              (iso === today ? ' cal__cell--today' : '') +
              (iso === state.selected ? ' cal__cell--selected' : ''),
            type: 'button',
            'aria-label': U.fmtDateLong(iso) + ', ' + items.length + ' item' + (items.length === 1 ? '' : 's'),
            onclick: () => {
              state.selected = iso;
              if (!inMonth) state.anchor = iso;
              paint();
              // Bring the tapped day's list into view — on a phone the grid
              // fills the screen, so the details would otherwise be off-screen.
              requestAnimationFrame(() => {
                const head = viewWrap.querySelector('.cal + div, .screen > div:nth-child(2)');
                if (head && head.scrollIntoView) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
                else window.scrollTo({ top: window.scrollY + 260, behavior: 'smooth' });
              });
            },
          });
          cell.appendChild(U.el('span', { class: 'cal__num', text: String(date.getDate()) }));
          if (items.length) {
            const dots = U.el('div', { class: 'cal__dots' });
            const kinds = [];
            items.forEach((it) => {
              if (kinds.indexOf(it.collection) < 0) kinds.push(it.collection);
            });
            kinds.slice(0, 3).forEach((k) => {
              const t = TYPES.find((x) => x.key === k);
              dots.appendChild(U.el('span', { class: 'cal__dot', style: { background: t.color }, title: t.label }));
            });
            if (items.length > 3) dots.appendChild(U.el('span', { class: 'cal__more', text: items.length + '' }));
            cell.appendChild(dots);
          }
          grid.appendChild(cell);
        });
      });
      wrap.appendChild(grid);
      // The selected day's items sit directly under the grid so tapping a date
      // immediately shows what is on it (and offers quick-add).
      wrap.appendChild(dayBody(state.selected, { full: true }));
      return wrap;
    }

    /* -------------------------------- Week ------------------------------- */
    function weekView() {
      const ws = Store.getSetting('weekStart', 1);
      const start = U.startOfWeek(U.parseISO(state.anchor), ws);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(U.addDays(start, i));
      const counts = countsFor(U.toISO(days[0]), U.toISO(days[6]));

      const wrap = U.el('div');
      const strip = U.el('div', { class: 'week-grid' });
      days.forEach((day) => {
        const iso = U.toISO(day);
        const items = counts[iso] || [];
        const kinds = [];
        items.forEach((it) => {
          if (kinds.indexOf(it.collection) < 0) kinds.push(it.collection);
        });
        const btn = U.el('button', {
          class: 'week-day',
          type: 'button',
          'aria-selected': String(iso === state.selected),
          onclick: () => {
            state.selected = iso;
            paint();
          },
        }, [
          U.el('span', { class: 'week-day__dow', text: U.DOW_SHORT[day.getDay()] }),
          U.el('span', { class: 'week-day__num', text: String(day.getDate()) }),
          U.el('span', { class: 'week-day__dots' }, kinds.slice(0, 3).map((k) => {
            const t = TYPES.find((x) => x.key === k);
            return U.el('i', { style: { background: t.color } });
          })),
        ]);
        if (iso === U.todayISO()) btn.style.boxShadow = 'inset 0 0 0 1.5px var(--accent)';
        strip.appendChild(btn);
      });
      wrap.appendChild(strip);
      wrap.appendChild(dayBody(state.selected, { compact: true }));
      return wrap;
    }

    /* --------------------------------- Day ------------------------------- */
    function dayView() {
      const wrap = U.el('div');
      const strip = U.el('div', { class: 'week-grid' });
      const ws = Store.getSetting('weekStart', 1);
      const start = U.startOfWeek(U.parseISO(state.anchor), ws);
      const counts = countsFor(U.toISO(start), U.toISO(U.addDays(start, 6)));
      for (let i = 0; i < 7; i++) {
        const day = U.addDays(start, i);
        const iso = U.toISO(day);
        const items = counts[iso] || [];
        strip.appendChild(
          U.el('button', {
            class: 'week-day',
            type: 'button',
            'aria-selected': String(iso === state.anchor),
            onclick: () => {
              state.anchor = iso;
              state.selected = iso;
              paint();
            },
          }, [
            U.el('span', { class: 'week-day__dow', text: U.DOW_SHORT[day.getDay()] }),
            U.el('span', { class: 'week-day__num', text: String(day.getDate()) }),
            U.el('span', { class: 'week-day__dots' }, items.length ? [U.el('i', { style: { background: 'var(--text-tertiary)' } })] : []),
          ])
        );
      }
      wrap.appendChild(strip);
      wrap.appendChild(dayBody(state.anchor, { full: true }));
      return wrap;
    }

    /** The list of everything on a date, with classes for that weekday. */
    function dayBody(iso, opts) {
      const o = opts || {};
      const wrap = U.el('div', { style: { marginTop: '10px' } });
      const items = Store.itemsOnDay(iso).filter((x) => typeFilter(x.collection, x.record));
    // Tapping a day should always show that day's list, whichever view is open.
    const alwaysFull = !!o.full || state.view === 'month';

      const classes = Store.list('timetable')
        .filter((c) => Number(c.day) === U.parseISO(iso).getDay())
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

      wrap.appendChild(
        U.el('div', { class: 'row row--between', style: { margin: '6px 0 10px' } }, [
          U.el('div', { class: 'section__title', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtDateRelative(iso) + ' · ' + items.length + ' item' + (items.length === 1 ? '' : 's') }),
          U.el('button', { class: 'section__action', type: 'button', onclick: () => P.quickAdd(iso) }, [U.icon('plus', 14), U.el('span', { text: 'Add' })]),
        ])
      );

      if (classes.length && alwaysFull) {
        const cl = U.el('div', { class: 'list', style: { marginBottom: '12px' } });
        classes.forEach((c, i) => {
          const subject = c.subjectId ? Store.byId('subjects', c.subjectId) : null;
          cl.appendChild(
            U.el('div', { class: 'list__row', style: i ? null : { borderTop: '0' } }, [
              U.el('span', { class: 'list__icon', style: { background: subject ? 'var(--bg-sunken)' : 'var(--bg-sunken)', color: subject ? subject.color : 'var(--text-tertiary)' } }, [
                U.icon(subject ? subject.icon : 'coffee', 16),
              ]),
              U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
                U.el('span', { class: 'list__label truncate', text: subject ? subject.name : c.label || 'Class' }),
                U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtTime(c.startTime) + ' – ' + U.fmtTime(c.endTime || c.startTime) + (c.room ? ' · ' + c.room : '') }),
              ]),
            ])
          );
        });
        wrap.appendChild(cl);
      }

      if (!items.length) {
        wrap.appendChild(
          UI.emptyState({
            icon: 'calendar',
            title: 'Nothing on this day',
            body: o.compact ? 'Select another day, or add something here.' : 'Add homework, an exam, an event or a task for this date.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', { dueDate: iso }) }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add exam', onclick: () => P.createItem('exams', { date: iso }) }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add event', onclick: () => P.createItem('events', { date: iso }) }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add task', onclick: () => P.createItem('tasks', { dueDate: iso }) }),
            ],
          })
        );
        return wrap;
      }

      const list = U.el('div', { class: 'list' });
      const subjectMap = P.subjectMap();
      items.forEach((it, i) => {
        list.appendChild(
          UI.swipeRow({
            content: UI.itemRow(it.collection, it.record, {
              subjectMap,
              bordered: i > 0,
              onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id),
            }),
            onComplete: () => UI.toggleComplete(it.collection, it.record.id),
            onDelete: () => P.deleteItem(it.collection, it.record.id),
            onReschedule: M.DATE_FIELD[it.collection] ? () => P.snoozeTomorrow(it.collection, it.record.id) : null,
          })
        );
      });
      wrap.appendChild(list);

      if (alwaysFull) {
        wrap.appendChild(
          U.el('div', { class: 'row', style: { gap: '8px', marginTop: '14px', flexWrap: 'wrap' } }, [
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: '+ Homework', onclick: () => P.createItem('homework', { dueDate: iso }) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: '+ Exam', onclick: () => P.createItem('exams', { date: iso }) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: '+ Event', onclick: () => P.createItem('events', { date: iso }) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: '+ Task', onclick: () => P.createItem('tasks', { dueDate: iso }) }),
          ])
        );
      }
      return wrap;
    }
    /* ------------------------------- Paint ------------------------------- */
    function paint() {
      U.clear(viewWrap);
      viewWrap.appendChild(toolbar());
      if (state.view === 'month') viewWrap.appendChild(monthView());
      else if (state.view === 'week') viewWrap.appendChild(weekView());
      else viewWrap.appendChild(dayView());
      syncUrl();
    }

    /** Keep the URL in step with the visible view (replaceState, no re-render). */
    function syncUrl() {
      const target = '#/calendar?view=' + state.view + '&date=' + state.anchor;
      if (location.hash === target) return;
      try {
        history.replaceState(null, '', target);
      } catch (e) {}
    }

    paint();

    // Reflect the view in the URL so back/forward and sharing work.
    return {
      node: root,
      title: 'Calendar',
      back: false,
      flush: false,
      actions: [
        { icon: 'plus', label: 'Add', onClick: () => P.quickAdd(state.selected) },
        { icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') },
      ],
      afterRender() {
        // Keep the view in the URL for back/forward, without re-rendering.
        // (The router owns the hash; replacing it mid-render would fight it.)
      },
    };
  }

  global.Screens = global.Screens || {};
  global.Screens.calendar = calendar;
  global.Screens._calendarTypes = TYPES;
})(window);
