/* ==========================================================================
   auth.js — accounts on this device.

   What this is: real, working accounts. A student picks a name and a password,
   the password is hashed (PBKDF2-SHA256, 150k iterations, per-account random
   salt) and only the hash is ever stored. Every account gets its own planner
   document, so logging in as someone else shows only their work.

   What this is NOT: a server. There is no backend here, so accounts live in
   this browser. The honest consequences, surfaced in the UI:
   - Data does not travel between devices by itself (export/import does that).
   - Clearing site data removes the accounts.
   The interface is deliberately written so a real backend can replace the
   storage calls without touching the screens.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;

  const ACCOUNTS_KEY = 'studyplanner.accounts.v1';
  const SESSION_KEY = 'studyplanner.session.v1';
  const ITERATIONS = 150000;
  const HASH = 'SHA-256';
  const KEY_LEN = 32;

  let state = {
    accounts: [],
    currentId: null,
    migrated: false,
  };

  /* ------------------------------ Storage ------------------------------- */
  function readAccounts() {
    try {
      const raw = global.localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[auth] accounts unreadable', e);
      return [];
    }
  }

  function writeAccounts(list) {
    try {
      global.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('[auth] could not save accounts', e);
      return false;
    }
  }

  function readSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.guest) return { guest: true, at: parsed.at };
      return parsed && parsed.accountId ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(accountId, remember) {
    try {
      if (!accountId) global.localStorage.removeItem(SESSION_KEY);
      else global.localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId, at: Date.now(), remember: !!remember }));
    } catch (e) {}
  }

  function writeGuestSession() {
    try {
      global.localStorage.setItem(SESSION_KEY, JSON.stringify({ guest: true, at: Date.now() }));
    } catch (e) {}
  }

  /** The raw session: {accountId} | {guest:true} | null */
  function session() {
    return readSession();
  }

  /* ------------------------------- Hashing ------------------------------ */
  function bytesToHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
    return out;
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytesToHex(bytes);
  }

  /** PBKDF2-SHA256 -> hex. Falls back to a clearly-marked weak hash if the
      WebCrypto API is missing (very old browser / insecure context). */
  async function hashPassword(password, saltHex, iterations) {
    const subtle = global.crypto && global.crypto.subtle;
    if (!subtle) return weakHash(password, saltHex);
    try {
      const enc = new TextEncoder();
      const key = await subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
      const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
      const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: iterations || ITERATIONS, hash: HASH },
        key,
        KEY_LEN * 8
      );
      return bytesToHex(new Uint8Array(bits));
    } catch (e) {
      console.warn('[auth] PBKDF2 unavailable, using fallback', e);
      return weakHash(password, saltHex);
    }
  }

  /** Deterministic fallback (FNV-1a based). Marked in the account record so the
      UI can say so plainly rather than pretending it is strong. */
  function weakHash(password, saltHex) {
    const input = saltHex + '\u0000' + password;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = (Math.imul(h2 ^ c, 2246822519) + i) >>> 0;
    }
    let out = '';
    for (let r = 0; r < 4; r++) {
      h1 = (Math.imul(h1 ^ r, 2654435761) >>> 0);
      h2 = (Math.imul(h2 ^ (h1 >>> 13), 3266489917) >>> 0);
      out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    }
    return 'w' + out;
  }

  /* ------------------------------- Helpers ------------------------------ */
  function normaliseName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  /** Case-insensitive key so "Ahmed" and "ahmed" are the same account. */
  function nameKey(name) {
    return normaliseName(name).toLowerCase();
  }

  function findByHandle(handle) {
    const key = nameKey(handle);
    return state.accounts.find((a) => a.nameKey === key) || null;
  }

  function publicAccount(account) {
    if (!account) return null;
    return {
      id: account.id,
      name: account.name,
      handle: account.handle,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt,
      avatarColor: account.avatarColor,
      guest: false,
    };
  }

  function current() {
    if (!state.currentId) return null;
    const acc = state.accounts.find((a) => a.id === state.currentId);
    return publicAccount(acc);
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

  /* ------------------------------- Init --------------------------------- */
  function init() {
    state.accounts = readAccounts();
    const s = readSession();
    if (s && s.accountId && state.accounts.some((a) => a.id === s.accountId)) {
      state.currentId = s.accountId;
      // Point storage at this account before anything reads the planner.
      global.Store.useAccount(state.currentId);
      global.Store.init();
    } else {
      state.currentId = null;
      if (s && s.accountId) writeSession(null);
    }
    return current();
  }

  /**
   * One-time migration: data created before accounts existed (the base
   * document with no owner) is adopted by the first account so nothing is lost.
   */
  function adoptLegacyData(accountId) {
    const baseKey = global.Store.BASE_KEY;
    let raw = null;
    try {
      raw = global.localStorage.getItem(baseKey);
    } catch (e) {
      return false;
    }
    if (!raw) return false;
    try {
      global.localStorage.setItem(baseKey + '.acct.' + accountId, raw);
      global.localStorage.removeItem(baseKey);
      state.migrated = true;
      return true;
    } catch (e) {
      return false;
    }
  }

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

  /* ------------------------------ Register ------------------------------ */
  /**
   * register({ name, password, confirm, grade, school, startWithSample })
   * Returns { ok, account } or { ok:false, error, field }
   */
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
    if (findByHandle(name)) return { ok: false, error: 'That name is already taken on this device. Try adding a surname or a number.', field: 'name' };
    if (!password) return { ok: false, error: 'Please choose a password.', field: 'password' };
    if (password.length < 4) return { ok: false, error: 'Use at least 4 characters for your password.', field: 'password' };
    if (password.length > 200) return { ok: false, error: 'That password is too long.', field: 'password' };
    if (password !== confirm) return { ok: false, error: 'The two passwords do not match.', field: 'confirm' };

    const salt = randomSalt();
    let hash;
    try {
      hash = await hashPassword(password, salt);
    } catch (e) {
      return { ok: false, error: 'Your password could not be secured on this device. Try another browser.', field: 'password' };
    }

    const account = {
      id: U.uid('acct'),
      name,
      nameKey: nameKey(name),
      handle: name.toLowerCase().replace(/\s+/g, ''),
      salt,
      hash,
      algo: hash.charAt(0) === 'w' ? 'fallback' : 'pbkdf2-' + ITERATIONS,
      createdAt: Date.now(),
      lastLoginAt: null,
      avatarColor: pickColor(name),
    };

    state.accounts.push(account);
    if (!writeAccounts(state.accounts)) {
      state.accounts = state.accounts.filter((a) => a.id !== account.id);
      return { ok: false, error: 'Accounts could not be saved — this browser is blocking storage (private mode?).' };
    }

    // First ever account adopts any pre-accounts planner data.
    if (state.accounts.length === 1) adoptLegacyData(account.id);

    // Seed a profile from what they typed.
    const patch = { name };
    if (input.grade) patch.grade = String(input.grade).trim();
    if (input.school) patch.school = String(input.school).trim();

    signInAs(account.id, patch);
    return { ok: true, account: publicAccount(account) };
  }

  function pickColor(name) {
    const palette = ['#4f6bed', '#8b5cf6', '#0d9488', '#b7791f', '#d9544d', '#0ea5e9', '#7c3aed', '#15803d'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  /* -------------------------------- Login ------------------------------- */
  async function login(nameOrHandle, password, opts) {
    const o = opts || {};
    const account = findByHandle(nameOrHandle);
    const generic = { ok: false, error: 'That name and password do not match.', field: 'password' };
    if (!nameOrHandle || !String(nameOrHandle).trim()) {
      return { ok: false, error: 'Enter your name.', field: 'name' };
    }
    if (!password) return { ok: false, error: 'Enter your password.', field: 'password' };
    if (!account) {
      // Same message either way: don't reveal which names exist.
      await hashPassword(String(password), 'decoy0000decoy0000decoy0000decoy00', 1);
      return generic;
    }
    let hash;
    try {
      hash = await hashPassword(String(password), account.salt, account.algo === 'fallback' ? 1 : undefined);
    } catch (e) {
      return { ok: false, error: 'Your password could not be checked on this device.', field: 'password' };
    }
    if (hash !== account.hash) return generic;

    account.lastLoginAt = Date.now();
    writeAccounts(state.accounts);
    signInAs(account.id, null, o.remember !== false);
    return { ok: true, account: publicAccount(account) };
  }

  /** Point the store at an account and mark the session. */
  function signInAs(accountId, profilePatch, remember) {
    state.currentId = accountId;
    global.Store.useAccount(accountId);
    global.Store.init();
    if (profilePatch) global.Store.setProfile(profilePatch);
    writeSession(accountId, remember !== false);
    global.Store.emit('auth', { action: 'login', account: current() });
    return current();
  }

  /* --------------------------- Guest / logout --------------------------- */
  function continueAsGuest() {
    state.currentId = null;
    writeGuestSession();
    global.Store.useAccount(null);
    global.Store.init();
    global.Store.emit('auth', { action: 'guest', account: null });
    return null;
  }

  function logout() {
    const who = current();
    global.Store.flush();
    state.currentId = null;
    writeSession(null);
    global.Store.emit('auth', { action: 'logout', account: who });
    return true;
  }

  /* ------------------------------ Manage -------------------------------- */
  async function changePassword(accountId, currentPassword, newPassword, confirmPassword) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    let hash;
    try {
      hash = await hashPassword(String(currentPassword || ''), account.salt, account.algo === 'fallback' ? 1 : undefined);
    } catch (e) {
      return { ok: false, error: 'Could not check your current password.', field: 'current' };
    }
    if (hash !== account.hash) return { ok: false, error: 'Your current password is not correct.', field: 'current' };
    if (!newPassword || String(newPassword).length < 4) return { ok: false, error: 'Use at least 4 characters.', field: 'password' };
    if (String(newPassword) !== String(confirmPassword)) return { ok: false, error: 'The new passwords do not match.', field: 'confirm' };

    account.salt = randomSalt();
    account.hash = await hashPassword(String(newPassword), account.salt);
    account.algo = account.hash.charAt(0) === 'w' ? 'fallback' : 'pbkdf2-' + ITERATIONS;
    account.updatedAt = Date.now();
    writeAccounts(state.accounts);
    return { ok: true };
  }

  function rename(accountId, newName) {
    const name = normaliseName(newName);
    if (!name || name.length < 2) return { ok: false, error: 'Please enter a name with at least 2 characters.' };
    const clash = findByHandle(name);
    if (clash && clash.id !== accountId) return { ok: false, error: 'That name is already taken on this device.' };
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    account.name = name;
    account.nameKey = nameKey(name);
    account.handle = name.toLowerCase().replace(/\s+/g, '');
    account.avatarColor = pickColor(name);
    writeAccounts(state.accounts);
    if (state.currentId === accountId) global.Store.setProfile({ name });
    return { ok: true, account: publicAccount(account) };
  }

  /**
   * Delete an account and everything it owns. Requires the password, because
   * this is the one action that cannot be undone.
   */
  async function remove(accountId, password) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'Account not found.' };
    let hash;
    try {
      hash = await hashPassword(String(password || ''), account.salt, account.algo === 'fallback' ? 1 : undefined);
    } catch (e) {
      return { ok: false, error: 'Could not check your password.', field: 'password' };
    }
    if (hash !== account.hash) return { ok: false, error: 'That password is not correct.', field: 'password' };

    const key = global.Store.BASE_KEY + '.acct.' + accountId;
    try {
      global.localStorage.removeItem(key);
      // also drop any backups belonging to this account
      const doomed = [];
      for (let i = 0; i < global.localStorage.length; i++) {
        const k = global.localStorage.key(i);
        if (k && k.indexOf(key) === 0) doomed.push(k);
      }
      doomed.forEach((k) => global.localStorage.removeItem(k));
    } catch (e) {}

    state.accounts = state.accounts.filter((a) => a.id !== accountId);
    writeAccounts(state.accounts);

    if (state.currentId === accountId) {
      state.currentId = null;
      writeSession(null);
      if (state.accounts.length) signInAs(state.accounts[0].id, null);
      else {
        global.Store.useAccount(null);
        global.Store.init();
      }
    }
    return { ok: true };
  }

  /** Wipe a specific account's planner data (keeps the login). */
  function clearAccountData(accountId) {
    const key = global.Store.BASE_KEY + '.acct.' + accountId;
    try {
      global.localStorage.removeItem(key);
    } catch (e) {}
    if (state.currentId === accountId) {
      global.Store.useAccount(accountId);
      global.Store.init();
    }
    return true;
  }

  function statsFor(accountId) {
    const key = global.Store.BASE_KEY + '.acct.' + accountId;
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return { items: 0, size: '0 KB' };
      const doc = JSON.parse(raw);
      const cols = doc.collections || {};
      const items = Object.keys(cols).reduce((acc, k) => acc + (Array.isArray(cols[k]) ? cols[k].length : 0), 0);
      const bytes = raw.length * 2;
      return { items, size: bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB' };
    } catch (e) {
      return { items: 0, size: 'unknown' };
    }
  }

  global.Auth = {
    init, register, login, logout, continueAsGuest, session,
    current, isSignedIn, list, count,
    changePassword, rename, remove, clearAccountData, statsFor,
    hasLegacyData, adoptLegacyData,
    normaliseName, findByHandle,
    get state() {
      return { accounts: list(), currentId: state.currentId };
    },
  };
})(window);
