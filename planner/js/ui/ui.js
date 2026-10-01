/* ==========================================================================
   ui.js — UI kit: toasts, sheets, confirm, form engine, rows, states, theme.
   Everything visual that is reused across screens lives here.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;

  const sheetStack = [];
  let toastHost = null;
  let modalDepth = 0;

  /* ------------------------------ Hosts -------------------------------- */
  function host() {
    if (!toastHost || !document.body.contains(toastHost)) {
      toastHost = U.el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  /* ------------------------------ Toasts ------------------------------- */
  function toast(message, opts) {
    const o = opts || {};
    const node = U.el('div', { class: 'toast' }, [
      U.el('span', { class: 'grow', text: message }),
      o.actionLabel
        ? U.el('button', {
            class: 'toast__action',
            type: 'button',
            text: o.actionLabel,
            onclick: () => {
              close();
              if (o.onAction) o.onAction();
            },
          })
        : null,
      U.el('button', {
        class: 'icon-btn icon-btn--sm',
        type: 'button',
        'aria-label': 'Dismiss',
        style: { color: 'inherit', width: '26px', height: '26px' },
        onclick: () => close(),
      }, [U.icon('x', 15)]),
    ]);
    host().appendChild(node);

    let closed = false;
    let timer = setTimeout(close, o.duration || (o.actionLabel ? 6000 : 2600));

    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      node.classList.add('is-closing');
      setTimeout(() => node.remove(), 220);
    }

    if (o.onAction) {
      node.addEventListener('mouseenter', () => clearTimeout(timer));
      node.addEventListener('mouseleave', () => {
        timer = setTimeout(close, 3000);
      });
    }
    return { close };
  }

  /* ------------------------------ Sheets ------------------------------- */
  /**
   * UI.sheet({ title, subtitle, body, footer, onClose, size, dismissible })
   * Returns { root, close, setTitle }.
   */
  function sheet(opts) {
    const o = opts || {};
    const dismissible = o.dismissible !== false;

    const backdrop = U.el('div', { class: 'sheet-backdrop' });
    const sheetEl = U.el('div', {
      class: 'sheet',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': o.title || 'Dialog',
      style: o.size === 'tall' ? { maxHeight: '96dvh' } : null,
    });

    const head = o.title
      ? U.el('div', { class: 'sheet__head' }, [
          o.titleIcon ? U.el('span', { class: 'text-tertiary' }, [U.icon(o.titleIcon, 18)]) : null,
          U.el('div', { class: 'grow col' }, [
            U.el('div', { class: 'sheet__title', text: o.title }),
            o.subtitle ? U.el('div', { class: 'app-header__sub', text: o.subtitle }) : null,
          ]),
          U.el('button', {
            class: 'icon-btn',
            type: 'button',
            'aria-label': 'Close',
            onclick: () => close(),
          }, [U.icon('x', 20)]),
        ])
      : null;

    const body = U.el('div', { class: 'sheet__body' });
    U.appendChildren(body, o.body);

    const footer = o.footer ? U.el('div', { class: 'sheet__foot' }, o.footer) : null;

    sheetEl.appendChild(U.el('div', { class: 'sheet__grabber' }, [U.el('span')]));
    if (head) sheetEl.appendChild(head);
    sheetEl.appendChild(body);
    if (footer) sheetEl.appendChild(footer);

    document.body.appendChild(backdrop);
    document.body.appendChild(sheetEl);

    const entry = { backdrop, sheetEl, onClose: o.onClose, restoreFocus: document.activeElement };
    sheetStack.push(entry);
    modalDepth++;
    document.body.style.overflow = 'hidden';

    backdrop.addEventListener('click', () => {
      if (dismissible) close();
    });

    function onKey(e) {
      if (e.key === 'Escape' && dismissible && sheetStack[sheetStack.length - 1] === entry) {
        e.preventDefault();
        close();
      }
      if (e.key === 'Tab') trapFocus(e, sheetEl);
    }
    document.addEventListener('keydown', onKey);

    // Swipe-down to dismiss on touch (grabber area only, so scrolling still works)
    let startY = null;
    const grabber = sheetEl.querySelector('.sheet__grabber');
    if (grabber && dismissible) {
      grabber.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });
      grabber.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) sheetEl.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      grabber.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - (startY || 0);
        sheetEl.style.transform = '';
        startY = null;
        if (dy > 90) close();
      });
    }

    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      sheetEl.classList.add('is-closing');
      backdrop.classList.add('is-closing');
      const idx = sheetStack.indexOf(entry);
      if (idx >= 0) sheetStack.splice(idx, 1);
      modalDepth = Math.max(0, modalDepth - 1);
      if (!modalDepth) document.body.style.overflow = '';
      setTimeout(() => {
        sheetEl.remove();
        backdrop.remove();
      }, 220);
      try {
        if (entry.restoreFocus && entry.restoreFocus.focus) entry.restoreFocus.focus();
      } catch (e) {}
      if (o.onClose) o.onClose(result);
    }

    const autofocus = o.autofocus !== false ? body.querySelector('[data-autofocus]') || body.querySelector('input,textarea,select,button') : null;
    if (autofocus) {
      setTimeout(() => {
        try {
          autofocus.focus({ preventScroll: true });
          if (autofocus.setSelectionRange && autofocus.value) autofocus.setSelectionRange(autofocus.value.length, autofocus.value.length);
        } catch (e) {}
      }, 120);
    }

    return {
      root: sheetEl,
      body,
      footer,
      close,
      setTitle(t) {
        const t1 = sheetEl.querySelector('.sheet__title');
        if (t1) t1.textContent = t;
      },
      replaceBody(content) {
        U.clear(body);
        U.appendChildren(body, content);
      },
    };
  }

  function trapFocus(e, container) {
    const focusables = U.$$(
      'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      container
    ).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------- Confirm -------------------------------- */
  function confirm(opts) {
    const o = typeof opts === 'string' ? { message: opts } : opts || {};
    return new Promise((resolve) => {
      let answered = false;
      const s = sheet({
        title: o.title || 'Are you sure?',
        dismissible: true,
        body: [
          U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55' }, text: o.message || '' }),
          o.detail ? U.el('p', { class: 'text-tertiary', style: { marginTop: '10px', fontSize: 'var(--fs-callout)' }, text: o.detail }) : null,
        ],
        footer: [
          U.el('button', {
            class: 'btn btn--secondary grow',
            type: 'button',
            text: o.cancelLabel || 'Cancel',
            onclick: () => {
              answered = true;
              s.close();
              resolve(false);
            },
          }),
          U.el('button', {
            class: 'btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + ' grow',
            type: 'button',
            text: o.confirmLabel || 'Confirm',
            onclick: () => {
              answered = true;
              s.close();
              resolve(true);
            },
          }),
        ],
        onClose: () => {
          if (!answered) resolve(false);
        },
      });
      setTimeout(() => {
        const btn = s.root.querySelector('.sheet__foot .btn:last-child');
        if (btn) btn.focus();
      }, 140);
    });
  }

  /** Text prompt sheet. Resolves to string or null. */
  function prompt(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let answered = false;
      const input = U.el('input', {
        class: 'input',
        type: o.type || 'text',
        value: o.value || '',
        placeholder: o.placeholder || '',
        'aria-label': o.title || 'Input',
        'data-autofocus': 'true',
      });
      const s = sheet({
        title: o.title || 'Enter a value',
        body: [
          o.message ? U.el('p', { class: 'text-secondary', style: { marginBottom: '12px' }, text: o.message }) : null,
          U.el('div', { class: 'field' }, [input, o.hint ? U.el('div', { class: 'field__hint', text: o.hint }) : null]),
        ],
        footer: [
          U.el('button', {
            class: 'btn btn--secondary grow',
            type: 'button',
            text: 'Cancel',
            onclick: () => {
              answered = true;
              s.close();
              resolve(null);
            },
          }),
          U.el('button', {
            class: 'btn btn--primary grow',
            type: 'button',
            text: o.confirmLabel || 'Save',
            onclick: submit,
          }),
        ],
        onClose: () => {
          if (!answered) resolve(null);
        },
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });
      function submit() {
        const v = input.value.trim();
        if (o.required && !v) {
          input.classList.add('is-invalid');
          input.style.borderColor = 'var(--danger)';
          input.focus();
          return;
        }
        answered = true;
        s.close();
        resolve(v);
      }
    });
  }

  /* -------------------------- Field rendering --------------------------- */
  /**
   * Each field renderer returns { node, get(), set(v), focus(), validate() }
   */
  function renderField(field, value, ctx) {
    const wrap = U.el('div', { class: 'field', dataset: { field: field.key } });
    const label = U.el('label', { class: 'field__label', for: 'f_' + field.key, text: field.label });
    wrap.appendChild(label);

    const err = U.el('div', { class: 'field__error hidden' });
    let control;
    let api;

    switch (field.type) {
      case 'textarea': {
        const ta = U.el('textarea', {
          class: 'textarea',
          id: 'f_' + field.key,
          placeholder: field.placeholder || '',
          rows: 4,
        });
        ta.value = value == null ? '' : String(value);
        control = ta;
        api = {
          get: () => ta.value.trim(),
          set: (v) => (ta.value = v == null ? '' : String(v)),
          focus: () => ta.focus(),
        };
        break;
      }
      case 'select': {
        const sel = U.el('select', { class: 'select', id: 'f_' + field.key });
        (field.options || []).forEach((o) => {
          sel.appendChild(U.el('option', { value: o.value, text: o.label, selected: String(o.value) === String(value) }));
        });
        if (value !== undefined && value !== null && value !== '') sel.value = String(value);
        control = sel;
        api = {
          get: () => sel.value,
          set: (v) => (sel.value = v),
          focus: () => sel.focus(),
        };
        break;
      }
      case 'date': {
        const inp = U.el('input', { class: 'input', type: 'date', id: 'f_' + field.key, value: value || U.todayISO() });
        const quick = U.el('div', { class: 'chip-row chip-row--padless', style: { marginTop: '8px' } });
        [
          { label: 'Today', days: 0 },
          { label: 'Tomorrow', days: 1 },
          { label: 'Next week', days: 7 },
        ].forEach((q) => {
          quick.appendChild(
            U.el('button', {
              class: 'chip',
              type: 'button',
              text: q.label,
              onclick: () => {
                inp.value = U.toISO(U.addDays(new Date(), q.days));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
              },
            })
          );
        });
        control = U.el('div', {}, [inp, quick]);
        api = {
          get: () => inp.value,
          set: (v) => (inp.value = v || ''),
          focus: () => inp.focus(),
          validate: () => {
            if (!field.required) return true;
            if (!inp.value) return 'Please pick a date.';
            if (!U.isValidISO(inp.value)) return 'That date is not valid.';
            return true;
          },
        };
        break;
      }
      case 'time': {
        const inp = U.el('input', { class: 'input', type: 'time', id: 'f_' + field.key, value: value || '' });
        control = inp;
        api = {
          get: () => inp.value,
          set: (v) => (inp.value = v || ''),
          focus: () => inp.focus(),
        };
        break;
      }
      case 'number': {
        const inp = U.el('input', { class: 'input', type: 'number', id: 'f_' + field.key, value: value == null ? '' : value, min: field.min, max: field.max, step: field.step || 1, inputmode: 'numeric' });
        control = inp;
        api = {
          get: () => (inp.value === '' ? null : Number(inp.value)),
          set: (v) => (inp.value = v == null ? '' : v),
          focus: () => inp.focus(),
        };
        break;
      }
      case 'duration': {
        const opts = [0, 15, 30, 45, 60, 90, 120, 180, 240, 300];
        const grid = U.el('div', { class: 'opt-grid opt-grid--3' });
        let current = Number(value) || 0;
        opts.forEach((mins) => {
          const b = U.el('button', {
            class: 'opt',
            type: 'button',
            'aria-pressed': String(current === mins),
            text: mins === 0 ? 'None' : U.fmtDuration(mins),
            onclick: () => {
              current = mins;
              U.$$('.opt', grid).forEach((n) => n.setAttribute('aria-pressed', 'false'));
              b.setAttribute('aria-pressed', 'true');
            },
          });
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = Number(v) || 0), focus: () => {} };
        break;
      }
      case 'priority': {
        const grid = U.el('div', { class: 'opt-grid opt-grid--4' });
        let current = value || 'medium';
        M.PRIORITIES.forEach((p) => {
          const b = U.el('button', {
            class: 'opt',
            type: 'button',
            'aria-pressed': String(current === p.value),
            onclick: () => {
              current = p.value;
              U.$$('.opt', grid).forEach((n) => n.setAttribute('aria-pressed', 'false'));
              b.setAttribute('aria-pressed', 'true');
            },
          }, [U.icon(p.icon, 14), U.el('span', { text: p.label })]);
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = v), focus: () => {} };
        break;
      }
      case 'category': {
        const grid = U.el('div', { class: 'opt-grid opt-grid--3' });
        let current = value || 'other';
        M.CATEGORIES.forEach((c) => {
          const b = U.el('button', {
            class: 'opt',
            type: 'button',
            'aria-pressed': String(current === c.value),
            onclick: () => {
              current = c.value;
              U.$$('.opt', grid).forEach((n) => n.setAttribute('aria-pressed', 'false'));
              b.setAttribute('aria-pressed', 'true');
            },
          }, [U.icon(c.icon, 14), U.el('span', { text: c.label })]);
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = v), focus: () => {} };
        break;
      }
      case 'importance': {
        const grid = U.el('div', { class: 'opt-grid opt-grid--2' });
        let current = value || 'medium';
        M.IMPORTANCE.forEach((c) => {
          const b = U.el('button', {
            class: 'opt',
            type: 'button',
            'aria-pressed': String(current === c.value),
            text: c.label,
            onclick: () => {
              current = c.value;
              U.$$('.opt', grid).forEach((n) => n.setAttribute('aria-pressed', 'false'));
              b.setAttribute('aria-pressed', 'true');
            },
          });
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = v), focus: () => {} };
        break;
      }
      case 'subject': {
        const grid = U.el('div', { class: 'chip-row chip-row--padless', style: { flexWrap: 'wrap', overflow: 'visible' } });
        let current = value || '';
        const subjects = () => Store.query('subjects', { sort: 'name' });
        function paint() {
          U.clear(grid);
          grid.appendChild(
            U.el('button', {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(!current),
              text: 'None',
              onclick: () => {
                current = '';
                paint();
              },
            })
          );
          subjects().forEach((s) => {
            const chip = U.el('button', {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(current === s.id),
              onclick: () => {
                current = current === s.id ? '' : s.id;
                paint();
              },
            }, [
              U.el('span', { class: 'subject-dot', style: { background: s.color } }),
              U.el('span', { text: s.name }),
            ]);
            grid.appendChild(chip);
          });
          grid.appendChild(
            U.el('button', {
              class: 'chip',
              type: 'button',
              onclick: async () => {
                const created = await openForm({ collection: 'subjects', title: 'New subject' });
                if (created) {
                  current = created.id;
                  paint();
                }
              },
            }, [U.icon('plus', 13), U.el('span', { text: 'Subject' })])
          );
        }
        paint();
        control = grid;
        api = { get: () => current || null, set: (v) => { current = v || ''; paint(); }, focus: () => {} };
        break;
      }
      case 'repeat': {
        const wrap2 = U.el('div');
        let rep = M.normalizeRepeat(value);
        const freqSel = U.el('select', { class: 'select' });
        M.REPEAT_FREQ.forEach((f) => freqSel.appendChild(U.el('option', { value: f.value, text: f.label, selected: rep.freq === f.value })));
        const daysRow = U.el('div', { class: 'chip-row chip-row--padless', style: { marginTop: '8px', flexWrap: 'wrap', overflow: 'visible' } });
        const untilWrap = U.el('div', { style: { marginTop: '10px' } });
        const untilInput = U.el('input', { class: 'input', type: 'date', value: rep.until || '' });
        untilWrap.appendChild(U.el('div', { class: 'field__label', style: { marginTop: '4px' }, text: 'Until (optional)' }));
        untilWrap.appendChild(untilInput);

        function paintDays() {
          U.clear(daysRow);
          U.DOW_SHORT.forEach((label, idx) => {
            daysRow.appendChild(
              U.el('button', {
                class: 'chip',
                type: 'button',
                'aria-pressed': String(rep.days.indexOf(idx) >= 0),
                text: label,
                onclick: (e) => {
                  const on = rep.days.indexOf(idx) >= 0;
                  rep.days = on ? rep.days.filter((d) => d !== idx) : rep.days.concat([idx]);
                  e.currentTarget.setAttribute('aria-pressed', String(!on));
                },
              })
            );
          });
        }
        function paintAll() {
          daysRow.classList.toggle('hidden', rep.freq !== 'custom');
          untilWrap.classList.toggle('hidden', rep.freq === 'none');
          paintDays();
        }
        freqSel.addEventListener('change', () => {
          rep.freq = freqSel.value;
          if (rep.freq === 'weekly' && !rep.days.length) rep.days = [new Date().getDay()];
          paintAll();
        });
        paintAll();
        wrap2.appendChild(freqSel);
        wrap2.appendChild(daysRow);
        wrap2.appendChild(untilWrap);
        control = wrap2;
        api = {
          get: () => ({ freq: freqSel.value, days: rep.days.slice(), until: untilInput.value || null }),
          set: (v) => {
            rep = M.normalizeRepeat(v);
            freqSel.value = rep.freq;
            untilInput.value = rep.until || '';
            paintAll();
          },
          focus: () => freqSel.focus(),
        };
        break;
      }
      case 'reminders': {
        const grid = U.el('div', { class: 'opt-grid opt-grid--2' });
        let current = Array.isArray(value) ? value.map(Number).slice() : [];
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
        control = U.el('div', {}, [
          grid,
          U.el('div', { class: 'field__hint', text: 'Reminders need notifications switched on in Settings.' }),
        ]);
        api = { get: () => current.slice(), set: (v) => (current = (v || []).slice()), focus: () => {} };
        break;
      }
      case 'attachments': {
        const list = U.el('div', { class: 'attach-grid' });
        const input = U.el('input', { type: 'file', multiple: true, class: 'sr-only', accept: 'image/*,application/pdf,.doc,.docx,.txt' });
        let items = Array.isArray(value) ? value.slice() : [];

        function paint() {
          U.clear(list);
          items.forEach((a) => {
            const thumb = U.el('div', { class: 'attach' });
            if (/^image\//.test(a.type || '')) {
              thumb.appendChild(U.el('img', { src: a.data || '', alt: a.name || 'attachment', loading: 'lazy' }));
            } else {
              thumb.appendChild(
                U.el('div', { class: 'attach__file' }, [U.icon('file', 20), U.el('span', { text: a.name || 'file' })])
              );
            }
            thumb.appendChild(
              U.el('button', {
                class: 'attach__del',
                type: 'button',
                'aria-label': 'Remove ' + (a.name || 'attachment'),
                onclick: () => {
                  items = items.filter((x) => x.id !== a.id);
                  Store.deleteAttachment(a.id);
                  paint();
                },
              }, [U.icon('x', 13)])
            );
            list.appendChild(thumb);
          });
          list.appendChild(
            U.el('button', {
              class: 'attach',
              type: 'button',
              'aria-label': 'Add attachment',
              onclick: () => input.click(),
              style: { borderStyle: 'dashed' },
            }, [U.el('div', { class: 'attach__file' }, [U.icon('plus', 20), U.el('span', { text: 'Add file' })])])
          );
        }
        paint();

        input.addEventListener('change', async () => {
          const files = Array.from(input.files || []);
          input.value = '';
          for (const f of files) {
            try {
              const att = await Store.fileToAttachment(f);
              const stub = await Store.storeAttachment(att);
              items.push(stub);
            } catch (e) {
              toast(e.message || 'That file could not be attached.');
            }
          }
          paint();
        });

        control = U.el('div', {}, [list, input]);
        api = { get: () => items.slice(), set: (v) => { items = (v || []).slice(); paint(); }, focus: () => {} };
        break;
      }
      case 'members': {
        const listEl = U.el('div', { class: 'stack-2' });
        let items = Array.isArray(value) ? value.slice() : [];
        const inp = U.el('input', { class: 'input', placeholder: field.placeholder || 'Add a name' });
        function paint() {
          U.clear(listEl);
          items.forEach((m, i) => {
            listEl.appendChild(
              U.el('div', { class: 'row', style: { gap: '8px' } }, [
                U.el('div', { class: 'avatar avatar--sm', text: initials(m) }),
                U.el('div', { class: 'grow truncate', text: m }),
                U.el('button', {
                  class: 'icon-btn icon-btn--sm',
                  type: 'button',
                  'aria-label': 'Remove ' + m,
                  onclick: () => {
                    items.splice(i, 1);
                    paint();
                  },
                }, [U.icon('x', 15)]),
              ])
            );
          });
        }
        function add() {
          const v = inp.value.trim();
          if (!v) return;
          if (items.length >= 20) {
            toast('A project can have up to 20 teammates.');
            return;
          }
          items.push(v);
          inp.value = '';
          paint();
        }
        paint();
        control = U.el('div', {}, [
          listEl,
          U.el('div', { class: 'row', style: { marginTop: '8px' } }, [
            inp,
            U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add', onclick: add }),
          ]),
        ]);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        });
        api = { get: () => items.slice(), set: (v) => { items = (v || []).slice(); paint(); }, focus: () => inp.focus() };
        break;
      }
      case 'milestones': {
        const listEl = U.el('div', { class: 'stack-2' });
        let items = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
        const nameInp = U.el('input', { class: 'input', placeholder: 'Milestone name' });
        const dateInp = U.el('input', { class: 'input', type: 'date' });
        function paint() {
          U.clear(listEl);
          if (!items.length) {
            listEl.appendChild(U.el('div', { class: 'field__hint', text: 'No milestones yet. They show as markers on the project timeline.' }));
          }
          items.forEach((m, i) => {
            listEl.appendChild(
              U.el('div', { class: 'row', style: { gap: '10px' } }, [
                U.el('span', { class: 'text-tertiary' }, [U.icon('flag', 16)]),
                U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
                  U.el('div', { class: 'truncate', text: m.name }),
                  m.date ? U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: U.fmtDateShort(m.date) }) : null,
                ]),
                U.el('button', {
                  class: 'icon-btn icon-btn--sm',
                  type: 'button',
                  'aria-label': 'Remove milestone',
                  onclick: () => {
                    items.splice(i, 1);
                    paint();
                  },
                }, [U.icon('x', 15)]),
              ])
            );
          });
        }
        function add() {
          const v = nameInp.value.trim();
          if (!v) {
            nameInp.focus();
            return;
          }
          items.push({ id: U.uid('mst'), name: v, date: dateInp.value || null });
          nameInp.value = '';
          dateInp.value = '';
          paint();
        }
        paint();
        control = U.el('div', {}, [
          listEl,
          U.el('div', { class: 'stack-2', style: { marginTop: '10px' } }, [
            nameInp,
            U.el('div', { class: 'row' }, [dateInp, U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add', onclick: add })]),
          ]),
        ]);
        api = { get: () => JSON.parse(JSON.stringify(items)), set: (v) => { items = (v || []).slice(); paint(); }, focus: () => nameInp.focus() };
        break;
      }
      case 'topics': {
        const listEl = U.el('div', { class: 'chip-row chip-row--padless', style: { flexWrap: 'wrap', overflow: 'visible' } });
        let items = Array.isArray(value) ? value.slice() : [];
        const inp = U.el('input', { class: 'input', placeholder: field.placeholder || 'Add a topic' });
        function paint() {
          U.clear(listEl);
          items.forEach((t, i) => {
            listEl.appendChild(
              U.el('span', { class: 'chip', style: { paddingRight: '6px' } }, [
                U.el('span', { text: t }),
                U.el('button', {
                  class: 'icon-btn icon-btn--sm',
                  type: 'button',
                  style: { width: '20px', height: '20px' },
                  'aria-label': 'Remove ' + t,
                  onclick: () => {
                    items.splice(i, 1);
                    paint();
                  },
                }, [U.icon('x', 12)]),
              ])
            );
          });
        }
        function add() {
          const v = inp.value.trim();
          if (!v) return;
          items.push(v);
          inp.value = '';
          paint();
        }
        paint();
        control = U.el('div', {}, [
          listEl,
          U.el('div', { class: 'row', style: { marginTop: '8px' } }, [inp, U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add', onclick: add })]),
        ]);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        });
        api = { get: () => items.slice(), set: (v) => { items = (v || []).slice(); paint(); }, focus: () => inp.focus() };
        break;
      }
      case 'checklist': {
        const listEl = U.el('div', { class: 'stack-2' });
        let items = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
        const inp = U.el('input', { class: 'input', placeholder: 'Add a checklist item' });
        function paint() {
          U.clear(listEl);
          items.forEach((c, i) => {
            listEl.appendChild(
              U.el('div', { class: 'checklist__item' }, [
                U.el('button', {
                  class: 'checklist__box' + (c.done ? ' is-done' : ''),
                  type: 'button',
                  'aria-pressed': String(!!c.done),
                  'aria-label': (c.done ? 'Uncheck ' : 'Check ') + c.text,
                  onclick: () => {
                    items[i].done = !items[i].done;
                    paint();
                  },
                }, [U.icon('check', 12)]),
                U.el('div', { class: 'checklist__text' + (c.done ? ' is-done' : ''), text: c.text }),
                U.el('button', {
                  class: 'icon-btn icon-btn--sm',
                  type: 'button',
                  'aria-label': 'Remove item',
                  onclick: () => {
                    items.splice(i, 1);
                    paint();
                  },
                }, [U.icon('x', 15)]),
              ])
            );
          });
        }
        function add() {
          const v = inp.value.trim();
          if (!v) return;
          items.push({ id: U.uid('chk'), text: v, done: false });
          inp.value = '';
          paint();
        }
        paint();
        control = U.el('div', {}, [listEl, U.el('div', { class: 'row', style: { marginTop: '8px' } }, [inp, U.el('button', { class: 'btn btn--secondary', type: 'button', text: 'Add', onclick: add })])]);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        });
        api = { get: () => items.slice(), set: (v) => { items = (v || []).slice(); paint(); }, focus: () => inp.focus() };
        break;
      }
      case 'color': {
        const grid = U.el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } });
        let current = value || M.SUBJECT_COLORS[0];
        M.SUBJECT_COLORS.forEach((c) => {
          const b = U.el('button', {
            class: 'icon-btn',
            type: 'button',
            'aria-label': 'Color ' + c,
            'aria-pressed': String(current === c),
            style: {
              width: '34px',
              height: '34px',
              background: c,
              borderRadius: 'var(--r-full)',
              boxShadow: current === c ? '0 0 0 2px var(--bg-canvas), 0 0 0 4px ' + c : 'none',
            },
            onclick: (e) => {
              current = c;
              U.$$('button', grid).forEach((n) => {
                n.style.boxShadow = 'none';
                n.setAttribute('aria-pressed', 'false');
              });
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--bg-canvas), 0 0 0 4px ' + c;
              e.currentTarget.setAttribute('aria-pressed', 'true');
            },
          });
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = v || M.SUBJECT_COLORS[0]), focus: () => {} };
        break;
      }
      case 'iconpick': {
        const grid = U.el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } });
        let current = value || 'book';
        M.SUBJECT_ICONS.forEach((name) => {
          const b = U.el('button', {
            class: 'icon-btn',
            type: 'button',
            'aria-label': name,
            'aria-pressed': String(current === name),
            style: {
              width: '38px',
              height: '38px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              background: current === name ? 'var(--accent-soft)' : 'transparent',
            },
            onclick: (e) => {
              current = name;
              U.$$('button', grid).forEach((n) => {
                n.style.background = 'transparent';
                n.setAttribute('aria-pressed', 'false');
              });
              e.currentTarget.style.background = 'var(--accent-soft)';
              e.currentTarget.setAttribute('aria-pressed', 'true');
            },
          }, [U.icon(name, 18)]);
          grid.appendChild(b);
        });
        control = grid;
        api = { get: () => current, set: (v) => (current = v || 'book'), focus: () => {} };
        break;
      }
      default: {
        const inp = U.el('input', {
          class: 'input',
          type: 'text',
          id: 'f_' + field.key,
          value: value == null ? '' : String(value),
          placeholder: field.placeholder || '',
          'data-autofocus': field.autofocus ? 'true' : null,
          autocomplete: 'off',
        });
        control = inp;
        api = {
          get: () => inp.value.trim(),
          set: (v) => (inp.value = v == null ? '' : String(v)),
          focus: () => inp.focus(),
          validate: () => (field.required && !inp.value.trim() ? 'This field is required.' : true),
        };
      }
    }

    wrap.appendChild(control);
    if (field.hint) wrap.appendChild(U.el('div', { class: 'field__hint', text: field.hint }));
    wrap.appendChild(err);

    return {
      key: field.key,
      field,
      node: wrap,
      get: api.get,
      set: api.set,
      focus: api.focus || (() => {}),
      validate: () => {
        const res = api.validate ? api.validate() : true;
        if (res !== true) {
          wrap.classList.add('field--invalid');
          err.textContent = res;
          err.classList.remove('hidden');
          return res;
        }
        wrap.classList.remove('field--invalid');
        err.classList.add('hidden');
        return true;
      },
    };
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase();
  }

  /* ------------------------------- Form -------------------------------- */
  /**
   * openForm({ collection, title, values, fields, onSubmit, onDelete, onDuplicate,
   *            submitLabel, extraBody, afterSave, isNew })
   * Resolves with the saved record, or null when dismissed.
   */
  function openForm(opts) {
    const o = opts || {};
    const schema = M.SCHEMAS[o.collection];
    const fields = o.fields || (schema ? schema.fields : []);
    // A record that already exists is an edit; a fresh one is a create, even
    // though it carries a pre-generated id.
    const isEdit = o.isNew ? false : !!(o.values && o.values.id);
    const initial = o.values ? JSON.parse(JSON.stringify(o.values)) : M.create(o.collection, o.prefill || {});
    if (!isEdit) delete initial.id;

    return new Promise((resolve) => {
      let settled = false;
      const renders = fields.map((f) => renderField(f, initial[f.key], { collection: o.collection }));

      const bodyChildren = [];
      if (o.extraBody) bodyChildren.push(o.extraBody);
      renders.forEach((r) => bodyChildren.push(r.node));
      if (o.footerExtra) bodyChildren.push(o.footerExtra);

      const saveBtn = U.el('button', {
        class: 'btn btn--primary grow',
        type: 'button',
        text: o.submitLabel || (isEdit ? 'Save changes' : 'Add ' + ((schema && schema.singular) || 'item')),
        onclick: () => submit(),
      });

      const footer = [];
      if (isEdit && o.onDelete) {
        footer.push(
          U.el('button', {
            class: 'icon-btn',
            type: 'button',
            'aria-label': 'Delete',
            onclick: async () => {
              const ok = await confirm({
                title: 'Delete this ' + ((schema && schema.label) || 'item').toLowerCase() + '?',
                message: 'This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (!ok) return;
              settled = true;
              s.close();
              o.onDelete(initial);
              resolve(null);
            },
          }, [U.icon('trash', 20)])
        );
      }
      footer.push(saveBtn);

      const s = sheet({
        title: o.title || (isEdit ? 'Edit ' + ((schema && schema.singular) || 'item').toLowerCase() : 'New ' + ((schema && schema.singular) || 'item').toLowerCase()),
        subtitle: o.subtitle,
        size: 'tall',
        body: bodyChildren,
        footer,
        onClose: () => {
          if (!settled) resolve(null);
        },
      });

      async function submit() {
        let firstBad = null;
        for (const r of renders) {
          const res = r.validate();
          if (res !== true && !firstBad) firstBad = r;
        }
        if (firstBad) {
          firstBad.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstBad.focus();
          toast('Please fix the highlighted field.');
          return;
        }

        const values = {};
        renders.forEach((r) => {
          values[r.key] = r.get();
        });

        // Cross-field sanity checks with human-readable messages.
        const check = validateCross(o.collection, values, initial);
        if (!check.ok) {
          toast(check.message);
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        try {
          let saved;
          if (o.onSubmit) saved = await o.onSubmit(values, initial);
          else {
            const rec = Object.assign({}, initial, values);
            saved = Store.put(o.collection, rec);
          }
          settled = true;
          s.close();
          resolve(saved || true);
        } catch (e) {
          console.error('[form] save failed', e);
          saveBtn.disabled = false;
          saveBtn.textContent = o.submitLabel || 'Save';
          toast(e && e.message ? e.message : 'Something went wrong while saving. Your other data is safe.');
        }
      }
    });
  }

  function validateCross(collection, values, initial) {
    if (collection === 'events' && values.startTime && values.endTime) {
      const a = U.minutesOf(values.startTime);
      const b = U.minutesOf(values.endTime);
      if (a !== null && b !== null && b < a) {
        return { ok: false, message: 'The end time is before the start time.' };
      }
    }
    if (collection === 'timetable' && values.startTime && values.endTime) {
      const a = U.minutesOf(values.startTime);
      const b = U.minutesOf(values.endTime);
      if (a !== null && b !== null && b <= a) return { ok: false, message: 'A class must end after it starts.' };
    }
    if ((collection === 'homework' || collection === 'tasks') && values.estMinutes === 0 && initial && initial.id === undefined) {
      // zero estimate is allowed (means "not estimated")
    }
    return { ok: true };
  }

  /* ---------------------------- Item rows ------------------------------- */
  /**
   * itemRow(collection, record, opts)
   * opts: { subjectMap, showType, showProgress, onOpen, compact, hideCheck }
   */
  function itemRow(collection, record, opts) {
    const o = opts || {};
    const meta = M.typeMeta(collection);
    const subject = record.subjectId ? (o.subjectMap ? o.subjectMap[record.subjectId] : Store.byId('subjects', record.subjectId)) : null;
    const done = M.isCompleted(collection, record);
    const overdue = M.isOverdue(collection, record);
    const deadline = M.deadlineOf(collection, record);
    const tf = M.TIME_FIELD[collection];
    const time = tf && record[tf] ? record[tf] : null;

    const row = U.el('div', { class: 'item' + (o.bordered ? ' item--bordered' : ''), role: 'button', tabindex: '0' });

    if (!o.hideCheck) {
      const checkBtn = U.el('button', {
        class: 'item__check' + (done ? ' is-done' : ''),
        type: 'button',
        'aria-pressed': String(done),
        dataset: { title: record.title || record.name || '' },
        'aria-label': (done ? 'Mark incomplete: ' : 'Mark complete: ') + (record.title || record.name || ''),
        onclick: (e) => {
          e.stopPropagation();
          toggleComplete(collection, record.id, { checkEl: checkBtn, titleEl: null, rowEl: null });
        },
      }, [U.icon('check', 14)]);
      row.appendChild(checkBtn);
    }

    const bodyCol = U.el('div', { class: 'item__body' });
    bodyCol.appendChild(U.el('div', { class: 'item__title' + (done ? ' is-done' : ''), text: record.title || record.name || 'Untitled' }));

    const metaRow = U.el('div', { class: 'item__meta' });
    const bits = [];
    if (o.showType !== false) {
      bits.push(U.el('span', { class: 'type-chip ' + meta.chip }, [U.icon(meta.icon, 11), U.el('span', { text: meta.label })]));
    }
    if (subject) {
      bits.push(U.el('span', { class: 'row', style: { gap: '5px' } }, [U.el('span', { class: 'subject-dot', style: { background: subject.color } }), U.el('span', { text: subject.name })]));
    }
    if (deadline) {
      const label = overdue ? U.fmtOverdue(deadline) : U.fmtDateRelative(deadline) + (time ? ', ' + U.fmtTime(time) : '');
      bits.push(U.el('span', { class: overdue ? 'text-danger' : '', style: overdue ? { fontWeight: '600' } : null, text: label }));
    } else if (collection === 'projects') {
      bits.push(U.el('span', { text: 'No due date' }));
    }
    if (record.priority && record.priority !== 'medium' && collection !== 'subjects') {
      const pm = M.priorityMeta(record.priority);
      bits.push(U.el('span', { class: 'prio prio--' + pm.value }, [U.icon(pm.icon, 11), U.el('span', { text: pm.label })]));
    }
    if (record.estMinutes && !done && (collection === 'homework' || collection === 'tasks')) {
      bits.push(U.el('span', { text: U.fmtDuration(record.estMinutes) }));
    }
    if (record.repeat && record.repeat.freq !== 'none') {
      bits.push(U.el('span', { class: 'row', style: { gap: '4px' } }, [U.icon('repeat', 11), U.el('span', { text: M.repeatLabel(record.repeat) })]));
    }
    if (record.sample) {
      bits.push(U.el('span', { class: 'badge badge--neutral', text: 'Sample' }));
    }
    bits.forEach((b, i) => {
      if (i) metaRow.appendChild(U.el('span', { class: 'item__meta-dot' }));
      metaRow.appendChild(b);
    });
    bodyCol.appendChild(metaRow);

    if (collection === 'projects') {
      const tasks = Store.projectTasks(record.id);
      const prog = M.projectProgress(record, tasks);
      const bar = U.el('div', { class: 'row', style: { marginTop: '10px', gap: '10px' } }, [
        U.el('div', { class: 'progress grow' }, [U.el('div', { class: 'progress__bar', style: { width: prog.pct + '%' } })]),
        U.el('span', { class: 'project-card__pct', text: prog.pct + '%' }),
      ]);
      bodyCol.appendChild(bar);
      if (prog.total) {
        bodyCol.appendChild(
          U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)', marginTop: '5px' }, text: prog.done + ' of ' + prog.total + ' subtasks done' + (prog.manual ? ' · manual override' : '') })
        );
      }
    }

    row.appendChild(bodyCol);

    const trail = U.el('div', { class: 'item__trail' });
    if (overdue) trail.appendChild(U.el('span', { class: 'badge badge--overdue', text: 'Overdue' }));
    else if (deadline === U.todayISO() && !done) trail.appendChild(U.el('span', { class: 'badge badge--today', text: 'Today' }));
    trail.appendChild(U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]));
    row.appendChild(trail);

    const open = () => {
      if (o.onOpen) o.onOpen(collection, record);
      else if (global.Router) global.Router.go('/' + collection + '/' + record.id);
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    return row;
  }

  /**
   * Complete/uncomplete with immediate, visible feedback.
   *
   * Important: mutating the store does NOT re-render the list (screens render
   * on navigation, not on every write), so the control the student just tapped
   * is updated directly here. Without this the circle stays empty until the
   * screen is reopened — which is exactly the bug this guards against.
   */
  function toggleComplete(collection, id, ctx) {
    const rec = Store.byId(collection, id);
    if (!rec) return;
    const wasDone = M.isCompleted(collection, rec);
    const updated = Store.setCompleted(collection, id, !wasDone);
    const nowDone = updated ? M.isCompleted(collection, updated) : !wasDone;
    U.haptic(8);

    // Paint the change on the row that was tapped.
    const c = ctx || {};
    const checkEl = c.checkEl || document.querySelector('.item__check[data-title="' + cssEscape(rec.title || rec.name || '') + '"]');
    if (checkEl) {
      checkEl.classList.toggle('is-done', nowDone);
      checkEl.setAttribute('aria-pressed', String(nowDone));
      checkEl.setAttribute('aria-label', (nowDone ? 'Mark incomplete: ' : 'Mark complete: ') + (rec.title || rec.name || ''));
      const rowEl = c.rowEl || checkEl.closest('.item');
      if (rowEl) {
        const titleEl = c.titleEl || rowEl.querySelector('.item__title');
        if (titleEl) titleEl.classList.toggle('is-done', nowDone);
      }
    }

    if (!wasDone) {
      const rolled = updated && !M.isCompleted(collection, updated) && updated.repeat && updated.repeat.freq !== 'none';
      if (rolled) {
        toast('Nice — next one is set for ' + U.fmtDateRelative(M.deadlineOf(collection, updated)) + '.', {
          actionLabel: 'Undo',
          onAction: () => {
            const df = M.DATE_FIELD[collection];
            updated[df] = rec[df];
            Store.put(collection, updated);
            refreshIfVisible();
          },
        });
      } else {
        toast('Completed — nice work.', {
          actionLabel: 'Undo',
          onAction: () => {
            Store.setCompleted(collection, id, false);
            refreshIfVisible();
          },
        });
      }
    } else {
      toast('Marked as not done.', {
        actionLabel: 'Undo',
        onAction: () => {
          Store.setCompleted(collection, id, true);
          refreshIfVisible();
        },
      });
    }

    // Screens that show derived numbers (progress rings, counters) may want to
    // redraw; they opt in via a data attribute so we never blow away a list the
    // student is reading.
    if (global.Notify) global.Notify.reschedule();
    if (global.Router && global.Router.state.screen && /^(today|statistics)$/.test(global.Router.state.screen)) {
      refreshIfVisible();
    }
    return updated;
  }

  function refreshIfVisible() {
    if (global.Router && global.Router.state && global.Router.state.screen) {
      global.Router.handle(true);
    }
  }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  /* --------------------------- Swipe actions ---------------------------- */
  /**
   * swipeRow({ content, onComplete, onDelete, onReschedule })
   * Left-swipe reveals complete/delete on the right; right-swipe reveals reschedule.
   */
  function swipeRow(opts) {
    const o = opts || {};
    const wrap = U.el('div', { class: 'swipe' });
    const actions = U.el('div', { class: 'swipe__actions' });
    const rightActions = U.el('div', { class: 'row', style: { gap: '0' } });
    const leftActions = U.el('div', { class: 'row' });

    if (o.onReschedule) {
      leftActions.appendChild(
        U.el('button', {
          class: 'swipe__action swipe__action--reschedule',
          type: 'button',
          onclick: () => {
            reset();
            o.onReschedule();
          },
        }, [U.icon('clock', 15), U.el('span', { text: 'Tomorrow' })])
      );
    }
    if (o.onComplete) {
      rightActions.appendChild(
        U.el('button', {
          class: 'swipe__action swipe__action--complete',
          type: 'button',
          onclick: () => {
            reset();
            o.onComplete();
          },
        }, [U.icon('check', 15), U.el('span', { text: 'Done' })])
      );
    }
    if (o.onDelete) {
      rightActions.appendChild(
        U.el('button', {
          class: 'swipe__action swipe__action--delete',
          type: 'button',
          onclick: () => {
            reset();
            o.onDelete();
          },
        }, [U.icon('trash', 15), U.el('span', { text: 'Delete' })])
      );
    }
    actions.appendChild(leftActions);
    actions.appendChild(rightActions);
    wrap.appendChild(actions);

    const pane = U.el('div', { class: 'swipe__pane' });
    U.appendChildren(pane, o.content);
    wrap.appendChild(pane);

    const OPEN = 132;
    let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, locked = null;

    pane.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dx = 0;
        dragging = true;
        decided = false;
        locked = null;
      },
      { passive: true }
    );

    pane.addEventListener(
      'touchmove',
      (e) => {
        if (!dragging) return;
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const ddx = cx - startX;
        const ddy = cy - startY;
        if (!decided) {
          if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
          decided = true;
          locked = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
          if (locked === 'x') pane.classList.add('is-dragging');
        }
        if (locked !== 'x') return;
        dx = ddx;
        const clamped = U.clamp(dx, -OPEN, OPEN);
        pane.style.transform = 'translateX(' + clamped + 'px)';
      },
      { passive: true }
    );

    function reset() {
      pane.classList.remove('is-dragging');
      pane.style.transform = '';
      dx = 0;
      dragging = false;
    }

    pane.addEventListener('touchend', () => {
      if (!dragging) return;
      const finalDx = dx;
      reset();
      if (finalDx <= -OPEN * 0.62 && rightActions.children.length) {
        pane.style.transition = 'transform var(--dur-2) var(--ease-out)';
        pane.style.transform = 'translateX(' + -OPEN + 'px)';
        setTimeout(() => {
          pane.style.transition = '';
        }, 200);
      } else if (finalDx >= OPEN * 0.62 && leftActions.children.length) {
        pane.style.transition = 'transform var(--dur-2) var(--ease-out)';
        pane.style.transform = 'translateX(' + OPEN + 'px)';
        setTimeout(() => {
          pane.style.transition = '';
        }, 200);
      }
    });

    wrap.addEventListener('click', (e) => {
      if (pane.style.transform && pane.style.transform !== 'translateX(0px)') {
        e.stopPropagation();
        reset();
      }
    });

    return wrap;
  }

  /* --------------------------- List sections ---------------------------- */
  /** Group rows into date buckets (Overdue / Today / Tomorrow / This week / Later). */
  function bucketSections(items, opts) {
    const o = opts || {};
    const order = o.order || ['overdue', 'today', 'tomorrow', 'week', 'later'];
    const groups = {};
    items.forEach((it) => {
      const b = M.bucketOf(it.collection, it.record);
      if (!groups[b]) groups[b] = [];
      groups[b].push(it);
    });
    return order
      .filter((b) => groups[b] && groups[b].length)
      .map((b) => ({ bucket: b, label: M.BUCKET_LABELS[b], items: groups[b] }));
  }

  /* --------------------------- Empty states ----------------------------- */
  function emptyState(opts) {
    const o = opts || {};
    return U.el('div', { class: 'empty' }, [
      U.el('div', { class: 'empty__art' }, [U.icon(o.icon || 'sparkles', 26)]),
      U.el('div', { class: 'empty__title', text: o.title || 'Nothing here yet' }),
      o.body ? U.el('div', { class: 'empty__body', text: o.body }) : null,
      o.actions && o.actions.length ? U.el('div', { class: 'empty__actions' }, o.actions) : null,
    ]);
  }

  /* ---------------------------- Skeletons ------------------------------- */
  function skeletonList(rows) {
    const n = rows || 4;
    const wrap = U.el('div', { class: 'list', 'aria-hidden': 'true' });
    for (let i = 0; i < n; i++) {
      wrap.appendChild(
        U.el('div', { class: 'skeleton-row' }, [
          U.el('div', { class: 'skeleton skeleton-row__check' }),
          U.el('div', { class: 'grow stack-2' }, [
            U.el('div', { class: 'skeleton skeleton-line', style: { width: 45 + ((i * 13) % 40) + '%' } }),
            U.el('div', { class: 'skeleton skeleton-line', style: { width: '30%', height: '9px' } }),
          ]),
        ])
      );
    }
    return wrap;
  }

  function skeletonScreen() {
    return U.el('div', { class: 'stack-5', style: { padding: '4px 0' }, 'aria-hidden': 'true' }, [
      U.el('div', { class: 'skeleton', style: { height: '30px', width: '62%', marginBottom: '14px' } }),
      U.el('div', { class: 'skeleton', style: { height: '13px', width: '40%', marginBottom: '26px' } }),
      skeletonList(5),
    ]);
  }

  /* ------------------------------ Theme --------------------------------- */
  let systemThemeListener = null;

  function resolvedTheme(mode) {
    if (mode === 'system' || !mode) {
      try {
        return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (e) {
        return 'light';
      }
    }
    return mode;
  }

  function applyTheme(mode, opts) {
    const o = opts || {};
    const resolved = resolvedTheme(mode);
    const root = document.documentElement;
    if (!o.animate) root.classList.add('no-transition');
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode || 'system');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#212121' : '#ffffff');
    if (!o.animate) {
      // Remove the transition guard once the swap has painted — and also on
      // transitionend, so a backgrounded tab can never stay stuck mid-fade.
      const unguard = () => {
        root.classList.remove('no-transition');
        document.removeEventListener('transitionend', unguard);
      };
      requestAnimationFrame(() => requestAnimationFrame(unguard));
      setTimeout(unguard, 120);
      document.addEventListener('transitionend', unguard, { once: true });
    }

    if (systemThemeListener) {
      systemThemeListener();
      systemThemeListener = null;
    }
    if ((mode === 'system' || !mode) && global.matchMedia) {
      const mq = global.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const next = mq.matches ? 'dark' : 'light';
        root.classList.add('no-transition');
        root.setAttribute('data-theme', next);
        const m2 = document.querySelector('meta[name="theme-color"]');
        if (m2) m2.setAttribute('content', next === 'dark' ? '#212121' : '#ffffff');
        setTimeout(() => root.classList.remove('no-transition'), 60);
        Store.emit('theme', { theme: next });
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
      systemThemeListener = () => {
        if (mq.removeEventListener) mq.removeEventListener('change', handler);
        else if (mq.removeListener) mq.removeListener(handler);
      };
    }
    Store.emit('theme', { theme: resolved, mode: mode || 'system' });
    return resolved;
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  /* ---------------------------- Small parts ----------------------------- */
  function sectionHead(title, opts) {
    const o = opts || {};
    return U.el('div', { class: 'section__head' }, [
      U.el('h2', { class: 'section__title' }, [
        U.el('span', { text: title }),
        o.count !== undefined && o.count !== null ? U.el('span', { class: 'section__count', text: String(o.count) }) : null,
      ]),
      o.action
        ? U.el('button', { class: 'section__action', type: 'button', onclick: o.action.onClick }, [
            U.el('span', { text: o.action.label }),
            U.icon('chevronRight', 14),
          ])
        : null,
    ]);
  }

  function chipRow(items, opts) {
    const o = opts || {};
    const row = U.el('div', { class: 'chip-row' + (o.padless ? ' chip-row--padless' : '') });
    items.forEach((it) => {
      row.appendChild(
        U.el('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(!!it.active),
          onclick: () => it.onClick && it.onClick(it),
        }, [
          it.icon ? U.icon(it.icon, 13) : null,
          U.el('span', { text: it.label }),
          it.count !== undefined && it.count !== null ? U.el('span', { class: 'chip__count', text: String(it.count) }) : null,
        ])
      );
    });
    return row;
  }

  function segmented(items, activeValue, onChange) {
    const wrap = U.el('div', { class: 'segmented', role: 'tablist' });
    items.forEach((it) => {
      wrap.appendChild(
        U.el('button', {
          class: 'segmented__btn',
          type: 'button',
          role: 'tab',
          'aria-selected': String(it.value === activeValue),
          text: it.label,
          onclick: () => onChange(it.value),
        })
      );
    });
    return wrap;
  }

  function fieldRow(label, value, opts) {
    const o = opts || {};
    const row = U.el(o.href ? 'a' : 'button', {
      class: 'list__row',
      href: o.href,
      type: o.href ? null : 'button',
      onclick: o.onClick,
    }, [
      o.icon ? U.el('span', { class: 'list__icon', style: { background: o.iconBg || 'var(--bg-sunken)', color: o.iconColor || 'var(--text-secondary)' } }, [U.icon(o.icon, 17)]) : null,
      U.el('span', { class: 'list__label grow', text: label }),
      value !== undefined && value !== null ? U.el('span', { class: 'list__value', text: String(value) }) : null,
      o.chevron !== false ? U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 16)]) : null,
    ]);
    return row;
  }

  function switchRow(label, checked, onChange, opts) {
    const o = opts || {};
    const sw = U.el('button', {
      class: 'switch',
      type: 'button',
      role: 'switch',
      'aria-checked': String(!!checked),
      'aria-label': label,
      onclick: () => {
        const next = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(next));
        onChange(next);
      },
    });
    return U.el('div', { class: 'list__row', style: { cursor: 'default' } }, [
      o.icon ? U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon(o.icon, 17)]) : null,
      U.el('div', { class: 'grow col' }, [
        U.el('span', { class: 'list__label', text: label }),
        o.hint ? U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)', marginTop: '2px' }, text: o.hint }) : null,
      ]),
      sw,
    ]);
  }

  function statTile(value, label, opts) {
    const o = opts || {};
    return U.el('div', { class: 'stat' }, [
      U.el('div', { class: 'stat__value', style: o.color ? { color: o.color } : null, text: String(value) }),
      U.el('div', { class: 'stat__label', text: label }),
      o.hint ? U.el('div', { class: 'stat__hint', text: o.hint }) : null,
    ]);
  }

  function progressBar(pct, cls) {
    return U.el('div', { class: 'progress ' + (cls || '') }, [
      U.el('div', { class: 'progress__bar', style: { width: U.clamp(pct, 0, 100) + '%' } }),
    ]);
  }

  function ring(pct, size) {
    const s = size || 44;
    return U.el('div', { class: 'ring', style: { '--pct': U.clamp(pct, 0, 100), width: s + 'px', height: s + 'px' } }, [
      U.el('span', { class: 'ring__label', text: Math.round(pct) + '%' }),
    ]);
  }

  /** A conic-gradient progress ring with a centre slot (used on Home/Today). */
  function progressRing(pct, size, centre) {
    const s = size || 60;
    const node = U.el('div', {
      class: 'ring',
      role: 'img',
      'aria-label': Math.round(pct) + '% complete',
      style: { '--pct': U.clamp(pct, 0, 100), width: s + 'px', height: s + 'px' },
    });
    if (centre) node.appendChild(centre);
    return node;
  }

  /** Simple bar chart from real data: [{label, count}] */
  function barChart(data, opts) {
    const o = opts || {};
    const max = Math.max(1, ...data.map((d) => d.count));
    const wrap = U.el('div', { class: 'chart', role: 'img', 'aria-label': o.ariaLabel || 'Bar chart' });
    data.forEach((d) => {
      const h = Math.max(3, Math.round((d.count / max) * 92));
      wrap.appendChild(
        U.el('div', { class: 'chart__col' }, [
          d.count ? U.el('span', { class: 'chart__val', text: String(d.count) }) : null,
          U.el('div', { class: 'chart__bar' + (d.count ? '' : ' chart__bar--empty'), style: { height: h + 'px' }, title: d.count + ' on ' + d.label }),
          U.el('span', { class: 'chart__label', text: d.label }),
        ])
      );
    });
    return wrap;
  }

  function countdownChip(dateISO, timeHM, prefix) {
    if (!dateISO) return null;
    const delta = U.diffDays(U.todayISO(), dateISO);
    const label = prefix ? prefix + ' ' + U.fmtCountdown(dateISO).toLowerCase() : U.fmtCountdown(dateISO);
    const cls = delta < 0 ? '' : delta <= 2 ? ' countdown--soon' : ' countdown--far';
    return U.el('span', { class: 'countdown' + cls }, [
      U.icon(delta < 0 ? 'alert' : 'clock', 13),
      U.el('span', { text: label + (timeHM ? ' · ' + U.fmtTime(timeHM) : '') }),
    ]);
  }

  function avatar(name, color, cls) {
    return U.el('div', {
      class: 'avatar ' + (cls || ''),
      style: color ? { background: color } : null,
      text: initials(name || Store.profile().name || '?'),
      'aria-hidden': 'true',
    });
  }

  /* --------------------------- Attachment view -------------------------- */
  function attachmentGrid(items, opts) {
    const o = opts || {};
    const grid = U.el('div', { class: 'attach-grid' });
    (items || []).forEach((a) => {
      const tile = U.el('div', { class: 'attach' });
      if (/^image\//.test(a.type || '') && a.data) {
        tile.appendChild(U.el('img', { src: a.data, alt: a.name || 'attachment', loading: 'lazy' }));
      } else {
        tile.appendChild(U.el('div', { class: 'attach__file' }, [U.icon('file', 22), U.el('span', { text: a.name || 'file' })]));
      }
      if (!o.readonly) {
        tile.appendChild(
          U.el('button', {
            class: 'attach__del',
            type: 'button',
            'aria-label': 'Remove attachment',
            onclick: async () => {
              const ok = await confirm({ title: 'Remove this attachment?', message: a.name || 'File', confirmLabel: 'Remove', danger: true });
              if (ok && o.onRemove) o.onRemove(a);
            },
          }, [U.icon('x', 13)])
        );
      }
      tile.addEventListener('click', (e) => {
        if (e.target.closest('.attach__del')) return;
        if (a.data) {
          const w = global.open('', '_blank');
          if (w) {
            w.document.write('<title>' + U.escapeHtml(a.name || 'attachment') + '</title><body style="margin:0;background:#111"><img src="' + a.data + '" style="max-width:100%;display:block;margin:auto">');
          } else {
            toast('Your browser blocked the preview window.');
          }
        } else {
          toast('This file is not available on this device.');
        }
      });
      grid.appendChild(tile);
    });
    return grid;
  }

  /* --------------------------- Error surface ---------------------------- */
  function errorPanel(message, retry) {
    return U.el('div', { class: 'empty' }, [
      U.el('div', { class: 'empty__art', style: { color: 'var(--danger)' } }, [U.icon('warning', 26)]),
      U.el('div', { class: 'empty__title', text: 'Something went wrong' }),
      U.el('div', { class: 'empty__body', text: message || 'Please try again.' }),
      retry ? U.el('div', { class: 'empty__actions' }, [U.el('button', { class: 'btn btn--primary', type: 'button', text: 'Try again', onclick: retry })]) : null,
    ]);
  }

  /* ------------------------------- Export ------------------------------- */
  global.UI = {
    toast, sheet, confirm, prompt, openForm, renderField, validateCross,
    itemRow, toggleComplete, swipeRow, bucketSections, initials,
    emptyState, skeletonList, skeletonScreen, errorPanel,
    applyTheme, resolvedTheme, currentTheme,
    sectionHead, chipRow, segmented, fieldRow, switchRow, statTile, progressBar, ring, progressRing, barChart, countdownChip, avatar,
    attachmentGrid,
    get modalDepth() {
      return modalDepth;
    },
  };
})(window);
