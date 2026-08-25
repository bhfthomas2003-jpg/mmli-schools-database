/* =========================================================
   MMLI School Database — backup.js
   Export JSON, Export CSV, Import JSON (replace/merge), Clear All
   ========================================================= */

const MMLI_BACKUP = (() => {
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
      d.getHours()
    )}${pad(d.getMinutes())}`;
  }

  async function exportJSON() {
    const schools = await MMLI_DB.getAll();
    const payload = {
      app: "MMLI School Database",
      exportedAt: new Date().toISOString(),
      version: 1,
      count: schools.length,
      schools,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `mmli-schools-backup-${timestamp()}.json`,
      "application/json"
    );
  }

  function csvEscape(val) {
    if (val === undefined || val === null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  async function exportCSV() {
    const schools = await MMLI_DB.getAll();
    const columns = [
      "schoolName",
      "schoolType",
      "schoolAddress",
      "community",
      "county",
      "principalName",
      "principalPhone",
      "principalEmail",
      "coachName",
      "coachRole",
      "coachPhone",
      "coachEmail",
      "letterStatus",
      "dateDelivered",
      "receivedBy",
      "deliveredBy",
      "followUpStatus",
      "followUpDate",
      "notes",
    ];
    const header = columns.join(",");
    const rows = schools.map((s) => columns.map((c) => csvEscape(s[c])).join(","));
    const csv = [header, ...rows].join("\n");
    downloadBlob(csv, `mmli-schools-export-${timestamp()}.csv`, "text/csv");
  }

  function parseAndValidate(jsonText) {
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      throw new Error("This file is not valid JSON. Choose a backup file exported from this app.");
    }
    const schools = Array.isArray(data) ? data : data.schools;
    if (!Array.isArray(schools)) {
      throw new Error("This file doesn't look like an MMLI backup (no schools array found).");
    }
    // Basic shape check
    schools.forEach((s, i) => {
      if (!s.schoolName) {
        throw new Error(`Record ${i + 1} is missing a school name — this may not be a valid backup.`);
      }
    });
    return schools;
  }

  // mode: 'replace' | 'merge'
  async function importJSON(jsonText, mode) {
    const incoming = parseAndValidate(jsonText);

    if (mode === "replace") {
      await MMLI_DB.clearAll();
    }

    const prepared = incoming.map((s) => {
      const record = Object.assign({}, s);
      if (mode === "merge" || !record.id) {
        // Assign a fresh id when merging, to avoid overwriting existing
        // records that happen to share an id from a different export.
        record.id = MMLI_DB.genId();
      }
      if (!record.createdAt) record.createdAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      return record;
    });

    await MMLI_DB.bulkAdd(prepared);
    return prepared.length;
  }

  async function clearAllData() {
    await MMLI_DB.clearAll();
  }

  // Public showcase export: a small, privacy-safe JSON of Confirmed schools
  // only (no principal/coach contact details), meant to be committed to the
  // repo so a separate public page (showcase.html) — or an embed on your
  // main website — can display it without touching this device's data.
  async function exportConfirmedShowcase() {
    const schools = await MMLI_DB.getAll();
    const confirmed = schools
      .filter((s) => s.followUpStatus === "Confirmed")
      .map((s) => ({
        schoolName: s.schoolName,
        schoolType: s.schoolType,
        community: s.community || "",
        county: s.county || "",
        confirmedDate: s.followUpDate || "",
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));

    const payload = {
      generatedAt: new Date().toISOString(),
      count: confirmed.length,
      schools: confirmed,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      "confirmed-schools.json",
      "application/json"
    );
    return confirmed.length;
  }

  return {
    exportJSON,
    exportCSV,
    importJSON,
    clearAllData,
    parseAndValidate,
    exportConfirmedShowcase,
  };
})();
