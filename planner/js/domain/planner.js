/* ==========================================================================
   planner.js — domain actions shared by every screen:
   create / edit / duplicate / delete / reschedule, quick-add menu,
   item action sheets, notes, study-plan generation, timetable helpers.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;

  /* ---------------------------- Create / edit --------------------------- */
  function createItem(collection, prefill, opts) {
    const o = opts || {};
    const schema = M.SCHEMAS[collection];
    if (!schema) return Promise.resolve(null);
    const patch = Object.assign({}, prefill || {});
    // Sensible defaults from settings when the caller didn't specify.
    if (!patch.reminders && schema.fields.some((f) => f.key === 'reminders')) {
      const def = Store.getSetting('defaultReminder', 1440);
      patch.reminders = def === null ? [] : [def];
    }
    return UI.openForm({
      collection,
      title: o.title || 'New ' + schema.singular.toLowerCase(),
      values: M.create(collection, patch),
      isNew: true,
      onDelete: null,
      onSubmit: (values, initial) => {
        // Prefill supplies defaults only — anything the student typed wins.
        const rec = Store.put(collection, Object.assign({}, initial, patch, values));
        afterCreate(collection, rec);
        return rec;
      },
    });
  }

  function afterCreate(collection, rec) {
    if (!rec) return;
    U.haptic(6);
    const label = M.SCHEMAS[collection] ? M.SCHEMAS[collection].singular.toLowerCase() : 'item';
    UI.toast(capitalise(label) + ' added.');
    if (global.Notify) global.Notify.reschedule();
    Store.emit('created', { collection, record: rec });
  }

  function editItem(collection, id) {
    const rec = Store.byId(collection, id);
    if (!rec) {
      UI.toast('That item no longer exists.');
      return Promise.resolve(null);
    }
    const schema = M.SCHEMAS[collection];
    return UI.openForm({
      collection,
      title: 'Edit ' + (schema ? schema.singular.toLowerCase() : 'item'),
      values: rec,
      onDelete: (values) => deleteItem(collection, values.id, { from: 'form' }),
      onSubmit: (values) => {
        const updated = Store.put(collection, Object.assign({}, rec, values));
        UI.toast('Changes saved.');
        if (global.Notify) global.Notify.reschedule();
        return updated;
      },
    });
  }

  /* ------------------------------- Delete ------------------------------- */
  async function deleteItem(collection, id, opts) {
    const o = opts || {};
    const rec = Store.byId(collection, id);
    if (!rec) return false;

    // Cascade-awareness: projects own subtasks, everything owns notes.
    let extra = '';
    if (collection === 'projects') {
      const subs = Store.projectTasks(id);
      if (subs.length) extra = subs.length + ' subtask' + (subs.length === 1 ? '' : 's') + ' will be removed with it.';
    }
    if (collection === 'subjects') {
      const n = ['homework', 'tasks', 'projects', 'exams', 'events'].reduce((acc, c) => acc + Store.list(c).filter((r) => r.subjectId === id).length, 0);
      if (n) extra = n + ' item' + (n === 1 ? '' : 's') + ' will keep their data but lose this subject.';
    }

    if (o.skipConfirm !== true) {
      const ok = await UI.confirm({
        title: 'Delete “' + (rec.title || rec.name || 'this item') + '”?',
        message: 'This cannot be undone.',
        detail: extra,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return false;
    }

    const snapshot = JSON.parse(JSON.stringify(rec));
    const removedTasks = collection === 'projects' ? Store.projectTasks(id).map((t) => JSON.parse(JSON.stringify(t))) : [];

    if (collection === 'projects') removedTasks.forEach((t) => Store.remove('tasks', t.id));
    if (collection === 'subjects') {
      ['homework', 'tasks', 'projects', 'exams', 'events'].forEach((c) => {
        Store.list(c).forEach((r) => {
          if (r.subjectId === id) Store.put(c, Object.assign({}, r, { subjectId: null }));
        });
      });
    }
    Store.notesFor(collection, id).forEach((n) => Store.remove('notes', n.id));
    Store.remove(collection, id);
    Store.flush();

    UI.toast('Deleted.', {
      actionLabel: 'Undo',
      onAction: () => {
        const restored = Store.put(collection, snapshot);
        removedTasks.forEach((t) => Store.put('tasks', t));
        UI.toast('Restored.');
        return restored;
      },
      duration: 7000,
    });
    if (global.Notify) global.Notify.reschedule();
    return true;
  }

  /* ----------------------------- Duplicate ------------------------------ */
  function duplicateItem(collection, id) {
    const rec = Store.byId(collection, id);
    if (!rec) return null;
    const copy = M.cloneRecord(collection, rec);
    const created = Store.put(collection, copy);
    if (collection === 'projects') {
      Store.projectTasks(id).forEach((t) => {
        Store.put('tasks', Object.assign(M.cloneRecord('tasks', t), { projectId: created.id }));
      });
    }
    UI.toast('Duplicated.');
    return created;
  }

  /* ---------------------------- Reschedule ------------------------------ */
  /** Move an item's deadline. Recomputes overdue status immediately (derived). */
  function reschedule(collection, id, dateISO, timeHM) {
    const rec = Store.byId(collection, id);
    if (!rec) return null;
    const df = M.DATE_FIELD[collection];
    if (!df) return null;
    if (!U.isValidISO(dateISO)) {
      UI.toast('That date is not valid.');
      return null;
    }
    const patch = {};
    patch[df] = dateISO;
    if (timeHM) {
      const tf = M.TIME_FIELD[collection];
      if (tf) patch[tf] = timeHM;
    }
    const updated = Store.put(collection, Object.assign({}, rec, patch));
    UI.toast('Moved to ' + U.fmtDateRelative(dateISO) + '.', {
      actionLabel: 'Undo',
      onAction: () => Store.put(collection, Object.assign({}, rec, { [df]: rec[df] })),
    });
    if (global.Notify) global.Notify.reschedule();
    return updated;
  }

  function rescheduleSheet(collection, id) {
    const rec = Store.byId(collection, id);
    if (!rec) return;
    const df = M.DATE_FIELD[collection];
    const tf = M.TIME_FIELD[collection];
    const dateInput = U.el('input', { class: 'input', type: 'date', value: rec[df] || U.todayISO() });
    const timeInput = U.el('input', { class: 'input', type: 'time', value: (tf && rec[tf]) || '' });
    const quick = U.el('div', { class: 'opt-grid opt-grid--2', style: { marginBottom: '14px' } });
    const s = UI.sheet({
      title: 'Reschedule',
      subtitle: rec.title || rec.name,
      body: [
        quick,
        U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'New date' }), dateInput]),
        tf ? U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Time' }), timeInput]) : null,
      ],
      footer: [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
        U.el('button', {
          class: 'btn btn--primary grow',
          type: 'button',
          text: 'Move',
          onclick: () => {
            reschedule(collection, id, dateInput.value, timeInput.value);
            s.close();
          },
        }),
      ],
    });
    [
      { label: 'Today', days: 0 },
      { label: 'Tomorrow', days: 1 },
      { label: '+2 days', days: 2 },
      { label: 'Next week', days: 7 },
    ].forEach((q) => {
      quick.appendChild(
        U.el('button', {
          class: 'opt',
          type: 'button',
          text: q.label,
          onclick: () => {
            dateInput.value = U.toISO(U.addDays(new Date(), q.days));
            U.$$('.opt', quick).forEach((n) => n.setAttribute('aria-pressed', 'false'));
          },
        })
      );
    });
  }

  function snoozeTomorrow(collection, id) {
    const rec = Store.byId(collection, id);
    if (!rec) return;
    const df = M.DATE_FIELD[collection];
    const base = rec[df] && rec[df] > U.todayISO() ? U.parseISO(rec[df]) : new Date();
    reschedule(collection, id, U.toISO(U.addDays(base, 1)));
  }

  /* --------------------------- Action sheet ----------------------------- */
  /** The "..." menu for any item: edit, complete, duplicate, reschedule, delete, notes. */
  function itemActions(collection, id) {
    const rec = Store.byId(collection, id);
    if (!rec) return;
    const done = M.isCompleted(collection, rec);
    const schema = M.SCHEMAS[collection];
    const canReschedule = !!M.DATE_FIELD[collection];

    const s = UI.sheet({
      title: rec.title || rec.name,
      subtitle: (schema ? schema.label : '') + (rec.subjectId && Store.byId('subjects', rec.subjectId) ? ' · ' + Store.byId('subjects', rec.subjectId).name : ''),
      body: [
        U.el('div', { class: 'list list--plain' }, [
          action('Edit', 'edit', () => {
            s.close();
            editItem(collection, id);
          }),
          action(done ? 'Mark as not done' : 'Mark as completed', done ? 'refresh' : 'checkCircle', () => {
            s.close();
            UI.toggleComplete(collection, id);
          }),
          canReschedule
            ? action('Reschedule', 'clock', () => {
                s.close();
                rescheduleSheet(collection, id);
              })
            : null,
          action('Duplicate', 'copy', () => {
            s.close();
            duplicateItem(collection, id);
          }),
          action('Notes', 'file', () => {
            s.close();
            openNotes(collection, id);
          }),
          collection === 'projects'
            ? action('Add subtask', 'plus', () => {
                s.close();
                addSubtask(collection, id);
              })
            : null,
          collection === 'exams'
            ? action('Create study plan', 'sparkles', () => {
                s.close();
                studyPlanSheet({ type: 'exams', id });
              })
            : null,
          collection === 'projects'
            ? action('Create study plan', 'sparkles', () => {
                s.close();
                studyPlanSheet({ type: 'projects', id });
              })
            : null,
          action('Delete', 'trash', () => {
            s.close();
            deleteItem(collection, id);
          }, 'danger'),
        ]),
      ],
    });

    function action(label, icon, onClick, tone) {
      return U.el('button', {
        class: 'list__row',
        type: 'button',
        onclick: onClick,
        style: tone === 'danger' ? { color: 'var(--danger)' } : null,
      }, [
        U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: tone === 'danger' ? 'var(--danger)' : 'var(--text-secondary)' } }, [U.icon(icon, 17)]),
        U.el('span', { class: 'list__label grow', text: label }),
      ]);
    }
  }

  /* ------------------------------ Quick add ----------------------------- */
  /** The + button: pick a type. `dateISO` pre-fills the date. */
  function quickAdd(dateISO) {
    const date = dateISO || U.todayISO();
    const s = UI.sheet({
      title: 'Add to your planner',
      subtitle: date === U.todayISO() ? 'Today' : U.fmtDateLong(date),
      body: [
        U.el('div', { class: 'list list--plain' }, [
          addRow('Homework', 'book', 't-homework', () => createItem('homework', { dueDate: date })),
          addRow('Task', 'checkCircle', 't-task', () => createItem('tasks', { dueDate: date })),
          addRow('Exam', 'clipboard', 't-exam', () => createItem('exams', { date })),
          addRow('Event', 'calendar', 't-event', () => createItem('events', { date })),
          addRow('Project', 'folder', 't-project', () => createItem('projects', { dueDate: date })),
          addRow('Note', 'file', 't-note', () => createItem('notes', {})),
        ]),
      ],
    });
    function addRow(label, icon, chip, onClick) {
      return U.el('button', {
        class: 'list__row',
        type: 'button',
        onclick: () => {
          s.close();
          onClick();
        },
      }, [
        U.el('span', { class: 'list__icon ' + chip }, [U.icon(icon, 18)]),
        U.el('span', { class: 'list__label grow', text: label }),
        U.el('span', { class: 'list__chev' }, [U.icon('plus', 16)]),
      ]);
    }
  }

  /* ------------------------------- Notes -------------------------------- */
  function openNotes(ownerType, ownerId, opts) {
    const o = opts || {};
    const owner = Store.byId(ownerType, ownerId);
    const existing = Store.notesFor(ownerType, ownerId);
    const listWrap = U.el('div', { class: 'stack-3' });

    function paint() {
      U.clear(listWrap);
      const notes = Store.notesFor(ownerType, ownerId);
      if (!notes.length) {
        listWrap.appendChild(
          UI.emptyState({
            icon: 'file',
            title: 'No notes yet',
            body: 'Keep formulas, reminders or a checklist with this item.',
            actions: [U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Write a note', onclick: () => newNote() })],
          })
        );
        return;
      }
      notes.forEach((n) => {
        const card = U.el('div', { class: 'note-card' });
        card.appendChild(
          U.el('div', { class: 'row row--between' }, [
            U.el('div', { class: 'note-card__title grow', text: n.title || 'Note' }),
            U.el('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': 'Edit note', onclick: () => editNote(n) }, [U.icon('edit', 16)]),
            U.el('button', {
              class: 'icon-btn icon-btn--sm',
              type: 'button',
              'aria-label': 'Delete note',
              onclick: async () => {
                const ok = await UI.confirm({ title: 'Delete this note?', confirmLabel: 'Delete', danger: true, message: n.title || 'Note' });
                if (ok) {
                  Store.remove('notes', n.id);
                  paint();
                }
              },
            }, [U.icon('trash', 16)]),
          ])
        );
        if (n.body) card.appendChild(U.el('div', { class: 'note-card__body', text: n.body }));
        if (n.checklist && n.checklist.length) {
          const cl = U.el('div', { style: { marginTop: '8px' } });
          n.checklist.forEach((c, i) => {
            cl.appendChild(
              U.el('div', { class: 'checklist__item' }, [
                U.el('button', {
                  class: 'checklist__box' + (c.done ? ' is-done' : ''),
                  type: 'button',
                  'aria-pressed': String(!!c.done),
                  'aria-label': (c.done ? 'Uncheck ' : 'Check ') + c.text,
                  onclick: () => {
                    n.checklist[i].done = !n.checklist[i].done;
                    Store.put('notes', n);
                    paint();
                  },
                }, [U.icon('check', 12)]),
                U.el('div', { class: 'checklist__text' + (c.done ? ' is-done' : ''), text: c.text }),
              ])
            );
          });
          card.appendChild(cl);
        }
        card.appendChild(U.el('div', { class: 'note-card__foot', text: 'Updated ' + U.fmtDateStamp(n.updatedAt) }));
        listWrap.appendChild(card);
      });
    }

    function newNote() {
      UI.openForm({
        collection: 'notes',
        title: 'New note',
        values: M.create('notes', { ownerType, ownerId }),
        isNew: true,
        onSubmit: (values, initial) => {
          const rec = Store.put('notes', Object.assign({}, initial, values, { ownerType, ownerId }));
          paint();
          UI.toast('Note saved.');
          return rec;
        },
      });
    }

    function editNote(n) {
      UI.openForm({
        collection: 'notes',
        title: 'Edit note',
        values: n,
        onDelete: () => {
          Store.remove('notes', n.id);
          paint();
        },
        onSubmit: (values) => {
          const rec = Store.put('notes', Object.assign({}, n, values));
          paint();
          UI.toast('Note saved.');
          return rec;
        },
      });
    }

    paint();
    const s = UI.sheet({
      title: 'Notes',
      subtitle: owner ? owner.title || owner.name : '',
      body: [
        U.el('button', { class: 'btn btn--secondary btn--block', type: 'button', text: 'New note', onclick: newNote, style: { marginBottom: '16px' } }),
        listWrap,
      ],
    });
    return s;
  }

  /* ------------------------------ Subtasks ------------------------------ */
  function addSubtask(projectCollectionOrId, id) {
    const projectId = arguments.length > 1 ? arguments[1] : arguments[0];
    const project = Store.byId('projects', projectId);
    if (!project) return;
    return UI.openForm({
      collection: 'tasks',
      title: 'New subtask',
      values: M.create('tasks', {
        projectId,
        subjectId: project.subjectId || null,
        category: 'project',
        dueDate: project.dueDate || U.todayISO(),
        reminders: [],
      }),
      isNew: true,
      onSubmit: (values, initial) => {
        const rec = Store.put('tasks', Object.assign({}, initial, values, { projectId }));
        UI.toast('Subtask added.');
        return rec;
      },
    });
  }

  /* --------------------------- Study planner ---------------------------- */
  /**
   * Build a study plan for an exam or project from real inputs:
   * deadline, days available, workload (topics or remaining subtasks),
   * and the student's own schedule (classes are avoided when possible).
   */
  function buildStudyPlan(source) {
    const isExam = source.type === 'exams';
    const rec = Store.byId(source.type, source.id);
    if (!rec) return { ok: false, message: 'That item no longer exists.' };
    const deadline = M.deadlineOf(source.type, rec);
    if (!deadline) return { ok: false, message: 'Add a due date first — a study plan needs a deadline.' };

    const today = U.todayISO();
    const totalDays = U.diffDays(today, deadline);
    if (totalDays < 0) return { ok: false, message: 'That deadline has already passed.' };

    // Workload: exam topics, else project subtasks still open, else a default.
    let units = [];
    if (isExam) {
      units = (rec.topics || []).slice();
      if (!units.length) units = [rec.title || 'Full review'];
    } else {
      units = Store.projectTasks(rec.id)
        .filter((t) => !t.completed)
        .map((t) => t.title);
      if (!units.length) units = [rec.title || 'Work on project'];
    }

    // Available days: tomorrow .. day before deadline (deadline itself is reserved),
    // skipping days with 4+ existing school items when there is room to skip.
    const days = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = U.toISO(U.addDays(new Date(), i));
      days.push(d);
    }
    let studyDays = days.filter((d) => d < deadline);
    if (!studyDays.length) studyDays = [today];
    if (studyDays.length > 1) {
      const relaxed = studyDays.filter((d) => {
        const count = ['homework', 'tasks', 'exams', 'events'].reduce(
          (acc, c) => acc + Store.list(c).filter((r) => M.deadlineOf(c, r) === d && !M.isCompleted(c, r)).length,
          0
        );
        return count < 4;
      });
      if (relaxed.length >= Math.min(2, studyDays.length)) studyDays = relaxed;
    }

    // Plan shape: fill topics across days; last day is a review, the one before
    // is practice, when there is room for it.
    const perDay = [];
    const n = studyDays.length;
    const topicsPerDay = Math.max(1, Math.ceil(units.length / Math.max(1, n - (n > 2 ? 2 : 0))));
    let cursor = 0;
    studyDays.forEach((day, idx) => {
      const remainingDays = n - idx;
      let titles = [];
      if (remainingDays === 1) {
        titles = [isExam ? 'Final review before ' + (rec.title || 'exam') : 'Final check before submission'];
      } else if (remainingDays === 2 && units.length > 2 && cursor < units.length) {
        titles = ['Practice questions', 'Review mistakes'];
      } else {
        while (titles.length < topicsPerDay && cursor < units.length) {
          titles.push(isExam ? 'Study: ' + units[cursor] : units[cursor]);
          cursor++;
        }
        if (!titles.length) titles = [isExam ? 'Review: ' + units[units.length - 1] : 'Continue ' + (rec.title || 'project')];
      }
      const base = Math.round(45 + titles.length * 10);
      perDay.push({
        date: day,
        title: titles.join(' + '),
        minutes: U.clamp(base, 25, 180),
        subjectId: rec.subjectId || null,
        sourceId: rec.id,
        sourceType: source.type,
      });
    });

    return { ok: true, plan: perDay, source: rec, type: source.type };
  }

  /** Preview + edit + commit the generated plan. */
  function studyPlanSheet(source) {
    const built = buildStudyPlan(source);
    if (!built.ok) {
      UI.toast(built.message);
      return;
    }
    let rows = built.plan.slice();
    const listWrap = U.el('div', { class: 'stack-2' });

    function paint() {
      U.clear(listWrap);
      rows.forEach((r, i) => {
        const dateInput = U.el('input', { class: 'input', type: 'date', value: r.date, 'aria-label': 'Session date' });
        dateInput.addEventListener('change', () => {
          if (!U.isValidISO(dateInput.value)) {
            UI.toast('That date is not valid.');
            dateInput.value = r.date;
            return;
          }
          rows[i].date = dateInput.value;
        });
        const minsSelect = U.el('select', { class: 'select', 'aria-label': 'Session length' });
        [20, 30, 45, 60, 90, 120].forEach((m) =>
          minsSelect.appendChild(U.el('option', { value: m, text: U.fmtDuration(m), selected: Number(r.minutes) === m }))
        );
        minsSelect.addEventListener('change', () => (rows[i].minutes = Number(minsSelect.value)));

        listWrap.appendChild(
          U.el('div', { class: 'card card--pad', style: { padding: '12px' } }, [
            U.el('div', { class: 'row row--between', style: { marginBottom: '8px' } }, [
              U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
                U.el('div', { style: { fontWeight: '600' }, text: r.title }),
                U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: U.fmtDateRelative(r.date) }),
              ]),
              U.el('button', {
                class: 'icon-btn icon-btn--sm',
                type: 'button',
                'aria-label': 'Remove session',
                onclick: () => {
                  rows.splice(i, 1);
                  paint();
                },
              }, [U.icon('x', 16)]),
            ]),
            U.el('div', { class: 'field-row' }, [dateInput, minsSelect]),
          ])
        );
      });
      if (!rows.length) listWrap.appendChild(U.el('div', { class: 'text-tertiary', text: 'No sessions left — add one below or cancel.' }));
      listWrap.appendChild(
        U.el('button', {
          class: 'btn btn--secondary btn--block',
          type: 'button',
          style: { marginTop: '8px' },
          onclick: () => {
            rows.push({ date: U.todayISO(), title: 'Study session', minutes: 45, subjectId: built.source.subjectId || null });
            paint();
          },
        }, [U.icon('plus', 15), U.el('span', { text: 'Add session' })])
      );
    }
    paint();

    const s = UI.sheet({
      title: 'Study plan',
      subtitle: built.source.title || built.source.name,
      size: 'tall',
      body: [
        U.el('p', { class: 'text-secondary', style: { marginBottom: '14px', lineHeight: '1.55' }, text: 'Built from your deadline and workload. Edit anything before adding it.' }),
        listWrap,
      ],
      footer: [
        U.el('button', { class: 'btn btn--secondary grow', type: 'button', text: 'Cancel', onclick: () => s.close() }),
        U.el('button', {
          class: 'btn btn--primary grow',
          type: 'button',
          text: 'Add to planner',
          onclick: () => {
            if (!rows.length) {
              UI.toast('Add at least one session.');
              return;
            }
            const created = rows.map((r) =>
              Store.put(
                'tasks',
                M.create('tasks', {
                  title: r.title,
                  dueDate: r.date,
                  dueTime: Store.profile().endTime || '17:00',
                  estMinutes: r.minutes,
                  category: 'study',
                  subjectId: r.subjectId,
                  priority: 'high',
                  examId: built.type === 'exams' ? built.source.id : null,
                  projectId: built.type === 'projects' ? built.source.id : null,
                  reminders: [Store.getSetting('defaultReminder', 1440)].filter((x) => x !== null),
                  source: 'study-plan',
                })
              )
            );
            s.close();
            UI.toast(created.length + ' study session' + (created.length === 1 ? '' : 's') + ' added to your calendar.');
            if (global.Notify) global.Notify.reschedule();
            Store.emit('study-plan-created', { source: built.source, count: created.length });
            if (global.Router && built.type === 'exams') global.Router.go('/exams/' + built.source.id);
          },
        }),
      ],
    });
  }

  /* ------------------------------ Subjects ------------------------------ */
  function subjectHead(subject, opts) {
    const o = opts || {};
    const head = U.el('div', { class: 'subject-head' }, [
      U.el('div', { class: 'subject-head__swatch', style: { background: subject.color } }, [U.icon(subject.icon || 'book', 20)]),
      U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
        U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-headline)' }, text: subject.name }),
        U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: [subject.teacher, subject.room].filter(Boolean).join(' · ') || 'No teacher set' }),
      ]),
      o.trail || null,
    ]);
    return head;
  }

  /* ------------------------------ Timetable ----------------------------- */
  function todayClasses() {
    const day = new Date().getDay();
    return Store.list('timetable')
      .filter((c) => Number(c.day) === day)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  }

  function classesForDay(day) {
    return Store.list('timetable')
      .filter((c) => Number(c.day) === Number(day))
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  }

  function addClass(day, prefill) {
    return UI.openForm({
      collection: 'timetable',
      title: 'New class',
      values: M.create('timetable', Object.assign({ day: day === undefined ? new Date().getDay() : day }, prefill || {})),
      onSubmit: (values, initial) => {
        const rec = Store.put('timetable', Object.assign({}, initial, values));
        UI.toast('Class added to your timetable.');
        return rec;
      },
    });
  }

  /* ------------------------------ Helpers ------------------------------- */
  function capitalise(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function subjectMap() {
    const map = {};
    Store.list('subjects').forEach((s) => (map[s.id] = s));
    return map;
  }

  function subjectColor(subjectId) {
    const s = subjectId ? Store.byId('subjects', subjectId) : null;
    return s ? s.color : 'var(--text-tertiary)';
  }

  /** Title for any record, used in headers and toasts. */
  function titleOf(rec) {
    return rec ? rec.title || rec.name || 'Untitled' : '';
  }

  /** The "route" for a record, used by search results and notifications. */
  function routeFor(collection, id) {
    return '/' + collection + '/' + id;
  }

  global.Planner = {
    createItem, editItem, deleteItem, duplicateItem,
    reschedule, rescheduleSheet, snoozeTomorrow, itemActions, quickAdd,
    openNotes, addSubtask, buildStudyPlan, studyPlanSheet,
    subjectHead, todayClasses, classesForDay, addClass,
    subjectMap, subjectColor, titleOf, routeFor, capitalise,
  };
})(window);
