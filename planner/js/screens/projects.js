/* ==========================================================================
   screens/projects.js — projects list with real progress, plus the
   project workspace (subtasks, milestones, notes, attachments, progress
   override) rendered by detail.js.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  function projects() {
    const root = U.el('div', { class: 'screen' });
    const body = U.el('div');
    root.appendChild(body);
    const state = { filter: 'active', subjectId: '', sort: 'due' };

    function paint() {
      U.clear(body);
      const subjects = Store.query('subjects', { sort: 'name' });

      body.appendChild(
        UI.chipRow(
          [
            { value: 'active', label: 'Active' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'done', label: 'Completed' },
            { value: 'all', label: 'All' },
          ].map((f) => ({
            label: f.label,
            active: state.filter === f.value,
            onClick: () => {
              state.filter = f.value;
              paint();
            },
          })),
          { padless: true }
        )
      );

      const row = U.el('div', { class: 'row', style: { gap: '8px', marginTop: '10px' } });
      if (subjects.length) {
        row.appendChild(
          U.el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(!!state.subjectId),
            onclick: () => {
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
            },
          }, [U.icon('filter', 13), U.el('span', { text: state.subjectId ? (Store.byId('subjects', state.subjectId) || {}).name : 'Subject' })])
        );
      }
      row.appendChild(
        U.el('button', {
          class: 'chip',
          type: 'button',
          onclick: () => {
            const opts = [
              { value: 'due', label: 'Due date' },
              { value: 'progress', label: 'Progress' },
              { value: 'priority', label: 'Priority' },
              { value: 'title', label: 'Name' },
            ];
            const s = UI.sheet({
              title: 'Sort projects',
              body: [U.el('div', { class: 'list list--plain' }, opts.map((o) =>
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
              ))],
            });
          },
        }, [U.icon('sliders', 13), U.el('span', { text: 'Sort' })])
      );
      body.appendChild(row);

      let rows = Store.query('projects', { sort: state.sort, dir: state.sort === 'progress' ? 'desc' : 'asc' });
      if (state.subjectId) rows = rows.filter((r) => r.subjectId === state.subjectId);
      if (state.filter === 'active') rows = rows.filter((r) => !M.isCompleted('projects', r));
      else if (state.filter === 'done') rows = rows.filter((r) => M.isCompleted('projects', r));
      else if (state.filter === 'overdue') rows = rows.filter((r) => M.isOverdue('projects', r));

      if (!rows.length) {
        body.appendChild(
          UI.emptyState({
            icon: 'folder',
            title: state.filter === 'done' ? 'No completed projects yet' : 'No projects yet',
            body: 'Projects hold their own subtasks, milestones and notes — progress is calculated for you.',
            actions: [
              U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Add a project', onclick: () => P.createItem('projects', {}) }),
            ],
          })
        );
        return;
      }

      const list = U.el('div', { class: 'stack-3', style: { marginTop: '14px' } });
      rows.forEach((p) => list.appendChild(projectCard(p)));
      body.appendChild(list);
    }

    function projectCard(p) {
      const subject = p.subjectId ? Store.byId('subjects', p.subjectId) : null;
      const tasks = Store.projectTasks(p.id);
      const prog = M.projectProgress(p, tasks);
      const overdue = M.isOverdue('projects', p);
      const done = M.isCompleted('projects', p);

      const card = U.el('div', { class: 'project-card card--tap' });
      card.appendChild(
        U.el('div', { class: 'project-card__top' }, [
          U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: subject ? subject.color : 'var(--type-project)', width: '38px', height: '38px' } }, [
            U.icon('folder', 19),
          ]),
          U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
            U.el('div', { class: 'project-card__title', text: p.title }),
            U.el('div', { class: 'item__meta', style: { marginTop: '5px' } }, [
              subject ? U.el('span', { class: 'row', style: { gap: '5px' } }, [U.el('span', { class: 'subject-dot', style: { background: subject.color } }), U.el('span', { text: subject.name })]) : null,
              subject ? U.el('span', { class: 'item__meta-dot' }) : null,
              U.el('span', { class: overdue ? 'text-danger' : '', text: done ? 'Completed' : overdue ? U.fmtOverdue(p.dueDate) : 'Due ' + U.fmtDateRelative(p.dueDate) }),
              p.members && p.members.length ? U.el('span', { class: 'item__meta-dot' }) : null,
              p.members && p.members.length ? U.el('span', { text: p.members.length + ' member' + (p.members.length === 1 ? '' : 's') }) : null,
            ]),
          ]),
          done ? U.el('span', { class: 'badge badge--done', text: 'Done' }) : overdue ? U.el('span', { class: 'badge badge--overdue', text: 'Overdue' }) : null,
        ])
      );

      card.appendChild(
        U.el('div', { class: 'project-card__progress' }, [
          U.el('div', { class: 'progress progress--lg grow' }, [U.el('div', { class: 'progress__bar progress__bar--type', style: { width: prog.pct + '%' } })]),
          U.el('span', { class: 'project-card__pct', text: prog.pct + '%' }),
        ])
      );
      card.appendChild(
        U.el('div', { class: 'row row--between' }, [
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: prog.total ? prog.done + ' of ' + prog.total + ' subtasks' + (prog.manual ? ' · manual' : '') : 'No subtasks yet' }),
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: p.milestones && p.milestones.length ? p.milestones.length + ' milestones' : '' }),
        ])
      );

      card.addEventListener('click', () => global.Router.go('/projects/' + p.id));
      return card;
    }

    paint();
    return {
      node: root,
      title: 'Projects',
      back: false,
      actions: [
        { icon: 'history', label: 'Completed projects', onClick: () => global.Router.go('/history?type=projects') },
        { icon: 'plus', label: 'Add project', onClick: () => P.createItem('projects', {}) },
      ],
    };
  }

  global.Screens = global.Screens || {};
  global.Screens.projects = projects;
})(window);
