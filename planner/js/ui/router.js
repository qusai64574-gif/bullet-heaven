/* ==========================================================================
   router.js — hash router with params, history, scroll restoration and
   an app shell (header + bottom navigation) that screens render into.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;

  const TABS = [
    { id: 'home', label: 'Home', icon: 'home', route: '/home', match: ['/home', '/today', '/'] },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', route: '/calendar', match: ['/calendar'] },
    { id: 'tasks', label: 'Tasks', icon: 'checkCircle', route: '/tasks', match: ['/tasks', '/homework', '/deadlines', '/history'] },
    { id: 'projects', label: 'Projects', icon: 'folder', route: '/projects', match: ['/projects', '/exams', '/events'] },
    { id: 'more', label: 'More', icon: 'more', route: '/more', match: ['/more', '/subjects', '/timetable', '/notes', '/statistics', '/settings', '/assistant', '/search', '/about', '/trash'] },
  ];

  /** Route table: [pattern, screenKey]. Patterns support :params. */
  const ROUTES = [
    ['/', 'home'],
    ['/home', 'home'],
    ['/signin', 'signin'],
    ['/today', 'today'],
    ['/calendar', 'calendar'],
    ['/tasks', 'tasks'],
    ['/homework', 'homework'],
    ['/projects', 'projects'],
    ['/exams', 'exams'],
    ['/events', 'events'],
    ['/deadlines', 'deadlines'],
    ['/more', 'more'],
    ['/subjects', 'subjects'],
    ['/subjects/:id', 'subjectDetail'],
    ['/timetable', 'timetable'],
    ['/notes', 'notes'],
    ['/notes/:id', 'noteDetail'],
    ['/statistics', 'statistics'],
    ['/history', 'history'],
    ['/settings', 'settings'],
    ['/search', 'search'],
    ['/assistant', 'assistant'],
    ['/about', 'about'],
    ['/trash', 'trash'],
    ['/homework/:id', 'detail:homework'],
    ['/tasks/:id', 'detail:tasks'],
    ['/projects/:id', 'detail:projects'],
    ['/exams/:id', 'detail:exams'],
    ['/events/:id', 'detail:events'],
  ];

  const state = {
    current: null,
    params: {},
    screen: null,
    title: '',
    history: [],
    scrollPositions: {},
    cleanup: null,
  };

  const listeners = [];

  function onChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function emit(route) {
    listeners.slice().forEach((fn) => {
      try {
        fn(route);
      } catch (e) {
        console.error('[router] listener failed', e);
      }
    });
  }

  /* ------------------------------ Parsing ------------------------------- */
  function currentPath() {
    const raw = String(location.hash || '').replace(/^#/, '');
    if (!raw) return '/home';
    return raw.startsWith('/') ? raw : '/' + raw;
  }

  function splitPath(path) {
    const [p, qs] = path.split('?');
    const query = {};
    if (qs) {
      qs.split('&').forEach((pair) => {
        if (!pair) return;
        const [k, v] = pair.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { path: p.replace(/\/+$/, '') || '/', query };
  }

  function match(path) {
    const segments = path.split('/').filter(Boolean);
    for (const [pattern, screen] of ROUTES) {
      const pSegs = pattern.split('/').filter(Boolean);
      if (pSegs.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < pSegs.length; i++) {
        if (pSegs[i].startsWith(':')) params[pSegs[i].slice(1)] = decodeURIComponent(segments[i]);
        else if (pSegs[i] !== segments[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { screen, params, pattern };
    }
    return null;
  }

  /* ------------------------------ Navigation ---------------------------- */
  function go(path, opts) {
    const o = opts || {};
    const target = path.startsWith('/') ? path : '/' + path;
    const hash = '#' + target;
    if (location.hash === hash) {
      handle(true);
      return;
    }
    if (o.replace) location.replace(hash);
    else location.hash = target;
  }

  function back() {
    if (history.length > 1) history.back();
    else go('/home');
  }

  function replace(path) {
    go(path, { replace: true });
  }

  /* ------------------------------ Shell --------------------------------- */
  let shellEls = null;

  function ensureShell() {
    if (shellEls && document.body.contains(shellEls.root)) return shellEls;
    const root = U.$('#app');

    const header = U.el('header', { class: 'app-header' });
    const headerInner = U.el('div', { class: 'app-header__inner' });
    const backBtn = U.el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Go back',
      onclick: () => back(),
      style: { display: 'none' },
    }, [U.icon('chevronLeft', 22)]);
    const titleWrap = U.el('div', { class: 'grow col', style: { minWidth: 0 } });
    const titleEl = U.el('div', { class: 'app-header__title' });
    const subEl = U.el('div', { class: 'app-header__sub' });
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);
    const actions = U.el('div', { class: 'row', style: { gap: '2px' } });
    headerInner.appendChild(backBtn);
    headerInner.appendChild(titleWrap);
    headerInner.appendChild(actions);
    header.appendChild(headerInner);

    const main = U.el('main', { class: 'app-main', id: 'main', tabindex: '-1' });

    const nav = U.el('nav', { class: 'bottom-nav', 'aria-label': 'Main navigation' });
    const navInner = U.el('div', { class: 'bottom-nav__inner' });
    TABS.forEach((tab) => {
      const btn = U.el('button', {
        class: 'nav-tab',
        type: 'button',
        dataset: { tab: tab.id },
        'aria-label': tab.label,
        onclick: () => {
          U.haptic(5);
          go(tab.route);
        },
      }, [
        U.el('span', { class: 'nav-tab__icon' }, [U.icon(tab.icon, 22), U.el('span', { class: 'nav-tab__dot' })]),
        U.el('span', { text: tab.label }),
      ]);
      navInner.appendChild(btn);
    });
    nav.appendChild(navInner);

    root.appendChild(header);
    root.appendChild(main);
    root.appendChild(nav);

    // Header shadow on scroll
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      header.classList.toggle('is-scrolled', y > 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    shellEls = { root, header, backBtn, titleEl, subEl, actions, main, nav, navInner, onScroll };
    return shellEls;
  }

  /** Screens call this to configure the header for their view. */
  function setHeader(opts) {
    const s = ensureShell();
    const o = opts || {};
    s.titleEl.textContent = o.title || '';
    s.subEl.textContent = o.subtitle || '';
    s.subEl.style.display = o.subtitle ? '' : 'none';
    s.backBtn.style.display = o.back ? '' : 'none';
    U.clear(s.actions);
    (o.actions || []).forEach((a) => {
      if (a.node) {
        s.actions.appendChild(a.node);
        return;
      }
      s.actions.appendChild(
        U.el('button', {
          class: 'icon-btn',
          type: 'button',
          'aria-label': a.label,
          onclick: a.onClick,
        }, [U.icon(a.icon, 21)])
      );
    });
    state.title = o.title || '';
    if (o.flush) s.main.classList.add('app-main--flush');
    else s.main.classList.remove('app-main--flush');
    if (o.hideNav) s.nav.classList.add('hidden');
    else s.nav.classList.remove('hidden');
    if (o.hideHeader) s.header.classList.add('hidden');
    else s.header.classList.remove('hidden');
  }

  function setNavBadge(tabId, on) {
    const s = ensureShell();
    const dot = s.navInner.querySelector('[data-tab="' + tabId + '"] .nav-tab__dot');
    if (dot) dot.classList.toggle('is-on', !!on);
  }

  function setActiveTab(screen) {
    const s = ensureShell();
    const path = '/' + (state.current || '').split('/').filter(Boolean)[0];
    let active = TABS[0];
    // Prefer the screen's declared tab when the route is ambiguous.
    const byScreen = {
      today: 'home', home: 'home', calendar: 'calendar',
      tasks: 'tasks', homework: 'tasks', deadlines: 'tasks', history: 'tasks',
      projects: 'projects', exams: 'projects', events: 'projects',
      more: 'more', subjects: 'more', subjectDetail: 'more', timetable: 'more',
      notes: 'more', noteDetail: 'more', statistics: 'more', settings: 'more',
      search: 'more', assistant: 'more', about: 'more', trash: 'more',
    };
    const screenKey = screen.split(':')[0];
    if (byScreen[screenKey]) active = TABS.find((t) => t.id === byScreen[screenKey]) || active;
    U.$$('.nav-tab', s.navInner).forEach((btn) => {
      const isActive = btn.dataset.tab === active.id;
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  /* ------------------------------ Handling ------------------------------ */
  let lastPath = null;

  function handle(samePath) {
    const full = currentPath();
    const { path, query } = splitPath(full);
    const m = match(path);
    if (!m) {
      go('/home', { replace: true });
      return;
    }

    if (state.cleanup) {
      try {
        state.cleanup();
      } catch (e) {}
      state.cleanup = null;
    }

    // Remember scroll for the page we're leaving.
    if (lastPath && lastPath !== path) {
      state.scrollPositions[lastPath] = window.scrollY || 0;
    }

    state.current = path;
    state.params = m.params;
    state.screen = m.screen;

    const s = ensureShell();
    U.clear(s.main);
    setActiveTab(m.screen);

    const Screens = global.Screens;
    const key = m.screen;
    const isDetail = key.indexOf('detail:') === 0;
    const collection = isDetail ? key.split(':')[1] : null;

    let view = null;
    try {
      if (isDetail) {
        view = Screens.detail(collection, m.params.id, query);
      } else if (typeof Screens[key] === 'function') {
        view = Screens[key](m.params, query);
      } else {
        view = Screens.notFound ? Screens.notFound(path) : null;
      }
    } catch (e) {
      console.error('[router] screen failed: ' + key, e);
      view = {
        node: global.UI.errorPanel(
          'This screen hit an unexpected problem. Your data is safe — try going back.',
          () => handle(true)
        ),
        title: 'Error',
      };
    }

    if (!view) view = { node: U.el('div', { class: 'empty__body', text: 'Nothing to show.' }) };

    if (view.beforeRender) {
      try {
        view.beforeRender();
      } catch (e) {
        console.error('[router] beforeRender failed', e);
      }
    }

    const node = view.node || view;

    // A screen can take over the whole window (sign-in, onboarding). Those
    // must not render inside the app shell, or the header/nav bleed through.
    if (view.fullPage) {
      U.clear(s.root);
      s.root.appendChild(node);
      state.cleanup = view.cleanup || null;
      document.title = (view.title ? view.title + ' · ' : '') + 'Study Planner';
      lastPath = path;
      emit({ path, screen: m.screen, params: m.params, query });
      if (view.afterRender) {
        try {
          view.afterRender();
        } catch (e) {
          console.error('[router] afterRender failed', e);
        }
      }
      return;
    }

    s.main.appendChild(node);
    if (view.header !== false) {
      setHeader({
        title: view.title || '',
        subtitle: view.subtitle,
        back: view.back !== undefined ? view.back : isDetail || path !== '/home',
        actions: view.actions || [],
        flush: !!view.flush,
        hideNav: !!view.hideNav,
        hideHeader: !!view.hideHeader,
      });
    }
    state.cleanup = view.cleanup || null;
    if (view.afterRender) {
      try {
        view.afterRender();
      } catch (e) {
        console.error('[router] afterRender failed', e);
      }
    }

    // Scroll: restore on back, otherwise top.
    const restore = samePath ? state.scrollPositions[path] : 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: restore || 0, behavior: 'auto' });
    });

    document.title = (view.title ? view.title + ' · ' : '') + 'Study Planner';
    lastPath = path;
    emit({ path, screen: m.screen, params: m.params, query });
  }

  function start() {
    ensureShell();
    window.addEventListener('hashchange', () => handle(false));
    if (!location.hash) location.replace('#/home');
    handle(true);
  }

  function currentTab() {
    return state.screen;
  }

  global.Router = {
    TABS, ROUTES, start, go, replace, back, handle, onChange, setHeader, setNavBadge,
    setActiveTab, currentPath, currentTab,
    get state() {
      return state;
    },
  };
})(window);
