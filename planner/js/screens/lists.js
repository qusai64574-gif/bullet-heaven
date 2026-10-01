/* ==========================================================================
   screens/lists.js — Tasks, Homework, Exams, Events, Notes, Deadlines,
   History. One list engine drives them all so filtering, sorting, grouping,
   swiping and empty states behave identically everywhere.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  /* ========================= Shared list engine ========================= */
  /**
   * renderList({ collection, items, groupMode, onEmpty, max, limit, onMore })
   * items: [{collection, record}]
   * Rows are rendered in pages (default 60) so the first paint stays fast even
   * with thousands of items — the rest arrive via a "Show more" button.
   */
  function renderList(items, opts) {
    const o = opts || {};
    const subjectMap = P.subjectMap();
    const wrap = U.el('div');
    const limit = o.limit || items.length;

    if (!items.length) {
      wrap.appendChild(o.empty || UI.emptyState({ icon: 'sparkles', title: 'Nothing here yet' }));
      return wrap;
    }

    let budget = limit;
    let shown = 0;
    function take(list) {
      const slice = list.slice(0, Math.max(0, budget));
      budget -= slice.length;
      shown += slice.length;
      return slice;
    }

    const rowFor = (it, i) =>
      UI.swipeRow({
        content: UI.itemRow(it.collection, it.record, {
          subjectMap,
          bordered: i > 0,
          onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id),
        }),
        onComplete: () => UI.toggleComplete(it.collection, it.record.id),
        onDelete: () => P.deleteItem(it.collection, it.record.id),
        onReschedule: M.DATE_FIELD[it.collection] ? () => P.snoozeTomorrow(it.collection, it.record.id) : null,
      });

    function moreButton() {
      const remaining = items.length - shown;
      if (remaining <= 0) return null;
      return U.el('button', {
        class: 'btn btn--secondary btn--block',
        type: 'button',
        style: { marginTop: '12px' },
        onclick: () => {
          if (o.onMore) o.onMore();
        },
      }, [
        U.icon('chevronDown', 16),
        U.el('span', { text: 'Show ' + Math.min(60, remaining) + ' more of ' + remaining }),
      ]);
    }

    if (o.groupMode === 'bucket') {
      const sections = UI.bucketSections(items, { order: o.bucketOrder || ['overdue', 'today', 'tomorrow', 'week', 'later', 'done'] });
      sections.forEach((sec) => {
        if (budget <= 0) return;
        const slice = take(sec.items);
        const head = UI.sectionHead(sec.label, { count: sec.items.length });
        if (sec.bucket === 'overdue') {
          head.appendChild(
            U.el('button', {
              class: 'section__action',
              type: 'button',
              text: 'Reschedule all',
              onclick: async () => {
                const ok = await UI.confirm({
                  title: 'Move all ' + sec.items.length + ' overdue items?',
                  message: 'They will be rescheduled to tomorrow.',
                  confirmLabel: 'Move all',
                });
                if (!ok) return;
                sec.items.forEach((it) => P.snoozeTomorrow(it.collection, it.record.id));
                UI.toast(sec.items.length + ' items moved to tomorrow.');
              },
            })
          );
        }
        wrap.appendChild(head);
        const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
        slice.forEach((it, i) => list.appendChild(rowFor(it, i)));
        wrap.appendChild(list);
      });
      const more = moreButton();
      if (more) wrap.appendChild(more);
      return wrap;
    }

    if (o.groupMode === 'date') {
      const groups = {};
      items.forEach((it) => {
        const d = M.deadlineOf(it.collection, it.record) || 'none';
        (groups[d] = groups[d] || []).push(it);
      });
      Object.keys(groups)
        .sort()
        .forEach((d) => {
          if (budget <= 0) return;
          const slice = take(groups[d]);
          const label = d === 'none' ? 'No date' : U.fmtDateRelative(d) + ' · ' + U.fmtDateShort(d);
          wrap.appendChild(UI.sectionHead(label, { count: groups[d].length }));
          const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
          slice.forEach((it, i) => list.appendChild(rowFor(it, i)));
          wrap.appendChild(list);
        });
      const more = moreButton();
      if (more) wrap.appendChild(more);
      return wrap;
    }

    const list = U.el('div', { class: 'list' });
    take(items).forEach((it, i) => list.appendChild(rowFor(it, i)));
    wrap.appendChild(list);
    const more = moreButton();
    if (more) wrap.appendChild(more);
    else if (items.length > limit) {
      wrap.appendChild(
        U.el('div', { class: 'text-tertiary', style: { textAlign: 'center', padding: '14px', fontSize: 'var(--fs-footnote)' }, text: 'Showing ' + shown + ' of ' + items.length + ' items.' })
      );
    }
    return wrap;
  }

  /* ============================ List screen ============================= */
  const QUICK_FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'week', label: 'This week' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'completed', label: 'Completed' },
    { value: 'all', label: 'All' },
  ];

  const SORT_OPTIONS = {
    homework: [
      { value: 'due', label: 'Due date' },
      { value: 'priority', label: 'Priority' },
      { value: 'subject', label: 'Subject' },
      { value: 'title', label: 'Title' },
      { value: 'created', label: 'Recently added' },
    ],
    tasks: [
      { value: 'due', label: 'Due date' },
      { value: 'priority', label: 'Priority' },
      { value: 'subject', label: 'Subject' },
      { value: 'category', label: 'Category' },
      { value: 'title', label: 'Title' },
    ],
    exams: [
      { value: 'due', label: 'Date' },
      { value: 'priority', label: 'Importance' },
      { value: 'subject', label: 'Subject' },
      { value: 'title', label: 'Name' },
    ],
    events: [
      { value: 'due', label: 'Date' },
      { value: 'subject', label: 'Category' },
      { value: 'title', label: 'Title' },
    ],
    notes: [
      { value: 'updated', label: 'Recently updated' },
      { value: 'title', label: 'Title' },
      { value: 'created', label: 'Recently added' },
    ],
  };

  function listScreen(config) {
    const cfg = config || {};
    const collection = cfg.collection;
    const state = {
      quick: cfg.quick || 'open',
      sort: cfg.sort || (SORT_OPTIONS[collection] ? SORT_OPTIONS[collection][0].value : 'due'),
      dir: cfg.dir || 'asc',
      subjectId: '',
      priority: '',
      category: '',
      search: '',
      groupMode: cfg.groupMode || 'bucket',
      scope: cfg.scope || null,
      limit: 60,
    };

    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);

    function filterFn(col, rec) {
      if (state.subjectId && rec.subjectId !== state.subjectId) return false;
      if (state.priority && rec.priority !== state.priority) return false;
      if (state.category && rec.category !== state.category) return false;
      if (cfg.filterFn && !cfg.filterFn(col, rec)) return false;
      return true;
    }

    function collect() {
      const today = U.todayISO();
      const ws = Store.getSetting('weekStart', 1);
      const opts = { sort: state.sort, dir: state.dir };
      if (state.subjectId) opts.subjectId = state.subjectId;
      if (state.priority) opts.priority = state.priority;
      if (state.category) opts.category = state.category;
      if (cfg.baseQuery) Object.assign(opts, cfg.baseQuery);

      switch (state.quick) {
        case 'open':
          opts.status = 'active';
          break;
        case 'completed':
          opts.status = 'completed';
          opts.sort = state.sort === 'due' ? 'completed' : state.sort;
          opts.dir = state.sort === 'due' ? 'desc' : state.dir;
          break;
        case 'overdue':
          opts.status = 'overdue';
          break;
        case 'today':
          opts.day = today;
          break;
        case 'tomorrow':
          opts.day = U.toISO(U.addDays(new Date(), 1));
          break;
        case 'week':
          opts.from = today;
          opts.to = U.toISO(U.endOfWeek(new Date(), ws));
          opts.status = 'active';
          break;
        case 'all':
        default:
          break;
      }
      let rows = Store.query(collection, opts);
      if (state.search) {
        const q = state.search.toLowerCase();
        rows = rows.filter((r) => M.searchableText(collection, r).indexOf(q) >= 0);
      }
      return rows.map((r) => ({ collection, record: r }));
    }

    function filterBar() {
      const wrap = U.el('div', { class: 'col', style: { gap: '10px', marginBottom: '14px' } });

      if (cfg.search !== false) {
        const input = U.el('input', {
          type: 'search',
          placeholder: cfg.searchPlaceholder || 'Filter ' + (cfg.noun || 'items').toLowerCase() + '…',
          value: state.search,
          'aria-label': 'Filter',
        });
        input.addEventListener(
          'input',
          U.debounce(() => {
            state.search = input.value.trim();
            paintBody();
          }, 180)
        );
        wrap.appendChild(
          U.el('div', { class: 'search-bar' }, [U.icon('search', 17), input])
        );
      }

      const quick = U.el('div', { class: 'chip-row chip-row--padless', style: { flexWrap: 'wrap', overflow: 'visible' } });
      (cfg.quickFilters || QUICK_FILTERS).forEach((f) => {
        quick.appendChild(
          U.el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(state.quick === f.value),
            text: f.label,
            onclick: () => {
              state.quick = f.value;
              paint();
            },
          })
        );
      });
      wrap.appendChild(quick);

      const activeCount = (state.subjectId ? 1 : 0) + (state.priority ? 1 : 0) + (state.category ? 1 : 0);
      const row = U.el('div', { class: 'row', style: { gap: '8px' } });
      row.appendChild(
        U.el('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(activeCount > 0),
          onclick: () => filterSheet(),
        }, [U.icon('filter', 13), U.el('span', { text: activeCount ? 'Filters (' + activeCount + ')' : 'Filters' })])
      );
      row.appendChild(
        U.el('button', {
          class: 'chip',
          type: 'button',
          onclick: () => sortSheet(),
        }, [U.icon('sliders', 13), U.el('span', { text: 'Sort: ' + (sortLabel()) })])
      );
      if (cfg.groupToggle) {
        row.appendChild(
          U.el('button', {
            class: 'chip',
            type: 'button',
            onclick: () => {
              state.groupMode = state.groupMode === 'bucket' ? 'none' : state.groupMode === 'none' ? 'date' : 'bucket';
              paint();
            },
          }, [U.icon('layers', 13), U.el('span', { text: state.groupMode === 'bucket' ? 'Grouped' : state.groupMode === 'date' ? 'By date' : 'Flat' })])
        );
      }
      wrap.appendChild(row);
      return wrap;
    }

    function sortLabel() {
      const opts = SORT_OPTIONS[collection] || [];
      const f = opts.find((o) => o.value === state.sort);
      return f ? f.label : state.sort;
    }

    function sortSheet() {
      const opts = SORT_OPTIONS[collection] || [];
      const s = UI.sheet({
        title: 'Sort by',
        body: [
          U.el('div', { class: 'list list--plain' }, opts.map((o) =>
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                state.sort = o.value;
                s.close();
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: state.sort === o.value ? 'var(--text-primary)' : 'var(--text-tertiary)' } }, [
                U.icon(state.sort === o.value ? 'check' : 'list', 16),
              ]),
              U.el('span', { class: 'list__label grow', text: o.label }),
            ])
          ).concat([
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                state.dir = state.dir === 'asc' ? 'desc' : 'asc';
                s.close();
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon(state.dir === 'asc' ? 'arrowUp' : 'arrowDown', 16)]),
              U.el('span', { class: 'list__label grow', text: state.dir === 'asc' ? 'Ascending' : 'Descending' }),
            ]),
          ])),
        ],
      });
    }

    function filterSheet() {
      const subjects = Store.query('subjects', { sort: 'name' });
      const s = UI.sheet({
        title: 'Filters',
        size: 'tall',
        body: [
          U.el('div', { class: 'field' }, [
            U.el('div', { class: 'field__label', text: 'Subject' }),
            UI.chipRow(
              [{ label: 'Any', active: !state.subjectId, onClick: () => { state.subjectId = ''; s.close(); paint(); } }].concat(
                subjects.map((sub) => ({
                  label: sub.name,
                  active: state.subjectId === sub.id,
                  onClick: () => {
                    state.subjectId = state.subjectId === sub.id ? '' : sub.id;
                    s.close();
                    paint();
                  },
                }))
              ),
              { padless: true }
            ),
          ]),
          U.el('div', { class: 'field' }, [
            U.el('div', { class: 'field__label', text: 'Priority' }),
            UI.chipRow(
              [{ label: 'Any', active: !state.priority, onClick: () => { state.priority = ''; s.close(); paint(); } }].concat(
                M.PRIORITIES.map((p) => ({
                  label: p.label,
                  active: state.priority === p.value,
                  onClick: () => {
                    state.priority = state.priority === p.value ? '' : p.value;
                    s.close();
                    paint();
                  },
                }))
              ),
              { padless: true }
            ),
          ]),
          collection === 'tasks' || collection === 'events'
            ? U.el('div', { class: 'field' }, [
                U.el('div', { class: 'field__label', text: 'Category' }),
                UI.chipRow(
                  [{ label: 'Any', active: !state.category, onClick: () => { state.category = ''; s.close(); paint(); } }].concat(
                    M.CATEGORIES.map((c) => ({
                      label: c.label,
                      active: state.category === c.value,
                      onClick: () => {
                        state.category = state.category === c.value ? '' : c.value;
                        s.close();
                        paint();
                      },
                    }))
                  ),
                  { padless: true }
                ),
              ])
            : null,
        ],
        footer: [
          U.el('button', {
            class: 'btn btn--secondary grow',
            type: 'button',
            text: 'Clear all',
            onclick: () => {
              state.subjectId = '';
              state.priority = '';
              state.category = '';
              s.close();
              paint();
            },
          }),
        ],
      });
    }

    function paintBody() {
      U.clear(body);
      const items = collect();
      const openCount = items.filter((it) => !M.isCompleted(it.collection, it.record)).length;
      const total = Store.list(collection).length;

      if (!items.length) {
        const isFiltered = state.quick !== 'open' || state.subjectId || state.priority || state.category || state.search;
        body.appendChild(
          isFiltered
            ? UI.emptyState({
                icon: 'search',
                title: 'No matches',
                body: 'Nothing fits these filters. Try clearing them.',
                actions: [
                  U.el('button', {
                    class: 'btn btn--secondary',
                    type: 'button',
                    text: 'Clear filters',
                    onclick: () => {
                      state.quick = 'open';
                      state.subjectId = '';
                      state.priority = '';
                      state.category = '';
                      state.search = '';
                      paint();
                    },
                  }),
                ],
              })
            : (cfg.empty ? cfg.empty() : UI.emptyState({ icon: 'sparkles', title: 'Nothing here yet' }))
        );
        return;
      }

      body.appendChild(
        U.el('div', { class: 'row row--between', style: { marginBottom: '12px' } }, [
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: items.length + ' shown · ' + openCount + ' open' + (total !== items.length ? ' · ' + total + ' total' : '') }),
        ])
      );

      body.appendChild(renderList(items, { groupMode: state.groupMode, empty: cfg.empty && cfg.empty(), limit: state.limit, onMore: () => { state.limit += 60; paintBody(); } }));
    }

    function paint() {
      U.clear(root);
      root.appendChild(filterBar());
      root.appendChild(body);
      paintBody();
    }

    paint();

    return {
      node: root,
      title: cfg.title,
      subtitle: cfg.subtitle,
      back: cfg.back !== undefined ? cfg.back : true,
      actions: (cfg.actions || []).concat([{ icon: 'search', label: 'Search everything', onClick: () => global.Router.go('/search') }]),
      afterRender: cfg.afterRender,
    };
  }

  /* ============================== Screens =============================== */
  /**
   * The Tasks tab covers both general tasks and homework, because the brief
   * puts homework under Tasks. A type chip switches between them.
   */
  function tasks(params, query) {
    const state = {
      type: query && query.type ? query.type : 'all',
      quick: 'open',
      sort: 'due',
      dir: 'asc',
      subjectId: '',
      priority: '',
      category: '',
      search: '',
      groupMode: 'bucket',
      limit: 60,
    };
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);

    function activeCols() {
      return state.type === 'all' ? ['homework', 'tasks'] : [state.type];
    }

    function collect() {
      const today = U.todayISO();
      const ws = Store.getSetting('weekStart', 1);
      const items = [];
      activeCols().forEach((col) => {
        const opts = { sort: state.sort, dir: state.dir };
        if (state.subjectId) opts.subjectId = state.subjectId;
        if (state.priority) opts.priority = state.priority;
        if (state.category) opts.category = state.category;
        switch (state.quick) {
          case 'open': opts.status = 'active'; break;
          case 'completed': opts.status = 'completed'; opts.sort = 'completed'; opts.dir = 'desc'; break;
          case 'overdue': opts.status = 'overdue'; break;
          case 'today': opts.day = today; break;
          case 'tomorrow': opts.day = U.toISO(U.addDays(new Date(), 1)); break;
          case 'week': opts.from = today; opts.to = U.toISO(U.endOfWeek(new Date(), ws)); opts.status = 'active'; break;
          default: break;
        }
        Store.query(col, opts).forEach((r) => {
          if (state.search) {
            const q = state.search.toLowerCase();
            if (M.searchableText(col, r).indexOf(q) < 0) return;
          }
          items.push({ collection: col, record: r });
        });
      });
      items.sort((a, b) => {
        const da = M.deadlineOf(a.collection, a.record) || '9999-99-99';
        const db = M.deadlineOf(b.collection, b.record) || '9999-99-99';
        if (da !== db) return da < db ? -1 : 1;
        const ta = (M.TIME_FIELD[a.collection] && a.record[M.TIME_FIELD[a.collection]]) || '99:99';
        const tb = (M.TIME_FIELD[b.collection] && b.record[M.TIME_FIELD[b.collection]]) || '99:99';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return (M.PRIORITY_RANK[a.record.priority] || 9) - (M.PRIORITY_RANK[b.record.priority] || 9);
      });
      return items;
    }

    function paint() {
      U.clear(body);

      body.appendChild(
        UI.chipRow(
          [
            { value: 'all', label: 'All work', icon: 'list' },
            { value: 'homework', label: 'Homework', icon: 'book' },
            { value: 'tasks', label: 'Tasks', icon: 'checkCircle' },
          ].map((t) => ({
            label: t.label,
            icon: t.icon,
            active: state.type === t.value,
            onClick: () => {
              state.type = t.value;
              paint();
            },
          })),
          { padless: true }
        )
      );

      const search = U.el('input', { type: 'search', placeholder: 'Filter your work…', value: state.search, 'aria-label': 'Filter' });
      search.addEventListener('input', U.debounce(() => {
        state.search = search.value.trim();
        paintBody();
      }, 180));
      body.appendChild(U.el('div', { class: 'search-bar', style: { marginTop: '10px' } }, [U.icon('search', 17), search]));

      const quick = U.el('div', { class: 'chip-row chip-row--padless', style: { marginTop: '10px', flexWrap: 'wrap', overflow: 'visible' } });
      QUICK_FILTERS.forEach((f) => {
        quick.appendChild(
          U.el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(state.quick === f.value),
            text: f.label,
            onclick: () => {
              state.quick = f.value;
              paint();
            },
          })
        );
      });
      body.appendChild(quick);

      const activeCount = (state.subjectId ? 1 : 0) + (state.priority ? 1 : 0) + (state.category ? 1 : 0);
      body.appendChild(
        U.el('div', { class: 'row', style: { gap: '8px', marginTop: '10px' } }, [
          U.el('button', { class: 'chip', type: 'button', 'aria-pressed': String(activeCount > 0), onclick: () => filterSheet(), }, [
            U.icon('filter', 13), U.el('span', { text: activeCount ? 'Filters (' + activeCount + ')' : 'Filters' }),
          ]),
          U.el('button', { class: 'chip', type: 'button', onclick: () => sortSheet() }, [
            U.icon('sliders', 13), U.el('span', { text: 'Sort: ' + sortLabel() }),
          ]),
          U.el('button', {
            class: 'chip',
            type: 'button',
            onclick: () => {
              state.groupMode = state.groupMode === 'bucket' ? 'none' : 'bucket';
              paint();
            },
          }, [U.icon('layers', 13), U.el('span', { text: state.groupMode === 'bucket' ? 'Grouped' : 'Flat' })]),
        ])
      );

      const listWrap = U.el('div', { style: { marginTop: '14px' } });
      body.appendChild(listWrap);
      paintBodyInto(listWrap);
    }

    function paintBody() {
      const listWrap = body.lastElementChild;
      paintBodyInto(listWrap);
    }

    function paintBodyInto(listWrap) {
      U.clear(listWrap);
      const items = collect();
      const openCount = items.filter((it) => !M.isCompleted(it.collection, it.record)).length;
      if (!items.length) {
        const filtered = state.quick !== 'open' || state.subjectId || state.priority || state.category || state.search || state.type !== 'all';
        listWrap.appendChild(
          filtered
            ? UI.emptyState({
                icon: 'search',
                title: 'No matches',
                body: 'Nothing fits these filters.',
                actions: [
                  U.el('button', {
                    class: 'btn btn--secondary',
                    type: 'button',
                    text: 'Clear filters',
                    onclick: () => {
                      state.quick = 'open';
                      state.subjectId = '';
                      state.priority = '';
                      state.category = '';
                      state.search = '';
                      state.type = 'all';
                      paint();
                    },
                  }),
                ],
              })
            : UI.emptyState({
                icon: 'checkCircle',
                title: 'No work yet',
                body: 'Tasks are for anything that isn’t homework — reading, revision, chores, reminders.',
                actions: [
                  U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add a task', onclick: () => P.createItem('tasks', {}) }),
                  U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', {}) }),
                ],
              })
        );
        return;
      }
      listWrap.appendChild(
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)', marginBottom: '10px' }, text: items.length + ' shown · ' + openCount + ' open' })
      );
      listWrap.appendChild(
        renderList(items, {
          groupMode: state.groupMode,
          limit: state.limit,
          onMore: () => {
            state.limit += 60;
            paintBodyInto(listWrap);
          },
        })
      );
    }

    function sortLabel() {
      const opts = SORT_OPTIONS.tasks;
      const f = opts.find((o) => o.value === state.sort);
      return f ? f.label : state.sort;
    }

    function sortSheet() {
      const s = UI.sheet({
        title: 'Sort by',
        body: [
          U.el('div', { class: 'list list--plain' }, SORT_OPTIONS.tasks.map((o) =>
            U.el('button', {
              class: 'list__row',
              type: 'button',
              onclick: () => {
                state.sort = o.value;
                s.close();
                paint();
              },
            }, [
              U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)' } }, [U.icon(state.sort === o.value ? 'check' : 'list', 16)]),
              U.el('span', { class: 'list__label grow', text: o.label }),
            ])
          )),
        ],
      });
    }

    function filterSheet() {
      const subjects = Store.query('subjects', { sort: 'name' });
      const s = UI.sheet({
        title: 'Filters',
        size: 'tall',
        body: [
          U.el('div', { class: 'field' }, [
            U.el('div', { class: 'field__label', text: 'Subject' }),
            UI.chipRow(
              [{ label: 'Any', active: !state.subjectId, onClick: () => { state.subjectId = ''; s.close(); paint(); } }].concat(
                subjects.map((sub) => ({
                  label: sub.name,
                  active: state.subjectId === sub.id,
                  onClick: () => {
                    state.subjectId = state.subjectId === sub.id ? '' : sub.id;
                    s.close();
                    paint();
                  },
                }))
              ),
              { padless: true }
            ),
          ]),
          U.el('div', { class: 'field' }, [
            U.el('div', { class: 'field__label', text: 'Priority' }),
            UI.chipRow(
              [{ label: 'Any', active: !state.priority, onClick: () => { state.priority = ''; s.close(); paint(); } }].concat(
                M.PRIORITIES.map((p) => ({
                  label: p.label,
                  active: state.priority === p.value,
                  onClick: () => {
                    state.priority = state.priority === p.value ? '' : p.value;
                    s.close();
                    paint();
                  },
                }))
              ),
              { padless: true }
            ),
          ]),
          U.el('div', { class: 'field' }, [
            U.el('div', { class: 'field__label', text: 'Category' }),
            UI.chipRow(
              [{ label: 'Any', active: !state.category, onClick: () => { state.category = ''; s.close(); paint(); } }].concat(
                M.CATEGORIES.map((c) => ({
                  label: c.label,
                  active: state.category === c.value,
                  onClick: () => {
                    state.category = state.category === c.value ? '' : c.value;
                    s.close();
                    paint();
                  },
                }))
              ),
              { padless: true }
            ),
          ]),
        ],
        footer: [
          U.el('button', {
            class: 'btn btn--secondary grow',
            type: 'button',
            text: 'Clear all',
            onclick: () => {
              state.subjectId = '';
              state.priority = '';
              state.category = '';
              s.close();
              paint();
            },
          }),
        ],
      });
    }

    paint();
    return {
      node: root,
      title: 'Tasks',
      subtitle: '',
      back: false,
      actions: [
        { icon: 'alert', label: 'Deadlines', onClick: () => global.Router.go('/deadlines') },
        { icon: 'plus', label: 'Add task', onClick: () => P.createItem('tasks', {}) },
      ],
    };
  }

  function homework() {
    return listScreen({
      collection: 'homework',
      title: 'Homework',
      noun: 'homework',
      groupMode: 'bucket',
      groupToggle: true,
      empty: () =>
        UI.emptyState({
          icon: 'book',
          title: 'No homework yet',
          body: 'Add your first assignment to start organising your school life.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', {}) }),
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Set up subjects', onclick: () => global.Router.go('/subjects') }),
          ],
        }),
      actions: [{ icon: 'plus', label: 'Add homework', onClick: () => P.createItem('homework', {}) }],
    });
  }

  function exams() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);

    function paint() {
      U.clear(body);
      const all = Store.query('exams', { sort: 'due' });
      const upcoming = all.filter((e) => !M.isCompleted('exams', e) && (e.date || '') >= U.todayISO());
      const past = all.filter((e) => M.isCompleted('exams', e) || (e.date || '') < U.todayISO());

      if (!all.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'clipboard',
            title: 'No exams yet',
            body: 'Add an exam and the app will count down to it and can build a study plan.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add an exam', onclick: () => P.createItem('exams', {}) }),
            ],
          })
        );
        return;
      }

      if (upcoming.length) {
        body.appendChild(UI.sectionHead('Upcoming', { count: upcoming.length }));
        const list = U.el('div', { class: 'stack-3', style: { marginBottom: '22px' } });
        upcoming.forEach((e) => list.appendChild(examCard(e)));
        body.appendChild(list);
      } else {
        body.appendChild(
          UI.emptyState({ icon: 'checkCircle', title: 'No upcoming exams', body: 'Nothing on the horizon. Add one when it’s announced.' })
        );
      }

      if (past.length) {
        body.appendChild(UI.sectionHead('Past & completed', { count: past.length }));
        const list = U.el('div', { class: 'list' });
        const subjectMap = P.subjectMap();
        past.forEach((e, i) =>
          list.appendChild(
            UI.swipeRow({
              content: UI.itemRow('exams', e, { subjectMap, bordered: i > 0, onOpen: () => global.Router.go('/exams/' + e.id) }),
              onComplete: () => UI.toggleComplete('exams', e.id),
              onDelete: () => P.deleteItem('exams', e.id),
            })
          )
        );
        body.appendChild(list);
      }
    }

    function examCard(e) {
      const subject = e.subjectId ? Store.byId('subjects', e.subjectId) : null;
      const delta = U.diffDays(U.todayISO(), e.date);
      const studyTasks = Store.query('tasks', { examId: e.id, sort: 'due' });
      const doneStudy = studyTasks.filter((t) => t.completed).length;
      const card = U.el('div', { class: 'card card--pad card--tap' });

      card.appendChild(
        U.el('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start' } }, [
          U.el('span', { class: 'list__icon', style: { background: 'var(--danger-soft)', color: 'var(--danger)', width: '40px', height: '40px' } }, [U.icon('clipboard', 20)]),
          U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
            U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: e.title }),
            U.el('div', { class: 'row', style: { gap: '6px', marginTop: '4px', flexWrap: 'wrap' } }, [
              subject ? U.el('span', { class: 'row', style: { gap: '5px', fontSize: 'var(--fs-footnote)', color: 'var(--text-secondary)' } }, [U.el('span', { class: 'subject-dot', style: { background: subject.color } }), U.el('span', { text: subject.name })]) : null,
              U.el('span', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtDateMedium(e.date) + (e.time ? ' · ' + U.fmtTime(e.time) : '') }),
              e.location ? U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: '· ' + e.location }) : null,
            ]),
          ]),
          UI.countdownChip(e.date, e.time, ''),
        ])
      );

      if (e.topics && e.topics.length) {
        const topics = U.el('div', { class: 'chip-row chip-row--padless', style: { marginTop: '12px', flexWrap: 'wrap', overflow: 'visible' } });
        e.topics.slice(0, 5).forEach((t) => topics.appendChild(U.el('span', { class: 'chip', style: { pointerEvents: 'none' }, text: t })));
        if (e.topics.length > 5) topics.appendChild(U.el('span', { class: 'chip', text: '+' + (e.topics.length - 5) }));
        card.appendChild(topics);
      }

      if (studyTasks.length) {
        card.appendChild(
          U.el('div', { style: { marginTop: '14px' } }, [
            U.el('div', { class: 'row row--between', style: { marginBottom: '6px' } }, [
              U.el('span', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Study plan · ' + doneStudy + '/' + studyTasks.length + ' done' }),
              U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'Tap to review' }),
            ]),
            UI.progressBar(studyTasks.length ? (doneStudy / studyTasks.length) * 100 : 0),
          ])
        );
      }

      const actions = U.el('div', { class: 'row', style: { gap: '8px', marginTop: '14px' } }, [
        U.el('button', {
          class: 'btn btn--secondary btn--sm',
          type: 'button',
          onclick: (ev) => {
            ev.stopPropagation();
            P.studyPlanSheet({ type: 'exams', id: e.id });
          },
        }, [U.icon('sparkles', 14), U.el('span', { text: studyTasks.length ? 'Rebuild plan' : 'Study plan' })]),
        U.el('button', {
          class: 'btn btn--secondary btn--sm',
          type: 'button',
          onclick: (ev) => {
            ev.stopPropagation();
            P.openNotes('exams', e.id);
          },
        }, [U.icon('file', 14), U.el('span', { text: 'Notes' })]),
        U.el('button', {
          class: 'btn btn--secondary btn--sm',
          type: 'button',
          onclick: (ev) => {
            ev.stopPropagation();
            P.itemActions('exams', e.id);
          },
        }, [U.icon('more', 14)]),
      ]);
      card.appendChild(actions);

      card.addEventListener('click', () => global.Router.go('/exams/' + e.id));
      return card;
    }

    paint();
    return {
      node: root,
      title: 'Exams',
      back: true,
      actions: [
        { icon: 'clipboard', label: 'Past exams', onClick: () => global.Router.go('/history?type=exams') },
        { icon: 'plus', label: 'Add exam', onClick: () => P.createItem('exams', {}) },
      ],
    };
  }

  function events() {
    return listScreen({
      collection: 'events',
      title: 'Events',
      noun: 'events',
      groupMode: 'date',
      groupToggle: false,
      quickFilters: [
        { value: 'open', label: 'Upcoming' },
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This week' },
        { value: 'all', label: 'All' },
        { value: 'completed', label: 'Past' },
      ],
      empty: () =>
        UI.emptyState({
          icon: 'calendar',
          title: 'No events yet',
          body: 'Trips, assemblies, sports days, meetings, birthdays — keep them all here.',
          actions: [U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add an event', onclick: () => P.createItem('events', {}) })],
        }),
      actions: [{ icon: 'plus', label: 'Add event', onClick: () => P.createItem('events', {}) }],
    });
  }

  function notes() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);
    let query = '';

    function paint() {
      U.clear(body);
      const bar = U.el('div', { class: 'search-bar', style: { marginBottom: '14px' } });
      const input = U.el('input', { type: 'search', placeholder: 'Search notes…', value: query, 'aria-label': 'Search notes' });
      input.addEventListener('input', U.debounce(() => {
        query = input.value.trim();
        paintList();
      }, 180));
      bar.appendChild(U.icon('search', 17));
      bar.appendChild(input);
      body.appendChild(bar);
      const listWrap = U.el('div', { class: 'stack-3' });
      body.appendChild(listWrap);

      function paintList() {
        U.clear(listWrap);
        let all = Store.query('notes', { sort: 'updated' });
        if (query) {
          const q = query.toLowerCase();
          all = all.filter((n) => M.searchableText('notes', n).indexOf(q) >= 0);
        }
        if (!all.length) {
          listWrap.appendChild(
            UI.emptyState({
              icon: 'file',
              title: query ? 'No notes match' : 'No notes yet',
              body: query ? 'Try a different word.' : 'Notes can live on their own, or be attached to a subject, homework, project or exam.',
              actions: query
                ? []
                : [U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Write a note', onclick: () => P.createItem('notes', {}) })],
            })
          );
          return;
        }
        all.forEach((n) => {
          const owner = n.ownerType && n.ownerId ? Store.byId(n.ownerType, n.ownerId) : null;
          const card = U.el('div', { class: 'note-card card--tap' });
          card.appendChild(U.el('div', { class: 'note-card__title', text: n.title || 'Note' }));
          if (n.body) card.appendChild(U.el('div', { class: 'note-card__body clamp-2', text: n.body }));
          if (n.checklist && n.checklist.length) {
            const done = n.checklist.filter((c) => c.done).length;
            card.appendChild(U.el('div', { class: 'row', style: { gap: '6px', marginTop: '8px', fontSize: 'var(--fs-footnote)', color: 'var(--text-tertiary)' } }, [
              U.icon('checkCircle', 13),
              U.el('span', { text: done + '/' + n.checklist.length + ' checklist items' }),
            ]));
          }
          card.appendChild(
            U.el('div', { class: 'note-card__foot row row--between' }, [
              U.el('span', { text: owner ? 'On ' + (owner.title || owner.name) : 'Standalone · updated ' + U.fmtDateStamp(n.updatedAt) }),
              U.el('button', {
                class: 'icon-btn icon-btn--sm',
                type: 'button',
                'aria-label': 'Note actions',
                onclick: (e) => {
                  e.stopPropagation();
                  P.itemActions('notes', n.id);
                },
              }, [U.icon('more', 15)]),
            ])
          );
          card.addEventListener('click', () => global.Router.go('/notes/' + n.id));
          listWrap.appendChild(card);
        });
      }
      paintList();
    }

    paint();
    return {
      node: root,
      title: 'Notes',
      back: true,
      actions: [{ icon: 'plus', label: 'New note', onClick: () => P.createItem('notes', {}) }],
    };
  }

  /* ============================= Deadlines ============================== */
  function deadlines() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);
    let subjectId = '';
    let limit = 60;

    function paint() {
      U.clear(body);
      const subjectMap = P.subjectMap();
      const items = [];
      ['homework', 'tasks', 'projects', 'exams'].forEach((c) => {
        Store.query(c, { status: 'active', sort: 'due' }).forEach((r) => {
          if (subjectId && r.subjectId !== subjectId) return;
          items.push({ collection: c, record: r });
        });
      });

      const subjects = Store.query('subjects', { sort: 'name' });
      if (subjects.length) {
        body.appendChild(
          UI.chipRow(
            [{ label: 'All subjects', active: !subjectId, onClick: () => { subjectId = ''; paint(); } }].concat(
              subjects.map((s) => ({
                label: s.name,
                active: subjectId === s.id,
                onClick: () => {
                  subjectId = subjectId === s.id ? '' : s.id;
                  paint();
                },
              }))
            ),
            { padless: true }
          )
        );
      }

      const sections = UI.bucketSections(items, { order: ['overdue', 'today', 'tomorrow', 'week', 'later'] });
      const overdueCount = (sections.find((s) => s.bucket === 'overdue') || { items: [] }).items.length;

      body.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginTop: '14px', marginBottom: '18px' } }, [
          U.el('div', { class: 'row', style: { gap: '14px', alignItems: 'center' } }, [
            U.el('span', { class: 'list__icon', style: { background: overdueCount ? 'var(--danger-soft)' : 'var(--success-soft)', color: overdueCount ? 'var(--danger)' : 'var(--success)', width: '42px', height: '42px' } }, [
              U.icon(overdueCount ? 'alert' : 'checkCircle', 20),
            ]),
            U.el('div', { class: 'grow col' }, [
              U.el('div', { style: { fontWeight: '600' }, text: overdueCount ? overdueCount + ' item' + (overdueCount === 1 ? '' : 's') + ' overdue' : 'Nothing overdue' }),
              U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: items.length + ' open deadline' + (items.length === 1 ? '' : 's') + ' in total' }),
            ]),
          ]),
          overdueCount
            ? U.el('button', {
                class: 'btn btn--secondary btn--block',
                type: 'button',
                style: { marginTop: '14px' },
                onclick: async () => {
                  const ok = await UI.confirm({
                    title: 'Move all ' + overdueCount + ' overdue items to tomorrow?',
                    message: 'You can move them individually afterwards.',
                    confirmLabel: 'Move all',
                  });
                  if (!ok) return;
                  (sections.find((s) => s.bucket === 'overdue') || { items: [] }).items.forEach((it) => P.snoozeTomorrow(it.collection, it.record.id));
                  UI.toast('Overdue items moved to tomorrow.');
                },
              }, [U.icon('clock', 15), U.el('span', { text: 'Reschedule all overdue' })])
            : null,
        ])
      );

      if (!sections.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'checkCircle',
            title: 'No open deadlines',
            body: 'Everything is done or nothing has a due date yet.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add homework', onclick: () => P.createItem('homework', {}) }),
              U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'See history', onclick: () => global.Router.go('/history') }),
            ],
          })
        );
        return;
      }

      // Render every bucket, but cap the rows so a heavy account still paints fast.
      let budget = limit;
      sections.forEach((sec) => {
        const head = UI.sectionHead(sec.label, { count: sec.items.length });
        body.appendChild(head);
        const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
        sec.items.slice(0, Math.max(0, budget)).forEach((it, i) => {
          budget--;
          const row = UI.itemRow(it.collection, it.record, { subjectMap, bordered: i > 0, onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id) });
          // One-tap reschedule on the row itself.
          const trail = row.querySelector('.item__trail');
          if (trail && M.DATE_FIELD[it.collection]) {
            const btn = U.el('button', {
              class: 'icon-btn icon-btn--sm',
              type: 'button',
              'aria-label': 'Reschedule',
              title: 'Move to tomorrow',
              onclick: (e) => {
                e.stopPropagation();
                P.snoozeTomorrow(it.collection, it.record.id);
              },
            }, [U.icon('clock', 16)]);
            trail.insertBefore(btn, trail.firstChild);
          }
          list.appendChild(row);
        });
        body.appendChild(list);
      });
      if (items.length > limit) {
        body.appendChild(
          U.el('button', {
            class: 'btn btn--secondary btn--block',
            type: 'button',
            onclick: () => {
              limit += 60;
              paint();
            },
          }, [U.icon('chevronDown', 16), U.el('span', { text: 'Show ' + Math.min(60, items.length - limit) + ' more of ' + (items.length - limit) })]),
        );
      }
    }

    paint();
    return {
      node: root,
      title: 'Deadlines',
      back: true,
      actions: [{ icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') }],
    };
  }

  /* ============================== History =============================== */
  function history(params, query) {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);
    const state = {
      type: query && query.type ? query.type : 'all',
      range: 'all',
      subjectId: '',
      limit: 60,
    };

    const TYPES = [
      { value: 'all', label: 'Everything' },
      { value: 'homework', label: 'Homework' },
      { value: 'tasks', label: 'Tasks' },
      { value: 'projects', label: 'Projects' },
      { value: 'exams', label: 'Exams' },
      { value: 'events', label: 'Events' },
    ];

    function paint() {
      U.clear(body);
      const subjectMap = P.subjectMap();
      const subjects = Store.query('subjects', { sort: 'name' });

      body.appendChild(
        UI.chipRow(
          TYPES.map((t) => ({
            label: t.label,
            active: state.type === t.value,
            onClick: () => {
              state.type = t.value;
              paint();
            },
          })),
          { padless: true }
        )
      );

      const ranges = [
        { value: 'all', label: 'All time' },
        { value: 'week', label: 'This week' },
        { value: 'month', label: 'This month' },
        { value: '30', label: 'Last 30 days' },
      ];
      body.appendChild(
        U.el('div', { style: { marginTop: '10px' } }, [
          UI.chipRow(
            ranges.map((r) => ({
              label: r.label,
              active: state.range === r.value,
              onClick: () => {
                state.range = r.value;
                paint();
              },
            })).concat(
              subjects.length
                ? [{
                    label: state.subjectId ? 'Subject: ' + (Store.byId('subjects', state.subjectId) || {}).name : 'All subjects',
                    icon: 'filter',
                    active: !!state.subjectId,
                    onClick: () => subjectPicker(),
                  }]
                : []
            ),
            { padless: true }
          ),
        ])
      );

      function subjectPicker() {
        const s = UI.sheet({
          title: 'Filter by subject',
          body: [
            U.el('div', { class: 'list list--plain' }, [
              U.el('button', {
                class: 'list__row',
                type: 'button',
                onclick: () => {
                  state.subjectId = '';
                  s.close();
                  paint();
                },
              }, [U.el('span', { class: 'list__label grow', text: 'All subjects' })]),
            ].concat(
              subjects.map((sub) =>
                U.el('button', {
                  class: 'list__row',
                  type: 'button',
                  onclick: () => {
                    state.subjectId = sub.id;
                    s.close();
                    paint();
                  },
                }, [
                  U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: sub.color } }, [U.icon(sub.icon || 'book', 16)]),
                  U.el('span', { class: 'list__label grow', text: sub.name }),
                ])
              )
            )),
          ],
        });
      }

      // Range window
      let from = null;
      const today = new Date();
      if (state.range === 'week') from = U.toISO(U.startOfWeek(today, Store.getSetting('weekStart', 1)));
      else if (state.range === 'month') from = U.toISO(U.startOfMonth(today));
      else if (state.range === '30') from = U.toISO(U.addDays(today, -30));

      const cols = state.type === 'all' ? ['homework', 'tasks', 'projects', 'exams', 'events'] : [state.type];
      const items = [];
      cols.forEach((c) => {
        Store.query(c, { status: 'completed', sort: 'completed', dir: 'desc' }).forEach((r) => {
          if (state.subjectId && r.subjectId !== state.subjectId) return;
          const when = r.completedAt ? U.toISO(new Date(r.completedAt)) : M.deadlineOf(c, r);
          if (from && when && when < from) return;
          items.push({ collection: c, record: r, when: when || '' });
        });
      });
      items.sort((a, b) => (b.when || '').localeCompare(a.when || '') || (b.record.completedAt || 0) - (a.record.completedAt || 0));

      const stats = {
        total: items.length,
        byType: cols.reduce((acc, c) => {
          acc[c] = items.filter((i) => i.collection === c).length;
          return acc;
        }, {}),
      };

      body.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginTop: '14px', marginBottom: '16px' } }, [
          U.el('div', { class: 'row', style: { gap: '16px' } }, [
            UI.ring(items.length ? 100 : 0, 50),
            U.el('div', { class: 'grow col' }, [
              U.el('div', { style: { fontWeight: '600' }, text: items.length + ' completed item' + (items.length === 1 ? '' : 's') }),
              U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: Object.keys(stats.byType).filter((k) => stats.byType[k]).map((k) => stats.byType[k] + ' ' + M.typeMeta(k).label.toLowerCase()).join(' · ') || 'Nothing in this range' }),
            ]),
          ]),
        ])
      );

      if (!items.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'history',
            title: 'Nothing completed yet',
            body: 'Completed homework, tasks, projects, exams and events all show up here.',
            actions: [U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Back to tasks', onclick: () => global.Router.go('/tasks') })],
          })
        );
        return;
      }

      // Group by day (capped so a long history still paints quickly).
      const groups = {};
      items.forEach((it) => {
        const key = it.when || 'unknown';
        (groups[key] = groups[key] || []).push(it);
      });
      let budget = state.limit;
      Object.keys(groups)
        .sort((a, b) => b.localeCompare(a))
        .forEach((day) => {
          if (budget <= 0) return;
          const slice = groups[day].slice(0, budget);
          budget -= slice.length;
          body.appendChild(
            UI.sectionHead(day === 'unknown' ? 'Date unknown' : U.fmtDateRelative(day) + ' · ' + U.fmtDateShort(day), { count: groups[day].length })
          );
          const list = U.el('div', { class: 'list', style: { marginBottom: '18px' } });
          slice.forEach((it, i) => {
            list.appendChild(
              UI.swipeRow({
                content: UI.itemRow(it.collection, it.record, {
                  subjectMap,
                  bordered: i > 0,
                  onOpen: (c, r) => global.Router.go('/' + c + '/' + r.id),
                }),
                onComplete: () => UI.toggleComplete(it.collection, it.record.id),
                onDelete: () => P.deleteItem(it.collection, it.record.id),
              })
            );
          });
          body.appendChild(list);
        });
      if (items.length > state.limit) {
        body.appendChild(
          U.el('button', {
            class: 'btn btn--secondary btn--block',
            type: 'button',
            onclick: () => {
              state.limit += 60;
              paint();
            },
          }, [U.icon('chevronDown', 16), U.el('span', { text: 'Show more of ' + items.length + ' completed items' })]),
        );
      }
    }

    paint();
    return {
      node: root,
      title: 'History',
      back: true,
      actions: [{ icon: 'search', label: 'Search', onClick: () => global.Router.go('/search') }],
    };
  }

  global.Screens = global.Screens || {};
  global.Screens.tasks = tasks;
  global.Screens.homework = homework;
  global.Screens.exams = exams;
  global.Screens.events = events;
  global.Screens.notes = notes;
  global.Screens.deadlines = deadlines;
  global.Screens.history = history;
  global.Screens._renderList = renderList;
  global.Screens._listScreen = listScreen;
})(window);
