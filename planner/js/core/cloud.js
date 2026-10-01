/* ==========================================================================
   cloud.js — cross-device sync backend.

   Transport: textdb.online, a keyless public text store with CORS enabled.
   - write:  POST https://textdb.online/update   (form fields: key, value)
   - read:   GET  https://textdb.online/<key>

   Because the store is public and has no write authentication, everything the
   student owns is ENCRYPTED ON THIS DEVICE before it is uploaded:
   - The password is stretched with PBKDF2-SHA256 (150k iterations) twice, with
     two independent salts, producing (a) an auth hash for the login check and
     (b) a 256-bit AES-GCM key. The auth hash cannot be used to decrypt.
   - The planner document is gzipped, encrypted with AES-GCM (random IV) and
     base64'd. The server only ever sees ciphertext.
   - Each account's record lives at a key derived from the name, so there is no
     shared directory to enumerate or race on.

   Honest limits (surfaced in the UI, not hidden):
   - A keyless store cannot authenticate writes: someone who learns an exact
     document key could overwrite that blob. Keys are long random strings.
   - Attachments (image data) are too large to sync and stay on their device.
   - The service prunes records that go 30 days without being touched.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;

  const ENDPOINT_WRITE = 'https://textdb.online/update';
  const ENDPOINT_READ = 'https://textdb.online/';
  const KEY_PREFIX_ACCOUNT = 'sp1acct';
  const KEY_PREFIX_DOC = 'sp1doc';
  const MAX_VALUE_CHARS = 190000; // service allows 200k; leave headroom
  const FORMAT = 'SP1';

  /* ------------------------------- Keys --------------------------------- */
  /** Short, stable hash used to keep two similar names from colliding. */
  function shortHash(s) {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0;
    }
    return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 8);
  }

  /** "Ahmed Ali" -> "ahmedali" (safe key characters only). */
  function sanitiseHandle(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24) || 'user';
  }

  function accountKey(name) {
    const h = sanitiseHandle(name);
    return KEY_PREFIX_ACCOUNT + h + shortHash(h);
  }

  function newDocKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    const rnd = new Uint8Array(20);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(rnd);
    else for (let i = 0; i < rnd.length; i++) rnd[i] = Math.floor(Math.random() * 256);
    for (let i = 0; i < rnd.length; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  function docKeyFor(docId) {
    return KEY_PREFIX_DOC + docId;
  }

  /* ------------------------------ Transport ----------------------------- */
  function timeoutSignal(ms) {
    if (typeof AbortController === 'undefined') return null;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  async function request(url, options, ms) {
    const opts = Object.assign({}, options || {});
    const signal = timeoutSignal(ms || 15000);
    if (signal) opts.signal = signal;
    const res = await fetch(url, opts);
    return res;
  }

  /**
   * Write a value. `key` must be 6-60 chars of [0-9a-zA-Z-_].
   * Returns { ok, error }.
   */
  async function put(key, value) {
    if (!navigator.onLine) return { ok: false, offline: true, error: 'You are offline.' };
    if (String(value).length > MAX_VALUE_CHARS) {
      return { ok: false, tooLarge: true, error: 'This planner is too large to sync.' };
    }
    try {
      const body = new URLSearchParams();
      body.set('key', key);
      body.set('value', value);
      const res = await request(ENDPOINT_WRITE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!res.ok) return { ok: false, error: 'Sync server returned ' + res.status + '.' };
      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        json = null;
      }
      if (json && json.status === 1) return { ok: true };
      if (json && json.status === 0) return { ok: false, error: 'The sync server rejected the write.' };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyNetError(e) };
    }
  }

  /** Read a value. Returns { ok, value, missing, error }. */
  async function get(key) {
    if (!navigator.onLine) return { ok: false, offline: true, error: 'You are offline.' };
    try {
      const res = await request(ENDPOINT_READ + encodeURIComponent(key), { method: 'GET', cache: 'no-store' });
      if (!res.ok) return { ok: false, error: 'Sync server returned ' + res.status + '.' };
      const text = await res.text();
      if (!text) return { ok: true, value: null, missing: true };
      return { ok: true, value: text };
    } catch (e) {
      return { ok: false, error: friendlyNetError(e) };
    }
  }

  async function remove(key) {
    // The service deletes a record when the value is empty.
    return put(key, '');
  }

  function friendlyNetError(e) {
    const msg = String((e && e.message) || e || '');
    if (/abort/i.test(msg)) return 'The sync server took too long to respond.';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Could not reach the sync server.';
    return 'Sync failed: ' + msg;
  }

  /* ------------------------------ Encoding ------------------------------ */
  function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return global.btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = global.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function gzipBytes(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------ Crypto -------------------------------- */
  function randomBytes(n) {
    const b = new Uint8Array(n);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  function hex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }

  function hasWebCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.TextEncoder);
  }

  /**
   * Derive both secrets from the password in one place so registration and
   * login can never drift apart:
   *   authHash — compared against the stored value to prove identity
   *   keyBits  — raw AES-GCM key material (never uploaded)
   */
  async function deriveSecrets(password, authSaltHex, dataSaltHex, iterations) {
    if (!hasWebCrypto()) {
      return { weak: true, authHash: weakHash(password, authSaltHex), keyBits: null };
    }
    const enc = new TextEncoder();
    const iters = iterations || 150000;
    async function pbkdf2(saltHex, len) {
      const key = await global.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
      const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
      const bits = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, len * 8);
      return new Uint8Array(bits);
    }
    const [authBits, keyBits] = await Promise.all([pbkdf2(authSaltHex, 32), pbkdf2(dataSaltHex, 32)]);
    return { weak: false, authHash: hex(authBits), keyBits };
  }

  function weakHash(password, saltHex) {
    const input = saltHex + '\u0000' + password;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = (Math.imul(h2 ^ c, 2246822519) + i) >>> 0;
    }
    let out = '';
    for (let r = 0; r < 4; r++) {
      h1 = Math.imul(h1 ^ r, 2654435761) >>> 0;
      h2 = Math.imul(h2 ^ (h1 >>> 13), 3266489917) >>> 0;
      out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    }
    return 'w' + out;
  }

  async function importAesKey(keyBits) {
    return global.crypto.subtle.importKey('raw', keyBits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  /**
   * Pack a planner document for upload:
   *   SP1E.<b64 iv>.<b64 ciphertext>
   * Plain fallback (no WebCrypto): SP1P.<b64 json>  — flagged in the UI.
   */
  async function packDocument(docObject, keyBits) {
    const json = JSON.stringify(docObject);
    const raw = new TextEncoder().encode(json);
    if (!keyBits || !hasWebCrypto()) {
      const gz = await gzipBytes(raw);
      const payload = gz || raw;
      return { payload: FORMAT + '.P.' + bytesToBase64(payload), plain: true, bytes: payload.length, rawBytes: raw.length };
    }
    const gz = await gzipBytes(raw);
    const payload = gz || raw;
    const iv = randomBytes(12);
    const key = await importAesKey(keyBits);
    const ct = new Uint8Array(await global.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
    return {
      payload: FORMAT + '.E.' + bytesToBase64(iv) + '.' + bytesToBase64(ct),
      plain: false,
      bytes: ct.length,
      rawBytes: raw.length,
    };
  }

  /** Unpack an uploaded payload. Returns { ok, doc, error }. */
  async function unpackDocument(payload, keyBits) {
    const text = String(payload || '');
    if (!text) return { ok: false, error: 'Nothing was stored for this account yet.' };
    const parts = text.split('.');
    if (parts[0] !== FORMAT) return { ok: false, error: 'This account holds data from an unknown format.' };
    const mode = parts[1];
    try {
      let bytes;
      if (mode === 'P') {
        bytes = base64ToBytes(parts.slice(2).join('.'));
      } else if (mode === 'E') {
        if (!keyBits || !hasWebCrypto()) {
          return { ok: false, error: 'This account was created with a browser that supports encryption, which this one does not.' };
        }
        const iv = base64ToBytes(parts[2]);
        const ct = base64ToBytes(parts.slice(3).join('.'));
        const key = await importAesKey(keyBits);
        bytes = new Uint8Array(await global.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
      } else {
        return { ok: false, error: 'Unknown payload format.' };
      }
      // Try gzip first; fall back to raw text.
      let jsonText = null;
      const un = await gunzipBytes(bytes);
      if (un) jsonText = new TextDecoder().decode(un);
      else jsonText = new TextDecoder().decode(bytes);
      let doc = null;
      try {
        doc = JSON.parse(jsonText);
      } catch (e) {
        // Encrypted but wrong key: AES-GCM normally throws, so reaching here
        // means the bytes were gzip'd but not valid JSON.
        return { ok: false, error: 'The stored planner could not be read.' };
      }
      return { ok: true, doc };
    } catch (e) {
      // AES-GCM authentication failure => wrong password (or tampered blob).
      return { ok: false, error: 'That password does not match this account, or the stored data is damaged.' };
    }
  }

  /* --------------------------- Account records --------------------------- */
  /**
   * The account record (public, not secret):
   * { v, name, handle, authSalt, authHash, dataSalt, docId, algo, createdAt, updatedAt }
   */
  async function fetchAccount(name) {
    const res = await get(accountKey(name));
    if (!res.ok) return res;
    if (res.missing) return { ok: true, account: null };
    let rec = null;
    try {
      rec = JSON.parse(res.value);
    } catch (e) {
      return { ok: false, error: 'The stored account record is damaged.' };
    }
    if (!rec || !rec.authHash) return { ok: true, account: null };
    return { ok: true, account: rec };
  }

  async function saveAccount(rec) {
    return put(accountKey(rec.name), JSON.stringify(rec));
  }

  async function deleteAccount(name, docId) {
    await remove(accountKey(name));
    if (docId) await remove(docKeyFor(docId));
    return { ok: true };
  }

  async function fetchDocument(docId) {
    return get(docKeyFor(docId));
  }

  async function saveDocument(docId, payload) {
    return put(docKeyFor(docId), payload);
  }

  /* ------------------------------ Diagnostics --------------------------- */
  /** Small round-trip so Settings can prove sync really works. */
  async function selfTest() {
    const key = 'sp1selftest' + shortHash(String(Date.now()));
    const value = 'ok-' + Date.now();
    const w = await put(key, value);
    if (!w.ok) return { ok: false, step: 'write', error: w.error };
    const r = await get(key);
    if (!r.ok) return { ok: false, step: 'read', error: r.error };
    if (r.value !== value) return { ok: false, step: 'verify', error: 'The server returned different data.' };
    await remove(key);
    return { ok: true };
  }

  global.Cloud = {
    // transport
    put, get, remove, selfTest,
    // keys
    accountKey, docKeyFor, newDocKey, sanitiseHandle,
    // crypto
    deriveSecrets, packDocument, unpackDocument, hasWebCrypto,
    // records
    fetchAccount, saveAccount, deleteAccount, fetchDocument, saveDocument,
    MAX_VALUE_CHARS, FORMAT,
  };
})(window);
