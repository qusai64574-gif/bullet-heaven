/* ==========================================================================
   screens/auth.js — sign in, create account, and the welcome/landing screen.
   Password fields are typed by the student into a normal password input; the
   app only ever keeps a hash (see core/auth.js).
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const UI = global.UI;
  const Auth = global.Auth;

  const MODES = { WELCOME: 'welcome', LOGIN: 'login', REGISTER: 'register' };

  /**
   * render({ onAuthed, onGuest, startMode })
   * Returns the root element for #app.
   */
  function authScreen(opts) {
    const o = opts || {};
    let mode = o.startMode || MODES.WELCOME;
    let busy = false;

    const root = U.el('div', { class: 'auth' });
    const card = U.el('div', { class: 'auth__card' });
    root.appendChild(card);

    function done() {
      if (o.onAuthed) o.onAuthed(Auth.current());
    }

    /* ------------------------------ Welcome ----------------------------- */
    function paintWelcome() {
      U.clear(card);
      card.appendChild(
        U.el('div', { class: 'auth__brand' }, [
          U.el('div', { class: 'auth__mark' }, [U.icon('cap', 30)]),
          U.el('h1', { class: 'auth__title', text: 'Study Planner' }),
          U.el('p', { class: 'auth__sub', text: 'Homework, projects, exams and deadlines — all in one place, on this device.' }),
        ])
      );

      const accounts = Auth.list();
      const actions = U.el('div', { class: 'auth__actions' });

      if (accounts.length) {
        actions.appendChild(
          U.el('button', {
            class: 'btn btn--primary btn--lg btn--block',
            type: 'button',
            text: 'Sign in',
            onclick: () => {
              mode = MODES.LOGIN;
              paint();
            },
          })
        );
        actions.appendChild(
          U.el('button', {
            class: 'btn btn--secondary btn--lg btn--block',
            type: 'button',
            text: 'Create another account',
            onclick: () => {
              mode = MODES.REGISTER;
              paint();
            },
          })
        );
      } else {
        actions.appendChild(
          U.el('button', {
            class: 'btn btn--primary btn--lg btn--block',
            type: 'button',
            text: 'Create your account',
            onclick: () => {
              mode = MODES.REGISTER;
              paint();
            },
          })
        );
        actions.appendChild(
          U.el('button', {
            class: 'btn btn--secondary btn--lg btn--block',
            type: 'button',
            text: 'Continue without an account',
            onclick: () => {
              Auth.continueAsGuest();
              if (o.onGuest) o.onGuest();
            },
          })
        );
      }
      card.appendChild(actions);

      if (accounts.length) {
        card.appendChild(
          U.el('div', { class: 'auth__accounts' }, [
            U.el('div', { class: 'auth__label', text: 'Accounts on this device' }),
          ].concat(
            accounts.map((a) =>
              U.el('button', {
                class: 'auth__account',
                type: 'button',
                onclick: () => {
                  mode = MODES.LOGIN;
                  prefillName = a.name;
                  paint();
                },
              }, [
                U.el('span', { class: 'avatar avatar--sm', style: { background: a.avatarColor }, text: initials(a.name) }),
                U.el('span', { class: 'grow col', style: { minWidth: 0 } }, [
                  U.el('span', { class: 'truncate', style: { fontWeight: '500' }, text: a.name }),
                  U.el('span', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: a.lastLoginAt ? 'Last used ' + U.fmtDateStamp(a.lastLoginAt) : 'Never signed in' }),
                ]),
                U.el('span', { class: 'list__chev' }, [U.icon('chevronRight', 15)]),
              ])
            )
          ))
        );
      }

      card.appendChild(
        U.el('p', { class: 'auth__note', text: 'Your account and planner are uploaded so you can sign in on any device. Your planner is encrypted on this device first — the server only stores scrambled data it cannot read.' })
      );
    }

    function initials(name) {
      return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
    }

    /* ------------------------------- Login ------------------------------ */
    let prefillName = '';

    function paintLogin() {
      U.clear(card);
      const nameInput = U.el('input', {
        class: 'input',
        type: 'text',
        placeholder: 'Your name',
        value: prefillName,
        autocomplete: 'username',
        autocapitalize: 'words',
        'data-autofocus': 'true',
        'aria-label': 'Your name',
      });
      const passInput = U.el('input', {
        class: 'input',
        type: 'password',
        placeholder: 'Your password',
        autocomplete: 'current-password',
        'aria-label': 'Your password',
      });
      const nameErr = U.el('div', { class: 'field__error hidden' });
      const passErr = U.el('div', { class: 'field__error hidden' });
      const submit = U.el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button', text: 'Sign in' });

      card.appendChild(
        U.el('div', { class: 'auth__brand auth__brand--compact' }, [
          U.el('h1', { class: 'auth__title', text: 'Welcome back' }),
          U.el('p', { class: 'auth__sub', text: 'Sign in with the name and password you used before.' }),
        ])
      );

      card.appendChild(U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Name' }), nameInput, nameErr]));
      card.appendChild(U.el('div', { class: 'field' }, [U.el('label', { class: 'field__label', text: 'Password' }), passInput, passErr]));

      const form = U.el('div', { class: 'auth__actions' }, [
        submit,
        U.el('button', {
          class: 'btn btn--ghost btn--block',
          type: 'button',
          text: 'Create a new account instead',
          onclick: () => {
            mode = MODES.REGISTER;
            paint();
          },
        }),
      ]);
      card.appendChild(form);

      function clearErrors() {
        [nameErr, passErr].forEach((e) => {
          e.classList.add('hidden');
          e.textContent = '';
        });
      }

      async function attempt() {
        if (busy) return;
        clearErrors();
        busy = true;
        submit.disabled = true;
        submit.textContent = 'Checking…';
        const res = await Auth.login(nameInput.value, passInput.value);
        busy = false;
        submit.disabled = false;
        submit.textContent = 'Sign in';
        if (!res.ok) {
          const target = res.field === 'name' ? nameErr : passErr;
          const field = res.field === 'name' ? nameInput : passInput;
          target.textContent = res.error;
          target.classList.remove('hidden');
          field.closest('.field').classList.add('field--invalid');
          field.focus();
          if (res.field !== 'name') passInput.select();
          return;
        }
        UI.toast('Welcome back, ' + res.account.name + '.');
        done();
      }

      submit.addEventListener('click', attempt);
      [nameInput, passInput].forEach((el) => {
        el.addEventListener('input', () => {
          el.closest('.field').classList.remove('field--invalid');
          clearErrors();
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attempt();
          }
        });
      });

      card.appendChild(
        U.el('div', { class: 'auth__foot' }, [
          U.el('button', {
            class: 'auth__link',
            type: 'button',
            text: 'Back',
            onclick: () => {
              mode = MODES.WELCOME;
              paint();
            },
          }),
        ])
      );
    }

    /* ------------------------------ Register ---------------------------- */
    function paintRegister() {
      U.clear(card);
      const first = Auth.count() === 0;

      const nameInput = U.el('input', {
        class: 'input', type: 'text', placeholder: 'e.g. Ahmed', autocomplete: 'username',
        autocapitalize: 'words', 'data-autofocus': 'true', 'aria-label': 'Your name',
      });
      const passInput = U.el('input', {
        class: 'input', type: 'password', placeholder: 'At least 4 characters',
        autocomplete: 'new-password', 'aria-label': 'Choose a password',
      });
      const confirmInput = U.el('input', {
        class: 'input', type: 'password', placeholder: 'Repeat your password',
        autocomplete: 'new-password', 'aria-label': 'Repeat your password',
      });
      const nameErr = U.el('div', { class: 'field__error hidden' });
      const passErr = U.el('div', { class: 'field__error hidden' });
      const confirmErr = U.el('div', { class: 'field__error hidden' });

      const showPass = U.el('button', {
        class: 'auth__reveal', type: 'button', 'aria-label': 'Show password', 'aria-pressed': 'false',
      }, [U.icon('eye', 15), U.el('span', { text: 'Show' })]);

      function toggleReveal() {
        const on = showPass.getAttribute('aria-pressed') !== 'true';
        showPass.setAttribute('aria-pressed', String(on));
        passInput.type = on ? 'text' : 'password';
        confirmInput.type = on ? 'text' : 'password';
        U.clear(showPass);
        showPass.appendChild(U.icon('eye', 15));
        showPass.appendChild(U.el('span', { text: on ? 'Hide' : 'Show' }));
      }
      showPass.addEventListener('click', toggleReveal);

      // Password strength meter (real, based on what they typed)
      const meter = U.el('div', { class: 'auth__meter' }, [U.el('i'), U.el('i'), U.el('i'), U.el('i')]);
      const meterLabel = U.el('div', { class: 'auth__meter-label', text: 'Use at least 4 characters' });
      function scorePassword(p) {
        if (!p) return 0;
        let s = 0;
        if (p.length >= 4) s++;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
        if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
        return Math.min(4, s);
      }
      passInput.addEventListener('input', () => {
        const s = scorePassword(passInput.value);
        const labels = ['Use at least 4 characters', 'Weak', 'Fair', 'Good', 'Strong'];
        const cls = ['', 'is-weak', 'is-fair', 'is-good', 'is-strong'];
        U.$$('i', meter).forEach((bar, i) => {
          bar.className = i < s ? cls[s] : '';
        });
        meterLabel.textContent = labels[s];
      });

      card.appendChild(
        U.el('div', { class: 'auth__brand auth__brand--compact' }, [
          U.el('h1', { class: 'auth__title', text: first ? 'Create your account' : 'New account' }),
          U.el('p', {
            class: 'auth__sub',
            text: first
              ? 'Just a name and a password — no email, no sign-up emails, nothing to verify.'
              : 'Each account keeps its own planner on this device.',
          }),
        ])
      );

      card.appendChild(U.el('div', { class: 'field' }, [
        U.el('label', { class: 'field__label', text: 'Name' }), nameInput, nameErr,
        U.el('div', { class: 'field__hint', text: 'This is how you sign in. Use something you will remember.' }),
      ]));
      card.appendChild(U.el('div', { class: 'field' }, [
        U.el('label', { class: 'field__label', text: 'Password' }), passInput,
        U.el('div', { class: 'row row--between', style: { marginTop: '8px' } }, [meter, showPass]),
        meterLabel, passErr,
      ]));
      card.appendChild(U.el('div', { class: 'field' }, [
        U.el('label', { class: 'field__label', text: 'Confirm password' }), confirmInput, confirmErr,
      ]));

      const submit = U.el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button', text: 'Create account' });
      card.appendChild(
        U.el('div', { class: 'auth__actions' }, [
          submit,
          Auth.count() > 0
            ? U.el('button', {
                class: 'btn btn--ghost btn--block',
                type: 'button',
                text: 'I already have an account',
                onclick: () => {
                  mode = MODES.LOGIN;
                  paint();
                },
              })
            : U.el('button', {
                class: 'btn btn--ghost btn--block',
                type: 'button',
                text: 'Continue without an account',
                onclick: () => {
                  Auth.continueAsGuest();
                  if (o.onGuest) o.onGuest();
                },
              }),
        ])
      );

      card.appendChild(
        U.el('div', { class: 'auth__note' }, [
          U.icon('lock', 13),
          U.el('span', { text: 'Your planner is encrypted on this device (AES-GCM) before it is uploaded, so the server only holds scrambled data. Sign in with the same name and password on any device to get your work.' }),
        ])
      );

      function clearErrors() {
        [nameErr, passErr, confirmErr].forEach((e) => {
          e.classList.add('hidden');
          e.textContent = '';
        });
        [nameInput, passInput, confirmInput].forEach((i) => i.closest('.field').classList.remove('field--invalid'));
      }

      async function attempt() {
        if (busy) return;
        clearErrors();
        busy = true;
        submit.disabled = true;
        submit.textContent = 'Creating…';
        let res;
        try {
          res = await Auth.register({
            name: nameInput.value,
            password: passInput.value,
            confirm: confirmInput.value,
          });
        } catch (e) {
          res = { ok: false, error: 'Something went wrong creating the account. Please try again.', field: 'name' };
        }
        busy = false;
        submit.disabled = false;
        submit.textContent = 'Create account';
        if (!res.ok) {
          const map = { name: [nameErr, nameInput], password: [passErr, passInput], confirm: [confirmErr, confirmInput] };
          const [errEl, inputEl] = map[res.field] || map.name;
          errEl.textContent = res.error;
          errEl.classList.remove('hidden');
          inputEl.closest('.field').classList.add('field--invalid');
          inputEl.focus();
          return;
        }
        UI.toast('Account created. Welcome, ' + res.account.name + '.');
        done();
      }

      submit.addEventListener('click', attempt);
      [nameInput, passInput, confirmInput].forEach((el) => {
        el.addEventListener('input', () => {
          el.closest('.field').classList.remove('field--invalid');
          clearErrors();
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attempt();
          }
        });
      });
    }

    /* ------------------------------- Paint ------------------------------ */
    function paint() {
      if (mode === MODES.LOGIN) paintLogin();
      else if (mode === MODES.REGISTER) paintRegister();
      else paintWelcome();
      const auto = card.querySelector('[data-autofocus]');
      if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 120);
      root.scrollTop = 0;
    }

    paint();
    return root;
  }

  /** The "sign in" prompt shown when a guest wants an account. */
  function accountSheet() {
    const s = UI.sheet({
      title: 'Your account',
      subtitle: Auth.current() ? Auth.current().name : 'Browsing as a guest',
      body: [
        Auth.current()
          ? U.el('div', { class: 'card card--pad', style: { marginBottom: '14px' } }, [
              U.el('div', { class: 'row', style: { gap: '12px' } }, [
                U.el('span', { class: 'avatar', style: { background: Auth.current().avatarColor }, text: initials(Auth.current().name) }),
                U.el('div', { class: 'grow col' }, [
                  U.el('div', { style: { fontWeight: '600' }, text: Auth.current().name }),
                  U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'Signed in on this device' }),
                ]),
              ]),
            ])
          : U.el('p', { class: 'text-secondary', style: { lineHeight: '1.55', marginBottom: '14px' }, text: 'You are using the planner as a guest. Create an account to keep your work separate from anyone else who uses this browser.' }),
        U.el('div', { class: 'list list--plain' }, [
          Auth.current()
            ? U.el('button', {
                class: 'list__row', type: 'button',
                onclick: () => {
                  s.close();
                  global.Router.go('/settings');
                },
              }, [
                U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('settings', 17)]),
                U.el('span', { class: 'list__label grow', text: 'Account settings' }),
              ])
            : U.el('button', {
                class: 'list__row', type: 'button',
                onclick: () => {
                  s.close();
                  global.Router.go('/signin');
                },
              }, [
                U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--text-secondary)' } }, [U.icon('user', 17)]),
                U.el('span', { class: 'list__label grow', text: 'Create an account or sign in' }),
              ]),
          U.el('button', {
            class: 'list__row', type: 'button',
            onclick: async () => {
              s.close();
              const ok = await UI.confirm({
                title: Auth.current() ? 'Sign out?' : 'Leave guest mode?',
                message: 'Your planner data stays saved on this device.',
                confirmLabel: 'Sign out',
              });
              if (!ok) return;
              Auth.logout();
              location.hash = '';
              location.reload();
            },
          }, [
            U.el('span', { class: 'list__icon', style: { background: 'var(--bg-sunken)', color: 'var(--danger)' } }, [U.icon('lock', 17)]),
            U.el('span', { class: 'list__label grow', style: { color: 'var(--danger)' }, text: Auth.current() ? 'Sign out' : 'Exit guest mode' }),
          ]),
        ]),
      ],
    });
    return s;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  }

  global.AuthScreens = { authScreen, accountSheet, MODES };
  global.Screens = global.Screens || {};
  /**
   * /signin — the full-screen auth surface. Marked fullPage so the router
   * hands over the whole window instead of nesting it in the app shell.
   */
  global.Screens.signin = function () {
    const root = U.el('div');
    root.appendChild(
      authScreen({
        startMode: Auth.count() ? MODES.LOGIN : MODES.REGISTER,
        onAuthed: () => {
          UI.toast('Signed in.');
          location.hash = '';
          location.reload();
        },
        onGuest: () => {
          location.hash = '';
          location.reload();
        },
      })
    );
    return { node: root, title: 'Sign in', fullPage: true };
  };
})(window);
