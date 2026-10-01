/* ==========================================================================
   idb.js — minimal IndexedDB wrapper (promise-based) for attachment blobs.
   Falls back gracefully when IndexedDB is unavailable (private mode etc.).
   ========================================================================== */
(function (global) {
  'use strict';

  const DB_NAME = 'studyplanner';
  const DB_VERSION = 1;
  const STORE = 'attachments';

  let dbPromise = null;
  let unavailable = false;

  function open() {
    if (unavailable) return Promise.reject(new Error('indexeddb-unavailable'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try {
        if (!global.indexedDB) throw new Error('no-idb');
        req = global.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        unavailable = true;
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        unavailable = true;
        reject(req.error || new Error('idb-open-failed'));
      };
      req.onblocked = () => {
        unavailable = true;
        reject(new Error('idb-blocked'));
      };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          let t;
          try {
            t = db.transaction(STORE, mode);
          } catch (e) {
            reject(e);
            return;
          }
          const store = t.objectStore(STORE);
          let result;
          try {
            result = fn(store);
          } catch (e) {
            reject(e);
            return;
          }
          t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
          t.onerror = () => reject(t.error || new Error('idb-tx-failed'));
          t.onabort = () => reject(t.error || new Error('idb-aborted'));
        })
    );
  }

  function reqPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const Idb = {
    available() {
      return !!global.indexedDB && !unavailable;
    },
    put(record) {
      return tx('readwrite', (store) => {
        store.put(record);
      }).then(() => record);
    },
    get(id) {
      return open()
        .then((db) => reqPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)))
        .catch(() => null);
    },
    getAll() {
      return open()
        .then((db) => reqPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll()))
        .catch(() => []);
    },
    del(id) {
      return tx('readwrite', (store) => {
        store.delete(id);
      }).catch(() => null);
    },
    clear() {
      return tx('readwrite', (store) => {
        store.clear();
      }).catch(() => null);
    },
    keys() {
      return open()
        .then((db) => reqPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys()))
        .catch(() => []);
    },
  };

  global.Idb = Idb;
})(window);
