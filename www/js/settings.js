window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createSettingsModule = (app) => {
  const { utils, config } = app;
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
    licenseId: document.getElementById("settingsLicenseId"),
    installId: document.getElementById("settingsInstallId"),
    copyInstallId: document.getElementById("copyInstallIdBtn"),
    verifyLicense: document.getElementById("verifyLicenseBtn"),
    licenseStatusPanel: document.getElementById("licenseStatusPanel"),
    licenseHelperText: document.getElementById("licenseHelperText"),
    aboutPanel: document.getElementById("aboutPanel"),
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
    refs.restoreBackup.addEventListener("click", openRestorePicker);
    refs.restoreInput.addEventListener("change", onRestoreSelected);
    refs.clearData.addEventListener("click", onClearData);
    refs.themeToggle.addEventListener("click", toggleThemeQuick);
    refs.copyInstallId.addEventListener("click", copyInstallId);
    refs.verifyLicense.addEventListener("click", onVerifyLicense);

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
      themeMeta.setAttribute("content", nextTheme === "dark" ? "#050e1d" : "#0a1628");
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

  function openRestorePicker() {
    if (!app.guard("backup.restore")) {
      return;
    }

    try {
      utils.openFilePicker(refs.restoreInput);
    } catch (error) {
      app.ui.toast("Backup import could not be opened on this device.", "warning");
    }
  }

  function describeExportResult(result, fallbackCopy) {
    if (result?.method === "native-save") {
      return "saved to your device";
    }

    if (result?.method === "native-share" || result?.method === "web-share") {
      return "opened in the share sheet";
    }

    if (result?.method === "native-share-fallback") {
      return fallbackCopy || "opened in the share sheet";
    }

    if (result?.method === "download") {
      return "downloaded";
    }

    if (result?.method === "cancelled") {
      return "cancelled";
    }

    return "exported";
  }

  function renderStorageSummary() {
    const summary = app.store.getStorageSummary();
    refs.storageSummary.innerHTML = `
      <div>Schema version: <strong>${utils.escapeHtml(String(summary.schemaVersion))}</strong></div>
      <div>Trips: <strong>${utils.escapeHtml(String(summary.trips))}</strong></div>
      <div>Expenses: <strong>${utils.escapeHtml(String(summary.expenses))}</strong></div>
      <div>Customers: <strong>${utils.escapeHtml(String(summary.customers))}</strong></div>
      <div>Invoices: <strong>${utils.escapeHtml(String(summary.invoices))}</strong></div>
      <div>Install ID: <strong>${utils.escapeHtml(String(summary.installId || "--"))}</strong></div>
      <div>License ID: <strong>${utils.escapeHtml(String(summary.licenseId || "Not set"))}</strong></div>
      <div>Estimated local data size: <strong>${utils.escapeHtml(utils.formatBytes(summary.estimatedBytes))}</strong></div>
    `;
  }

  function renderRoleNote(role) {
    const permissions = utils.ROLE_PERMISSIONS[role] || utils.ROLE_PERMISSIONS.owner;
    const protection = app.protectionState();
    const lines = [
      `${utils.ROLE_LABELS[role]} mode is active.`,
      permissions.customers ? "Customer management is available." : "Customer management is hidden for this role.",
      permissions.invoices ? "Invoice tools are available." : "Invoice tools are hidden for this role.",
      permissions.destructiveData ? "Restore and clear-data actions are enabled." : "Restore and clear-data actions are protected.",
      protection.readOnly ? "The app is currently in read-only mode." : "Write features are currently available.",
    ];

    refs.permissionNote.innerHTML = lines.map((line) => `<div>${utils.escapeHtml(line)}</div>`).join("");
    refs.roleBadge.textContent = utils.ROLE_LABELS[role] || "Owner";
  }

  function renderLicensePanel() {
    const protection = app.protectionState();
    const license = protection.license || {};
    const demo = protection.demo || {};
    const helperLines = [];

    if (protection.key.startsWith("demo")) {
      helperLines.push(`Demo expires on ${utils.formatDate(demo.expiresAt)}.`);
      helperLines.push(`Trips: ${demo.usage.trips}/${demo.limits.trips} | Expenses: ${demo.usage.expenses}/${demo.limits.expenses} | Customers: ${demo.usage.customers}/${demo.limits.customers}`);
    } else {
      helperLines.push(`Status: ${license.badgeLabel || protection.badgeLabel}`);
      helperLines.push(`License ID: ${license.licenseId || "Not set"}`);
      helperLines.push(`Install ID: ${protection.installId || "Preparing..."}`);
      if (license.paidUntil) {
        helperLines.push(`Paid until: ${utils.formatDate(license.paidUntil)}`);
      }
      if (license.graceUntil) {
        helperLines.push(`Grace until: ${utils.formatDate(license.graceUntil)}`);
      }
      if (license.lastVerifiedAt) {
        helperLines.push(`Last verified: ${utils.formatDateTime(license.lastVerifiedAt)}`);
      }
      if (license.verificationSource) {
        helperLines.push(`Verification source: ${license.verificationSource}`);
      }
    }

    refs.licenseStatusPanel.innerHTML = helperLines.map((line) => `<div>${utils.escapeHtml(line)}</div>`).join("");
    refs.licenseHelperText.textContent = protection.key.startsWith("demo")
      ? `Demo builds stay visibly branded and become read-only after ${config.DEMO_EXPIRES_DAYS} days.`
      : `${config.SUPPORT_CONTACT} Offline access stays valid only while the recent verification window is still within tolerance.`;
    refs.verifyLicense.disabled = protection.key === "demo-active" || protection.key === "demo-expired";
  }

  function renderAboutPanel() {
    const protection = app.protectionState();
    refs.aboutPanel.innerHTML = `
      <div><strong>${utils.escapeHtml(utils.APP_NAME)}</strong></div>
      <div>Powered by <strong>${utils.escapeHtml(utils.BRAND_NAME)}</strong></div>
      <div>${utils.escapeHtml(config.APP_BRAND_WATERMARK)}</div>
      <div>Support: ${utils.escapeHtml(config.SUPPORT_CONTACT)}</div>
      <div>Build mode: ${utils.escapeHtml(protection.buildLabel || "Licensed App")}</div>
      <div>Subscription enforcement: ${utils.escapeHtml(config.SUBSCRIPTION_ENABLED ? "Enabled" : "Disabled")}</div>
    `;
  }

  function render() {
    const settings = app.store.peek().settings;
    const protection = app.protectionState();

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
    refs.invoicePrefix.value = settings.invoicePrefix || "IR";
    refs.paymentTerms.value = settings.paymentTerms || "";
    refs.invoiceNotes.value = settings.invoiceNotes || "";
    refs.licenseId.value = app.store.peek().licenseMeta.licenseId || "";
    refs.installId.value = protection.installId || "";

    applyTheme(settings.theme);
    renderConnectionBadge();
    renderRoleNote(settings.role);
    renderStorageSummary();
    renderLicensePanel();
    renderAboutPanel();

    refs.exportBackup.disabled = !app.featureState("backup.export").allowed;
    refs.restoreBackup.disabled = !app.can("destructiveData") || !app.featureState("backup.restore").allowed;
    refs.clearData.disabled = !app.can("destructiveData") || !app.featureState("data.clear").allowed;
  }

  async function onSubmit(event) {
    event.preventDefault();

    try {
      if (!app.guard("settings.save")) {
        return;
      }

      if (!refs.form.reportValidity()) {
        throw new Error("Please review the settings form.");
      }

      const previousLicenseId = app.store.peek().licenseMeta.licenseId;

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
          invoicePrefix: utils.stringFrom(refs.invoicePrefix.value, "IR").slice(0, 10) || "IR",
          paymentTerms: utils.stringFrom(refs.paymentTerms.value),
          invoiceNotes: utils.stringFrom(refs.invoiceNotes.value),
        };
        draft.licenseMeta.licenseId = utils.stringFrom(refs.licenseId.value);
        return draft;
      });

      if (utils.stringFrom(refs.licenseId.value) !== previousLicenseId && !config.DEMO_MODE) {
        await app.modules.protection.refreshNow();
      }

      app.ui.toast("Settings saved.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Settings could not be saved.", "warning");
    }
  }

  async function exportBackup() {
    if (!app.guard("backup.export")) {
      return;
    }

    refs.exportBackup.disabled = true;

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

      if (result.method === "cancelled") {
        app.ui.toast("Backup export cancelled.", "warning");
        return;
      }

      app.ui.toast(`Backup ${describeExportResult(result, "opened in the share sheet so you can save it elsewhere")}.`, "success");
    } catch (error) {
      app.ui.toast(error.message || "Backup export failed.", "warning");
    } finally {
      refs.exportBackup.disabled = false;
    }
  }

  async function onRestoreSelected(event) {
    const file = event.target.files?.[0];
    refs.restoreInput.value = "";

    if (!file) {
      return;
    }

    if (!app.guard("backup.restore")) {
      return;
    }

    try {
      const content = await utils.readFileAsText(file);
      const parsed = JSON.parse(content);
      const shouldContinue = await app.ui.confirm({
        title: "Restore backup",
        message: "This will replace the current trips, expenses, customers, and invoices on this device. License and install metadata stay protected here.",
        confirmLabel: "Restore data",
      });

      if (!shouldContinue) {
        return;
      }

      const result = await app.store.restoreBackup(parsed, {
        createSafetyBackup: refs.safetyBackupToggle.checked,
      });

      let message = "Backup restored successfully.";
      if (result.safetyBackup) {
        const blob = new Blob([JSON.stringify(result.safetyBackup, null, 2)], { type: "application/json" });
        const exportResult = await utils.exportFile({
          blob,
          fileName: `${utils.APP_SLUG}-safety-backup-${utils.toLocalDateInputValue(new Date())}.json`,
          mode: "download",
          title: `${utils.APP_NAME} safety backup`,
          text: `${utils.APP_NAME} safety backup export`,
        });

        if (exportResult.method === "cancelled") {
          message = "Backup restored. Safety backup export was cancelled.";
        } else {
          message = `Backup restored. Safety backup ${describeExportResult(exportResult, "opened in the share sheet so you can store it safely")}.`;
        }
      }

      app.ui.toast(message, "success");
    } catch (error) {
      app.ui.toast(error.message || "Restore failed. Check that the JSON file is valid.", "warning");
    }
  }

  async function onClearData() {
    if (!app.can("destructiveData")) {
      app.ui.toast("This role cannot clear all data. Switch to Owner mode first.", "warning");
      return;
    }

    if (!app.guard("data.clear")) {
      return;
    }

    const shouldClear = await app.ui.confirm({
      title: "Clear all data",
      message: "This removes trips, expenses, customers, invoices, and stored receipts from this device. The install and subscription identity will stay protected here.",
      confirmLabel: "Clear data",
    });

    if (!shouldClear) {
      return;
    }

    await app.store.resetAll({ preserveProtection: true });
    app.ui.toast("All local operating data cleared.", "success");
  }

  async function copyInstallId() {
    try {
      const copied = await utils.copyText(refs.installId.value);
      if (!copied) {
        throw new Error("Install ID could not be copied.");
      }

      app.ui.toast("Install ID copied.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Install ID could not be copied.", "warning");
    }
  }

  async function onVerifyLicense() {
    refs.verifyLicense.disabled = true;

    try {
      await app.modules.protection.refreshNow();
      app.ui.toast("Subscription verification completed.", "success");
    } catch (error) {
      app.ui.toast(error.message || "Subscription verification failed.", "warning");
    } finally {
      refs.verifyLicense.disabled = false;
    }
  }

  return {
    applyTheme,
    init,
    render,
    toggleThemeQuick,
  };
};
