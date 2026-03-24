window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createChildrenModule = (app) => {
  const { utils } = app;

  const refs = {
    list: document.getElementById("childList"),
    empty: document.getElementById("childEmptyState"),
    summary: document.getElementById("childSummaryStrip"),
    openButton: document.getElementById("openChildModalBtn"),
    filterClass: document.getElementById("childClassFilter"),
    filterStatus: document.getElementById("childStatusFilter"),
    search: document.getElementById("childSearchInput"),
    form: document.getElementById("childForm"),
    modalTitle: document.getElementById("childModalTitle"),
    idInput: document.getElementById("childIdInput"),
    firstName: document.getElementById("childFirstNameInput"),
    lastName: document.getElementById("childLastNameInput"),
    birthDate: document.getElementById("childBirthDateInput"),
    grade: document.getElementById("childGradeInput"),
    classSelect: document.getElementById("childClassSelect"),
    visitorStatus: document.getElementById("childVisitorStatusInput"),
    familyStatus: document.getElementById("childFamilyStatusInput"),
    status: document.getElementById("childStatusInput"),
    guardianOneName: document.getElementById("childGuardianOneNameInput"),
    guardianOnePhone: document.getElementById("childGuardianOnePhoneInput"),
    guardianTwoName: document.getElementById("childGuardianTwoNameInput"),
    guardianTwoPhone: document.getElementById("childGuardianTwoPhoneInput"),
    allergies: document.getElementById("childAllergiesInput"),
    medical: document.getElementById("childMedicalInput"),
    pickupCode: document.getElementById("childPickupCodeInput"),
    generatePickupCode: document.getElementById("generatePickupCodeBtn"),
    notes: document.getElementById("childNotesInput"),
    followUp: document.getElementById("childNeedsFollowUpInput"),
    deleteButton: document.getElementById("deleteChildBtn"),
  };

  function init() {
    refs.openButton.addEventListener("click", () => openCreate());
    refs.filterClass.addEventListener("change", render);
    refs.filterStatus.addEventListener("change", render);
    refs.search.addEventListener("input", render);
    refs.form.addEventListener("submit", onSubmit);
    refs.deleteButton.addEventListener("click", onDeleteFromModal);
    refs.generatePickupCode.addEventListener("click", () => {
      refs.pickupCode.value = utils.generatePickupCode();
    });
    refs.list.addEventListener("click", onListClick);
  }

  function refreshClassOptions() {
    app.populateClassSelect(refs.filterClass, {
      allowAll: true,
      allLabel: "All classes",
    });
    app.populateClassSelect(refs.classSelect, {
      allowBlank: false,
    });
  }

  function currentChild() {
    return app.store.peek().children.find((child) => child.id === refs.idInput.value) || null;
  }

  function resetForm() {
    refs.form.reset();
    refs.idInput.value = "";
    refs.birthDate.value = "";
    refs.grade.value = "";
    refs.visitorStatus.value = "member";
    refs.familyStatus.value = "agape";
    refs.status.value = "active";
    refs.pickupCode.value = utils.generatePickupCode();
    refs.followUp.checked = false;
    refs.deleteButton.classList.add("hidden");
  }

  function openCreate(options = {}) {
    refreshClassOptions();
    resetForm();
    refs.modalTitle.textContent = options.visitor ? "Add first-time visitor" : "Add child";
    refs.visitorStatus.value = options.visitor ? "first-time" : "member";
    refs.familyStatus.value = options.visitor ? "unchurched" : "agape";
    refs.followUp.checked = Boolean(options.visitor);
    app.ui.openModal("childModal");
  }

  function openEdit(childId) {
    const child = app.store.peek().children.find((item) => item.id === childId);
    if (!child) {
      app.ui.toast("That child profile could not be found.", "warning");
      return;
    }

    refreshClassOptions();
    const guardians = child.guardians || [];
    refs.modalTitle.textContent = "Edit child";
    refs.idInput.value = child.id;
    refs.firstName.value = child.firstName;
    refs.lastName.value = child.lastName;
    refs.birthDate.value = child.birthDate || "";
    refs.grade.value = child.grade || "";
    refs.classSelect.value = child.classId || refs.classSelect.value;
    refs.visitorStatus.value = child.visitorStatus;
    refs.familyStatus.value = child.familyChurchStatus;
    refs.status.value = child.status;
    refs.guardianOneName.value = guardians[0]?.name || "";
    refs.guardianOnePhone.value = guardians[0]?.phone || "";
    refs.guardianTwoName.value = guardians[1]?.name || "";
    refs.guardianTwoPhone.value = guardians[1]?.phone || "";
    refs.allergies.value = child.allergies || "";
    refs.medical.value = child.medicalNotes || "";
    refs.pickupCode.value = child.pickupCode || utils.generatePickupCode();
    refs.notes.value = child.notes || "";
    refs.followUp.checked = Boolean(child.needsFollowUp);
    refs.deleteButton.classList.remove("hidden");
    app.ui.openModal("childModal");
  }

  function buildChildFromForm() {
    if (!refs.form.reportValidity()) {
      throw new Error("Please complete the child registration form.");
    }

    const existing = currentChild();
    const now = utils.nowISOString();
    const guardians = [
      { name: refs.guardianOneName.value, phone: refs.guardianOnePhone.value },
      { name: refs.guardianTwoName.value, phone: refs.guardianTwoPhone.value },
    ].filter((guardian) => utils.stringFrom(guardian.name));

    if (!guardians.length) {
      throw new Error("Add at least one guardian.");
    }

    return {
      id: refs.idInput.value || utils.makeId("child"),
      firstName: utils.stringFrom(refs.firstName.value),
      lastName: utils.stringFrom(refs.lastName.value),
      birthDate: refs.birthDate.value || "",
      grade: utils.stringFrom(refs.grade.value),
      classId: refs.classSelect.value,
      visitorStatus: refs.visitorStatus.value,
      familyChurchStatus: refs.familyStatus.value,
      guardians,
      allergies: utils.stringFrom(refs.allergies.value),
      medicalNotes: utils.stringFrom(refs.medical.value),
      pickupCode: utils.stringFrom(refs.pickupCode.value, utils.generatePickupCode()),
      notes: utils.stringFrom(refs.notes.value),
      needsFollowUp: refs.followUp.checked,
      status: refs.status.value,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }

  function onSubmit(event) {
    event.preventDefault();

    try {
      const nextChild = buildChildFromForm();
      const existing = app.store.peek().children.find((child) => child.id === nextChild.id);
      app.store.update((draft) => {
        const index = draft.children.findIndex((child) => child.id === nextChild.id);
        if (index >= 0) {
          draft.children[index] = nextChild;
        } else {
          draft.children.push(nextChild);
        }
        return draft;
      });

      app.queueSync("children", existing ? "upsert" : "create", nextChild);
      app.ui.closeModal();
      app.ui.toast(existing ? "Child profile updated." : "Child profile saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "The child could not be saved.", "warning");
    }
  }

  async function onDeleteFromModal() {
    const child = currentChild();
    if (!child) {
      return;
    }

    const shouldDelete = await app.ui.confirm({
      title: "Delete child profile",
      message: "This removes the child profile and local attendance history from this device. Continue?",
      confirmLabel: "Delete profile",
    });

    if (!shouldDelete) {
      return;
    }

    app.store.update((draft) => {
      draft.children = draft.children.filter((item) => item.id !== child.id);
      draft.attendance = draft.attendance.filter((record) => record.childId !== child.id);
      return draft;
    });
    app.queueSync("children", "delete", { id: child.id });
    app.ui.closeModal();
    app.ui.toast("Child profile deleted.", "success");
  }

  function getFilteredChildren() {
    const classId = refs.filterClass.value || "all";
    const statusFilter = refs.filterStatus.value || "active";
    const query = refs.search.value.trim().toLowerCase();
    const followUpIds = new Set(app.getFollowUpChildren().map((child) => child.id));

    return utils.sortByName(app.store.peek().children, (child) => utils.buildChildDisplayName(child))
      .filter((child) => {
        const matchesClass = classId === "all" || child.classId === classId;
        const haystack = [
          utils.buildChildDisplayName(child),
          utils.buildGuardianSummary(child),
          child.allergies,
          child.medicalNotes,
          child.pickupCode,
          child.notes,
        ].join(" ").toLowerCase();
        const matchesSearch = !query || haystack.includes(query);

        if (statusFilter === "followup") {
          return matchesClass && matchesSearch && followUpIds.has(child.id);
        }

        if (statusFilter === "visitors") {
          return matchesClass && matchesSearch && child.visitorStatus !== "member";
        }

        if (statusFilter === "active") {
          return matchesClass && matchesSearch && child.status === "active";
        }

        return matchesClass && matchesSearch;
      });
  }

  function renderSummary(children) {
    const todayRecords = app.getTodayAttendance();
    const medicalAlerts = children.filter((child) => child.allergies || child.medicalNotes).length;
    const followUps = app.getFollowUpChildren().length;
    const visitors = children.filter((child) => child.visitorStatus !== "member").length;

    refs.summary.innerHTML = [
      { label: "Registered", value: children.length },
      { label: "Checked in", value: todayRecords.filter((record) => record.status === "checked-in").length },
      { label: "Medical alerts", value: medicalAlerts },
      { label: "Visitors", value: visitors },
      { label: "Follow-up", value: followUps },
    ].map((item) => `<span class="summary-pill">${utils.escapeHtml(item.label)}: ${utils.escapeHtml(String(item.value))}</span>`).join("");
  }

  function buildCard(child) {
    const classGroup = app.findClass(child.classId);
    const todayRecord = app.getTodayAttendanceForChild(child.id);
    const history = app.getAttendanceHistory(child.id).slice(0, 4);
    const streak = utils.attendanceStreak(app.getAttendanceHistory(child.id));
    const followUp = app.getFollowUpChildren().find((item) => item.id === child.id);

    return `
      <article class="profile-card">
        <div class="profile-header">
          <div>
            <h3 class="profile-title">${utils.escapeHtml(utils.buildChildDisplayName(child))}</h3>
            <p class="profile-subtitle">${utils.escapeHtml(utils.buildAgeLabel(child.birthDate))}  |  ${utils.escapeHtml(child.grade || "Grade not set")}  |  ${utils.escapeHtml(utils.buildGuardianSummary(child))}</p>
          </div>
          <div class="badge-row">
            <span class="badge badge-neutral class-chip" style="--class-color:${utils.escapeHtml(classGroup?.color || "#58a6ff")}">${utils.escapeHtml(classGroup?.name || "Unassigned class")}</span>
            <span class="badge ${todayRecord?.status === "checked-out" ? "badge-soft" : todayRecord?.status === "checked-in" ? "badge-success" : "badge-warning"}">${utils.escapeHtml(utils.buildAttendanceStatusLabel(todayRecord?.status || "not-checked-in"))}</span>
          </div>
        </div>
        ${(child.allergies || child.medicalNotes) ? `
          <div class="alert-banner">
            <strong>Medical alert</strong>
            <div>${utils.escapeHtml(child.allergies || child.medicalNotes)}</div>
          </div>
        ` : ""}
        <div class="detail-grid">
          <span class="detail-item">Pickup code: ${utils.escapeHtml(child.pickupCode)}</span>
          <span class="detail-item">Visitor: ${utils.escapeHtml(child.visitorStatus)}</span>
          <span class="detail-item">Family: ${utils.escapeHtml(child.familyChurchStatus)}</span>
          <span class="detail-item">Streak: ${utils.escapeHtml(String(streak))} week${streak === 1 ? "" : "s"}</span>
        </div>
        ${followUp ? `<div class="note-panel note-panel-accent"><strong>${utils.escapeHtml(followUp.reasonTitle)}</strong><div>${utils.escapeHtml(followUp.reasonCopy)}</div></div>` : ""}
        ${child.notes ? `<div class="note-panel"><div>${utils.escapeHtml(child.notes)}</div></div>` : ""}
        <div class="mini-history">
          ${history.length ? history.map((record) => `<span>${utils.escapeHtml(record.serviceDate)}  |  ${utils.escapeHtml(utils.buildAttendanceStatusLabel(record.status))}</span>`).join("") : "<span>No attendance history yet</span>"}
        </div>
        <div class="action-row">
          <button class="btn btn-secondary btn-inline" type="button" data-child-action="edit" data-child-id="${utils.escapeHtml(child.id)}">Edit</button>
          <button class="btn btn-primary btn-inline" type="button" data-child-action="toggle-attendance" data-child-id="${utils.escapeHtml(child.id)}">${todayRecord?.status === "checked-in" ? "Check out" : "Check in"}</button>
        </div>
      </article>
    `;
  }

  function render() {
    refreshClassOptions();
    const children = getFilteredChildren();
    renderSummary(app.store.peek().children);
    refs.empty.hidden = children.length > 0;
    refs.list.innerHTML = children.map(buildCard).join("");
  }

  function onListClick(event) {
    const button = event.target.closest("[data-child-action]");
    if (!button) {
      return;
    }

    const childId = button.dataset.childId;
    if (button.dataset.childAction === "edit") {
      openEdit(childId);
      return;
    }

    if (button.dataset.childAction === "toggle-attendance") {
      app.modules.checkin.quickToggle(childId);
    }
  }

  return {
    init,
    openCreate,
    openEdit,
    render,
  };
};



