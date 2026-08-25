/* =========================================================
   MMLI School Database — database.js (Firestore edition)
   Same public API as the old IndexedDB version (open, getAll,
   getById, add, update, remove, clearAll, bulkAdd, genId,
   isLikelyDuplicate) so app.js and backup.js work unchanged.
   The difference: every read/write now goes to a shared
   Firestore collection, so every teammate's phone/browser sees
   the same data instead of its own private local copy.
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your MMLI Firebase project — apiKey etc. here are safe to expose
// client-side; Firestore Security Rules (set in the Firebase console),
// not secrecy of this config, are what control who can read/write.
const firebaseConfig = {
  apiKey: "AIzaSyBSVE0T1JhNjmFi416mD9WI4XTmHgb1-_I",
  authDomain: "mmli-schools-database.firebaseapp.com",
  projectId: "mmli-schools-database",
  storageBucket: "mmli-schools-database.firebasestorage.app",
  messagingSenderId: "505699685288",
  appId: "1:505699685288:web:fa36b4737cc4f95470439d",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLLECTION = "schools";
const BATCH_LIMIT = 450; // Firestore batched writes cap at 500 — stay safely under it.

const MMLI_DB = (() => {
  function genId() {
    return "sch_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  async function open() {
    // Nothing to "open" with Firestore — the SDK manages its own
    // connection. Kept only so any old call sites don't break.
    return true;
  }

  async function getAll() {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map((d) => d.data());
  }

  async function getById(id) {
    const snap = await getDoc(doc(db, COLLECTION, id));
    return snap.exists() ? snap.data() : null;
  }

  async function add(school) {
    const now = new Date().toISOString();
    const record = Object.assign(
      { id: genId(), createdAt: now, updatedAt: now },
      school
    );
    await setDoc(doc(db, COLLECTION, record.id), record);
    return record;
  }

  async function update(id, changes) {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("School not found");
    const existing = snap.data();
    const merged = Object.assign({}, existing, changes, {
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, merged);
    return merged;
  }

  async function remove(id) {
    await deleteDoc(doc(db, COLLECTION, id));
    return true;
  }

  async function clearAll() {
    const snap = await getDocs(collection(db, COLLECTION));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return true;
  }

  // Bulk insert used by restore. Does not clear existing data first.
  async function bulkAdd(records) {
    if (!records.length) return 0;
    let count = 0;
    for (let i = 0; i < records.length; i += BATCH_LIMIT) {
      const chunk = records.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((r) => {
        const record = r.id ? r : Object.assign({}, r, { id: genId() });
        batch.set(doc(db, COLLECTION, record.id), record);
      });
      await batch.commit();
      count += chunk.length;
    }
    return count;
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

// app.js and backup.js are loaded as regular (non-module) scripts, so
// expose MMLI_DB as a global exactly like the old IndexedDB version did.
// Timing note: this <script type="module"> executes after HTML parsing
// completes but before the DOMContentLoaded event fires (same guarantee
// as a `defer` script), and app.js only calls MMLI_DB from inside its
// DOMContentLoaded handler — so window.MMLI_DB is always ready in time.
window.MMLI_DB = MMLI_DB;
