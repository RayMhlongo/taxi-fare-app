window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createSettingsModule = (app) => {
  const { utils } = app;
  const systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const refs = {
    form: document.getElementById("settingsForm"),
    driverName: document.getElementById("settingsDriverName"),
    businessName: document.getElementById("settingsBusinessName"),
    driverPhone: document.getElementById("settingsDriverPhone"),
    driverEmail: document.getElementById("settingsDriverEmail"),
    vehiclePlate: document.getElementById("settingsVehiclePlate"),
    vatNumber: document.getElementById("settingsVatNumber"),
    businessAddress: document.getElementById("settingsBusinessAddress"),
    theme: document.getElementById("settingsTheme"),
    currency: document.getElementById("settingsCurrency"),
    role: document.getElementById("settingsRole"),
    invoiceTheme: document.getElementById("settingsInvoiceTheme"),
    invoicePrefix: document.getElementById("settingsInvoicePrefix"),
    paymentTerms: document.getElementById("settingsPaymentTerms"),
    invoiceNotes: document.getElementById("settingsInvoiceNotes"),
    exportBackup: document.getElementById("exportBackupBtn"),
    restoreBackup: document.getElementById("restoreBackupBtn"),
    clearData: document.getElementById("clearDataBtn"),
    safetyBackupToggle: document.getElementById("safetyBackupToggle"),
    storageSummary: document.getElementById("storageSummary"),
    permissionNote: document.getElementById("rolePermissionNote"),
    roleBadge: document.getElementById("roleBadge"),
    connectionBadge: document.getElementById("connectionBadge"),
    themeToggle: document.getElementById("themeToggleBtn"),
    restoreInput: document.getElementById("restoreBackupInput"),
  };

  function init() {
    refs.form.addEventListener("submit", onSubmit);
    refs.exportBackup.addEventListener("click", exportBackup);
    refs.restoreBackup.addEventListener("click", () => refs.restoreInput.click());
    refs.restoreInput.addEventListener("change", onRestoreSelected);
    refs.clearData.addEventListener("click", onClearData);
    refs.themeToggle.addEventListener("click", toggleThemeQuick);

    if (systemThemeQuery?.addEventListener) {
      systemThemeQuery.addEventListener("change", () => {
        if (app.store.peek().settings.theme === "system") {
          applyTheme("system");
        }
      });
    }

    window.addEventListener("online", renderConnectionBadge);
    window.addEventListener("offline", renderConnectionBadge);
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
      themeMeta.setAttribute("content", nextTheme === "dark" ? "#101723" : "#0b8f81");
    }
    refs.themeToggle.textContent = nextTheme === "dark" ? "Light" : "Dark";
  }

  function toggleThemeQuick() {
    const currentSetting = app.store.peek().settings.theme;
    const currentResolved = resolvedTheme(currentSetting);
    const nextTheme = currentResolved === "dark" ? "light" : "dark";

    app.store.update((draft) => {
      draft.settings.theme = nextTheme;
      return draft;
    });

    app.ui.toast(`Theme set to ${nextTheme}.`, "success");
  }

  function renderConnectionBadge() {
    refs.connectionBadge.textContent = navigator.onLine ? "Online" : "Offline ready";
  }

  function renderStorageSummary() {
    const summary = app.store.getStorageSummary();
    refs.storageSummary.innerHTML = `
      <div>Schema version: <strong>${utils.escapeHtml(String(summary.schemaVersion))}</strong></div>
      <div>Trips: <strong>${utils.escapeHtml(String(summary.trips))}</strong></div>
      <div>Expenses: <strong>${utils.escapeHtml(String(summary.expenses))}</strong></div>
      <div>Customers: <strong>${utils.escapeHtml(String(summary.customers))}</strong></div>
      <div>Invoices: <strong>${utils.escapeHtml(String(summary.invoices))}</strong></div>
      <div>Estimated local data size: <strong>${utils.escapeHtml(utils.formatBytes(summary.estimatedBytes))}</strong></div>
    `;
  }

  function renderRoleNote(role) {
    const permissions = utils.ROLE_PERMISSIONS[role] || utils.ROLE_PERMISSIONS.owner;
    const lines = [
      `${utils.ROLE_LABELS[role]} mode is active.`,
      permissions.customers ? "Customer management is available." : "Customer management is hidden for this role.",
      permissions.invoices ? "Invoice tools are available." : "Invoice tools are hidden for this role.",
      permissions.destructiveData ? "Restore and clear-data actions are enabled." : "Restore and clear-data actions are protected.",
    ];

    refs.permissionNote.innerHTML = lines.map((line) => `<div>${utils.escapeHtml(line)}</div>`).join("");
    refs.roleBadge.textContent = utils.ROLE_LABELS[role] || "Owner";
  }

  function render() {
    const settings = app.store.peek().settings;
    refs.driverName.value = settings.driverName || "";
    refs.businessName.value = settings.businessName || "";
    refs.driverPhone.value = settings.driverPhone || "";
    refs.driverEmail.value = settings.driverEmail || "";
    refs.vehiclePlate.value = settings.vehiclePlate || "";
    refs.vatNumber.value = settings.vatNumber || "";
    refs.businessAddress.value = settings.businessAddress || "";
    refs.theme.value = settings.theme || "system";
    refs.currency.value = settings.currency || "ZAR";
    refs.role.value = settings.role || "owner";
    refs.invoiceTheme.value = settings.invoiceTheme || "modern";
    refs.invoicePrefix.value = settings.invoicePrefix || "TF";
    refs.paymentTerms.value = settings.paymentTerms || "";
    refs.invoiceNotes.value = settings.invoiceNotes || "";

    applyTheme(settings.theme);
    renderConnectionBadge();
    renderRoleNote(settings.role);
    renderStorageSummary();
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
          driverName: utils.stringFrom(refs.driverName.value),
          businessName: utils.stringFrom(refs.businessName.value),
          driverPhone: utils.stringFrom(refs.driverPhone.value),
          driverEmail: utils.stringFrom(refs.driverEmail.value),
          vehiclePlate: utils.stringFrom(refs.vehiclePlate.value),
          vatNumber: utils.stringFrom(refs.vatNumber.value),
          businessAddress: utils.stringFrom(refs.businessAddress.value),
          theme: refs.theme.value,
          currency: refs.currency.value,
          role: refs.role.value,
          invoiceTheme: refs.invoiceTheme.value,
          invoicePrefix: utils.stringFrom(refs.invoicePrefix.value, "TF").slice(0, 10) || "TF",
          paymentTerms: utils.stringFrom(refs.paymentTerms.value),
          invoiceNotes: utils.stringFrom(refs.invoiceNotes.value),
        };
        return draft;
      });

      app.ui.toast("Settings saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Settings could not be saved.", "warning");
    }
  }

  async function exportBackup() {
    try {
      const payload = await app.store.exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      utils.downloadBlob(blob, `taxi-fare-backup-${utils.toLocalDateInputValue(new Date())}.json`);
      app.ui.toast("Backup exported.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Backup export failed.", "warning");
    }
  }

  async function onRestoreSelected(event) {
    const file = event.target.files?.[0];
    refs.restoreInput.value = "";

    if (!file) {
      return;
    }

    try {
      const content = await utils.readFileAsText(file);
      const parsed = JSON.parse(content);
      const shouldContinue = await app.ui.confirm({
        title: "Restore backup",
        message: "This will replace the current local database. Continue with restore?",
        confirmLabel: "Restore data",
      });

      if (!shouldContinue) {
        return;
      }

      const result = await app.store.restoreBackup(parsed, {
        createSafetyBackup: refs.safetyBackupToggle.checked,
      });

      if (result.safetyBackup) {
        const blob = new Blob([JSON.stringify(result.safetyBackup, null, 2)], { type: "application/json" });
        utils.downloadBlob(blob, `taxi-fare-safety-backup-${utils.toLocalDateInputValue(new Date())}.json`);
      }

      app.ui.toast("Backup restored successfully.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Restore failed. Check that the JSON file is valid.", "warning");
    }
  }

  async function onClearData() {
    const canDelete = utils.ROLE_PERMISSIONS[app.store.peek().settings.role]?.destructiveData;
    if (!canDelete) {
      app.ui.toast("This role cannot clear all data. Switch to Owner mode first.", "warning");
      return;
    }

    const shouldClear = await app.ui.confirm({
      title: "Clear all data",
      message: "This removes trips, expenses, customers, invoices, and stored receipts from this device.",
      confirmLabel: "Clear data",
    });

    if (!shouldClear) {
      return;
    }

    await app.store.resetAll();
    app.ui.toast("All local data cleared.", "success");
  }

  return {
    applyTheme,
    init,
    render,
    toggleThemeQuick,
  };
};
