/* =========================================================
   MMLI School Database — database.js
   IndexedDB wrapper. No external dependencies.
   ========================================================= */

const MMLI_DB = (() => {
  const DB_NAME = "mmli_school_db";
  const DB_VERSION = 1;
  const STORE = "schools";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("schoolName", "schoolName", { unique: false });
          store.createIndex("schoolType", "schoolType", { unique: false });
          store.createIndex("county", "county", { unique: false });
          store.createIndex("letterStatus", "letterStatus", { unique: false });
          store.createIndex("followUpStatus", "followUpStatus", { unique: false });
        }
      };

      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = (event) => reject(event.target.error);
    });
    return dbPromise;
  }

  function tx(mode) {
    return open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
  }

  function genId() {
    return "sch_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  async function getAll() {
    const store = await tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function getById(id) {
    const store = await tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function add(school) {
    const store = await tx("readwrite");
    const now = new Date().toISOString();
    const record = Object.assign(
      {
        id: genId(),
        createdAt: now,
        updatedAt: now,
      },
      school
    );
    return new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  async function update(id, changes) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error("School not found"));
        const merged = Object.assign({}, existing, changes, {
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
        const putReq = store.put(merged);
        putReq.onsuccess = () => resolve(merged);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async function remove(id) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAll() {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Bulk insert used by restore. Does not clear existing data.
  async function bulkAdd(records) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      let count = 0;
      if (records.length === 0) return resolve(0);
      records.forEach((r) => {
        const req = store.put(r); // put = insert or overwrite by id
        req.onsuccess = () => {
          count++;
          if (count === records.length) resolve(count);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  function normalizeName(name) {
    return (name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  }

  // Simple similarity check for duplicate detection (Levenshtein-ish via
  // normalized substring/word overlap — good enough for warning, not blocking).
  function isLikelyDuplicate(nameA, nameB) {
    const a = normalizeName(nameA);
    const b = normalizeName(nameB);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;

    const wordsA = new Set(a.split(" "));
    const wordsB = new Set(b.split(" "));
    let shared = 0;
    wordsA.forEach((w) => {
      if (wordsB.has(w) && w.length > 2) shared++;
    });
    const smaller = Math.min(wordsA.size, wordsB.size);
    return smaller > 0 && shared / smaller >= 0.7;
  }

  return {
    open,
    getAll,
    getById,
    add,
    update,
    remove,
    clearAll,
    bulkAdd,
    genId,
    isLikelyDuplicate,
  };
})();
