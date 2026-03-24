window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.createSettingsModule = (app) => {
  const { utils } = app;
  const systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const refs = {
    form: document.getElementById("settingsForm"),
    churchName: document.getElementById("settingsChurchName"),
    campus: document.getElementById("settingsCampus"),
    logoUrl: document.getElementById("settingsLogoUrl"),
    currentUser: document.getElementById("settingsCurrentUser"),
    theme: document.getElementById("settingsTheme"),
    language: document.getElementById("settingsLanguage"),
    role: document.getElementById("settingsRole"),
    followUpWindow: document.getElementById("settingsFollowUpWindow"),
    appScriptUrl: document.getElementById("settingsAppScriptUrl"),
    autoSync: document.getElementById("settingsAutoSync"),
    pickupRequired: document.getElementById("settingsPickupRequired"),
    allowOverride: document.getElementById("settingsAllowOverride"),
    welcomeMessage: document.getElementById("settingsWelcomeMessage"),
    checkoutMessage: document.getElementById("settingsCheckoutMessage"),
    exportBackup: document.getElementById("exportBackupBtn"),
    restoreBackup: document.getElementById("restoreBackupBtn"),
    restoreInput: document.getElementById("restoreBackupInput"),
    clearData: document.getElementById("clearDataBtn"),
    testConnection: document.getElementById("testConnectionBtn"),
    syncNow: document.getElementById("syncNowBtn"),
    storageSummary: document.getElementById("storageSummary"),
    syncSummary: document.getElementById("syncSummary"),
    rolePermissionNote: document.getElementById("rolePermissionNote"),
    roleBadge: document.getElementById("roleBadge"),
    connectionBadge: document.getElementById("connectionBadge"),
    themeToggle: document.getElementById("themeToggleBtn"),
    installButton: document.getElementById("installAppBtn"),
    brandKicker: document.getElementById("brandKicker"),
    brandSubtitle: document.getElementById("brandSubtitle"),
    brandLogo: document.getElementById("brandLogo"),
    loaderLogo: document.getElementById("loaderLogo"),
  };

  let installPrompt = null;

  function init() {
    refs.form.addEventListener("submit", onSubmit);
    refs.exportBackup.addEventListener("click", exportBackup);
    refs.restoreBackup.addEventListener("click", openRestorePicker);
    refs.restoreInput.addEventListener("change", onRestoreSelected);
    refs.clearData.addEventListener("click", clearData);
    refs.testConnection.addEventListener("click", testConnection);
    refs.syncNow.addEventListener("click", syncNow);
    refs.themeToggle.addEventListener("click", toggleThemeQuick);
    refs.installButton.addEventListener("click", installApp);

    if (systemThemeQuery?.addEventListener) {
      systemThemeQuery.addEventListener("change", () => {
        if (app.store.peek().settings.theme === "system") {
          applyTheme("system");
        }
      });
    }

    window.addEventListener("online", renderChrome);
    window.addEventListener("offline", renderChrome);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      refs.installButton.hidden = false;
    });
  }

  function resolvedTheme(theme) {
    if (theme === "dark") {
      return "dark";
    }
    if (theme === "light") {
      return "light";
    }
    return systemThemeQuery?.matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const nextTheme = resolvedTheme(theme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", nextTheme === "dark" ? "#152445" : "#234fb8");
    }
    refs.themeToggle.textContent = nextTheme === "dark" ? "Light" : "Dark";
  }

  function connectionText() {
    if (!navigator.onLine) {
      return "Offline ready";
    }

    const state = app.store.peek();
    if (state.syncQueue.length) {
      return `${state.syncQueue.length} waiting to sync`;
    }

    if (state.settings.appScriptUrl && state.settings.lastSyncAt) {
      return `Synced ${utils.formatTime(state.settings.lastSyncAt, state.settings.language)}`;
    }

    if (state.settings.appScriptUrl) {
      return "Online";
    }

    return "Online local mode";
  }

  function renderStorageSummary() {
    const summary = app.store.getStorageSummary();
    refs.storageSummary.innerHTML = `
      <div>Schema version: <strong>${utils.escapeHtml(String(summary.schemaVersion))}</strong></div>
      <div>Children: <strong>${utils.escapeHtml(String(summary.children))}</strong></div>
      <div>Attendance records: <strong>${utils.escapeHtml(String(summary.attendance))}</strong></div>
      <div>Class groups: <strong>${utils.escapeHtml(String(summary.classes))}</strong></div>
      <div>Polls: <strong>${utils.escapeHtml(String(summary.polls))}</strong></div>
      <div>Queued sync changes: <strong>${utils.escapeHtml(String(summary.queue))}</strong></div>
      <div>Estimated local size: <strong>${utils.escapeHtml(utils.formatBytes(summary.estimatedBytes))}</strong></div>
    `;
  }

  function renderSyncSummary() {
    const settings = app.store.peek().settings;
    refs.syncSummary.innerHTML = `
      <div><strong>Status:</strong> ${utils.escapeHtml(settings.lastSyncStatus || "Offline ready")}</div>
      <div><strong>Last sync:</strong> ${utils.escapeHtml(settings.lastSyncAt ? utils.formatDateTime(settings.lastSyncAt, settings.language) : "Not synced yet")}</div>
      <div><strong>Error:</strong> ${utils.escapeHtml(settings.lastSyncError || "None")}</div>
    `;
  }

  function renderRoleNote() {
    const role = app.store.peek().settings.role;
    const permissions = utils.ROLE_PERMISSIONS[role] || utils.ROLE_PERMISSIONS.admin;
    refs.rolePermissionNote.innerHTML = [
      `${utils.ROLE_LABELS[role]} mode is active.`,
      permissions.reports ? "Reports remain visible." : "Reports are hidden for this role.",
      permissions.ministry ? "Class and volunteer setup is available." : "Ministry setup is hidden for this role.",
      permissions.managePolls ? "Poll creation is available." : "Only voting is available.",
      permissions.destructiveData ? "Clear-data tools are enabled." : "Destructive tools stay protected.",
    ].map((line) => `<div>${utils.escapeHtml(line)}</div>`).join("");
  }

  function renderChrome() {
    const settings = app.store.peek().settings;
    applyTheme(settings.theme);
    utils.applyCopy(settings.language);
    document.title = `${utils.APP_NAME} | ${settings.churchName || utils.CHURCH_NAME}`;
    refs.roleBadge.textContent = utils.ROLE_LABELS[settings.role] || "Admin";
    refs.connectionBadge.textContent = connectionText();
    refs.brandKicker.textContent = `${settings.churchName || utils.CHURCH_NAME}  |  ${settings.campus || utils.CHURCH_LOCATION}`;
    refs.brandSubtitle.textContent = "Warm, safe children's church care for every Sunday service.";
    refs.brandLogo.src = settings.logoUrl || "icons/agape-logo.svg";
    refs.loaderLogo.src = settings.logoUrl || "icons/agape-logo.svg";
    renderStorageSummary();
    renderSyncSummary();
    renderRoleNote();
  }

  function render() {
    const settings = app.store.peek().settings;
    refs.churchName.value = settings.churchName || "";
    refs.campus.value = settings.campus || "";
    refs.logoUrl.value = settings.logoUrl || "";
    refs.currentUser.value = settings.currentUser || "";
    refs.theme.value = settings.theme || "system";
    refs.language.value = settings.language || "en";
    refs.role.value = settings.role || "admin";
    refs.followUpWindow.value = settings.followUpWindowDays || 14;
    refs.appScriptUrl.value = settings.appScriptUrl || "";
    refs.autoSync.checked = Boolean(settings.autoSync);
    refs.pickupRequired.checked = Boolean(settings.pickupCodeRequired);
    refs.allowOverride.checked = Boolean(settings.allowAdminOverride);
    refs.welcomeMessage.value = settings.welcomeMessage || "";
    refs.checkoutMessage.value = settings.checkoutMessage || "";
    renderChrome();
  }

  function onSubmit(event) {
    event.preventDefault();

    try {
      if (!refs.form.reportValidity()) {
        throw new Error("Please review the settings form.");
      }

      app.store.update((draft) => {
        draft.settings = {
          ...draft.settings,
          churchName: utils.stringFrom(refs.churchName.value, utils.CHURCH_NAME),
          campus: utils.stringFrom(refs.campus.value, utils.CHURCH_LOCATION),
          logoUrl: utils.stringFrom(refs.logoUrl.value, "icons/agape-logo.svg") || "icons/agape-logo.svg",
          currentUser: utils.stringFrom(refs.currentUser.value, "Agape Team"),
          theme: refs.theme.value,
          language: refs.language.value,
          role: refs.role.value,
          followUpWindowDays: Math.max(1, utils.integerFrom(refs.followUpWindow.value, 14)),
          appScriptUrl: utils.stringFrom(refs.appScriptUrl.value),
          autoSync: refs.autoSync.checked,
          pickupCodeRequired: refs.pickupRequired.checked,
          allowAdminOverride: refs.allowOverride.checked,
          welcomeMessage: utils.stringFrom(refs.welcomeMessage.value),
          checkoutMessage: utils.stringFrom(refs.checkoutMessage.value),
        };
        return draft;
      });

      app.syncPermissions();
      app.ui.toast("Settings saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Settings could not be saved.", "warning");
    }
  }

  async function exportBackup() {
    try {
      const payload = await app.store.exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const result = await utils.exportFile({
        blob,
        fileName: `${utils.APP_SLUG}-backup-${utils.toLocalDateInputValue(new Date())}.json`,
        mode: "download",
        title: `${utils.APP_NAME} backup`,
        text: `${utils.APP_NAME} backup export`,
      });
      if (result.method !== "cancelled") {
        app.ui.toast("Backup exported.", "success");
      }
    } catch (error) {
      app.ui.toast(error.message || "Backup export failed.", "warning");
    }
  }

  function openRestorePicker() {
    utils.openFilePicker(refs.restoreInput);
  }

  async function onRestoreSelected(event) {
    const file = event.target.files?.[0];
    refs.restoreInput.value = "";
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const shouldContinue = await app.ui.confirm({
        title: "Restore backup",
        message: "This replaces the current local Agape Kids data on this device. Continue?",
        confirmLabel: "Restore",
      });
      if (!shouldContinue) {
        return;
      }

      await app.store.restoreBackup(parsed);
      app.ui.toast("Backup restored.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Backup restore failed.", "warning");
    }
  }

  async function clearData() {
    if (!app.can("destructiveData")) {
      app.ui.toast("Switch to Admin mode to clear all data.", "warning");
      return;
    }

    const shouldClear = await app.ui.confirm({
      title: "Clear local data",
      message: "This removes children, attendance, polls, and settings stored on this device.",
      confirmLabel: "Clear data",
    });
    if (!shouldClear) {
      return;
    }

    await app.store.resetAll();
    app.ui.toast("All local data cleared.", "success");
  }

  async function testConnection() {
    try {
      const result = await app.api.testConnection();
      app.store.update((draft) => {
        draft.settings.lastSyncStatus = result.message || "Connection successful.";
        draft.settings.lastSyncError = "";
        return draft;
      });
      app.ui.toast("Apps Script connection looks good.", "success");
    } catch (error) {
      app.store.update((draft) => {
        draft.settings.lastSyncError = error.message || "Connection failed.";
        draft.settings.lastSyncStatus = "Connection test failed.";
        return draft;
      });
      app.ui.toast(error.message || "Connection test failed.", "warning");
    }
  }

  async function syncNow() {
    if (!app.api.isConfigured()) {
      app.ui.toast("Add an Apps Script URL first.", "warning");
      return;
    }

    try {
      const result = await app.api.flushQueue();
      app.ui.toast(`Sync finished. ${result.synced} change${result.synced === 1 ? "" : "s"} synced.`, "success");
    } catch (error) {
      app.store.update((draft) => {
        draft.settings.lastSyncError = error.message || "Sync failed.";
        draft.settings.lastSyncStatus = "Sync failed.";
        return draft;
      });
      app.ui.toast(error.message || "Sync failed.", "warning");
    }
  }

  function toggleThemeQuick() {
    const current = resolvedTheme(app.store.peek().settings.theme);
    const nextTheme = current === "dark" ? "light" : "dark";
    app.store.update((draft) => {
      draft.settings.theme = nextTheme;
      return draft;
    });
    app.ui.toast(`Theme set to ${nextTheme}.`, "success");
  }

  async function installApp() {
    if (!installPrompt) {
      app.ui.toast("Install prompt is not available on this device yet.", "info");
      return;
    }

    await installPrompt.prompt();
    installPrompt = null;
    refs.installButton.hidden = true;
  }

  return {
    applyTheme,
    init,
    render,
    renderChrome,
    toggleThemeQuick,
  };
};



