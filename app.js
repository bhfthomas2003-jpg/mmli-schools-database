/* =========================================================
   MMLI School Database — app.js
   Router + view rendering + form handling + UI glue.
   ========================================================= */

(function () {
  "use strict";

  const viewRoot = document.getElementById("view-root");
  const toastRoot = document.getElementById("toast-root");
  const modalRoot = document.getElementById("modal-root");

  // One-time cleanup: remove any leftover access-code keys from earlier
  // versions of this app that included a local lock screen (now removed).
  localStorage.removeItem("mmli_lock_enabled");
  localStorage.removeItem("mmli_lock_code");
  sessionStorage.removeItem("mmli_unlocked");

  const SCHOOL_TYPES = ["Junior High School", "Senior High School"];
  const LETTER_STATUSES = ["Not Delivered", "Delivered"];
  const FOLLOWUP_STATUSES = ["Pending", "Contacted", "Interested", "Confirmed", "Declined"];
  const COACH_ROLES = ["Sports Coordinator", "Coach", "Athletic Director", "Physical Education Teacher", "Other"];

  let allSchools = [];
  let editingSchoolId = null; // used by the add/edit form
  let pendingDuplicateBypass = false;

  /* ----------------------- Utilities ----------------------- */

  function esc(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message, type) {
    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .2s ease";
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  function openModal(html) {
    modalRoot.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
    const overlay = document.getElementById("modal-overlay");
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function letterBadge(status) {
    if (status === "Delivered") return `<span class="badge badge-green">Delivered</span>`;
    return `<span class="badge badge-gray">Not Delivered</span>`;
  }
  function followUpBadge(status) {
    const map = {
      Pending: "badge-amber",
      Contacted: "badge-blue",
      Interested: "badge-blue",
      Confirmed: "badge-green",
      Declined: "badge-red",
    };
    return `<span class="badge ${map[status] || "badge-gray"}">${esc(status || "Pending")}</span>`;
  }
  function typeBadge(type) {
    return `<span class="badge badge-gray">${type === "Senior High School" ? "SHS" : "JHS"}</span>`;
  }

  async function refreshData() {
    allSchools = await MMLI_DB.getAll();
    return allSchools;
  }

  /* ----------------------- Router ----------------------- */

  const routes = {
    dashboard: renderDashboard,
    directory: renderDirectory,
    add: renderForm,
    backup: renderBackup,
    settings: renderSettings,
  };

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    return { route: parts[0] || "dashboard", param: parts[1] || null };
  }

  async function router() {
    const { route, param } = parseHash();
    setActiveNav(route === "edit" ? "add" : route === "school" ? "directory" : route);
    viewRoot.scrollTop = 0;
    window.scrollTo(0, 0);

    await refreshData();

    if (route === "edit" && param) {
      editingSchoolId = param;
      renderForm();
    } else if (route === "school" && param) {
      editingSchoolId = null;
      renderProfile(param);
    } else {
      editingSchoolId = null;
      const fn = routes[route] || renderDashboard;
      fn();
    }
    playPageEnter();
  }

  // Re-trigger the page-enter CSS animation on every navigation by
  // removing and re-adding the class (forces a reflow in between).
  function playPageEnter() {
    viewRoot.classList.remove("page-enter");
    void viewRoot.offsetWidth; // force reflow
    viewRoot.classList.add("page-enter");
  }

  function setActiveNav(route) {
    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  window.addEventListener("hashchange", router);

  /* ----------------------- Dashboard ----------------------- */

  function renderDashboard() {
    const total = allSchools.length;
    const jhs = allSchools.filter((s) => s.schoolType === "Junior High School").length;
    const shs = allSchools.filter((s) => s.schoolType === "Senior High School").length;
    const delivered = allSchools.filter((s) => s.letterStatus === "Delivered").length;
    const notDelivered = total - delivered;
    const pending = allSchools.filter((s) => s.followUpStatus === "Pending" || !s.followUpStatus).length;
    const interested = allSchools.filter((s) => s.followUpStatus === "Interested").length;
    const confirmed = allSchools.filter((s) => s.followUpStatus === "Confirmed").length;

    const stats = [
      { label: "Total Schools", value: total, accent: "" },
      { label: "Junior High", value: jhs, accent: "accent-blue" },
      { label: "Senior High", value: shs, accent: "accent-gold" },
      { label: "Letters Delivered", value: delivered, accent: "accent-green" },
      { label: "Letters Not Delivered", value: notDelivered, accent: "accent-red" },
      { label: "Follow-Ups Pending", value: pending, accent: "accent-amber" },
      { label: "Interested Schools", value: interested, accent: "accent-blue" },
      { label: "Confirmed Schools", value: confirmed, accent: "accent-green" },
    ];

    const recent = [...allSchools]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    viewRoot.innerHTML = `
      <h1 class="page-title">Dashboard</h1>
      <p class="page-sub">Overview of MMLI's school outreach database.</p>

      <div class="stat-grid">
        ${stats
          .map(
            (s, i) => `
          <div class="stat-card ${s.accent}" style="--i:${i}">
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>`
          )
          .join("")}
      </div>

      <div class="section-title">Recently Updated</div>
      ${
        recent.length
          ? `<div class="school-list">${recent.map((s, i) => schoolCardHTML(s, i)).join("")}</div>`
          : emptyStateHTML("No schools yet", "Add your first school to get started.", "Add a School", "#/add")
      }
    `;
    bindSchoolCardClicks();
  }

  function emptyStateHTML(title, sub, ctaLabel, ctaHref) {
    return `
      <div class="empty-state card">
        <span class="empty-icon">&#127979;</span>
        <h3>${esc(title)}</h3>
        <p>${esc(sub)}</p>
        ${ctaLabel ? `<a href="${ctaHref}" class="btn btn-primary" style="margin-top:10px;">${esc(ctaLabel)}</a>` : ""}
      </div>`;
  }

  /* ----------------------- Directory ----------------------- */

  let directoryState = {
    query: "",
    type: "all", // all | Junior High School | Senior High School
    county: "all",
    letterStatus: "all",
    followUpStatus: "all",
  };

  function schoolCardHTML(s, i) {
    const location = [s.community, s.county].filter(Boolean).join(", ") || "Location not set";
    return `
      <div class="school-card" data-id="${esc(s.id)}" role="button" tabindex="0" style="--i:${i || 0}">
        <div class="school-card-top">
          <div>
            <div class="school-name">${esc(s.schoolName)}</div>
            <div class="school-meta">${esc(location)}</div>
          </div>
          ${typeBadge(s.schoolType)}
        </div>
        <div class="school-badges">
          ${letterBadge(s.letterStatus)}
          ${followUpBadge(s.followUpStatus)}
        </div>
        <div class="school-contact-row">
          <span>Principal: ${esc(s.principalName || "—")}</span>
          <span>Coach: ${esc(s.coachName || "—")}</span>
        </div>
      </div>`;
  }

  function bindSchoolCardClicks() {
    document.querySelectorAll(".school-card").forEach((card) => {
      const go = () => (location.hash = "#/school/" + card.dataset.id);
      card.addEventListener("click", go);
      card.addEventListener("keypress", (e) => {
        if (e.key === "Enter") go();
      });
    });
  }

  function getCounties() {
    const set = new Set();
    allSchools.forEach((s) => s.county && set.add(s.county));
    return [...set].sort();
  }

  function filteredSchools() {
    const q = directoryState.query.trim().toLowerCase();
    return allSchools.filter((s) => {
      if (directoryState.type !== "all" && s.schoolType !== directoryState.type) return false;
      if (directoryState.county !== "all" && s.county !== directoryState.county) return false;
      if (directoryState.letterStatus !== "all" && s.letterStatus !== directoryState.letterStatus) return false;
      if (directoryState.followUpStatus !== "all" && (s.followUpStatus || "Pending") !== directoryState.followUpStatus)
        return false;
      if (!q) return true;
      const hay = [
        s.schoolName,
        s.principalName,
        s.coachName,
        s.principalPhone,
        s.coachPhone,
        s.principalEmail,
        s.coachEmail,
        s.community,
        s.county,
        s.schoolAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderDirectory() {
    const counties = getCounties();
    const results = filteredSchools();

    viewRoot.innerHTML = `
      <h1 class="page-title">School Directory</h1>
      <p class="page-sub">Search and filter MMLI's partner schools.</p>

      <div class="search-bar">
        <div class="search-input-wrap">
          <span aria-hidden="true">&#128269;</span>
          <input id="search-input" type="search" placeholder="Search by name, contact, phone, email, location…" value="${esc(
            directoryState.query
          )}" />
        </div>
        <div class="filter-row" id="filter-type">
          ${chip("all", "All Types", directoryState.type)}
          ${chip("Junior High School", "Junior High", directoryState.type)}
          ${chip("Senior High School", "Senior High", directoryState.type)}
        </div>
        <div class="filter-row" id="filter-letter">
          ${chip("all", "Any Letter Status", directoryState.letterStatus)}
          ${chip("Delivered", "Delivered", directoryState.letterStatus)}
          ${chip("Not Delivered", "Not Delivered", directoryState.letterStatus)}
        </div>
        <div class="filter-row" id="filter-followup">
          ${chip("all", "Any Follow-Up", directoryState.followUpStatus)}
          ${FOLLOWUP_STATUSES.map((f) => chip(f, f, directoryState.followUpStatus)).join("")}
        </div>
        ${
          counties.length
            ? `<div class="filter-row" id="filter-county">
                ${chip("all", "All Counties", directoryState.county)}
                ${counties.map((c) => chip(c, c, directoryState.county)).join("")}
              </div>`
            : ""
        }
      </div>

      <div class="result-count">${results.length} school${results.length === 1 ? "" : "s"} found</div>

      ${
        results.length
          ? `<div class="school-list">${results.map((s, i) => schoolCardHTML(s, i)).join("")}</div>`
          : allSchools.length
          ? emptyStateHTML("No matches", "Try a different search or clear your filters.", "", "")
          : emptyStateHTML("No schools yet", "Add your first school to get started.", "Add a School", "#/add")
      }
    `;

    bindSchoolCardClicks();

    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", (e) => {
      directoryState.query = e.target.value;
      renderDirectory();
      // restore focus + cursor position after re-render
      const el = document.getElementById("search-input");
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });

    document.querySelectorAll(".chip").forEach((chipEl) => {
      chipEl.addEventListener("click", () => {
        const group = chipEl.parentElement.id;
        const val = chipEl.dataset.value;
        if (group === "filter-type") directoryState.type = val;
        if (group === "filter-letter") directoryState.letterStatus = val;
        if (group === "filter-followup") directoryState.followUpStatus = val;
        if (group === "filter-county") directoryState.county = val;
        renderDirectory();
      });
    });
  }

  function chip(value, label, current) {
    return `<button class="chip ${current === value ? "active" : ""}" data-value="${esc(value)}">${esc(
      label
    )}</button>`;
  }

  /* ----------------------- School profile ----------------------- */

  function renderProfile(id) {
    const s = allSchools.find((x) => x.id === id);
    if (!s) {
      viewRoot.innerHTML = emptyStateHTML("School not found", "It may have been deleted.", "Back to Directory", "#/directory");
      return;
    }
    const location = [s.community, s.county].filter(Boolean).join(", ") || "Not set";

    viewRoot.innerHTML = `
      <div class="profile-header">
        <div class="profile-type">${esc(s.schoolType || "")}</div>
        <h2>${esc(s.schoolName)}</h2>
        <div class="profile-loc">${esc(location)}${s.schoolAddress ? " — " + esc(s.schoolAddress) : ""}</div>
        <div class="school-badges">${letterBadge(s.letterStatus)}${followUpBadge(s.followUpStatus)}</div>
      </div>

      <div class="info-block card">
        <div class="section-title mt-0">Principal Information</div>
        ${infoRow("Name", s.principalName)}
        ${infoRow("Phone", s.principalPhone, "tel")}
        ${infoRow("Email", s.principalEmail, "mail")}
      </div>

      <div class="info-block card">
        <div class="section-title mt-0">Sports / Coach Information</div>
        ${infoRow("Name", s.coachName)}
        ${infoRow("Role", s.coachRole)}
        ${infoRow("Phone", s.coachPhone, "tel")}
        ${infoRow("Email", s.coachEmail, "mail")}
      </div>

      <div class="info-block card">
        <div class="section-title mt-0">MMLI Outreach — Letter</div>
        ${infoRow("Letter Status", s.letterStatus || "Not Delivered")}
        ${infoRow("Date Delivered", s.dateDelivered)}
        ${infoRow("Received By", s.receivedBy)}
        ${infoRow("Delivered By", s.deliveredBy)}
      </div>

      <div class="info-block card">
        <div class="section-title mt-0">Follow-Up</div>
        ${infoRow("Status", s.followUpStatus || "Pending")}
        ${infoRow("Follow-Up Date", s.followUpDate)}
        ${s.notes ? `<div class="info-row"><span class="info-label">Notes</span><span class="info-value notes-value">${esc(s.notes)}</span></div>` : ""}
      </div>

      <div class="profile-actions">
        <a href="#/edit/${esc(s.id)}" class="btn btn-outline">Edit</a>
        <button class="btn btn-danger" id="delete-btn">Delete</button>
      </div>
    `;

    document.getElementById("delete-btn").addEventListener("click", () => confirmDelete(s));
  }

  function infoRow(label, value, linkType) {
    if (!value) return `<div class="info-row"><span class="info-label">${esc(label)}</span><span class="info-value">—</span></div>`;
    let inner = esc(value);
    if (linkType === "tel") inner = `<a href="tel:${esc(value.replace(/\s+/g, ""))}">${esc(value)}</a>`;
    if (linkType === "mail") inner = `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
    return `<div class="info-row"><span class="info-label">${esc(label)}</span><span class="info-value">${inner}</span></div>`;
  }

  function confirmDelete(s) {
    openModal(`
      <h3>Delete this school?</h3>
      <p>This will permanently remove <strong>${esc(s.schoolName)}</strong> from the database. This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-outline" id="cancel-del">Cancel</button>
        <button class="btn btn-danger" id="confirm-del">Delete</button>
      </div>
    `);
    document.getElementById("cancel-del").addEventListener("click", closeModal);
    document.getElementById("confirm-del").addEventListener("click", async () => {
      await MMLI_DB.remove(s.id);
      closeModal();
      toast("School deleted", "success");
      location.hash = "#/directory";
    });
  }

  /* ----------------------- Add / Edit form ----------------------- */

  function blankSchool() {
    return {
      schoolName: "",
      schoolType: "Junior High School",
      schoolAddress: "",
      community: "",
      county: "",
      principalName: "",
      principalPhone: "",
      principalEmail: "",
      coachName: "",
      coachRole: "Sports Coordinator",
      coachPhone: "",
      coachEmail: "",
      letterStatus: "Not Delivered",
      dateDelivered: "",
      receivedBy: "",
      deliveredBy: "",
      followUpStatus: "Pending",
      followUpDate: "",
      notes: "",
    };
  }

  function renderForm() {
    const isEdit = !!editingSchoolId;
    const data = isEdit ? allSchools.find((x) => x.id === editingSchoolId) : blankSchool();
    if (isEdit && !data) {
      viewRoot.innerHTML = emptyStateHTML("School not found", "It may have been deleted.", "Back to Directory", "#/directory");
      return;
    }

    viewRoot.innerHTML = `
      <h1 class="page-title">${isEdit ? "Edit School" : "Add School"}</h1>
      <p class="page-sub">${isEdit ? "Update this school's information." : "Fields marked with * are required."}</p>

      <div id="dup-warning"></div>

      <form id="school-form" novalidate>
        <fieldset class="fieldset">
          <legend>School Details</legend>
          <div class="form-group">
            <label>School Name <span class="req">*</span></label>
            <input type="text" name="schoolName" value="${esc(data.schoolName)}" required />
          </div>
          <div class="form-group">
            <label>School Type <span class="req">*</span></label>
            <select name="schoolType" required>
              ${SCHOOL_TYPES.map((t) => `<option value="${t}" ${data.schoolType === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>School Address <span class="req">*</span></label>
            <input type="text" name="schoolAddress" value="${esc(data.schoolAddress)}" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Community / City</label>
              <input type="text" name="community" value="${esc(data.community)}" />
            </div>
            <div class="form-group">
              <label>County</label>
              <input type="text" name="county" value="${esc(data.county)}" />
            </div>
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Principal Information</legend>
          <div class="form-group">
            <label>Principal Name <span class="req">*</span></label>
            <input type="text" name="principalName" value="${esc(data.principalName)}" required />
          </div>
          <div class="form-group">
            <label>Principal Phone <span class="req">*</span></label>
            <input type="tel" name="principalPhone" value="${esc(data.principalPhone)}" required />
          </div>
          <div class="form-group">
            <label>Principal Email</label>
            <input type="email" name="principalEmail" value="${esc(data.principalEmail)}" />
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Sports Coordinator / Coach</legend>
          <div class="form-group">
            <label>Name <span class="req">*</span></label>
            <input type="text" name="coachName" value="${esc(data.coachName)}" required />
          </div>
          <div class="form-group">
            <label>Position / Role</label>
            <select name="coachRole">
              ${COACH_ROLES.map((r) => `<option value="${r}" ${data.coachRole === r ? "selected" : ""}>${r}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Phone Number <span class="req">*</span></label>
            <input type="tel" name="coachPhone" value="${esc(data.coachPhone)}" required />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="coachEmail" value="${esc(data.coachEmail)}" />
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Letter Distribution</legend>
          <div class="form-group">
            <label>Letter Status</label>
            <select name="letterStatus">
              ${LETTER_STATUSES.map((t) => `<option value="${t}" ${data.letterStatus === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Date Delivered</label>
              <input type="date" name="dateDelivered" value="${esc(data.dateDelivered)}" />
            </div>
            <div class="form-group">
              <label>Received By</label>
              <input type="text" name="receivedBy" value="${esc(data.receivedBy)}" />
            </div>
          </div>
          <div class="form-group">
            <label>Delivered By</label>
            <input type="text" name="deliveredBy" value="${esc(data.deliveredBy)}" />
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Follow-Up</legend>
          <div class="form-group">
            <label>Follow-Up Status</label>
            <select name="followUpStatus">
              ${FOLLOWUP_STATUSES.map((t) => `<option value="${t}" ${data.followUpStatus === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Follow-Up Date</label>
            <input type="date" name="followUpDate" value="${esc(data.followUpDate)}" />
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea name="notes">${esc(data.notes)}</textarea>
          </div>
        </fieldset>

        <div class="form-actions">
          <a href="${isEdit ? "#/school/" + esc(data.id) : "#/directory"}" class="btn btn-outline">Cancel</a>
          <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Add School"}</button>
        </div>
      </form>
    `;

    pendingDuplicateBypass = false;
    document.getElementById("school-form").addEventListener("submit", (e) => handleFormSubmit(e, isEdit, data.id));
  }

  function validateForm(form) {
    const requiredFields = [
      ["schoolName", "School name is required."],
      ["schoolAddress", "School address is required."],
      ["principalName", "Principal name is required."],
      ["principalPhone", "Principal phone is required."],
      ["coachName", "Coach / sports person name is required."],
      ["coachPhone", "Coach / sports person phone is required."],
    ];
    let firstInvalid = null;
    let ok = true;

    document.querySelectorAll(".form-group").forEach((g) => g.classList.remove("has-error"));
    document.querySelectorAll(".field-error").forEach((e) => e.remove());

    requiredFields.forEach(([name, msg]) => {
      const input = form.elements[name];
      if (!input.value.trim()) {
        markError(input, msg);
        ok = false;
        firstInvalid = firstInvalid || input;
      }
    });

    ["principalEmail", "coachEmail"].forEach((name) => {
      const input = form.elements[name];
      const v = input.value.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        markError(input, "Enter a valid email address.");
        ok = false;
        firstInvalid = firstInvalid || input;
      }
    });

    ["principalPhone", "coachPhone"].forEach((name) => {
      const input = form.elements[name];
      const v = input.value.trim();
      if (v && v.replace(/[^0-9]/g, "").length < 6) {
        markError(input, "Phone number looks too short.");
        ok = false;
        firstInvalid = firstInvalid || input;
      }
    });

    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function markError(input, msg) {
    const group = input.closest(".form-group");
    group.classList.add("has-error");
    const hint = document.createElement("div");
    hint.className = "field-error";
    hint.textContent = msg;
    group.appendChild(hint);
  }

  function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => (obj[k] = typeof v === "string" ? v.trim() : v));
    return obj;
  }

  async function handleFormSubmit(e, isEdit, id) {
    e.preventDefault();
    const form = e.target;
    if (!validateForm(form)) return;
    const obj = formToObject(form);

    // Duplicate detection (only warn on add, or when name changed on edit)
    if (!pendingDuplicateBypass) {
      const dup = allSchools.find(
        (s) => s.id !== id && MMLI_DB.isLikelyDuplicate(s.schoolName, obj.schoolName)
      );
      if (dup) {
        showDuplicateWarning(dup, () => {
          pendingDuplicateBypass = true;
          form.requestSubmit();
        });
        return;
      }
    }

    try {
      if (isEdit) {
        await MMLI_DB.update(id, obj);
        toast("School updated", "success");
        location.hash = "#/school/" + id;
      } else {
        const created = await MMLI_DB.add(obj);
        toast("School added", "success");
        location.hash = "#/school/" + created.id;
      }
    } catch (err) {
      toast("Something went wrong: " + err.message, "error");
    }
  }

  function showDuplicateWarning(dup, onContinue) {
    const box = document.getElementById("dup-warning");
    box.innerHTML = `
      <div class="duplicate-warning">
        &#9888; Possible duplicate school found: <strong>${esc(dup.schoolName)}</strong> already exists.
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button class="btn btn-sm btn-outline" id="dup-review">Review Existing</button>
          <button class="btn btn-sm btn-gold" id="dup-continue">This Is Different — Continue</button>
        </div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("dup-review").addEventListener("click", () => {
      location.hash = "#/school/" + dup.id;
    });
    document.getElementById("dup-continue").addEventListener("click", onContinue);
  }

  /* ----------------------- Backup ----------------------- */

  function renderBackup() {
    viewRoot.innerHTML = `
      <h1 class="page-title">Backup &amp; Restore</h1>
      <p class="page-sub">Your data lives only in this browser. Back it up regularly.</p>

      <div class="action-list">
        <div class="action-card" id="export-json-card" role="button" tabindex="0" style="--i:0">
          <div class="action-icon">&#8681;</div>
          <div class="action-text">
            <div class="action-title">Export JSON Backup</div>
            <div class="action-sub">Full backup of all ${allSchools.length} school record(s).</div>
          </div>
        </div>

        <div class="action-card" id="export-csv-card" role="button" tabindex="0" style="--i:1">
          <div class="action-icon">&#128203;</div>
          <div class="action-text">
            <div class="action-title">Export CSV</div>
            <div class="action-sub">Spreadsheet-friendly export for Excel/Sheets.</div>
          </div>
        </div>

        <div class="action-card" id="import-card" role="button" tabindex="0" style="--i:2">
          <div class="action-icon">&#8679;</div>
          <div class="action-text">
            <div class="action-title">Import Backup</div>
            <div class="action-sub">Restore from a previously exported JSON file.</div>
          </div>
        </div>
        <input type="file" id="import-file-input" accept="application/json,.json" hidden />
      </div>

      <div class="settings-note">
        Backups are saved to your phone's Downloads folder. Store a copy somewhere safe (email, Google Drive, WhatsApp to yourself) in case this device is lost or the browser data is cleared.
      </div>
    `;

    document.getElementById("export-json-card").addEventListener("click", async () => {
      await MMLI_BACKUP.exportJSON();
      toast("JSON backup downloaded", "success");
    });
    document.getElementById("export-csv-card").addEventListener("click", async () => {
      await MMLI_BACKUP.exportCSV();
      toast("CSV exported", "success");
    });
    const fileInput = document.getElementById("import-file-input");
    document.getElementById("import-card").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleImportFile);
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let schools;
      try {
        schools = MMLI_BACKUP.parseAndValidate(reader.result);
      } catch (err) {
        toast(err.message, "error");
        return;
      }
      openModal(`
        <h3>Restore ${schools.length} school${schools.length === 1 ? "" : "s"}?</h3>
        <p>Choose how to apply this backup. This action cannot be undone.</p>
        <div class="modal-actions" style="flex-direction:column;">
          <button class="btn btn-primary btn-block" id="import-merge">Add to Existing Data</button>
          <button class="btn btn-danger btn-block" id="import-replace">Replace Existing Data</button>
          <button class="btn btn-outline btn-block" id="import-cancel">Cancel</button>
        </div>
      `);
      document.getElementById("import-cancel").addEventListener("click", closeModal);
      document.getElementById("import-merge").addEventListener("click", () => runImport(reader.result, "merge"));
      document.getElementById("import-replace").addEventListener("click", () => confirmReplace(reader.result));
    };
    reader.readAsText(file);
  }

  function confirmReplace(jsonText) {
    openModal(`
      <h3>Replace all existing data?</h3>
      <p>This will permanently delete every school currently in the database before restoring the backup. This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-outline" id="replace-cancel">Cancel</button>
        <button class="btn btn-danger" id="replace-confirm">Replace Data</button>
      </div>
    `);
    document.getElementById("replace-cancel").addEventListener("click", closeModal);
    document.getElementById("replace-confirm").addEventListener("click", () => runImport(jsonText, "replace"));
  }

  async function runImport(jsonText, mode) {
    try {
      const count = await MMLI_BACKUP.importJSON(jsonText, mode);
      closeModal();
      toast(`Restored ${count} school record(s)`, "success");
      await refreshData();
      router();
    } catch (err) {
      closeModal();
      toast(err.message, "error");
    }
  }

  /* ----------------------- Settings ----------------------- */

  function renderSettings() {
    viewRoot.innerHTML = `
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Data management for this device.</p>

      <div class="section-title mt-0">Data Management</div>
      <div class="action-list">
        <div class="action-card" id="s-export-json" role="button" tabindex="0" style="--i:0">
          <div class="action-icon">&#8681;</div>
          <div class="action-text">
            <div class="action-title">Export JSON Backup</div>
            <div class="action-sub">${allSchools.length} school record(s)</div>
          </div>
        </div>
        <div class="action-card" id="s-export-csv" role="button" tabindex="0" style="--i:1">
          <div class="action-icon">&#128203;</div>
          <div class="action-text"><div class="action-title">Export CSV</div></div>
        </div>
        <div class="action-card" id="s-import" role="button" tabindex="0" style="--i:2">
          <div class="action-icon">&#8679;</div>
          <div class="action-text"><div class="action-title">Import JSON Backup</div></div>
        </div>
        <input type="file" id="s-import-input" accept="application/json,.json" hidden />
        <div class="action-card danger" id="s-clear-all" role="button" tabindex="0" style="--i:3">
          <div class="action-icon">&#128465;</div>
          <div class="action-text">
            <div class="action-title">Clear All Data</div>
            <div class="action-sub">Permanently delete every school record</div>
          </div>
        </div>
      </div>

      <div class="settings-note">
        MMLI School Database v1.0 — runs entirely on this device via IndexedDB. No servers, accounts, or external databases are used. Data does not sync between devices or browsers — export a backup regularly.
      </div>
    `;

    document.getElementById("s-export-json").addEventListener("click", async () => {
      await MMLI_BACKUP.exportJSON();
      toast("JSON backup downloaded", "success");
    });
    document.getElementById("s-export-csv").addEventListener("click", async () => {
      await MMLI_BACKUP.exportCSV();
      toast("CSV exported", "success");
    });
    const importInput = document.getElementById("s-import-input");
    document.getElementById("s-import").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", handleImportFile);

    document.getElementById("s-clear-all").addEventListener("click", confirmClearAll);
  }

  function confirmClearAll() {
    openModal(`
      <h3>Delete all school data?</h3>
      <p>This permanently deletes every school record on this device. Export a backup first if you might need this data again.</p>
      <p>Type <strong>DELETE ALL SCHOOL DATA</strong> to confirm.</p>
      <div class="form-group"><input type="text" id="clear-confirm-input" autocomplete="off" /></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="clear-cancel">Cancel</button>
        <button class="btn btn-danger" id="clear-confirm" disabled>Delete Everything</button>
      </div>
    `);
    const input = document.getElementById("clear-confirm-input");
    const confirmBtn = document.getElementById("clear-confirm");
    input.addEventListener("input", () => {
      confirmBtn.disabled = input.value !== "DELETE ALL SCHOOL DATA";
    });
    document.getElementById("clear-cancel").addEventListener("click", closeModal);
    confirmBtn.addEventListener("click", async () => {
      await MMLI_BACKUP.clearAllData();
      closeModal();
      toast("All school data deleted", "success");
      await refreshData();
      location.hash = "#/dashboard";
      router();
    });
  }

  /* ----------------------- Offline indicator ----------------------- */

  function updateOfflinePill() {
    const pill = document.getElementById("offline-pill");
    pill.hidden = navigator.onLine;
  }
  window.addEventListener("online", updateOfflinePill);
  window.addEventListener("offline", updateOfflinePill);

  /* ----------------------- Service worker ----------------------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* offline caching is a nice-to-have; ignore failures (e.g. file:// use) */
      });
    });
  }

  /* ----------------------- Init ----------------------- */

  document.addEventListener("DOMContentLoaded", async () => {
    updateOfflinePill();
    await MMLI_DB.open();
    if (!location.hash) location.hash = "#/dashboard";
    router();
  });
})();
