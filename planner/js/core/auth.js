/* ==========================================================================
   auth.js — accounts that work across devices.

   A student registers with a name and a password. The account record and the
   planner are uploaded to a keyless public text store (see core/cloud.js), and
   everything private is encrypted on this device first:

     authHash = PBKDF2(password, authSalt)   -> uploaded, checks the login
     keyBits  = PBKDF2(password, dataSalt)   -> NEVER uploaded, decrypts planner

   The auth hash cannot be turned into the encryption key, so neither the server
   nor anyone reading the public blob can decrypt a planner even though the
   account record itself is visible.

   Offline: the last synced copy is kept on the device, so the planner opens and
   works with no connection and re-syncs when the connection returns.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const Cloud = global.Cloud;

  const ACCOUNTS_KEY = 'studyplanner.accounts.v2';
  const SESSION_KEY = 'studyplanner.session.v1';
  const LOCAL_DOC_KEY = 'studyplanner.localdoc.v1';
  const ITERATIONS = 150000;

  let state = {
    accounts: [],   // local metadata only (no secrets)
    currentId: null,
    keyBits: null,  // in memory for this session; cleared on sign-out
    sync: { status: 'idle', lastSyncAt: null, error: null, pending: false },
  };

  /* ------------------------------ Local store --------------------------- */
  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[auth] could not write ' + key, e);
      return false;
    }
  }

  function readAccounts() {
    const list = readJSON(ACCOUNTS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function writeAccounts(list) {
    return writeJSON(ACCOUNTS_KEY, list);
  }

  function readSession() {
    const s = readJSON(SESSION_KEY, null);
    if (!s) return null;
    if (s.guest) return { guest: true, at: s.at };
    return s.accountId ? s : null;
  }

  function writeSession(s) {
    if (!s) {
      try {
        global.localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      return;
    }
    writeJSON(SESSION_KEY, s);
  }

  function session() {
    return readSession();
  }

  /* ------------------------------- Helpers ------------------------------ */
  function normaliseName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  function nameKey(name) {
    return normaliseName(name).toLowerCase();
  }

  function findByHandle(handle) {
    const key = nameKey(handle);
    return state.accounts.find((a) => nameKey(a.name) === key) || null;
  }

  function publicAccount(a) {
    if (!a) return null;
    return {
      id: a.id,
      name: a.name,
      handle: Cloud.sanitiseHandle(a.name),
      docId: a.docId,
      createdAt: a.createdAt,
      lastLoginAt: a.lastLoginAt,
      avatarColor: a.avatarColor,
      algo: a.algo,
      synced: a.synced !== false,
    };
  }

  function current() {
    if (!state.currentId) return null;
    return publicAccount(state.accounts.find((a) => a.id === state.currentId));
  }

  function isSignedIn() {
    return !!state.currentId;
  }

  function list() {
    return state.accounts.map(publicAccount);
  }

  function count() {
    return state.accounts.length;
  }

  function pickColor(name) {
    const palette = ['#4f6bed', '#8b5cf6', '#0d9488', '#b7791f', '#d9544d', '#0ea5e9', '#7c3aed', '#15803d'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  /* ---------------------------- Sync state ------------------------------ */
  function syncStatus() {
    return {
      status: state.sync.status,
      lastSyncAt: state.sync.lastSyncAt,
      error: state.sync.error,
      pending: state.sync.pending,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      encryption: Cloud.hasWebCrypto() ? 'AES-GCM' : 'none',
    };
  }

  function setSync(patch) {
    Object.assign(state.sync, patch);
    if (global.Store && global.Store.emit) global.Store.emit('sync', syncStatus());
  }

  /* ------------------------------- Init --------------------------------- */
  function init() {
    state.accounts = readAccounts();
    const s = readSession();
    if (s && s.accountId && state.accounts.some((a) => a.id === s.accountId)) {
      state.currentId = s.accountId;
      global.Store.useAccount(state.currentId);
      global.Store.init();
    } else {
      state.currentId = null;
      if (s && s.accountId) writeSession(null);
    }
    return current();
  }

  /* ------------------------ Local document cache ------------------------ */
  function localDocKey(accountId) {
    return LOCAL_DOC_KEY + '.' + accountId;
  }

  function cacheDocument(accountId, doc) {
    try {
      writeJSON(localDocKey(accountId), { at: Date.now(), doc });
      return true;
    } catch (e) {
      return false;
    }
  }

  function readCachedDocument(accountId) {
    const rec = readJSON(localDocKey(accountId), null);
    return rec && rec.doc ? rec : null;
  }

  /* -------------------------- Planner document -------------------------- */
  function buildDoc() {
    const exported = JSON.parse(global.Store.exportData());
    return {
      app: 'Study Planner',
      format: 'studyplanner.backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: exported.settings,
      profile: exported.profile,
      collections: exported.collections,
      meta: exported.meta,
    };
  }

  function applyDoc(doc, mode) {
    if (!doc || !doc.collections) return { ok: false, error: 'The stored planner is empty or damaged.' };
    return global.Store.importData(JSON.stringify(doc), mode || 'replace');
  }

  /* ------------------------------ Register ------------------------------ */
  async function register(input) {
    const name = normaliseName(input && input.name);
    const password = String((input && input.password) || '');
    const confirm = input && input.confirm !== undefined ? String(input.confirm) : password;

    if (!name) return { ok: false, error: 'Please enter your name.', field: 'name' };
    if (name.length < 2) return { ok: false, error: 'Your name needs at least 2 characters.', field: 'name' };
    if (name.length > 40) return { ok: false, error: 'That name is too long (40 characters max).', field: 'name' };
    if (!/^[\p{L}\p{N} .'\-_]+$/u.test(name)) {
      return { ok: false, error: 'Use letters, numbers, spaces, hyphens or apostrophes only.', field: 'name' };
    }
    if (!password) return { ok: false, error: 'Please choose a password.', field: 'password' };
    if (password.length < 4) return { ok: false, error: 'Use at least 4 characters for your password.', field: 'password' };
    if (password !== confirm) return { ok: false, error: 'The two passwords do not match.', field: 'confirm' };
    if (!Cloud.hasWebCrypto()) {
      return {
        ok: false,
        error: 'This browser cannot encrypt your work, so cloud accounts are unavailable here. Use a modern browser, or continue without an account.',
        field: 'password',
      };
    }
    if (findByHandle(name)) {
      return { ok: false, error: 'That name is already on this device. Sign in instead.', field: 'name' };
    }

    setSync({ status: 'working', error: null });
    let existing;
    try {
      existing = await Cloud.fetchAccount(name);
    } catch (e) {
      existing = { ok: false, error: String((e && e.message) || e) };
    }
    if (!existing.ok) {
      setSync({ status: 'error', error: existing.error });
      return { ok: false, error: existing.error || 'Could not reach the sync server. Check your connection and try again.' };
    }
    if (existing.account) {
      setSync({ status: 'idle' });
      return { ok: false, error: 'That name is already taken. Try adding a surname or a number.', field: 'name' };
    }

    const authSalt = Cloud.newDocKey().slice(0, 32).padEnd(32, 'a');
    const dataSalt = Cloud.newDocKey().slice(0, 32).padEnd(32, 'b');
    let secrets;
    try {
      secrets = await Cloud.deriveSecrets(password, authSalt, dataSalt, ITERATIONS);
    } catch (e) {
      setSync({ status: 'error', error: String((e && e.message) || e) });
      return { ok: false, error: 'Your password could not be secured on this device.', field: 'password' };
    }

    const docId = Cloud.newDocKey();
    const record = {
      v: 1,
      name,
      handle: Cloud.sanitiseHandle(name),
      authSalt,
      authHash: secrets.authHash,
      dataSalt,
      docId,
      algo: 'pbkdf2-' + ITERATIONS + '+aes-gcm',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await Cloud.saveAccount(record);
    if (!saved.ok) {
      setSync({ status: 'error', error: saved.error });
      return { ok: false, error: saved.error || 'The account could not be saved to the server.' };
    }

    const account = {
      id: U.uid('acct'),
      name,
      docId,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      avatarColor: pickColor(name),
      algo: record.algo,
      synced: true,
    };
    state.accounts.push(account);
    writeAccounts(state.accounts);

    state.currentId = account.id;
    state.keyBits = secrets.keyBits;
    global.Store.useAccount(account.id);
    global.Store.init();

    const patch = { name };
    if (input.grade) patch.grade = String(input.grade).trim();
    if (input.school) patch.school = String(input.school).trim();
    global.Store.setProfile(patch);

    writeSession({ accountId: account.id, at: Date.now() });
    global.Store.emit('auth', { action: 'register', account: publicAccount(account) });

    await sync({ reason: 'register' });
    return { ok: true, account: publicAccount(account) };
  }

  /* -------------------------------- Login ------------------------------- */
  async function login(nameOrHandle, password) {
    const generic = { ok: false, error: 'That name and password do not match.', field: 'password' };
    const name = normaliseName(nameOrHandle);
    if (!name) return { ok: false, error: 'Enter your name.', field: 'name' };
    if (!password) return { ok: false, error: 'Enter your password.', field: 'password' };
    if (!Cloud.hasWebCrypto()) {
      return { ok: false, error: 'This browser cannot decrypt your work. Use a modern browser.', field: 'password' };
    }

    setSync({ status: 'working', error: null });
    let res;
    try {
      res = await Cloud.fetchAccount(name);
    } catch (e) {
      res = { ok: false, error: String((e && e.message) || e) };
    }
    if (!res.ok) {
      setSync({ status: 'error', error: res.error });
      return { ok: false, error: res.error || 'Could not reach the sync server. Check your connection and try again.' };
    }
    if (!res.account) {
      setSync({ status: 'idle' });
      return generic;
    }
    const record = res.account;

    let secrets;
    try {
      secrets = await Cloud.deriveSecrets(String(password), record.authSalt, record.dataSalt, ITERATIONS);
    } catch (e) {
      setSync({ status: 'error', error: String((e && e.message) || e) });
      return { ok: false, error: 'Your password could not be checked on this device.', field: 'password' };
    }
    if (secrets.authHash !== record.authHash) {
      setSync({ status: 'idle' });
      return generic;
    }

    let account = findByHandle(name);
    if (!account) {
      account = {
        id: U.uid('acct'),
        name: record.name || name,
        docId: record.docId,
        createdAt: record.createdAt || Date.now(),
        avatarColor: pickColor(record.name || name),
        algo: record.algo,
        synced: true,
      };
      state.accounts.push(account);
    }
    account.docId = record.docId;
    account.name = record.name || account.name;
    account.lastLoginAt = Date.now();
    writeAccounts(state.accounts);

    state.currentId = account.id;
    state.keyBits = secrets.keyBits;
    global.Store.useAccount(account.id);
    global.Store.init();
    writeSession({ accountId: account.id, at: Date.now() });
    global.Store.emit('auth', { action: 'login', account: publicAccount(account) });

    const pull = await pullRemote();
    if (!pull.ok && pull.error) {
      const cached = readCachedDocument(account.id);
      if (cached) applyDoc(cached.doc, 'replace');
      global.Store.emit('auth', { action: 'login-offline', account: publicAccount(account) });
      return { ok: true, account: publicAccount(account), warning: pull.error };
    }
    return { ok: true, account: publicAccount(account) };
  }

  /* -------------------------------- Sync -------------------------------- */
  let syncTimer = null;
  let syncing = false;

  async function pushRemote() {
    const account = state.accounts.find((a) => a.id === state.currentId);
    if (!account) return { ok: false, error: 'Not signed in.' };
    if (!state.keyBits) {
      return { ok: false, error: 'Sign in again to sync — the encryption key is not available in this session.' };
    }
    const doc = buildDoc();
    const packed = await Cloud.packDocument(doc, state.keyBits);
    const saved = await Cloud.saveDocument(account.docId, packed.payload);
    if (!saved.ok) return saved;
    cacheDocument(account.id, doc);
    account.synced = true;
    writeAccounts(state.accounts);
    return { ok: true, bytes: packed.bytes, rawBytes: packed.rawBytes };
  }

  async function pullRemote() {
    const account = state.accounts.find((a) => a.id === state.currentId);
    if (!account) return { ok: false, error: 'Not signed in.' };
    if (!state.keyBits) return { ok: false, error: 'Sign in again to sync.' };
    const res = await Cloud.fetchDocument(account.docId);
    if (!res.ok) return res;
    if (res.missing) return { ok: true, empty: true };
    const unpacked = await Cloud.unpackDocument(res.value, state.keyBits);
    if (!unpacked.ok) return unpacked;
    const applied = applyDoc(unpacked.doc, 'replace');
    if (!applied.ok) return applied;
    cacheDocument(account.id, unpacked.doc);
    return { ok: true };
  }

  async function sync(opts) {
    const o = opts || {};
    if (syncing) return { ok: false, busy: true };
    if (!isSignedIn()) return { ok: false, error: 'Not signed in.' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSync({ status: 'offline', pending: true });
      return { ok: false, offline: true, error: 'You are offline. Your work is saved on this device.' };
    }
    syncing = true;
    setSync({ status: 'working', error: null });
    try {
      const pushed = await pushRemote();
      if (!pushed.ok) {
        setSync({ status: 'error', error: pushed.error, pending: true });
        return pushed;
      }
      setSync({ status: 'ok', lastSyncAt: Date.now(), error: null, pending: false });
      global.Store.emit('synced', { at: state.sync.lastSyncAt, reason: o.reason || 'manual' });
      return pushed;
    } catch (e) {
      const msg = String((e && e.message) || e);
      setSync({ status: 'error', error: msg, pending: true });
      return { ok: false, error: msg };
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(reason) {
    if (!isSignedIn() || !state.keyBits) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSync({ status: 'offline', pending: true });
      return;
    }
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      sync({ reason: reason || 'auto' });
    }, 2500);
  }

  async function uploadLocal() {
    setSync({ status: 'working', error: null });
    const res = await pushRemote();
    if (res.ok) setSync({ status: 'ok', lastSyncAt: Date.now(), error: null, pending: false });
    else setSync({ status: 'error', error: res.error, pending: true });
    return res;
  }

  async function downloadRemote() {
    setSync({ status: 'working', error: null });
    const res = await pullRemote();
    if (res.ok) setSync({ status: 'ok', lastSyncAt: Date.now(), error: null, pending: false });
    else setSync({ status: 'error', error: res.error });
    return res;
  }

  /* --------------------------- Guest / logout --------------------------- */
  function continueAsGuest() {
    state.currentId = null;
    state.keyBits = null;
    writeSession({ guest: true, at: Date.now() });
    global.Store.useAccount(null);
    global.Store.init();
    global.Store.emit('auth', { action: 'guest', account: null });
    return null;
  }

  function logout() {
    const who = current();
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    global.Store.flush();
    state.currentId = null;
    state.keyBits = null;
    writeSession(null);
    global.Store.emit('auth', { action: 'logout', account: who });
    return true;
  }

  /* ------------------------------ Manage -------------------------------- */
  async function changePassword(accountId, currentPassword, newPassword, confirmPassword) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    if (!newPassword || String(newPassword).length < 4) return { ok: false, error: 'Use at least 4 characters.', field: 'password' };
    if (String(newPassword) !== String(confirmPassword)) return { ok: false, error: 'The new passwords do not match.', field: 'confirm' };

    const res = await Cloud.fetchAccount(account.name);
    if (!res.ok) return { ok: false, error: res.error };
    if (!res.account) return { ok: false, error: 'This account is no longer on the server.' };
    const record = res.account;

    const check = await Cloud.deriveSecrets(String(currentPassword || ''), record.authSalt, record.dataSalt, ITERATIONS);
    if (check.authHash !== record.authHash) return { ok: false, error: 'Your current password is not correct.', field: 'current' };

    // Re-key: fresh salts, fresh auth hash, fresh encryption key, and the
    // planner is re-uploaded under the new key so the old password stops
    // working everywhere at once.
    const authSalt = Cloud.newDocKey().slice(0, 32).padEnd(32, 'a');
    const dataSalt = Cloud.newDocKey().slice(0, 32).padEnd(32, 'b');
    const secrets = await Cloud.deriveSecrets(String(newPassword), authSalt, dataSalt, ITERATIONS);
    record.authSalt = authSalt;
    record.authHash = secrets.authHash;
    record.dataSalt = dataSalt;
    record.updatedAt = Date.now();
    const saved = await Cloud.saveAccount(record);
    if (!saved.ok) return { ok: false, error: saved.error };

    state.keyBits = secrets.keyBits;
    const pushed = await pushRemote();
    if (!pushed.ok) {
      return { ok: false, error: 'Password changed, but the planner could not be re-uploaded: ' + pushed.error };
    }
    return { ok: true };
  }

  async function rename(accountId, newName) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    const name = normaliseName(newName);
    if (!name || name.length < 2) return { ok: false, error: 'Please enter a name with at least 2 characters.' };
    if (findByHandle(name)) return { ok: false, error: 'That name is already on this device.' };

    if (nameKey(name) !== nameKey(account.name)) {
      const clash = await Cloud.fetchAccount(name);
      if (!clash.ok) return { ok: false, error: clash.error };
      if (clash.account) return { ok: false, error: 'That name is already taken. Try another.' };
    }

    const res = await Cloud.fetchAccount(account.name);
    if (!res.ok) return { ok: false, error: res.error };
    if (!res.account) return { ok: false, error: 'This account is no longer on the server.' };

    const record = res.account;
    const oldName = record.name;
    record.name = name;
    record.handle = Cloud.sanitiseHandle(name);
    record.updatedAt = Date.now();
    const saved = await Cloud.saveAccount(record);
    if (!saved.ok) return { ok: false, error: saved.error };
    if (nameKey(oldName) !== nameKey(name)) await Cloud.remove(Cloud.accountKey(oldName));

    account.name = name;
    account.avatarColor = pickColor(name);
    writeAccounts(state.accounts);
    if (state.currentId === accountId) global.Store.setProfile({ name });
    return { ok: true, account: publicAccount(account) };
  }

  async function remove(accountId, password) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    const res = await Cloud.fetchAccount(account.name);
    if (!res.ok) return { ok: false, error: res.error };
    if (!res.account) return { ok: false, error: 'This account is no longer on the server.' };
    const check = await Cloud.deriveSecrets(String(password || ''), res.account.authSalt, res.account.dataSalt, ITERATIONS);
    if (check.authHash !== res.account.authHash) return { ok: false, error: 'That password is not correct.', field: 'password' };

    await Cloud.deleteAccount(res.account.name, res.account.docId);
    try {
      global.localStorage.removeItem(localDocKey(accountId));
      global.localStorage.removeItem(global.Store.BASE_KEY + '.acct.' + accountId);
    } catch (e) {}

    state.accounts = state.accounts.filter((a) => a.id !== accountId);
    writeAccounts(state.accounts);
    if (state.currentId === accountId) {
      state.currentId = null;
      state.keyBits = null;
      writeSession(null);
      if (state.accounts.length) {
        global.Store.useAccount(state.accounts[0].id);
        global.Store.init();
      } else {
        global.Store.useAccount(null);
        global.Store.init();
      }
    }
    return { ok: true };
  }

  /** Clear this account's planner on the device and on the server. */
  async function clearAccountData(accountId) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    global.Store.reset({ keepProfile: true, keepSettings: true });
    global.Store.flush();
    const pushed = await pushRemote();
    return pushed.ok ? { ok: true } : { ok: false, error: pushed.error };
  }

  function statsFor(accountId) {
    const cached = readCachedDocument(accountId);
    if (!cached) return { items: 0, size: 'not synced yet' };
    const cols = (cached.doc && cached.doc.collections) || {};
    const items = Object.keys(cols).reduce((acc, k) => acc + (Array.isArray(cols[k]) ? cols[k].length : 0), 0);
    const bytes = JSON.stringify(cached.doc).length;
    return { items, size: bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB' };
  }

  /* --------------------------- Local migration -------------------------- */
  function hasLegacyData() {
    try {
      const raw = global.localStorage.getItem(global.Store.BASE_KEY);
      if (!raw) return false;
      const doc = JSON.parse(raw);
      const cols = (doc && doc.collections) || {};
      return Object.keys(cols).some((k) => Array.isArray(cols[k]) && cols[k].length > 0);
    } catch (e) {
      return false;
    }
  }

  function adoptLegacyData() {
    try {
      const raw = global.localStorage.getItem(global.Store.BASE_KEY);
      if (!raw) return false;
      const doc = JSON.parse(raw);
      if (!doc || !doc.collections) return false;
      global.Store.importData(JSON.stringify(doc), 'replace');
      return true;
    } catch (e) {
      return false;
    }
  }

  global.Auth = {
    init, register, login, logout, continueAsGuest, session,
    current, isSignedIn, list, count,
    changePassword, rename, remove, clearAccountData, statsFor,
    sync, scheduleSync, uploadLocal, downloadRemote, syncStatus, setSync,
    pushRemote, pullRemote, readCachedDocument, cacheDocument, buildDoc,
    hasLegacyData, adoptLegacyData,
    normaliseName, findByHandle,
    get state() {
      return { accounts: list(), currentId: state.currentId, sync: syncStatus() };
    },
  };
})(window);
