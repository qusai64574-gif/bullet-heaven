/* ==========================================================================
   utils.js — pure helpers: dates, ids, DOM, formatting, icons
   No app state here; safe to load first.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------- IDs --------------------------------- */
  function uid(prefix) {
    const rnd =
      global.crypto && global.crypto.getRandomValues
        ? Array.from(global.crypto.getRandomValues(new Uint8Array(8)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        : Math.random().toString(16).slice(2, 18);
    return (prefix || 'id') + '_' + Date.now().toString(36) + rnd.slice(0, 6);
  }

  /* ------------------------------ Dates -------------------------------- */
  const DAY_MS = 86400000;
  const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Date -> "YYYY-MM-DD" in local time (never UTC-shifted) */
  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISO() {
    return toISO(new Date());
  }

  /** "YYYY-MM-DD" -> Date at local midnight. Returns null when invalid. */
  function parseISO(iso) {
    if (!iso || typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
    return d;
  }

  function isValidISO(iso) {
    return parseISO(iso) !== null;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    const c = startOfDay(d);
    c.setDate(c.getDate() + n);
    return c;
  }

  function addMonths(d, n) {
    const c = startOfDay(d);
    const day = c.getDate();
    c.setDate(1);
    c.setMonth(c.getMonth() + n);
    const last = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
    c.setDate(Math.min(day, last));
    return c;
  }

  /** Whole calendar days from a -> b (b - a). DST-safe via midnight normalisation. */
  function diffDays(aISO, bISO) {
    const a = typeof aISO === 'string' ? parseISO(aISO) : startOfDay(aISO);
    const b = typeof bISO === 'string' ? parseISO(bISO) : startOfDay(bISO);
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
  }

  /** weekStart: 0=Sunday … 6=Saturday */
  function startOfWeek(d, weekStart) {
    const c = startOfDay(d);
    const shift = (c.getDay() - (weekStart || 0) + 7) % 7;
    return addDays(c, -shift);
  }

  function endOfWeek(d, weekStart) {
    return addDays(startOfWeek(d, weekStart), 6);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  /** 6x7 matrix of Dates covering the month, aligned to weekStart */
  function monthMatrix(year, month, weekStart) {
    const first = new Date(year, month, 1);
    const start = startOfWeek(first, weekStart);
    const rows = [];
    let cursor = start;
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        row.push(cursor);
        cursor = addDays(cursor, 1);
      }
      rows.push(row);
    }
    return rows;
  }

  function nowHM() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** "14:30" + "2026-10-06" -> Date (local). Returns null on bad input. */
  function combine(dateISO, timeHM) {
    const d = parseISO(dateISO);
    if (!d) return null;
    if (!timeHM || !/^\d{1,2}:\d{2}$/.test(timeHM)) return new Date(d.getTime() + 23 * 3600000 + 59 * 60000);
    const [h, mi] = timeHM.split(':').map(Number);
    if (h > 23 || mi > 59) return null;
    d.setHours(h, mi, 0, 0);
    return d;
  }

  function minutesOf(timeHM) {
    if (!timeHM || !/^\d{1,2}:\d{2}$/.test(timeHM)) return null;
    const [h, m] = timeHM.split(':').map(Number);
    return h * 60 + m;
  }

  /* ---------------------------- Formatting ----------------------------- */
  function use24h() {
    try {
      return !!(global.Store && Store.getSetting('timeFormat') === '24');
    } catch (e) {
      return false;
    }
  }

  /** "14:30" -> "2:30 PM" (or "14:30" in 24h mode) */
  function fmtTime(timeHM) {
    const mins = minutesOf(timeHM);
    if (mins === null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (use24h()) return pad2(h) + ':' + pad2(m);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad2(m) + ' ' + ap;
  }

  /** Short: "Oct 6" / with year when different */
  function fmtDateShort(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() + (sameYear ? '' : ', ' + d.getFullYear());
  }

  /** "Mon, Oct 6" */
  function fmtDateMedium(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return DOW_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
  }

  /** "Monday, October 6, 2026" */
  function fmtDateLong(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return DOW_LONG[d.getDay()] + ', ' + MONTH_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function fmtMonthYear(d) {
    return MONTH_LONG[d.getMonth()] + ' ' + d.getFullYear();
  }

  /** Date-aware label: Today / Tomorrow / Yesterday / Mon, Oct 6 */
  function fmtDateRelative(iso) {
    const delta = diffDays(todayISO(), iso);
    if (delta === 0) return 'Today';
    if (delta === 1) return 'Tomorrow';
    if (delta === -1) return 'Yesterday';
    if (delta > 1 && delta < 7) return DOW_LONG[parseISO(iso).getDay()];
    return fmtDateMedium(iso);
  }

  /** "in 3 days" / "2 days overdue" / "today" */
  function fmtCountdown(iso) {
    const delta = diffDays(todayISO(), iso);
    if (delta === 0) return 'Today';
    if (delta === 1) return 'Tomorrow';
    if (delta === -1) return 'Yesterday';
    if (delta > 1) return 'In ' + delta + ' days';
    return Math.abs(delta) + ' days ago';
  }

  function fmtOverdue(iso) {
    const delta = diffDays(iso, todayISO());
    if (delta <= 0) return '';
    return delta === 1 ? '1 day overdue' : delta + ' days overdue';
  }

  function fmtDuration(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    if (!m) return '';
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? h + 'h ' + rem + 'm' : h + 'h';
  }

  function fmtDateStamp(ts) {
    const d = new Date(ts);
    const delta = diffDays(todayISO(), toISO(d));
    const t = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (delta === 0) return 'Today, ' + fmtTime(t);
    if (delta === -1) return 'Yesterday, ' + fmtTime(t);
    return fmtDateShort(toISO(d)) + ', ' + fmtTime(t);
  }

  function greeting(name) {
    const h = new Date().getHours();
    const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
    return name ? part + ', ' + name : part;
  }

  /* ------------------------------- DOM --------------------------------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  /** Build an element: el('div', {class:'x', dataset:{id:1}}, [child, 'text']) */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) {
            if (sk.indexOf('--') === 0) node.style.setProperty(sk, String(v[sk]));
            else node.style[sk] = v[sk];
          }
        }
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'value') node.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple') node[k] = !!v;
        else node.setAttribute(k, v);
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) {
      children.forEach((c) => appendChildren(node, c));
      return;
    }
    if (children instanceof Node) node.appendChild(children);
    else node.appendChild(document.createTextNode(String(children)));
  }

  /** Parse an HTML string into a single element (attributes preserved). */
  function h(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function frag(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Wrap query matches in <mark> on an already-escaped string. */
  function highlight(escapedText, query) {
    if (!query) return escapedText;
    const q = query.trim();
    if (q.length < 1) return escapedText;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return escapedText.replace(new RegExp('(' + safe + ')', 'ig'), '<mark>$1</mark>');
    } catch (e) {
      return escapedText;
    }
  }

  function on(node, evt, sel, handler) {
    node.addEventListener(evt, function (e) {
      const target = e.target.closest(sel);
      if (target && node.contains(target)) handler(e, target);
    });
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait);
    };
  }

  function throttle(fn, wait) {
    let last = 0, timer = null;
    return function () {
      const args = arguments, ctx = this, now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(ctx, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          fn.apply(ctx, args);
        }, wait - (now - last));
      }
    };
  }

  function nextFrame(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function plural(n, one, many) {
    return n === 1 ? one : many || one + 's';
  }

  /* ------------------------------ Icons -------------------------------- */
  const PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.6V20a1 1 0 0 0 1 1h3.5v-5.5h5V21H18a1 1 0 0 0 1-1V9.6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.6.8l1 1.3h7.2A2.5 2.5 0 0 1 21 9.6v7.9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5"/><path d="M17 5.2a3.5 3.5 0 0 1 0 6.6M18 20c0-2.2-.7-4-2-5.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10.5 10.5z"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5V20.5"/>',
    cap: '<path d="M2.5 8.5 12 4l9.5 4.5L12 13z"/><path d="M6 10.5V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5.5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    clip: '<path d="M20.4 11.5 12 19.9a5 5 0 0 1-7-7l8.4-8.4a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a1.8 1.8 0 0 1-2.5-2.5l7.7-7.7"/>',
    trash: '<path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.5 11v6M13.5 11v6"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 5.5l4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4.5V8.5h4"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5"/><path d="M20 19.5v-4h-4"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.3v.2"/>',
    warning: '<path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 16.5v.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
    sparkles: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z"/><path d="M19 4v3M17.5 5.5h3"/>',
    message: '<path d="M20.5 12a8 8 0 0 1-8 8H4.5l1.6-3A8 8 0 1 1 20.5 12z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.2M3.5 12h.2M3.5 18h.2"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    filter: '<path d="M3.5 5.5h17l-6.5 8v6l-4-2v-4z"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M20.5 6H7A4 4 0 0 0 3 10v1"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M3.5 18H17a4 4 0 0 0 4-4v-1"/>',
    star: '<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 10l5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    trending: '<path d="M3.5 17 9 11.5l3.5 3.5L20.5 7"/><path d="M15.5 7h5v5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<path d="M7 4.5 19 12 7 19.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    download: '<path d="M12 3.5v11M7.5 10 12 14.5 16.5 10"/><path d="M4 20h16"/>',
    upload: '<path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8"/><path d="M4 20h16"/>',
    share: '<path d="M12 3v12M8 6.5 12 2.5l4 4"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    camera: '<path d="M4 8.5h2.8l1.4-2h7.6l1.4 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5z"/><circle cx="12" cy="13.5" r="3.2"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m4 17 4.5-4.5L12 16l3-2.5 5 4.5"/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/>',
    zap: '<path d="M13.5 2.5 4 14h6l-1.5 7.5L19 10h-6z"/>',
    flag: '<path d="M5 21V4.5M5 5h11l-1.5 4L16 13H5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.8-1 7.2 4.5-2.6 4.5 2.6-1-7.2"/>',
    clipboard: '<rect x="6" y="4.5" width="12" height="16" rx="2.5"/><path d="M9.5 4.5V3.6A1.1 1.1 0 0 1 10.6 2.5h2.8a1.1 1.1 0 0 1 1.1 1.1v.9z"/><path d="M9.5 11h5M9.5 15h3"/>',
    send: '<path d="M20.5 3.5 3.5 10.4l6.6 2.5 2.5 6.6z"/><path d="M20.5 3.5 10.1 12.9"/>',
    menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
    coffee: '<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M6 3.5v1.5M10 3.5v1.5M14 3.5v1.5"/>',
    gauge: '<path d="M4 17a8.5 8.5 0 1 1 16 0"/><path d="m12 13 3.5-3.5"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5"/><path d="M10 13h4"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V10H9"/><path d="M12 8v4.5l3 1.8"/>',
    school: '<path d="M3 20V9l9-5 9 5v11"/><path d="M9 20v-6h6v6"/><path d="M2 20h20"/>',
    palette: '<path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3-3.2 3H16a2 2 0 0 0-1.4 3.4A1.8 1.8 0 0 1 12 21z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.8" cy="10" r="1.2"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 13a10 10 0 0 1 3-2M19 13a10 10 0 0 0-3.5-2.4M12 20h.01"/>',
  };

  /**
   * icon(name, size, extraClass)
   * Returns an <svg> element (stroke-based, 24px grid, currentColor).
   */
  function icon(name, size, cls) {
    const d = PATHS[name] || PATHS.circle;
    const s = size || 20;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    svg.innerHTML = d;
    return svg;
  }

  function iconHTML(name, size) {
    const d = PATHS[name] || PATHS.circle;
    const s = size || 20;
    return (
      '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'
    );
  }

  /* --------------------------- Device helpers -------------------------- */
  function isStandalone() {
    return (
      (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
      global.navigator.standalone === true
    );
  }

  function haptic(ms) {
    if (global.navigator && global.navigator.vibrate) {
      try {
        global.navigator.vibrate(ms || 8);
      } catch (e) {}
    }
  }

  function isNative() {
    return !!(global.StudyPlannerNative && global.StudyPlannerNative.isNative);
  }

  /* ------------------------------ Export ------------------------------- */
  global.U = {
    uid, pad2, DAY_MS, DOW_LONG, DOW_SHORT, MONTH_LONG, MONTH_SHORT,
    toISO, todayISO, parseISO, isValidISO, startOfDay, addDays, addMonths,
    diffDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, monthMatrix,
    nowHM, combine, minutesOf,
    fmtTime, fmtDateShort, fmtDateMedium, fmtDateLong, fmtMonthYear,
    fmtDateRelative, fmtCountdown, fmtOverdue, fmtDuration, fmtDateStamp, greeting,
    $, $$, el, h, frag, clear, appendChildren, escapeHtml, highlight, on, debounce, throttle,
    nextFrame, sleep, clamp, plural,
    icon, iconHTML, isStandalone, haptic, isNative,
  };
})(window);
