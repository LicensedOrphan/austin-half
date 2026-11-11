// On-device storage. IndexedDB only; nothing leaves the phone.
// Stores: runs (GPS tracks + stats), logs (one per plan day), kv (settings, paces, active run).

const DB_NAME = 'austin-half';
const VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' }).createIndex('date', 'date');
        if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
  }));
}

export const db = {
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  put: (store, value, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  all: (store) => tx(store, 'readonly', (s) => s.getAll()),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
};

export const settings = {
  get: (key, fallback = null) => db.get('kv', key).then((v) => (v === undefined ? fallback : v)),
  set: (key, value) => db.put('kv', value, key),
};

// Ask Safari not to evict our data. Installed Home Screen apps are usually exempt anyway.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

// Full backup as a JSON file the user can save to Files or iCloud Drive.
export async function exportAll() {
  const [runs, logs, kvKeys] = await Promise.all([db.all('runs'), db.all('logs'), tx('kv', 'readonly', (s) => s.getAllKeys())]);
  const kv = {};
  for (const k of kvKeys) kv[k] = await db.get('kv', k);
  delete kv.activeRun;
  return { app: 'austin-half', version: 1, exportedAt: new Date().toISOString(), runs, logs, kv };
}

export async function importAll(data) {
  if (data?.app !== 'austin-half') throw new Error('Not an Austin Half backup file');
  for (const r of data.runs || []) await db.put('runs', r);
  for (const l of data.logs || []) await db.put('logs', l);
  for (const [k, v] of Object.entries(data.kv || {})) await db.put('kv', v, k);
}
