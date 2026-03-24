window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createCheckinModule = (app) => {
  const { utils } = app;

  const refs = {
    openVisitor: document.getElementById("openVisitorModalBtn"),
    openChildren: document.getElementById("openCheckinChildrenBtn"),
    classFilter: document.getElementById("checkinClassFilter"),
    statusFilter: document.getElementById("attendanceStatusFilter"),
    search: document.getElementById("checkinSearchInput"),
    summary: document.getElementById("checkinSummaryStrip"),
    pendingPickupList: document.getElementById("pendingPickupList"),
    checkedOutList: document.getElementById("checkedOutList"),
    rosterList: document.getElementById("checkinRosterList"),
    followUpList: document.getElementById("absentFollowUpList"),
    serviceLabel: document.getElementById("todayServiceLabel"),
    form: document.getElementById("attendanceForm"),
    modalTitle: document.getElementById("attendanceModalTitle"),
    childIdInput: document.getElementById("attendanceChildIdInput"),
    modeInput: document.getElementById("attendanceModeInput"),
    childSummary: document.getElementById("attendanceChildSummary"),
    pickedUpBy: document.getElementById("attendancePickedUpByInput"),
    pickupCode: document.getElementById("attendancePickupCodeInput"),
    overrideToggle: document.getElementById("attendanceOverrideToggle"),
    note: document.getElementById("attendanceNoteInput"),
    submitButton: document.getElementById("attendanceSubmitBtn"),
  };

  function init() {
    refs.openVisitor.addEventListener("click", () => app.modules.children.openCreate({ visitor: true }));
    refs.openChildren.addEventListener("click", () => app.openScreen("children"));
    refs.classFilter.addEventListener("change", render);
    refs.statusFilter.addEventListener("change", render);
    refs.search.addEventListener("input", render);
    refs.form.addEventListener("submit", onModalSubmit);
    refs.rosterList.addEventListener("click", onRosterClick);
    refs.pendingPickupList.addEventListener("click", onPendingListClick);
    refs.followUpList.addEventListener("click", onFollowUpListClick);
  }

  function refreshClassFilter() {
    app.populateClassSelect(refs.classFilter, {
      allowAll: true,
      allLabel: "All classes",
    });
  }

  function buildAttendanceRecord(child, status = "checked-in") {
    const now = utils.nowISOString();
    return {
      id: utils.makeId("attendance"),
      childId: child.id,
      serviceDate: app.todayKey(),
      checkInTime: status === "absent" ? "" : now,
      checkOutTime: "",
      status,
      classId: child.classId,
      firstVisit: child.visitorStatus === "first-time",
      pickupVerified: false,
      pickedUpBy: "",
      pickupCodeUsed: "",
      note: "",
      recordedBy: app.store.peek().settings.currentUser,
      createdAt: now,
      updatedAt: now,
    };
  }

  function checkInChild(childId) {
    const child = app.findChild(childId);
    if (!child) {
      app.ui.toast("That child profile could not be found.", "warning");
      return;
    }

    const existing = app.getTodayAttendanceForChild(childId);
    if (existing?.status === "checked-in") {
      openCheckout(childId);
      return;
    }

    const nextRecord = existing
      ? {
        ...existing,
        status: "checked-in",
        classId: child.classId,
        checkInTime: existing.checkInTime || utils.nowISOString(),
        updatedAt: utils.nowISOString(),
      }
      : buildAttendanceRecord(child, "checked-in");

    app.store.update((draft) => {
      const index = draft.attendance.findIndex((record) => record.id === nextRecord.id);
      if (index >= 0) {
        draft.attendance[index] = nextRecord;
      } else {
        draft.attendance.push(nextRecord);
      }
      return draft;
    });
    app.queueSync("attendance", existing ? "upsert" : "create", nextRecord);
    app.ui.toast(`${utils.buildChildDisplayName(child)} checked in.`, "success");
  }

  function quickToggle(childId) {
    const todayRecord = app.getTodayAttendanceForChild(childId);
    if (todayRecord?.status === "checked-in") {
      openCheckout(childId);
      return;
    }
    checkInChild(childId);
  }

  function openCheckout(childId) {
    const child = app.findChild(childId);
    const record = app.getTodayAttendanceForChild(childId);
    if (!child || !record) {
      app.ui.toast("This child is not checked in yet.", "warning");
      return;
    }

    refs.form.reset();
    refs.modalTitle.textContent = "Confirm checkout";
    refs.childIdInput.value = childId;
    refs.modeInput.value = "checkout";
    refs.overrideToggle.checked = false;
    refs.childSummary.innerHTML = `
      <strong>${utils.escapeHtml(utils.buildChildDisplayName(child))}</strong>
      <div>${utils.escapeHtml(utils.buildGuardianSummary(child))}</div>
      <div>${utils.escapeHtml(child.pickupCode ? `Expected pickup code: ${child.pickupCode}` : "No pickup code saved.")}</div>
    `;
    refs.submitButton.textContent = "Confirm checkout";
    app.ui.openModal("attendanceModal");
  }

  function verifyPickup(child, overrideEnabled) {
    const configured = app.store.peek().settings.pickupCodeRequired;
    const allowOverride = app.store.peek().settings.allowAdminOverride && app.can("settings");
    const providedCode = utils.stringFrom(refs.pickupCode.value);

    if (!configured) {
      return {
        pickupVerified: true,
        pickupCodeUsed: providedCode,
      };
    }

    if (providedCode && providedCode === child.pickupCode) {
      return {
        pickupVerified: true,
        pickupCodeUsed: providedCode,
      };
    }

    if (overrideEnabled && allowOverride) {
      return {
        pickupVerified: false,
        pickupCodeUsed: providedCode,
      };
    }

    throw new Error("Pickup code does not match. Ask the guardian for the correct code or use admin override.");
  }

  function onModalSubmit(event) {
    event.preventDefault();

    try {
      const child = app.findChild(refs.childIdInput.value);
      const record = app.getTodayAttendanceForChild(refs.childIdInput.value);
      if (!child || !record) {
        throw new Error("The attendance record could not be found.");
      }

      if (!refs.form.reportValidity()) {
        throw new Error("Please complete the checkout fields.");
      }

      const verification = verifyPickup(child, refs.overrideToggle.checked);
      const nextRecord = {
        ...record,
        status: "checked-out",
        checkOutTime: utils.nowISOString(),
        pickedUpBy: utils.stringFrom(refs.pickedUpBy.value),
        pickupCodeUsed: verification.pickupCodeUsed,
        pickupVerified: verification.pickupVerified,
        note: utils.stringFrom(refs.note.value),
        updatedAt: utils.nowISOString(),
      };

      app.store.update((draft) => {
        const index = draft.attendance.findIndex((entry) => entry.id === nextRecord.id);
        if (index >= 0) {
          draft.attendance[index] = nextRecord;
        }
        return draft;
      });
      app.queueSync("attendance", "upsert", nextRecord);
      app.ui.closeModal();
      app.ui.toast(app.store.peek().settings.checkoutMessage, "success");
    } catch (error) {
      app.ui.toast(error.message || "Checkout could not be completed.", "warning");
    }
  }

  function markAbsent(childId) {
    const child = app.findChild(childId);
    if (!child) {
      return;
    }

    const existing = app.getTodayAttendanceForChild(childId);
    const nextRecord = existing
      ? {
        ...existing,
        status: "absent",
        updatedAt: utils.nowISOString(),
      }
      : buildAttendanceRecord(child, "absent");

    app.store.update((draft) => {
      const index = draft.attendance.findIndex((record) => record.id === nextRecord.id);
      if (index >= 0) {
        draft.attendance[index] = nextRecord;
      } else {
        draft.attendance.push(nextRecord);
      }
      return draft;
    });
    app.queueSync("attendance", existing ? "upsert" : "create", nextRecord);
    app.ui.toast(`${utils.buildChildDisplayName(child)} marked absent.`, "info");
  }

  function getFilteredChildren() {
    const classId = refs.classFilter.value || "all";
    const statusFilter = refs.statusFilter.value || "all";
    const query = refs.search.value.trim().toLowerCase();

    return utils.sortByName(app.store.peek().children.filter((child) => child.status === "active"), (child) => utils.buildChildDisplayName(child))
      .filter((child) => {
        const attendance = app.getTodayAttendanceForChild(child.id);
        const matchesClass = classId === "all" || child.classId === classId;
        const haystack = `${utils.buildChildDisplayName(child)} ${utils.buildGuardianSummary(child)}`.toLowerCase();
        const matchesSearch = !query || haystack.includes(query);

        if (statusFilter === "checked-in") {
          return matchesClass && matchesSearch && attendance?.status === "checked-in";
        }
        if (statusFilter === "checked-out") {
          return matchesClass && matchesSearch && attendance?.status === "checked-out";
        }
        if (statusFilter === "not-checked-in") {
          return matchesClass && matchesSearch && !attendance;
        }
        return matchesClass && matchesSearch;
      });
  }

  function renderSummary() {
    const todayRecords = app.getTodayAttendance();
    const checkedIn = todayRecords.filter((record) => record.status === "checked-in").length;
    const checkedOut = todayRecords.filter((record) => record.status === "checked-out").length;
    const absent = todayRecords.filter((record) => record.status === "absent").length;
    const firstVisitors = todayRecords.filter((record) => record.firstVisit).length;

    refs.summary.innerHTML = [
      { label: "Checked in", value: checkedIn },
      { label: "Checked out", value: checkedOut },
      { label: "Absent", value: absent },
      { label: "First visits", value: firstVisitors },
    ].map((item) => `<span class="summary-pill">${utils.escapeHtml(item.label)}: ${utils.escapeHtml(String(item.value))}</span>`).join("");
  }

  function renderPendingPickup() {
    const pending = app.getTodayAttendance().filter((record) => record.status === "checked-in");
    if (!pending.length) {
      refs.pendingPickupList.innerHTML = `<div class="empty-state"><h3>All clear</h3><p>No children are waiting for pickup right now.</p></div>`;
      return;
    }

    refs.pendingPickupList.innerHTML = pending.map((record) => {
      const child = app.findChild(record.childId);
      return `
        <div class="list-row">
          <div class="list-row-main">
            <p class="list-row-title">${utils.escapeHtml(utils.buildChildDisplayName(child))}</p>
            <p class="list-row-copy">${utils.escapeHtml(utils.formatTime(record.checkInTime, app.language()))}  |  ${utils.escapeHtml(app.findClass(record.classId)?.name || "Class pending")}</p>
          </div>
          <button class="btn btn-primary btn-inline" type="button" data-pending-action="checkout" data-child-id="${utils.escapeHtml(child.id)}">Check out</button>
        </div>
      `;
    }).join("");
  }

  function renderCheckedOut() {
    const records = app.getTodayAttendance().filter((record) => record.status === "checked-out");
    if (!records.length) {
      refs.checkedOutList.innerHTML = `<div class="empty-state"><h3>No completed pickups yet</h3><p>Checked-out children will appear here once pickup is confirmed.</p></div>`;
      return;
    }

    refs.checkedOutList.innerHTML = records.map((record) => {
      const child = app.findChild(record.childId);
      return `
        <div class="list-row">
          <div class="list-row-main">
            <p class="list-row-title">${utils.escapeHtml(utils.buildChildDisplayName(child))}</p>
            <p class="list-row-copy">${utils.escapeHtml(record.pickedUpBy || "Pickup recorded")}  |  ${utils.escapeHtml(utils.formatTime(record.checkOutTime, app.language()))}</p>
          </div>
          <span class="badge ${record.pickupVerified ? "badge-success" : "badge-warning"}">${record.pickupVerified ? "Code matched" : "Override used"}</span>
        </div>
      `;
    }).join("");
  }

  function renderRoster() {
    const children = getFilteredChildren();
    refs.rosterList.innerHTML = children.map((child) => {
      const classGroup = app.findClass(child.classId);
      const attendance = app.getTodayAttendanceForChild(child.id);
      const statusLabel = utils.buildAttendanceStatusLabel(attendance?.status || "not-checked-in");
      const actionLabel = attendance?.status === "checked-in" ? "Check out" : "Check in";

      return `
        <article class="list-card">
          <div class="list-card-head">
            <div>
              <h4 class="list-card-title">${utils.escapeHtml(utils.buildChildDisplayName(child))}</h4>
              <p class="list-card-copy">${utils.escapeHtml(utils.buildGuardianSummary(child))}  |  ${utils.escapeHtml(classGroup?.name || "Unassigned class")}</p>
            </div>
            <span class="badge ${attendance?.status === "checked-out" ? "badge-soft" : attendance?.status === "checked-in" ? "badge-success" : "badge-warning"}">${utils.escapeHtml(statusLabel)}</span>
          </div>
          <div class="detail-grid">
            <span class="detail-item">Pickup code: ${utils.escapeHtml(child.pickupCode)}</span>
            <span class="detail-item">${utils.escapeHtml(child.visitorStatus)}</span>
          </div>
          <div class="action-row">
            <button class="btn btn-secondary btn-inline" type="button" data-roster-action="absent" data-child-id="${utils.escapeHtml(child.id)}">Mark absent</button>
            <button class="btn btn-primary btn-inline" type="button" data-roster-action="toggle" data-child-id="${utils.escapeHtml(child.id)}">${utils.escapeHtml(actionLabel)}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderFollowUps() {
    const followUps = app.getAbsentChildren();
    if (!followUps.length) {
      refs.followUpList.innerHTML = `<div class="empty-state"><h3>No absentee follow-up list</h3><p>Children who miss today and need a pastoral check-in will appear here.</p></div>`;
      return;
    }

    refs.followUpList.innerHTML = followUps.map((entry) => `
      <div class="list-row">
        <div class="list-row-main">
          <p class="list-row-title">${utils.escapeHtml(utils.buildChildDisplayName(entry.child))}</p>
          <p class="list-row-copy">${utils.escapeHtml(entry.reasonCopy)}</p>
        </div>
        <button class="btn btn-secondary btn-inline" type="button" data-followup-action="edit" data-child-id="${utils.escapeHtml(entry.child.id)}">Open profile</button>
      </div>
    `).join("");
  }

  function render() {
    refreshClassFilter();
    refs.serviceLabel.textContent = `${utils.formatDate(app.todayKey(), app.language())} service`;
    renderSummary();
    renderPendingPickup();
    renderCheckedOut();
    renderRoster();
    renderFollowUps();
  }

  function onRosterClick(event) {
    const button = event.target.closest("[data-roster-action]");
    if (!button) {
      return;
    }

    const childId = button.dataset.childId;
    if (button.dataset.rosterAction === "toggle") {
      quickToggle(childId);
      return;
    }

    if (button.dataset.rosterAction === "absent") {
      markAbsent(childId);
    }
  }

  function onPendingListClick(event) {
    const button = event.target.closest("[data-pending-action='checkout']");
    if (!button) {
      return;
    }
    openCheckout(button.dataset.childId);
  }

  function onFollowUpListClick(event) {
    const button = event.target.closest("[data-followup-action='edit']");
    if (!button) {
      return;
    }
    app.modules.children.openEdit(button.dataset.childId);
  }

  return {
    checkInChild,
    init,
    openCheckout,
    quickToggle,
    render,
  };
};



