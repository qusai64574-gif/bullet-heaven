/* ==========================================================================
   app.js — boot sequence, global chrome (FAB, offline banner, error guards),
   keyboard shortcuts and service-worker registration.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const Store = global.Store;
  const UI = global.UI;

  let booted = false;

  /* -------------------------------- Boot -------------------------------- */
  function boot() {
    if (booted) return;
    booted = true;

    const appRoot = U.$('#app');

    // Accounts first: the store must point at the right document before any
    // planner data is read. (Store.init() is called inside Auth.init().)
    let account = null;
    try {
      account = global.Auth.init();
      if (!account) Store.init();
    } catch (e) {
      console.error('[app] storage init failed', e);
      appRoot.appendChild(
        UI.errorPanel('The planner could not open its storage on this device. Try reloading the app.', () => location.reload())
      );
      return;
    }

    // Theme before first paint (also applied inline in index.html to avoid flash)
    UI.applyTheme(Store.getSetting('theme', 'system'), { animate: false });

    // Storage problems surface as a message, never a silent data loss.
    Store.on('storage-error', (e) => {
      UI.toast(e && e.message ? e.message : 'There was a problem saving to this device.', { duration: 8000 });
    });

    // A date rollover while the app is open should refresh derived state.
    watchDateRollover();

    // ---- Gate: an account, or an explicit guest session, is required. ----
    const session = global.Auth.session();
    if (!account && !session) {
      renderAuth(appRoot, { startMode: null });
      return;
    }

    if (!Store.getSetting('onboarded', false) && Store.isEmpty()) {
      renderOnboarding(appRoot);
      return;
    }
    if (!Store.getSetting('onboarded', false)) {
      // Data exists but the flag is missing (e.g. imported backup) — don't force setup.
      Store.setSetting('onboarded', true);
    }

    startApp();
  }

  function renderAuth(appRoot, opts) {
    U.clear(appRoot);
    document.body.classList.add('is-onboarding');
    const node = global.AuthScreens.authScreen({
      startMode: (opts && opts.startMode) || null,
      onAuthed: () => {
        document.body.classList.remove('is-onboarding');
        U.clear(appRoot);
        // A brand new account has an empty planner → run setup.
        if (!Store.getSetting('onboarded', false) && Store.isEmpty()) renderOnboarding(appRoot);
        else startApp();
      },
      onGuest: () => {
        document.body.classList.remove('is-onboarding');
        U.clear(appRoot);
        if (!Store.getSetting('onboarded', false) && Store.isEmpty()) renderOnboarding(appRoot);
        else startApp();
      },
    });
    appRoot.appendChild(node);
  }

  function renderOnboarding(appRoot) {
    U.clear(appRoot);
    document.body.classList.add('is-onboarding');
    const node = global.Screens.onboarding({
      onDone: () => {
        document.body.classList.remove('is-onboarding');
        U.clear(appRoot);
        startApp();
      },
    });
    appRoot.appendChild(node);
  }

  function startApp() {
    const appRoot = U.$('#app');
    U.clear(appRoot);
    global.Router.start();
    global.Notify.start();
    installFab();
    installChrome();
    installShortcuts();
    registerServiceWorker();

    // Keep the greeting/avatar in step when the account changes.
    global.Store.on('auth', () => {
      if (Store.getSetting('onboarded', false)) global.Router.handle(true);
    });

    // Push every edit up to the server shortly after it happens, so a student
    // who switches devices finds the work already there.
    global.Store.on('change', (e) => {
      if (!global.Auth.isSignedIn()) return;
      if (e && e.collection === 'conversations') return; // chat history stays local
      global.Auth.scheduleSync('change');
    });
    global.Store.on('settings', () => {
      if (global.Auth.isSignedIn()) global.Auth.scheduleSync('settings');
    });
    global.Store.on('profile', () => {
      if (global.Auth.isSignedIn()) global.Auth.scheduleSync('profile');
    });

    // Flush a pending sync when the app goes to the background, and catch up
    // when the connection returns.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        Store.flush();
        if (global.Auth.isSignedIn() && global.Auth.syncStatus().pending) global.Auth.sync({ reason: 'background' });
      }
    });
    global.addEventListener('online', () => {
      if (global.Auth.isSignedIn()) {
        global.Auth.sync({ reason: 'reconnect' });
        UI.toast('Back online — syncing your planner.');
      }
    });
    global.addEventListener('offline', () => {
      if (global.Auth.isSignedIn()) UI.toast('Offline — your work is saved here and will sync later.', { duration: 5000 });
    });

    // Assistant state that depends on time (greeting) refreshes on return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const last = lastRenderDate;
        if (last && last !== U.todayISO()) {
          lastRenderDate = U.todayISO();
          global.Router.handle(true);
        }
      }
    });
  }

  let lastRenderDate = U.todayISO();

  function watchDateRollover() {
    setInterval(() => {
      const today = U.todayISO();
      if (today !== lastRenderDate) {
        lastRenderDate = today;
        Store.invalidate();
        if (Store.getSetting('onboarded', false)) global.Router.handle(true);
      }
    }, 60000);
  }

  /* --------------------------------- FAB -------------------------------- */
  const FAB_SCREENS = ['home', 'today', 'calendar', 'tasks', 'homework', 'projects', 'exams', 'events', 'deadlines', 'subjects', 'subjectDetail', 'notes', 'timetable'];

  function installFab() {
    const fab = U.el('button', {
      class: 'fab',
      type: 'button',
      'aria-label': 'Add something new',
      onclick: () => global.Planner.quickAdd(),
    }, [U.icon('plus', 22), U.el('span', { text: 'Add' })]);
    document.body.appendChild(fab);

    function update(screen) {
      const key = String(screen || '').split(':')[0];
      const show = FAB_SCREENS.indexOf(key) >= 0;
      fab.style.display = show ? '' : 'none';
    }
    update(global.Router.state.screen);
    global.Router.onChange((r) => update(r.screen));
  }

  /* ------------------------------- Chrome -------------------------------- */
  function installChrome() {
    // Offline banner: the app works offline, but say so plainly when it happens.
    const banner = U.el('div', {
      class: 'offline-banner',
      role: 'status',
      'aria-live': 'polite',
      style: {
        position: 'fixed',
        top: 'calc(var(--safe-top) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '90',
        display: 'none',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 14px',
        borderRadius: '999px',
        background: 'var(--text-primary)',
        color: 'var(--bg-canvas)',
        fontSize: 'var(--fs-footnote)',
        fontWeight: '500',
        boxShadow: 'var(--shadow-3)',
      },
    }, [U.icon('wifiOff', 14), U.el('span', { text: 'Offline — everything still works' })]);
    document.body.appendChild(banner);

    function update() {
      banner.style.display = navigator.onLine ? 'none' : 'flex';
    }
    global.addEventListener('online', update);
    global.addEventListener('offline', update);
    update();

    // Warn before leaving with unsaved data (rare, but honest).
    global.addEventListener('beforeunload', () => Store.flush());

    // Prevent iOS double-tap zoom on controls while keeping pinch zoom.
    let lastTouch = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        if (now - lastTouch <= 300 && !e.target.closest('input,textarea')) {
          e.preventDefault();
        }
        lastTouch = now;
      },
      { passive: false }
    );

    // Global error guards — never leave a frozen screen.
    global.addEventListener('error', (e) => {
      console.error('[app] uncaught error', e.error || e.message);
    });
    global.addEventListener('unhandledrejection', (e) => {
      console.error('[app] unhandled rejection', e.reason);
      const msg = e.reason && e.reason.message ? e.reason.message : '';
      if (/quota|storage/i.test(msg)) {
        UI.toast('This device is out of storage space. Export a backup and free some space.', { duration: 8000 });
      }
    });

    // Theme follows the system when set to "System".
    Store.on('settings', (e) => {
      if (e && (e.key === 'theme' || e.key === '*')) {
        const mode = Store.getSetting('theme', 'system');
        UI.applyTheme(mode, { animate: true });
      }
    });
  }

  /* ----------------------------- Shortcuts ------------------------------- */
  function installShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'k') {
          e.preventDefault();
          global.Router.go('/search');
        }
        return;
      }
      if (typing) {
        if (e.key === 'Escape' && e.target.blur) e.target.blur();
        return;
      }
      const map = {
        '1': '/home',
        '2': '/calendar',
        '3': '/tasks',
        '4': '/projects',
        '5': '/more',
        t: '/today',
        d: '/deadlines',
        s: '/search',
        a: '/assistant',
        n: '/settings',
      };
      if (map[e.key]) {
        e.preventDefault();
        global.Router.go(map[e.key]);
      }
      if (e.key === 'n' && e.shiftKey) {
        e.preventDefault();
        global.Planner.quickAdd();
      }
    });
  }

  /* --------------------------- Service worker ---------------------------- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    // Local development must never serve a stale shell — the worker caches
    // every asset, which silently hides edits. Production keeps the worker.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        // Refresh the shell when a new version is waiting.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              UI.toast('A new version is ready.', {
                actionLabel: 'Reload',
                onAction: () => {
                  sw.postMessage({ type: 'SKIP_WAITING' });
                  location.reload();
                },
                duration: 8000,
              });
            }
          });
        });
      })
      .catch((e) => {
        console.warn('[app] service worker registration failed', e);
      });
  }

  /* -------------------------------- Start -------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose a tiny debug surface for support and manual testing.
  global.StudyPlanner = {
    version: '1.0.0',
    boot,
    export: () => Store.exportData(),
    counts: () => Store.exportCounts(),
    stats: () => Store.stats(),
  };
})(window);
