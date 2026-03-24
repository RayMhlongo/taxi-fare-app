window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createProtectionModule = (app) => {
  const { config, utils } = app;
  const demo = window.TaxiFareApp.createDemoModule(app);
  const license = window.TaxiFareApp.createLicenseModule(app);

  function getState() {
    const demoState = demo.getState();
    const licenseState = license.getState();
    const installMeta = app.store.peek().installMeta;
    const isDemo = demoState.enabled;
    const readOnly = isDemo ? demoState.expired : licenseState.readOnly;
    const premium = {
      exports: config.ENABLE_EXPORTS && !isDemo && !readOnly,
      invoices: config.ENABLE_INVOICES && !isDemo && !readOnly,
      backupRestore: config.ENABLE_BACKUP_RESTORE && !isDemo && !readOnly,
      advancedReports: config.ENABLE_ADVANCED_REPORTS && !isDemo && !readOnly,
    };

    if (isDemo) {
      const title = demoState.expired
        ? "This demo has expired."
        : "Demo Version";
      const message = demoState.expired
        ? `Contact ${config.APP_OWNER_NAME} for full access.`
        : `Property of ${config.APP_OWNER_NAME}. Demo limits: ${demoState.remaining.trips} trips, ${demoState.remaining.expenses} expenses, ${demoState.remaining.customers} customers remaining.`;

      return {
        key: demoState.expired ? "demo-expired" : "demo-active",
        demo: demoState,
        license: licenseState,
        readOnly,
        badgeLabel: demoState.expired ? "Demo Expired" : "Demo Version",
        bannerTitle: title,
        bannerMessage: message,
        bannerTone: demoState.expired ? "danger" : "warning",
        bannerMeta: `Expires ${utils.formatDate(demoState.expiresAt)}`,
        bannerAction: "",
        buildLabel: "Demo Version",
        buildTone: "warning",
        ownerLabel: config.APP_BRAND_WATERMARK,
        ownerCopy: `Powered by ${config.APP_OWNER_NAME}`,
        installChip: `Install ${String(installMeta.installId || "--").slice(-8)}`,
        installId: installMeta.installId,
        premium,
        supportContact: config.SUPPORT_CONTACT,
      };
    }

    const bannerMetaParts = [];
    if (licenseState.paidUntil) {
      bannerMetaParts.push(`Paid until ${utils.formatDate(licenseState.paidUntil)}`);
    }
    if (licenseState.lastVerifiedAt) {
      bannerMetaParts.push(`Last verified ${utils.formatDateTime(licenseState.lastVerifiedAt)}`);
    }

    return {
      key: licenseState.key,
      demo: demoState,
      license: licenseState,
      readOnly,
      badgeLabel: licenseState.badgeLabel,
      bannerTitle: licenseState.title,
      bannerMessage: licenseState.message,
      bannerTone: licenseState.tone,
      bannerMeta: bannerMetaParts.join(" | "),
      bannerAction: licenseState.action,
      buildLabel: licenseState.key === "developer-preview" ? "Local Preview" : "Licensed App",
      buildTone: licenseState.key === "developer-preview" ? "info" : "success",
      ownerLabel: config.APP_BRAND_WATERMARK,
      ownerCopy: `Powered by ${config.APP_OWNER_NAME}`,
      installChip: `Install ${String(installMeta.installId || "--").slice(-8)}`,
      installId: installMeta.installId,
      premium,
      supportContact: config.SUPPORT_CONTACT,
    };
  }

  function featureMessage(feature, state, fallback) {
    if (state.key === "demo-expired") {
      return `This demo has expired. Contact ${config.APP_OWNER_NAME} for full access.`;
    }

    if (state.key === "demo-active") {
      return fallback || `Demo limit reached. Contact ${config.APP_OWNER_NAME} for the full version.`;
    }

    if (state.license.key === "expired") {
      return "Your subscription has expired. Please make payment to continue using this app.";
    }

    if (state.license.key === "grace") {
      return "You are in the grace period. Renew your subscription soon to avoid read-only mode.";
    }

    if (state.license.key === "verification-overdue") {
      return "Subscription verification is overdue. Reconnect to continue using write features.";
    }

    if (state.license.key === "missing-license") {
      return "Enter your license ID in Settings and verify it online.";
    }

    if (state.license.key === "unconfigured") {
      return "License verification is not configured for this build yet.";
    }

    if (state.license.key === "suspended") {
      return state.license.message || "This installation is not authorized.";
    }

    return fallback || `${feature} is not available right now.`;
  }

  function canUse(feature, context = {}) {
    const state = getState();
    const result = {
      allowed: true,
      reason: "",
      tone: "warning",
    };

    const disableForReadOnly = [
      "trip.create",
      "trip.edit",
      "trip.delete",
      "expense.create",
      "expense.edit",
      "expense.delete",
      "customer.create",
      "customer.edit",
      "customer.delete",
      "customer.toggle",
      "settings.save",
      "backup.export",
      "backup.restore",
      "data.clear",
      "invoice.save",
      "invoice.download",
      "invoice.share",
      "report.export",
    ];

    if (state.readOnly && disableForReadOnly.includes(feature)) {
      result.allowed = false;
      result.reason = featureMessage(feature, state);
      result.tone = "danger";
      return result;
    }

    if (feature === "report.export" && !config.ENABLE_EXPORTS) {
      result.allowed = false;
      result.reason = "Workbook export is disabled in configuration.";
      return result;
    }

    if ((feature === "backup.export" || feature === "backup.restore" || feature === "data.clear") && !config.ENABLE_BACKUP_RESTORE) {
      result.allowed = false;
      result.reason = "Backup and restore tools are disabled in configuration.";
      return result;
    }

    if ((feature === "invoice.save" || feature === "invoice.download" || feature === "invoice.share") && !config.ENABLE_INVOICES) {
      result.allowed = false;
      result.reason = "Invoice tools are disabled in configuration.";
      return result;
    }

    if (state.key === "demo-active") {
      if (feature === "backup.export" || feature === "backup.restore" || feature === "data.clear" || feature === "report.export") {
        result.allowed = false;
        result.reason = `This feature is disabled in the demo. Contact ${config.APP_OWNER_NAME} for the full version.`;
        return result;
      }

      if (feature === "invoice.save" || feature === "invoice.download" || feature === "invoice.share") {
        result.allowed = false;
        result.reason = `Invoice PDF tools are disabled in the demo. Contact ${config.APP_OWNER_NAME} for full access.`;
        return result;
      }

      if (feature === "trip.create" && state.demo.limitReached.trips) {
        result.allowed = false;
        result.reason = `Demo limit reached. Contact ${config.APP_OWNER_NAME} for the full version.`;
        return result;
      }

      if (feature === "expense.create" && state.demo.limitReached.expenses) {
        result.allowed = false;
        result.reason = `Demo limit reached. Contact ${config.APP_OWNER_NAME} for the full version.`;
        return result;
      }

      if (feature === "customer.create" && state.demo.limitReached.customers) {
        result.allowed = false;
        result.reason = `Demo limit reached. Contact ${config.APP_OWNER_NAME} for the full version.`;
        return result;
      }
    }

    if (feature === "settings.save" && state.license.key === "developer-preview") {
      return result;
    }

    if (context.requirePremium && !state.premium[context.requirePremium]) {
      result.allowed = false;
      result.reason = featureMessage(feature, state);
      return result;
    }

    return result;
  }

  function guard(feature, context = {}) {
    const result = canUse(feature, context);
    if (!result.allowed && !context.silent) {
      app.ui.toast(result.reason, result.tone === "danger" ? "warning" : result.tone);
    }
    return result.allowed;
  }

  async function init() {
    demo.init();
    await license.init();
    return getState();
  }

  async function refreshNow() {
    await license.refresh({ force: true, reason: "manual" });
    return getState();
  }

  async function refreshIfNeeded() {
    await license.refresh({ force: false, reason: "periodic" });
    return getState();
  }

  return {
    canUse,
    getState,
    guard,
    init,
    refreshIfNeeded,
    refreshNow,
  };
};
