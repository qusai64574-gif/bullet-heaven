/* ==========================================================================
   screens/detail.js — the detail screen for every item type, plus notes.
   Everything is editable here: fields, subtasks, progress override,
   attachments, notes, completion, duplication, rescheduling and deletion.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;
  const P = global.Planner;

  const TITLES = { homework: 'Homework', tasks: 'Task', projects: 'Project', exams: 'Exam', events: 'Event' };

  function detail(collection, id) {
    const rec = Store.byId(collection, id);
    const root = U.el('div', { class: 'screen' });

    if (!rec) {
      root.appendChild(
        UI.emptyState({
          icon: 'alert',
          title: 'Item not found',
          body: 'It may have been deleted.',
          actions: [U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Go back', onclick: () => global.Router.back() })],
        })
      );
      return { node: root, title: 'Not found', back: true };
    }

    const subject = rec.subjectId ? Store.byId('subjects', rec.subjectId) : null;
    const meta = M.typeMeta(collection);
    const done = M.isCompleted(collection, rec);
    const overdue = M.isOverdue(collection, rec);
    const deadline = M.deadlineOf(collection, rec);

    /* ------------------------------- Hero ------------------------------- */
    const hero = U.el('div', { class: 'detail-hero' });
    hero.appendChild(U.el('div', { class: 'row', style: { gap: '8px', marginBottom: '10px', flexWrap: 'wrap' } }, [
      U.el('span', { class: 'type-chip ' + meta.chip }, [U.icon(meta.icon, 11), U.el('span', { text: meta.label })]),
      done ? U.el('span', { class: 'badge badge--done', text: 'Completed' }) : null,
      overdue ? U.el('span', { class: 'badge badge--overdue', text: U.fmtOverdue(deadline) }) : null,
      rec.sample ? U.el('span', { class: 'badge badge--neutral', text: 'Sample data' }) : null,
    ]));
    hero.appendChild(U.el('h1', { class: 'detail-hero__title' + (done ? ' text-tertiary' : ''), text: rec.title || rec.name || 'Untitled' }));

    const metaRow = U.el('div', { class: 'detail-hero__meta' });
    if (subject) {
      metaRow.appendChild(
        U.el('button', {
          class: 'chip',
          type: 'button',
          onclick: () => global.Router.go('/subjects/' + subject.id),
        }, [U.el('span', { class: 'subject-dot', style: { background: subject.color } }), U.el('span', { text: subject.name })])
      );
    }
    if (collection === 'exams') metaRow.appendChild(UI.countdownChip(rec.date, rec.time, ''));
    if (collection === 'projects') {
      const prog = M.projectProgress(rec, Store.projectTasks(rec.id));
      metaRow.appendChild(U.el('span', { class: 'badge badge--info', text: prog.pct + '% complete' }));
    }
    if (rec.priority && collection !== 'events') {
      const pm = M.priorityMeta(rec.priority);
      metaRow.appendChild(U.el('span', { class: 'prio prio--' + pm.value, style: { fontSize: 'var(--fs-callout)' } }, [U.icon(pm.icon, 14), U.el('span', { text: pm.label + ' priority' })]));
    }
    if (rec.repeat && rec.repeat.freq !== 'none') {
      metaRow.appendChild(U.el('span', { class: 'badge badge--neutral' }, [U.icon('repeat', 12), U.el('span', { text: M.repeatLabel(rec.repeat) })]));
    }
    hero.appendChild(metaRow);
    root.appendChild(hero);

    /* --------------------------- Complete toggle ------------------------ */
    root.appendChild(
      U.el('div', { style: { marginBottom: '18px' } }, [
        U.el('button', {
          class: 'btn ' + (done ? 'btn--secondary' : 'btn--primary') + ' btn--block btn--lg',
          type: 'button',
          onclick: () => {
            UI.toggleComplete(collection, id);
            global.Router.handle(true);
          },
        }, [
          U.icon(done ? 'refresh' : 'check', 18),
          U.el('span', { text: done ? 'Mark as not done' : collection === 'projects' ? 'Mark project complete' : 'Mark as completed' }),
        ]),
      ])
    );

    /* ------------------------------ Meta grid --------------------------- */
    const cells = [];
    if (deadline) cells.push(['Date', U.fmtDateLong(deadline) + (collection === 'exams' && rec.time ? '' : '')]);
    const tf = M.TIME_FIELD[collection];
    if (tf && rec[tf]) cells.push([collection === 'events' ? 'Starts' : 'Time', U.fmtTime(rec[tf])]);
    if (collection === 'events' && rec.endTime) cells.push(['Ends', U.fmtTime(rec.endTime)]);
    if (collection === 'exams' && rec.location) cells.push(['Location', rec.location]);
    if (collection === 'events' && rec.location) cells.push(['Location', rec.location]);
    if (rec.teacher) cells.push(['Teacher', rec.teacher]);
    if (rec.unit) cells.push(['Chapter / unit', rec.unit]);
    if (rec.estMinutes) cells.push(['Estimated time', U.fmtDuration(rec.estMinutes)]);
    if (collection === 'exams' && rec.importance) cells.push(['Importance', M.importanceMeta(rec.importance).label]);
    if (collection === 'tasks' && rec.category) cells.push(['Category', M.categoryMeta(rec.category).label]);
    if (collection === 'events' && rec.category) cells.push(['Category', M.categoryMeta(rec.category).label]);
    if (rec.members && rec.members.length) cells.push(['Team', rec.members.join(', ')]);

    if (cells.length) {
      const grid = U.el('div', { class: 'meta-grid', style: { marginBottom: '18px' } });
      cells.forEach(([label, value]) => {
        grid.appendChild(
          U.el('div', { class: 'meta-cell' }, [
            U.el('div', { class: 'meta-cell__label', text: label }),
            U.el('div', { class: 'meta-cell__value', text: value }),
          ])
        );
      });
      root.appendChild(grid);
    }

    /* ------------------------------- Reminders -------------------------- */
    root.appendChild(
      U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
        U.el('div', { class: 'row row--between' }, [
          U.el('div', { class: 'row', style: { gap: '10px' } }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('bell', 16)]),
            U.el('div', { class: 'col' }, [
              U.el('div', { style: { fontWeight: '500' } }, [U.el('span', { text: (rec.reminders && rec.reminders.length) ? (rec.reminders.length + ' reminder' + (rec.reminders.length === 1 ? '' : 's')) : 'No reminders' })]),
              U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: (rec.reminders && rec.reminders.length) ? rec.reminders.slice().sort((a, b) => b - a).map((m) => M.reminderLabel(m)).join(' · ') : 'Add one so you don’t forget' }),
            ]),
          ]),
          U.el('button', {
            class: 'btn btn--secondary btn--sm',
            type: 'button',
            text: 'Change',
            onclick: () => remindersSheet(collection, rec),
          }),
        ]),
      ])
    );

    /* ------------------------------ Progress ---------------------------- */
    if (collection === 'projects') {
      root.appendChild(projectProgressBlock(rec));
      root.appendChild(subtaskBlock(rec));
      root.appendChild(milestoneBlock(rec));
    }

    /* --------------------------- Study tasks ---------------------------- */
    if (collection === 'exams') {
      root.appendChild(studyBlock(rec));
    }
    if (collection === 'exams' && rec.topics && rec.topics.length) {
      const topics = U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } });
      topics.appendChild(U.el('div', { class: 'field__label', text: 'Topics covered' }));
      const chips = U.el('div', { class: 'chip-row chip-row--padless', style: { flexWrap: 'wrap', overflow: 'visible' } });
      rec.topics.forEach((t) => chips.appendChild(U.el('span', { class: 'chip', style: { pointerEvents: 'none' }, text: t })));
      topics.appendChild(chips);
      root.appendChild(topics);
    }

    /* ----------------------------- Description -------------------------- */
    if (rec.description || rec.notes) {
      root.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } }, [
          U.el('div', { class: 'field__label', text: rec.description ? 'Description' : 'Notes' }),
          U.el('div', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.55' }, text: rec.description || rec.notes }),
        ])
      );
    }

    /* ---------------------------- Attachments --------------------------- */
    root.appendChild(attachmentsBlock(collection, rec));

    /* ------------------------------- Notes ------------------------------ */
    root.appendChild(notesBlock(collection, rec));

    /* ----------------------------- Action bar --------------------------- */
    root.appendChild(
      U.el('div', { class: 'action-bar' }, [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => P.editItem(collection, id) }, [U.icon('edit', 16), U.el('span', { text: 'Edit' })]),
        U.el('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'Duplicate', onclick: () => { const c = P.duplicateItem(collection, id); if (c) global.Router.go('/' + collection + '/' + c.id); } }, [U.icon('copy', 16)]),
        M.DATE_FIELD[collection]
          ? U.el('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'Reschedule', onclick: () => P.rescheduleSheet(collection, id) }, [U.icon('clock', 16)])
          : null,
        U.el('button', { class: 'btn btn--danger', type: 'button', 'aria-label': 'Delete', onclick: async () => { const ok = await P.deleteItem(collection, id); if (ok) global.Router.back(); } }, [U.icon('trash', 16)]),
      ])
    );

    /* ----------------------------- Meta footer -------------------------- */
    root.appendChild(
      U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', textAlign: 'center', marginTop: '18px' }, text: 'Added ' + U.fmtDateStamp(rec.createdAt) + (rec.updatedAt && rec.updatedAt !== rec.createdAt ? ' · Updated ' + U.fmtDateStamp(rec.updatedAt) : '') + (done && rec.completedAt ? ' · Completed ' + U.fmtDateStamp(rec.completedAt) : '') })
    );

    return {
      node: root,
      title: TITLES[collection] || 'Details',
      back: true,
      actions: [
        { icon: 'more', label: 'More actions', onClick: () => P.itemActions(collection, id) },
        { icon: 'edit', label: 'Edit', onClick: () => P.editItem(collection, id) },
      ],
    };
  }

  /* ----------------------------- Sub-blocks ----------------------------- */
  function projectProgressBlock(project) {
    const tasks = Store.projectTasks(project.id);
    const prog = M.projectProgress(project, tasks);
    const block = U.el('div', { class: 'card card--pad', style: { marginBottom: '18px' } });
    block.appendChild(
      U.el('div', { class: 'row row--between', style: { marginBottom: '12px' } }, [
        U.el('div', { class: 'field__label', style: { margin: 0 }, text: 'Progress' }),
        U.el('button', {
          class: 'section__action',
          type: 'button',
          text: prog.manual ? 'Use subtasks' : 'Set manually',
          onclick: () => {
            if (prog.manual) {
              Store.put('projects', Object.assign({}, project, { progressOverride: null }));
              UI.toast('Progress now follows your subtasks.');
              global.Router.handle(true);
              return;
            }
            manualProgressSheet(project);
          },
        }),
      ])
    );
    block.appendChild(
      U.el('div', { class: 'row', style: { gap: '14px' } }, [
        UI.ring(prog.pct, 62),
        U.el('div', { class: 'grow col' }, [
          U.el('div', { style: { fontWeight: '600' }, text: prog.total ? prog.done + ' of ' + prog.total + ' subtasks complete' : 'No subtasks yet' }),
          U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-callout)', marginTop: '2px' }, text: prog.manual ? 'Manually set to ' + prog.pct + '%' : prog.total ? 'Calculated from your subtasks' : 'Add subtasks to track progress automatically' }),
        ]),
      ])
    );
    return block;
  }

  function manualProgressSheet(project) {
    const range = U.el('input', { class: 'input', type: 'range', min: '0', max: '100', step: '5', value: String(project.progressOverride || 0), style: { width: '100%' } });
    const out = U.el('div', { style: { fontSize: '34px', fontWeight: '600', textAlign: 'center', margin: '10px 0' }, text: (project.progressOverride || 0) + '%' });
    range.addEventListener('input', () => (out.textContent = range.value + '%'));
    const s = UI.sheet({
      title: 'Set progress',
      subtitle: project.title,
      body: [out, range, U.el('div', { class: 'field__hint', text: 'This overrides the automatic subtask calculation until you switch back.' })],
      footer: [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
        U.el('button', {
          class: 'btn btn--primary grow',
          type: 'button',
          text: 'Save',
          onclick: () => {
            Store.put('projects', Object.assign({}, project, { progressOverride: Number(range.value) }));
            s.close();
            UI.toast('Progress updated.');
            global.Router.handle(true);
          },
        }),
      ],
    });
  }

  function subtaskBlock(project) {
    const tasks = Store.projectTasks(project.id);
    const done = tasks.filter((t) => t.completed).length;
    const block = U.el('div', { style: { marginBottom: '18px' } });
    const head = UI.sectionHead('Subtasks', { count: tasks.length });
    head.appendChild(
      U.el('button', {
        class: 'section__action',
        type: 'button',
        onclick: async () => {
          const created = await P.addSubtask(project.id);
          if (created) global.Router.handle(true);
        },
      }, [U.icon('plus', 14), U.el('span', { text: 'Add' })])
    );
    block.appendChild(head);

    if (!tasks.length) {
      block.appendChild(
        UI.emptyState({
          icon: 'list',
          title: 'No subtasks yet',
          body: 'Break the project into steps — progress updates as you tick them off.',
          actions: [
            U.el('button', {
              class: 'btn btn--primary',
              type: 'button',
              text: 'Add a subtask',
              onclick: async () => {
                const c = await P.addSubtask(project.id);
                if (c) global.Router.handle(true);
              },
            }),
          ],
        })
      );
      return block;
    }

    const list = U.el('div', { class: 'list' });
    tasks.forEach((t, i) => {
      list.appendChild(
        UI.swipeRow({
          content: UI.itemRow('tasks', t, {
            bordered: i > 0,
            hideCheck: false,
            showType: false,
            onOpen: (c, r) => global.Router.go('/tasks/' + r.id),
          }),
          onComplete: () => {
            UI.toggleComplete('tasks', t.id);
            global.Router.handle(true);
          },
          onDelete: async () => {
            await P.deleteItem('tasks', t.id, { skipConfirm: false });
            global.Router.handle(true);
          },
        })
      );
    });
    block.appendChild(list);
    block.appendChild(
      U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', marginTop: '8px', textAlign: 'center' }, text: done + ' of ' + tasks.length + ' complete' })
    );
    return block;
  }

  function milestoneBlock(project) {
    const block = U.el('div', { style: { marginBottom: '18px' } });
    const ms = project.milestones || [];
    const head = UI.sectionHead('Milestones', { count: ms.length });
    head.appendChild(
      U.el('button', {
        class: 'section__action',
        type: 'button',
        onclick: () => P.editItem('projects', project.id),
      }, [U.icon('edit', 13), U.el('span', { text: 'Edit' })])
    );
    block.appendChild(head);
    if (!ms.length) {
      block.appendChild(U.el('div', { class: 'card card--pad text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: 'No milestones. Add them when you edit the project — they mark key dates on the way to the deadline.' }));
      return block;
    }
    const list = U.el('div', { class: 'list' });
    ms.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((m, i) => {
      const passed = m.date && m.date < U.todayISO();
      list.appendChild(
        U.el('div', { class: 'list__row', style: i ? null : { borderTop: '0' } }, [
          U.el('span', { class: 'list__icon', style: { background: passed ? 'var(--success-soft)' : 'var(--bg-sunken)', color: passed ? 'var(--success)' : 'var(--text-tertiary)' } }, [
            U.icon(passed ? 'check' : 'flag', 16),
          ]),
          U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
            U.el('span', { class: 'list__label', text: m.name }),
            m.date ? U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: U.fmtDateLong(m.date) + (passed ? ' · passed' : '') }) : null,
          ]),
        ])
      );
    });
    block.appendChild(list);
    return block;
  }

  function studyBlock(exam) {
    const tasks = Store.query('tasks', { examId: exam.id, sort: 'due' });
    const done = tasks.filter((t) => t.completed).length;
    const block = U.el('div', { style: { marginBottom: '18px' } });
    const head = UI.sectionHead('Study plan', { count: tasks.length });
    head.appendChild(
      U.el('button', {
        class: 'section__action',
        type: 'button',
        onclick: () => P.studyPlanSheet({ type: 'exams', id: exam.id }),
      }, [U.icon('sparkles', 13), U.el('span', { text: tasks.length ? 'Rebuild' : 'Create' })])
    );
    block.appendChild(head);

    if (!tasks.length) {
      block.appendChild(
        UI.emptyState({
          icon: 'sparkles',
          title: 'No study plan yet',
          body: 'Let the planner spread your topics across the days you have left, then edit anything.',
          actions: [
            U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Create study plan', onclick: () => P.studyPlanSheet({ type: 'exams', id: exam.id }) }),
          ],
        })
      );
      return block;
    }

    const list = U.el('div', { class: 'list' });
    tasks.forEach((t, i) => {
      list.appendChild(
        UI.swipeRow({
          content: UI.itemRow('tasks', t, { bordered: i > 0, showType: false, onOpen: (c, r) => global.Router.go('/tasks/' + r.id) }),
          onComplete: () => {
            UI.toggleComplete('tasks', t.id);
            global.Router.handle(true);
          },
          onDelete: async () => {
            await P.deleteItem('tasks', t.id);
            global.Router.handle(true);
          },
        })
      );
    });
    block.appendChild(list);
    block.appendChild(
      U.el('div', { style: { marginTop: '12px' } }, [
        UI.progressBar(tasks.length ? (done / tasks.length) * 100 : 0),
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', marginTop: '6px', textAlign: 'center' }, text: done + ' of ' + tasks.length + ' study sessions done' }),
      ])
    );
    return block;
  }

  function attachmentsBlock(collection, rec) {
    const block = U.el('div', { style: { marginBottom: '18px' } });
    const items = rec.attachments || [];
    const head = UI.sectionHead('Attachments', { count: items.length });
    const input = U.el('input', { type: 'file', multiple: true, class: 'sr-only', accept: 'image/*,application/pdf,.doc,.docx,.txt' });
    head.appendChild(
      U.el('button', {
        class: 'section__action',
        type: 'button',
        onclick: () => input.click(),
      }, [U.icon('clip', 13), U.el('span', { text: 'Add' })])
    );
    block.appendChild(head);
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      input.value = '';
      const next = (rec.attachments || []).slice();
      for (const f of files) {
        try {
          const att = await Store.fileToAttachment(f);
          const stub = await Store.storeAttachment(att);
          next.push(stub);
        } catch (e) {
          UI.toast(e.message || 'That file could not be attached.');
        }
      }
      if (next.length !== (rec.attachments || []).length) {
        Store.put(collection, Object.assign({}, rec, { attachments: next }));
        UI.toast(files.length + ' attachment' + (files.length === 1 ? '' : 's') + ' added.');
        global.Router.handle(true);
      }
    });
    block.appendChild(input);

    if (!items.length) {
      block.appendChild(
        U.el('div', { class: 'card card--pad text-secondary', style: { fontSize: 'var(--fs-callout)' }, text: 'Photos of worksheets, PDFs or screenshots can live here. They stay on this device.' })
      );
      return block;
    }

    block.appendChild(
      UI.attachmentGrid(items, {
        onRemove: (a) => {
          const next = (rec.attachments || []).filter((x) => x.id !== a.id);
          Store.deleteAttachment(a.id);
          Store.put(collection, Object.assign({}, rec, { attachments: next }));
          UI.toast('Attachment removed.');
          global.Router.handle(true);
        },
      })
    );
    return block;
  }

  function notesBlock(collection, rec) {
    const notes = Store.notesFor(collection, rec.id);
    const block = U.el('div', { style: { marginBottom: '18px' } });
    const head = UI.sectionHead('Notes', { count: notes.length });
    head.appendChild(
      U.el('button', {
        class: 'section__action',
        type: 'button',
        onclick: () => P.openNotes(collection, rec.id),
      }, [U.icon('file', 13), U.el('span', { text: notes.length ? 'Manage' : 'Add' })])
    );
    block.appendChild(head);
    if (!notes.length) {
      block.appendChild(
        U.el('button', {
          class: 'card card--pad card--tap',
          type: 'button',
          style: { width: '100%', textAlign: 'left' },
          onclick: () => P.openNotes(collection, rec.id),
        }, [
          U.el('div', { class: 'row', style: { gap: '10px' } }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-tertiary)' } }, [U.icon('file', 16)]),
            U.el('div', { class: 'grow col' }, [
              U.el('div', { style: { fontWeight: '500' }, text: 'No notes yet' }),
              U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Add text or a checklist to keep with this item.' }),
            ]),
            U.el('span', { class: 'list__chev' }, [U.icon('plus', 16)]),
          ]),
        ])
      );
      return block;
    }
    notes.forEach((n) => {
      const card = U.el('div', { class: 'note-card card--tap', style: { marginBottom: '8px' } });
      card.appendChild(U.el('div', { class: 'note-card__title', text: n.title }));
      if (n.body) card.appendChild(U.el('div', { class: 'note-card__body', text: n.body }));
      if (n.checklist && n.checklist.length) {
        const cl = U.el('div', { style: { marginTop: '8px' } });
        n.checklist.forEach((c, i) => {
          cl.appendChild(
            U.el('div', { class: 'checklist__item' }, [
              U.el('button', {
                class: 'checklist__box' + (c.done ? ' is-done' : ''),
                type: 'button',
                'aria-label': (c.done ? 'Uncheck ' : 'Check ') + c.text,
                onclick: (e) => {
                  e.stopPropagation();
                  n.checklist[i].done = !n.checklist[i].done;
                  Store.put('notes', n);
                  global.Router.handle(true);
                },
              }, [U.icon('check', 12)]),
              U.el('div', { class: 'checklist__text' + (c.done ? ' is-done' : ''), text: c.text }),
            ])
          );
        });
        card.appendChild(cl);
      }
      card.addEventListener('click', () => P.openNotes(collection, rec.id));
      block.appendChild(card);
    });
    return block;
  }

  function remindersSheet(collection, rec) {
    let current = (rec.reminders || []).slice();
    const grid = U.el('div', { class: 'opt-grid opt-grid--2' });
    M.REMINDER_OPTIONS.forEach((r) => {
      const b = U.el('button', {
        class: 'opt',
        type: 'button',
        'aria-pressed': String(current.indexOf(r.value) >= 0),
        text: r.label,
        onclick: () => {
          const on = current.indexOf(r.value) >= 0;
          current = on ? current.filter((v) => v !== r.value) : current.concat([r.value]);
          b.setAttribute('aria-pressed', String(!on));
        },
      });
      grid.appendChild(b);
    });
    const s = UI.sheet({
      title: 'Reminders',
      subtitle: rec.title || rec.name,
      body: [
        grid,
        U.el('div', { class: 'field__hint', text: 'Reminders fire when notifications are switched on in Settings.' }),
      ],
      footer: [
        U.el('button', {
          class: 'btn btn--primary grow',
          type: 'button',
          text: 'Save reminders',
          onclick: () => {
            Store.put(collection, Object.assign({}, rec, { reminders: current }));
            if (global.Notify) global.Notify.reschedule();
            s.close();
            UI.toast(current.length ? 'Reminders updated.' : 'Reminders removed.');
            global.Router.handle(true);
          },
        }),
      ],
    });
  }

  /* ---------------------------- Note detail ---------------------------- */
  function noteDetail(params) {
    const note = Store.byId('notes', params.id);
    const root = U.el('div', { class: 'screen' });
    if (!note) {
      root.appendChild(UI.emptyState({ icon: 'alert', title: 'Note not found', body: 'It may have been deleted.' }));
      return { node: root, title: 'Note', back: true };
    }
    const owner = note.ownerType && note.ownerId ? Store.byId(note.ownerType, note.ownerId) : null;

    root.appendChild(
      U.el('div', { class: 'detail-hero' }, [
        U.el('h1', { class: 'detail-hero__title', text: note.title || 'Note' }),
        U.el('div', { class: 'detail-hero__meta' }, [
          owner
            ? U.el('button', { class: 'chip', type: 'button', onclick: () => global.Router.go('/' + note.ownerType + '/' + note.ownerId) }, [
                U.icon(M.typeMeta(note.ownerType).icon, 12),
                U.el('span', { text: owner.title || owner.name }),
              ])
            : U.el('span', { class: 'badge badge--neutral', text: 'Standalone note' }),
          U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'Updated ' + U.fmtDateStamp(note.updatedAt) }),
        ]),
      ])
    );

    if (note.body) {
      root.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginBottom: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }, text: note.body })
      );
    }

    if (note.checklist && note.checklist.length) {
      const block = U.el('div', { class: 'card card--pad', style: { marginBottom: '16px' } });
      note.checklist.forEach((c, i) => {
        block.appendChild(
          U.el('div', { class: 'checklist__item' }, [
            U.el('button', {
              class: 'checklist__box' + (c.done ? ' is-done' : ''),
              type: 'button',
              'aria-pressed': String(!!c.done),
              'aria-label': (c.done ? 'Uncheck ' : 'Check ') + c.text,
              onclick: () => {
                note.checklist[i].done = !note.checklist[i].done;
                Store.put('notes', note);
                global.Router.handle(true);
              },
            }, [U.icon('check', 12)]),
            U.el('div', { class: 'checklist__text' + (c.done ? ' is-done' : ''), text: c.text }),
          ])
        );
      });
      root.appendChild(block);
    }

    root.appendChild(
      U.el('div', { class: 'action-bar' }, [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', onclick: () => P.editItem('notes', note.id) }, [U.icon('edit', 16), U.el('span', { text: 'Edit' })]),
        U.el('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'Duplicate', onclick: () => { const c = P.duplicateItem('notes', note.id); if (c) global.Router.go('/notes/' + c.id); } }, [U.icon('copy', 16)]),
        U.el('button', {
          class: 'btn btn--danger',
          type: 'button',
          'aria-label': 'Delete',
          onclick: async () => {
            const ok = await P.deleteItem('notes', note.id);
            if (ok) global.Router.back();
          },
        }, [U.icon('trash', 16)]),
      ])
    );

    return { node: root, title: 'Note', back: true, actions: [{ icon: 'edit', label: 'Edit note', onClick: () => P.editItem('notes', note.id) }] };
  }

  global.Screens = global.Screens || {};
  global.Screens.detail = detail;
  global.Screens.noteDetail = noteDetail;
})(window);
