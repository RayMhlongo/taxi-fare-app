window.AgapeKidsApp = window.AgapeKidsApp || {};

document.addEventListener("DOMContentLoaded", () => {
  const { utils, storage } = window.AgapeKidsApp;

  const store = storage.createStore();
  const uiState = {
    activeScreen: "dashboard",
    activeModalId: "",
  };

  let toastTimer = null;
  let confirmResolver = null;

  const dom = {
    appNav: document.getElementById("appNav"),
    screens: Array.from(document.querySelectorAll("[data-screen]")),
    modalShell: document.getElementById("modalShell"),
    confirmModal: document.getElementById("confirmModal"),
    confirmTitle: document.getElementById("confirmModalTitle"),
    confirmMessage: document.getElementById("confirmModalMessage"),
    confirmAccept: document.getElementById("confirmAcceptBtn"),
    confirmCancel: document.getElementById("confirmCancelBtn"),
    toast: document.getElementById("toast"),
    loader: document.getElementById("appLoader"),
  };

  const app = {
    api: null,
    dom,
    modules: {},
    store,
    utils,
    ui: {
      closeModal,
      confirm,
      openModal,
      toast,
    },
  };

  function language() {
    return store.peek().settings.language || "en";
  }

  function todayKey() {
    return utils.toLocalDateInputValue(new Date());
  }

  function findClass(classId) {
    return store.peek().classes.find((item) => item.id === classId) || null;
  }

  function findChild(childId) {
    return store.peek().children.find((item) => item.id === childId) || null;
  }

  function getTodayAttendance() {
    return store.peek().attendance.filter((record) => record.serviceDate === todayKey());
  }

  function getTodayAttendanceForChild(childId) {
    return getTodayAttendance().find((record) => record.childId === childId) || null;
  }

  function getAttendanceHistory(childId) {
    return utils.sortByDateDesc(store.peek().attendance.filter((record) => record.childId === childId), "updatedAt");
  }

  function getChildrenByClass(classId) {
    return store.peek().children.filter((child) => child.classId === classId && child.status === "active");
  }

  function getClassSummary(from = todayKey(), to = todayKey()) {
    const attendance = store.peek().attendance.filter((record) => utils.isWithinRange(record.serviceDate, from, to) && record.status !== "absent");
    const total = attendance.length || 1;
    return utils.sortByName(store.peek().classes, (item) => item.name).map((classGroup) => {
      const count = attendance.filter((record) => record.classId === classGroup.id).length;
      return {
        ...classGroup,
        count,
        percent: Math.max(6, Math.round((count / total) * 100)),
      };
    }).filter((entry) => entry.count > 0 || from === todayKey());
  }

  function getActivePolls() {
    return store.peek().polls.filter((poll) => poll.status === "active");
  }

  function getVisiblePolls() {
    const role = store.peek().settings.role;
    return store.peek().polls.filter((poll) => {
      if (role === "admin" || role === "leader") {
        return true;
      }
      if (poll.visibility === "all") {
        return true;
      }
      return poll.visibility === "volunteers" && role === "volunteer";
    });
  }

  function getFollowUpChildren() {
    const followUpWindow = store.peek().settings.followUpWindowDays || 14;
    return store.peek().children
      .filter((child) => child.status === "active")
      .map((child) => {
        const history = getAttendanceHistory(child.id);
        const latestAttendance = history.find((record) => record.status === "checked-in" || record.status === "checked-out");
        const missedToday = !getTodayAttendanceForChild(child.id);
        const daysSinceLast = latestAttendance ? Math.abs(utils.daysBetween(latestAttendance.serviceDate, todayKey())) : 999;
        const dueToAbsence = missedToday && latestAttendance && daysSinceLast >= 7;
        const dueToFamily = child.familyChurchStatus === "unchurched" && child.visitorStatus !== "member";
        const dueToFlag = child.needsFollowUp;

        if (!dueToAbsence && !dueToFamily && !dueToFlag) {
          return null;
        }

        return {
          child,
          reasonTitle: dueToFamily ? "Family follow-up" : dueToFlag ? "Requested follow-up" : "Absent child",
          reasonCopy: dueToFamily
            ? "Visitor family is marked as unchurched and should receive a warm follow-up."
            : dueToFlag
              ? "This child profile is marked for follow-up this week."
              : `Last attendance was ${latestAttendance ? latestAttendance.serviceDate : "not yet recorded"}.`,
        };
      })
      .filter(Boolean);
  }

  function getAbsentChildren() {
    const followUps = getFollowUpChildren();
    return followUps.filter((entry) => !getTodayAttendanceForChild(entry.child.id));
  }

  function getUpcomingEvents(limit = 4) {
    return [...store.peek().events]
      .filter((eventItem) => new Date(eventItem.dateTime).getTime() >= Date.now() - 86400000)
      .sort((left, right) => new Date(left.dateTime) - new Date(right.dateTime))
      .slice(0, limit)
      .map((eventItem) => ({
        ...eventItem,
        audienceLabel: eventItem.audience === "all" ? "All families" : eventItem.audience,
      }));
  }

  function getUpcomingBirthdays() {
    const today = new Date();
    return store.peek().children
      .filter((child) => child.birthDate)
      .map((child) => {
        const birthDate = new Date(child.birthDate);
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (nextBirthday < today) {
          nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
        }
        return {
          child,
          nextBirthday,
          ageLabel: `${nextBirthday.getFullYear() - birthDate.getFullYear()} yrs`,
          dateLabel: utils.formatDate(nextBirthday, language()),
        };
      })
      .filter((entry) => utils.daysBetween(today, entry.nextBirthday) <= 30)
      .sort((left, right) => left.nextBirthday - right.nextBirthday);
  }

  function getTopAttendanceStreaks() {
    return store.peek().children
      .map((child) => ({
        child,
        streak: utils.attendanceStreak(getAttendanceHistory(child.id)),
      }))
      .filter((entry) => entry.streak > 0)
      .sort((left, right) => right.streak - left.streak)
      .slice(0, 5);
  }

  function getDashboardSnapshot() {
    const classSummary = getClassSummary(todayKey(), todayKey());
    const checkedIn = getTodayAttendance().filter((record) => record.status === "checked-in");
    const checkedOut = getTodayAttendance().filter((record) => record.status === "checked-out");
    const firstVisitors = getTodayAttendance().filter((record) => record.firstVisit);
    const followUps = getFollowUpChildren();
    const volunteerSummary = utils.sortByName(store.peek().volunteers, (item) => item.name).slice(0, 6);
    const alerts = [];

    checkedIn.forEach((record) => {
      const child = findChild(record.childId);
      if (child && (child.allergies || child.medicalNotes)) {
        alerts.push({
          title: `${utils.buildChildDisplayName(child)} has a medical note`,
          copy: child.allergies || child.medicalNotes,
        });
      }
    });

    if (store.peek().syncQueue.length) {
      alerts.push({
        title: "Offline changes waiting to sync",
        copy: `${store.peek().syncQueue.length} update${store.peek().syncQueue.length === 1 ? "" : "s"} will sync when the connection is ready.`,
      });
    }

    getUpcomingBirthdays().slice(0, 2).forEach((entry) => {
      alerts.push({
        title: `Birthday reminder for ${utils.buildChildDisplayName(entry.child)}`,
        copy: entry.dateLabel,
      });
    });

    return {
      checkedIn,
      checkedOut,
      firstVisitors,
      followUps,
      classSummary,
      volunteerSummary,
      upcomingEvents: getUpcomingEvents(),
      activePolls: getActivePolls(),
      alerts: alerts.slice(0, 4),
    };
  }

  function populateClassSelect(select, options = {}) {
    if (!select) {
      return;
    }

    const previous = select.value;
    const classes = utils.sortByName(store.peek().classes, (item) => item.name);
    const choices = [];
    if (options.allowAll) {
      choices.push({ value: "all", label: options.allLabel || "All classes" });
    }
    if (options.allowBlank) {
      choices.push({ value: "", label: options.blankLabel || "No class" });
    }
    classes.forEach((classGroup) => {
      choices.push({ value: classGroup.id, label: classGroup.name });
    });

    select.innerHTML = choices.map((choice) => `<option value="${utils.escapeHtml(choice.value)}">${utils.escapeHtml(choice.label)}</option>`).join("");
    const values = new Set(choices.map((choice) => choice.value));
    if (values.has(previous)) {
      select.value = previous;
    } else if (options.allowAll) {
      select.value = "all";
    } else if (!options.allowBlank && classes[0]) {
      select.value = classes[0].id;
    }
  }

  function can(permission) {
    const role = store.peek().settings.role || "admin";
    return utils.ROLE_PERMISSIONS[role]?.[permission] ?? true;
  }

  function queueSync(entityType, action, payload) {
    const entry = {
      id: utils.makeId("queue"),
      entityType,
      action,
      payload,
      createdAt: utils.nowISOString(),
      attempts: 0,
    };

    store.update((draft) => {
      draft.syncQueue.push(entry);
      draft.settings.lastSyncStatus = `Queued ${draft.syncQueue.length} change${draft.syncQueue.length === 1 ? "" : "s"}.`;
      return draft;
    });

    if (navigator.onLine && store.peek().settings.autoSync && app.api.isConfigured()) {
      app.api.flushQueue().catch(() => {
        // Preserve queue and surface the status elsewhere.
      });
    }
  }

  function toast(message, type = "success") {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.className = `toast ${type} show`;
    toastTimer = window.setTimeout(() => {
      dom.toast.className = "toast";
    }, 3200);
  }

  function openModal(modalId) {
    uiState.activeModalId = modalId;
    dom.modalShell.classList.add("show");
    dom.modalShell.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    dom.modalShell.querySelectorAll(".modal").forEach((modal) => {
      modal.hidden = modal.id !== modalId;
    });
  }

  function closeModal() {
    dom.modalShell.classList.remove("show");
    dom.modalShell.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    dom.modalShell.querySelectorAll(".modal").forEach((modal) => {
      modal.hidden = true;
    });
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    uiState.activeModalId = "";
  }

  function confirm({ title, message, confirmLabel = "Continue" }) {
    return new Promise((resolve) => {
      confirmResolver = resolve;
      dom.confirmTitle.textContent = title;
      dom.confirmMessage.textContent = message;
      dom.confirmAccept.textContent = confirmLabel;
      openModal("confirmModal");
    });
  }

  function closeConfirmWith(value) {
    const resolver = confirmResolver;
    confirmResolver = null;
    closeModal();
    if (resolver) {
      resolver(value);
    }
  }

  function openScreen(screenName) {
    if ((screenName === "reports" && !can("reports"))
      || (screenName === "settings" && !can("settings"))
      || (screenName === "ministry" && !can("ministry"))
      || (screenName === "polls" && !can("votePolls"))) {
      toast("This role cannot open that section.", "warning");
      return;
    }

    uiState.activeScreen = screenName;
    dom.screens.forEach((screen) => {
      screen.classList.toggle("active", screen.dataset.screen === screenName);
    });
    dom.appNav.querySelectorAll(".nav-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.screenTarget === screenName);
    });
  }

  function syncPermissions() {
    dom.appNav.querySelectorAll(".nav-btn").forEach((button) => {
      const target = button.dataset.screenTarget;
      const allowed = (target !== "reports" || can("reports"))
        && (target !== "settings" || can("settings"))
        && (target !== "ministry" || can("ministry"))
        && (target !== "polls" || can("votePolls"));
      button.hidden = !allowed;
    });

    if ((uiState.activeScreen === "reports" && !can("reports"))
      || (uiState.activeScreen === "settings" && !can("settings"))
      || (uiState.activeScreen === "ministry" && !can("ministry"))
      || (uiState.activeScreen === "polls" && !can("votePolls"))) {
      openScreen("dashboard");
    }
  }

  function renderAll() {
    syncPermissions();
    app.modules.settings.render();
    app.modules.dashboard.render();
    app.modules.children.render();
    app.modules.checkin.render();
    app.modules.ministry.render();
    app.modules.polls.render();
    app.modules.reports.render();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore local preview registration issues.
    });
  }

  function bindGlobalEvents() {
    dom.appNav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-screen-target]");
      if (button) {
        openScreen(button.dataset.screenTarget);
      }
    });

    dom.modalShell.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal]")) {
        closeModal();
      }
    });

    dom.confirmCancel.addEventListener("click", () => closeConfirmWith(false));
    dom.confirmAccept.addEventListener("click", () => closeConfirmWith(true));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && uiState.activeModalId) {
        closeModal();
      }
    });
  }

  function applyQueryState() {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get("screen");
    const pollSlug = params.get("poll");

    if (screen && dom.screens.some((item) => item.dataset.screen === screen)) {
      openScreen(screen);
    }

    if (pollSlug) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`poll-card-${pollSlug}`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
  }

  function hideLoader() {
    window.setTimeout(() => {
      dom.loader.classList.add("is-hidden");
    }, 120);
  }

  app.language = language;
  app.todayKey = todayKey;
  app.findClass = findClass;
  app.findChild = findChild;
  app.getTodayAttendance = getTodayAttendance;
  app.getTodayAttendanceForChild = getTodayAttendanceForChild;
  app.getAttendanceHistory = getAttendanceHistory;
  app.getChildrenByClass = getChildrenByClass;
  app.getClassSummary = getClassSummary;
  app.getActivePolls = getActivePolls;
  app.getVisiblePolls = getVisiblePolls;
  app.getFollowUpChildren = getFollowUpChildren;
  app.getAbsentChildren = getAbsentChildren;
  app.getUpcomingEvents = getUpcomingEvents;
  app.getUpcomingBirthdays = getUpcomingBirthdays;
  app.getTopAttendanceStreaks = getTopAttendanceStreaks;
  app.getDashboardSnapshot = getDashboardSnapshot;
  app.populateClassSelect = populateClassSelect;
  app.can = can;
  app.queueSync = queueSync;
  app.openScreen = openScreen;
  app.syncPermissions = syncPermissions;

  app.api = window.AgapeKidsApp.createApiService(app);
  app.modules.dashboard = window.AgapeKidsApp.createDashboardModule(app);
  app.modules.children = window.AgapeKidsApp.createChildrenModule(app);
  app.modules.checkin = window.AgapeKidsApp.createCheckinModule(app);
  app.modules.ministry = window.AgapeKidsApp.createMinistryModule(app);
  app.modules.polls = window.AgapeKidsApp.createPollsModule(app);
  app.modules.reports = window.AgapeKidsApp.createReportsModule(app);
  app.modules.settings = window.AgapeKidsApp.createSettingsModule(app);

  bindGlobalEvents();
  app.modules.dashboard.init();
  app.modules.children.init();
  app.modules.checkin.init();
  app.modules.ministry.init();
  app.modules.polls.init();
  app.modules.reports.init();
  app.modules.settings.init();

  store.subscribe(renderAll);
  renderAll();
  applyQueryState();
  registerServiceWorker();
  hideLoader();
});
