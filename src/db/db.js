import { DB_NAME, DB_VERSION, STORES } from './schema.js';

let dbPromise = null;

export function openDB(factory = indexedDB) {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(STORES)) {
        const store = db.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const idx of def.indexes) {
          if (!store.indexNames.contains(idx.name)) store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab'));
  });
  return dbPromise;
}

export function resetDBHandle() { dbPromise = null; }

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function get(store, key) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).get(key));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
  return value;
}

export async function bulkPut(store, values) {
  if (!values.length) return 0;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
  return values.length;
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

export async function bulkDel(store, keys) {
  if (!keys.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const k of keys) os.delete(k);
  await done(tx);
}

export async function all(store) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function byIndex(store, index, query) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(query));
}

export async function countIndex(store, index, query) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).index(index).count(query));
}

// All rows for a profile within [from, to] (inclusive ISO dates). Omit bounds for open ranges.
export async function byProfileDate(store, profileId, from, to) {
  const lower = [profileId, from || ''];
  const upper = [profileId, to || '￿'];
  return byIndex(store, 'profileDate', IDBKeyRange.bound(lower, upper));
}

export async function byProfile(store, profileId) {
  return byIndex(store, 'profileId', profileId);
}

export async function clearProfile(store, profileId) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  const keys = await wrap(os.index('profileId').getAllKeys(profileId));
  for (const k of keys) os.delete(k);
  await done(tx);
  return keys.length;
}

export async function clearStore(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await done(tx);
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
