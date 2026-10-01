/* ==========================================================================
   notify.js — reminders & notifications.
   Two delivery paths:
   1. Native bridge (Android WebView shell) — NotificationManager alarms that
      fire even when the app is closed.
   2. Web fallback — permission-based Notification API + a foreground scheduler
      that fires while the app is open (and reflects the next reminder in-app).
   Nothing is scheduled when the user has notifications switched off.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;

  const FIRED_KEY = 'studyplanner.notify.fired.v1';
  const LOOKAHEAD_MS = 36 * 3600 * 1000; // schedule window
  const TICK_MS = 30000;

  let fired = {};
  let ticker = null;
  let scheduled = new Map(); // key -> timeout id
  let lastError = null;

  function nativeBridge() {
    return global.StudyPlannerNative || null;
  }

  function isNative() {
    const b = nativeBridge();
    return !!(b && b.isNative);
  }

  function loadFired() {
    try {
      fired = JSON.parse(global.localStorage.getItem(FIRED_KEY) || '{}');
    } catch (e) {
      fired = {};
    }
    // keep the map small
    const cutoff = Date.now() - 7 * 86400000;
    Object.keys(fired).forEach((k) => {
      if (fired[k] < cutoff) delete fired[k];
    });
  }

  function saveFired() {
    try {
      global.localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    } catch (e) {}
  }

  function permissionState() {
    if (isNative()) return nativeBridge().notificationPermission ? nativeBridge().notificationPermission() : 'granted';
    if (!('Notification' in global)) return 'unsupported';
    return global.Notification.permission;
  }

  function requestPermission() {
    if (isNative()) {
      try {
        return Promise.resolve(nativeBridge().requestNotificationPermission());
      } catch (e) {
        return Promise.resolve('denied');
      }
    }
    if (!('Notification' in global)) return Promise.resolve('unsupported');
    if (global.Notification.permission === 'granted') return Promise.resolve('granted');
    try {
      const p = global.Notification.requestPermission();
      return p && p.then ? p : Promise.resolve(global.Notification.permission);
    } catch (e) {
      return Promise.resolve('denied');
    }
  }

  /* ------------------------- Reminder computation ----------------------- */
  /** All future reminder moments for one record, as {at:Date, minutes, label}. */
  function remindersFor(collection, rec) {
    const offsets = Array.isArray(rec.reminders) ? rec.reminders : [];
    if (!offsets.length) return [];
    const base = M.whenOf(collection, rec);
    if (!base) return [];
    return offsets
      .map((mins) => {
        const at = new Date(base.getTime() - Number(mins) * 60000);
        return { at, minutes: Number(mins), base };
      })
      .filter((r) => !isNaN(r.at.getTime()));
  }

  function categoryEnabled(collection) {
    if (!Store.getSetting('notificationsEnabled', false)) return false;
    switch (collection) {
      case 'homework': return Store.getSetting('notifyHomework', true);
      case 'projects': return Store.getSetting('notifyProjects', true);
      case 'exams': return Store.getSetting('notifyExams', true);
      case 'events': return Store.getSetting('notifyEvents', true);
      case 'tasks': return Store.getSetting('notifyTasks', true);
      default: return false;
    }
  }

  function inQuietHours(at) {
    const q = Store.getSetting('quietHours', null);
    if (!q || !q.enabled) return false;
    const start = U.minutesOf(q.start);
    const end = U.minutesOf(q.end);
    if (start === null || end === null) return false;
    const mins = at.getHours() * 60 + at.getMinutes();
    if (start <= end) return mins >= start && mins < end;
    return mins >= start || mins < end; // overnight window
  }

  function messageFor(collection, rec) {
    const subject = rec.subjectId ? Store.byId('subjects', rec.subjectId) : null;
    const subj = subject ? subject.name + ' ' : '';
    const title = rec.title || rec.name || 'Planner item';
    const d = M.deadlineOf(collection, rec);
    const tf = M.TIME_FIELD[collection];
    const t = tf && rec[tf] ? ' at ' + U.fmtTime(rec[tf]) : '';
    switch (collection) {
      case 'homework':
        return { title: 'Homework due', body: subj + title + ' is due ' + relativeWord(d) + t + '.' };
      case 'projects':
        return { title: 'Project deadline', body: subj + title + ' is due ' + relativeWord(d) + '.' };
      case 'exams':
        return { title: 'Exam coming up', body: subj + title + ' starts ' + relativeWord(d) + t + '.' };
      case 'events':
        return { title: 'Event reminder', body: title + ' ' + relativeWord(d) + t + '.' };
      default:
        return { title: 'Task reminder', body: title + ' is due ' + relativeWord(d) + t + '.' };
    }
  }

  function relativeWord(iso) {
    if (!iso) return 'soon';
    const delta = U.diffDays(U.todayISO(), iso);
    if (delta < 0) return 'overdue';
    if (delta === 0) return 'today';
    if (delta === 1) return 'tomorrow';
    return 'in ' + delta + ' days';
  }

  /* ---------------------------- Delivery -------------------------------- */
  function deliver(title, body, data) {
    const payload = { title, body, data: data || {}, at: Date.now() };
    if (isNative()) {
      try {
        nativeBridge().notify(title, body, JSON.stringify(data || {}));
        Store.emit('notified', payload);
        return true;
      } catch (e) {
        lastError = String(e);
      }
    }
    if ('Notification' in global && global.Notification.permission === 'granted') {
      try {
        const n = new global.Notification(title, {
          body,
          tag: (data && data.key) || title,
          silent: false,
        });
        n.onclick = () => {
          try {
            global.focus();
            n.close();
          } catch (e) {}
          if (data && data.route && global.Router) global.Router.go(data.route);
        };
        Store.emit('notified', payload);
        return true;
      } catch (e) {
        lastError = String(e);
      }
    }
    // Always surface in-app so a reminder is never silently dropped.
    Store.emit('reminder', payload);
    return false;
  }

  /* --------------------------- Scheduler -------------------------------- */
  function collect() {
    const out = [];
    const now = Date.now();
    Object.keys(M.COLLECTIONS).forEach((collection) => {
      if (!categoryEnabled(collection)) return;
      Store.list(collection).forEach((rec) => {
        if (M.isCompleted(collection, rec)) return;
        if (rec.remindersOff) return;
        remindersFor(collection, rec).forEach((r) => {
          if (r.at.getTime() < now - 60000) return;
          if (r.at.getTime() > now + LOOKAHEAD_MS) return;
          if (inQuietHours(r.at)) return;
          const key = collection + ':' + rec.id + ':' + r.minutes + ':' + U.toISO(r.at);
          out.push({ key, collection, rec, at: r.at, minutes: r.minutes });
        });
      });
    });
    out.sort((a, b) => a.at - b.at);
    return out;
  }

  function scheduleNative(list) {
    const b = nativeBridge();
    if (!b || !b.isNative || !b.scheduleReminders) return false;
    try {
      b.scheduleReminders(
        JSON.stringify(
          list.map((item) => {
            const msg = messageFor(item.collection, item.rec);
            return {
              key: item.key,
              at: item.at.getTime(),
              title: msg.title,
              body: msg.body,
              route: '#/' + item.collection + '/' + item.rec.id,
            };
          })
        )
      );
      return true;
    } catch (e) {
      lastError = String(e);
      return false;
    }
  }

  function cancelNative() {
    const b = nativeBridge();
    if (!b || !b.isNative || !b.cancelReminders) return;
    try {
      b.cancelReminders();
    } catch (e) {}
  }

  /** Re-plan every reminder. Cheap: one pass over the collections. */
  function reschedule() {
    clearTimers();
    const list = collect();
    scheduleNative(list);
    if (!Store.getSetting('notificationsEnabled', false)) return { count: 0 };
    list.forEach((item) => {
      if (fired[item.key]) return;
      const delay = item.at.getTime() - Date.now();
      if (delay < 0 || delay > LOOKAHEAD_MS) return;
      const t = setTimeout(() => {
        fireItem(item);
      }, delay);
      scheduled.set(item.key, t);
    });
    return { count: list.length, next: list.length ? list[0].at : null };
  }

  function fireItem(item) {
    if (fired[item.key]) return;
    fired[item.key] = Date.now();
    saveFired();
    scheduled.delete(item.key);
    const msg = messageFor(item.collection, item.rec);
    deliver(msg.title, msg.body, {
      key: item.key,
      collection: item.collection,
      id: item.rec.id,
      route: '#/' + item.collection + '/' + item.rec.id,
    });
  }

  function clearTimers() {
    scheduled.forEach((t) => clearTimeout(t));
    scheduled.clear();
  }

  /** Items whose reminder is imminent — powers the in-app "next up" line. */
  function nextUp() {
    const list = collect();
    return list.length ? list[0] : null;
  }

  function start() {
    loadFired();
    reschedule();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
      // Re-plan periodically so date rollovers and edits are picked up.
      reschedule();
      checkDueNow();
    }, TICK_MS);
    Store.on('change', U.debounce(() => reschedule(), 800));
    Store.on('settings', U.debounce(() => reschedule(), 300));
  }

  /** Catch anything that became due while the timer was asleep (device sleep). */
  function checkDueNow() {
    const list = collect();
    list.forEach((item) => {
      if (fired[item.key]) return;
      if (item.at.getTime() <= Date.now()) fireItem(item);
    });
  }

  async function enable() {
    const state = await requestPermission();
    if (state === 'granted') {
      Store.setSetting('notificationsEnabled', true);
      reschedule();
      return { ok: true, state };
    }
    if (state === 'unsupported') {
      return {
        ok: false,
        state,
        message: 'This device cannot show system notifications. Reminders will appear inside the app instead.',
      };
    }
    return {
      ok: false,
      state,
      message: 'Notifications are blocked. You can allow them in your browser or system settings, then try again.',
    };
  }

  function disable() {
    Store.setSetting('notificationsEnabled', false);
    clearTimers();
    cancelNative();
  }

  async function test() {
    const state = permissionState();
    if (state !== 'granted') {
      const res = await enable();
      if (!res.ok) return res;
    }
    const ok = deliver('Test reminder', 'Reminders are working. This is what a homework reminder looks like.', { key: 'test-' + Date.now() });
    return { ok, state: permissionState(), inApp: !ok };
  }

  function status() {
    const list = collect();
    return {
      permission: permissionState(),
      enabled: Store.getSetting('notificationsEnabled', false),
      scheduled: list.length,
      next: list.length ? list[0] : null,
      lastError,
      native: isNative(),
    };
  }

  global.Notify = {
    start, reschedule, enable, disable, test, status, nextUp, deliver,
    requestPermission, permissionState, remindersFor, messageFor, isNative,
    categoryEnabled,
  };
})(window);
