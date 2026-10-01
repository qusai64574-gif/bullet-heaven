/* ==========================================================================
   screens/onboarding.js — first launch setup.
   Five short steps, everything optional except the name, no account needed.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;

  const STEPS = ['You', 'School', 'Subjects', 'Day', 'Alerts'];

  function onboarding(opts) {
    const o = opts || {};
    const draft = {
      name: '',
      grade: '',
      school: '',
      startTime: '08:00',
      endTime: '15:00',
      theme: 'system',
      subjects: ['Mathematics', 'Science', 'English'],
      customSubject: '',
      notifications: false,
      sampleData: true,
    };
    let step = 0;

    const root = U.el('div', { class: 'onboard' });
    const progress = U.el('div', { class: 'onboard__progress' });
    const stepWrap = U.el('div', { class: 'onboard__step' });
    const foot = U.el('div', { class: 'onboard__foot' });
    root.appendChild(progress);
    root.appendChild(stepWrap);
    root.appendChild(foot);

    function paintProgress() {
      U.clear(progress);
      STEPS.forEach((label, i) => {
        progress.appendChild(U.el('div', { class: 'onboard__seg' + (i < step ? ' is-done' : i === step ? ' is-active' : ''), title: label }, [U.el('i')]));
      });
    }

    /* ------------------------------- Steps ------------------------------- */
    function stepYou() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h1', { class: 'onboard__title', text: 'Welcome' }));
      wrap.appendChild(
        U.el('p', { class: 'onboard__sub', text: 'One place for homework, projects, exams, events and everything else. It takes about 30 seconds to set up.' })
      );

      const nameInput = U.el('input', { class: 'input', placeholder: 'e.g. Ahmed', value: draft.name, autocomplete: 'given-name', 'data-autofocus': 'true' });
      nameInput.addEventListener('input', () => (draft.name = nameInput.value.trim()));

      const gradeInput = U.el('input', { class: 'input', placeholder: 'e.g. Grade 10', value: draft.grade });
      gradeInput.addEventListener('input', () => (draft.grade = gradeInput.value.trim()));

      wrap.appendChild(
        U.el('div', { style: { marginTop: '26px' } }, [
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Your name' }), nameInput, U.el('div', { class: 'field__hint', text: 'Used for the greeting on your home screen.' })]),
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Grade or year (optional)' }), gradeInput]),
        ])
      );
      return { node: wrap, validate: () => true };
    }

    function stepSchool() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h1', { class: 'onboard__title', text: 'Your school' }));
      wrap.appendChild(U.el('p', { class: 'onboard__sub', text: 'Optional — but it helps label things clearly. Skip if you’d rather not.' }));

      const schoolInput = U.el('input', { class: 'input', placeholder: 'e.g. Al Noor Secondary School', value: draft.school, 'data-autofocus': 'true' });
      schoolInput.addEventListener('input', () => (draft.school = schoolInput.value.trim()));

      wrap.appendChild(
        U.el('div', { style: { marginTop: '26px' } }, [
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'School name (optional)' }), schoolInput]),
        ])
      );
      return { node: wrap, validate: () => true };
    }

    function stepSubjects() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h1', { class: 'onboard__title', text: 'Your subjects' }));
      wrap.appendChild(U.el('p', { class: 'onboard__sub', text: 'Tap to keep or remove. You can add your own below, and change everything later.' }));

      const common = ['Mathematics', 'Science', 'English', 'Arabic', 'Computer Science', 'History', 'Geography', 'Art', 'Music', 'Physical Education'];
      const grid = U.el('div', { class: 'chip-row chip-row--padless', style: { marginTop: '22px', flexWrap: 'wrap', overflow: 'visible' } });

      function paintChips() {
        U.clear(grid);
        common.forEach((name) => {
          grid.appendChild(
            U.el('button', {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(draft.subjects.indexOf(name) >= 0),
              onclick: () => {
                const i = draft.subjects.indexOf(name);
                if (i >= 0) draft.subjects.splice(i, 1);
                else draft.subjects.push(name);
                paintChips();
              },
            }, [U.el('span', { text: name })])
          );
        });
        draft.customSubject.trim() && draft.subjects.indexOf(draft.customSubject.trim()) >= 0
          ? null
          : null;
      }
      paintChips();

      const customInput = U.el('input', { class: 'input', placeholder: 'Add another subject' });
      const addBtn = U.el('button', {
        class: 'btn btn--secondary',
        type: 'button',
        text: 'Add',
        onclick: () => {
          const v = customInput.value.trim();
          if (!v) return;
          if (draft.subjects.indexOf(v) < 0) draft.subjects.push(v);
          customInput.value = '';
          paintChips();
          UI.toast(v + ' added.');
        },
      });
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn.click();
        }
      });

      wrap.appendChild(grid);
      wrap.appendChild(U.el('div', { class: 'row', style: { marginTop: '16px' } }, [customInput, addBtn]));
      wrap.appendChild(
        U.el('div', { class: 'field__hint', style: { marginTop: '10px' }, text: draft.subjects.length ? draft.subjects.length + ' selected' : 'You can skip this and add subjects later.' })
      );
      return { node: wrap, validate: () => true };
    }

    function stepDay() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h1', { class: 'onboard__title', text: 'Your day' }));
      wrap.appendChild(U.el('p', { class: 'onboard__sub', text: 'Used for study planning and for placing tasks sensibly around your classes.' }));

      const start = U.el('input', { class: 'input', type: 'time', value: draft.startTime });
      start.addEventListener('change', () => (draft.startTime = start.value || '08:00'));
      const end = U.el('input', { class: 'input', type: 'time', value: draft.endTime });
      end.addEventListener('change', () => (draft.endTime = end.value || '15:00'));

      const themeGrid = U.el('div', { class: 'opt-grid opt-grid--3' });
      [
        { value: 'light', label: 'Light', icon: 'sun' },
        { value: 'dark', label: 'Dark', icon: 'moon' },
        { value: 'system', label: 'System', icon: 'monitor' },
      ].forEach((t) => {
        themeGrid.appendChild(
          U.el('button', {
            class: 'opt',
            type: 'button',
            'aria-pressed': String(draft.theme === t.value),
            onclick: () => {
              draft.theme = t.value;
              UI.$$('.opt', themeGrid).forEach((n) => n.setAttribute('aria-pressed', 'false'));
              const btn = themeGrid.querySelector('[data-v="' + t.value + '"]');
              UI.applyTheme(t.value, { animate: true });
              U.$$('button', themeGrid).forEach((n, i) => n.setAttribute('aria-pressed', String(['light', 'dark', 'system'][i] === t.value)));
            },
            dataset: { v: t.value },
          }, [U.icon(t.icon, 15), U.el('span', { text: t.label })])
        );
      });

      wrap.appendChild(
        U.el('div', { style: { marginTop: '26px' } }, [
          U.el('div', { class: 'field-row' }, [
            U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'School starts' }), start]),
            U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'School ends' }), end]),
          ]),
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Theme' }), themeGrid]),
        ])
      );
      return { node: wrap, validate: () => true };
    }

    function stepAlerts() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h1', { class: 'onboard__title', text: 'Reminders' }));
      wrap.appendChild(
        U.el('p', { class: 'onboard__sub', text: 'Get a nudge before homework is due and exams start. You can change this any time.' })
      );

      const notifSwitch = U.el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(draft.notifications), 'aria-label': 'Enable notifications' });
      const sampleSwitch = U.el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(draft.sampleData), 'aria-label': 'Load sample data' });

      notifSwitch.addEventListener('click', () => {
        const next = notifSwitch.getAttribute('aria-checked') !== 'true';
        notifSwitch.setAttribute('aria-checked', String(next));
        draft.notifications = next;
      });
      sampleSwitch.addEventListener('click', () => {
        const next = sampleSwitch.getAttribute('aria-checked') !== 'true';
        sampleSwitch.setAttribute('aria-checked', String(next));
        draft.sampleData = next;
      });

      wrap.appendChild(
        U.el('div', { class: 'list list--plain', style: { marginTop: '22px' } }, [
          U.el('div', { class: 'list__row' }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('bell', 17)]),
            U.el('div', { class: 'grow col' }, [
              U.el('span', { class: 'list__label', text: 'Notifications' }),
              U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Homework, exams, projects and events' }),
            ]),
            notifSwitch,
          ]),
          U.el('div', { class: 'list__row' }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('sparkles', 17)]),
            U.el('div', { class: 'grow col' }, [
              U.el('span', { class: 'list__label', text: 'Start with sample data' }),
              U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-footnote)' }, text: 'See how everything works — remove it with one tap later' }),
            ]),
            sampleSwitch,
          ]),
        ])
      );

      wrap.appendChild(
        U.el('div', { class: 'card card--pad', style: { marginTop: '18px' } }, [
          U.el('div', { class: 'row', style: { gap: '10px' } }, [
            U.el('span', { class: 'text-tertiary' }, [U.icon('lock', 17)]),
            U.el('div', { class: 'col' }, [
              U.el('div', { style: { fontWeight: '500', fontSize: 'var(--fs-callout)' }, text: 'No account needed' }),
              U.el('div', { class: 'text-secondary', style: { fontSize: 'var(--fs-footnote)' }, text: 'Everything stays on this device. You can export a backup whenever you like.' }),
            ]),
          ]),
        ])
      );
      return { node: wrap, validate: () => true };
    }

    const STEP_FNS = [stepYou, stepSchool, stepSubjects, stepDay, stepAlerts];

    /* ------------------------------ Controls ----------------------------- */
    function paintFoot() {
      U.clear(foot);
      if (step > 0) {
        foot.appendChild(
          U.el('button', {
            class: 'btn btn--secondary',
            type: 'button',
            text: 'Back',
            onclick: () => {
              step--;
              paint();
            },
          })
        );
      } else {
        foot.appendChild(
          U.el('button', {
            class: 'btn btn--ghost',
            type: 'button',
            text: 'Skip setup',
            onclick: () => finish(true),
          })
        );
      }
      foot.appendChild(
        U.el('button', {
          class: 'btn btn--primary grow',
          type: 'button',
          text: step === STEPS.length - 1 ? 'Start using the app' : 'Continue',
          onclick: () => {
            if (step === STEPS.length - 1) finish(false);
            else {
              step++;
              paint();
            }
          },
        })
      );
    }

    function paint() {
      paintProgress();
      U.clear(stepWrap);
      const built = STEP_FNS[step]();
      currentValidate = built.validate;
      stepWrap.appendChild(built.node);
      paintFoot();
      const auto = built.node.querySelector('[data-autofocus]');
      if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 150);
      root.scrollTop = 0;
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }

    let currentValidate = () => true;

    /* ------------------------------- Finish ------------------------------ */
    async function finish(skipped) {
      const btn = foot.querySelector('.btn--primary');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Setting up…';
      }

      Store.setProfile({
        name: draft.name || '',
        grade: draft.grade || '',
        school: draft.school || '',
        startTime: draft.startTime,
        endTime: draft.endTime,
      });
      Store.setSetting('theme', draft.theme);
      Store.setSetting('onboarded', true);
      Store.setSetting('timeFormat', '12');

      // Subjects
      const names = skipped ? [] : draft.subjects;
      names.forEach((name, i) => {
        Store.put('subjects', M.create('subjects', {
          name,
          color: M.SUBJECT_COLORS[i % M.SUBJECT_COLORS.length],
          icon: M.SUBJECT_ICONS[i % M.SUBJECT_ICONS.length],
        }));
      });

      // Sample data
      if (!skipped && draft.sampleData) {
        try {
          global.Sample.load();
          Store.setSetting('sampleDataLoaded', true);
        } catch (e) {
          console.error('[onboarding] sample data failed', e);
        }
      }

      // Notifications
      if (!skipped && draft.notifications) {
        const res = await global.Notify.enable();
        if (!res.ok && res.message) UI.toast(res.message);
      }

      Store.flush();
      UI.applyTheme(draft.theme, { animate: false });
      if (o.onDone) o.onDone();
      else global.Router.start();
    }

    paint();
    return root;
  }

  global.Screens = global.Screens || {};
  global.Screens.onboarding = onboarding;
})(window);
