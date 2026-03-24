window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.createLicenseModule = (app) => {
  const { config, utils } = app;
  let refreshPromise = null;

  function isLocalPreview() {
    const host = window.location.hostname;
    return window.location.protocol === "file:"
      || host === "localhost"
      || host === "127.0.0.1"
      || host === "::1";
  }

  function makeInstallId() {
    if (window.crypto?.randomUUID) {
      return `install_${window.crypto.randomUUID()}`;
    }

    return utils.makeId("install");
  }

  function hashString(value) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `fp_${(hash >>> 0).toString(16)}`;
  }

  function buildDeviceFingerprint() {
    const payload = [
      navigator.userAgent || "",
      navigator.platform || "",
      navigator.language || "",
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      window.screen?.width || 0,
      window.screen?.height || 0,
      window.screen?.colorDepth || 0,
    ].join("|");

    return hashString(payload);
  }

  function getFunctionUrl() {
    const backend = config.LICENSE_BACKEND || {};
    if (!backend.url || !backend.functionName) {
      return "";
    }

    return `${String(backend.url).replace(/\/+$/, "")}/functions/v1/${backend.functionName}`;
  }

  function hasBackendConfig() {
    const backend = config.LICENSE_BACKEND || {};
    return Boolean(backend.url && backend.anonKey && backend.functionName);
  }

  function ensureInstallIdentity() {
    const installMeta = app.store.peek().installMeta || {};
    const nextInstallId = utils.stringFrom(installMeta.installId, makeInstallId());
    const nextFingerprint = utils.stringFrom(installMeta.deviceFingerprint, buildDeviceFingerprint());
    const now = utils.nowISOString();

    if (installMeta.installId === nextInstallId && installMeta.deviceFingerprint === nextFingerprint && installMeta.lastSeenAt) {
      app.store.update((draft) => {
        draft.installMeta.lastSeenAt = now;
        return draft;
      });
      return;
    }

    app.store.update((draft) => {
      draft.installMeta.installId = nextInstallId;
      draft.installMeta.deviceFingerprint = nextFingerprint;
      draft.installMeta.createdAt = utils.stringFrom(draft.installMeta.createdAt, now);
      draft.installMeta.lastSeenAt = now;
      draft.appMeta.buildChannel = config.DEMO_MODE ? "demo" : "paid";
      return draft;
    });
  }

  function computeGraceUntil(paidUntil) {
    const paidUntilDate = utils.toDate(paidUntil);
    if (!paidUntilDate) {
      return null;
    }

    return utils.addDays(paidUntilDate, config.SUBSCRIPTION_GRACE_DAYS);
  }

  function normalizeRemotePayload(raw = {}) {
    const installMeta = app.store.peek().installMeta || {};
    const now = utils.nowISOString();
    const status = utils.stringFrom(raw.status, "expired");
    const paidUntil = utils.stringFrom(raw.paidUntil || raw.paid_until);
    const graceUntil = utils.stringFrom(raw.graceUntil || raw.grace_until);
    const effectiveGrace = graceUntil || (computeGraceUntil(paidUntil)?.toISOString() || "");

    return {
      licenseId: utils.stringFrom(raw.licenseId || raw.license_id, app.store.peek().licenseMeta.licenseId),
      driverName: utils.stringFrom(raw.driverName || raw.driver_name),
      businessName: utils.stringFrom(raw.businessName || raw.business_name),
      status,
      paidUntil,
      graceUntil: effectiveGrace,
      lastVerifiedAt: utils.stringFrom(raw.lastVerifiedAt || raw.last_verified_at, now),
      lastAttemptAt: now,
      lastMessage: utils.stringFrom(raw.message, ""),
      notes: utils.stringFrom(raw.notes || raw.adminNote || raw.admin_note),
      boundInstallId: utils.stringFrom(raw.boundInstallId || raw.bound_install_id, installMeta.installId),
      deviceFingerprint: utils.stringFrom(raw.deviceFingerprint || raw.device_fingerprint, installMeta.deviceFingerprint),
      accessMode: utils.stringFrom(raw.accessMode || raw.access_mode),
      verificationSource: "remote",
      deviceMismatch: Boolean(raw.deviceMismatch || raw.device_mismatch),
    };
  }

  function writeLicenseMeta(nextMeta) {
    app.store.update((draft) => {
      draft.licenseMeta = {
        ...draft.licenseMeta,
        ...nextMeta,
      };

      if (nextMeta.licenseId) {
        draft.installMeta.boundLicenseId = nextMeta.licenseId;
      }

      return draft;
    });
  }

  function deriveStatus(meta = app.store.peek().licenseMeta) {
    const now = new Date();
    const paidUntil = utils.toDate(meta.paidUntil);
    const graceUntil = utils.toDate(meta.graceUntil) || computeGraceUntil(meta.paidUntil);
    const offlineDeadline = utils.toDate(meta.lastVerifiedAt)
      ? utils.addDays(meta.lastVerifiedAt, config.MAX_OFFLINE_VERIFICATION_DAYS)
      : null;

    let status = utils.stringFrom(meta.status, "");
    if (meta.deviceMismatch && config.DEVICE_BINDING_MODE !== "off") {
      status = "suspended";
    } else if (status !== "suspended" && status !== "expired") {
      if (paidUntil && now.getTime() <= utils.endOfDay(paidUntil).getTime()) {
        status = "active";
      } else if (graceUntil && now.getTime() <= utils.endOfDay(graceUntil).getTime()) {
        status = "grace";
      } else if (paidUntil || graceUntil) {
        status = "expired";
      } else {
        status = status || "unverified";
      }
    }

    return {
      ...meta,
      status,
      paidUntil: paidUntil ? paidUntil.toISOString() : "",
      graceUntil: graceUntil ? graceUntil.toISOString() : "",
      offlineDeadline: offlineDeadline ? offlineDeadline.toISOString() : "",
    };
  }

  function buildLocalPreviewState() {
    const meta = deriveStatus();
    return {
      key: "developer-preview",
      badgeLabel: "Developer Preview",
      title: "Developer preview is active on localhost.",
      message: "Subscription enforcement is bypassed for local testing only. Production builds still require verification.",
      tone: "info",
      readOnly: false,
      action: "",
      licenseId: meta.licenseId,
      paidUntil: meta.paidUntil,
      graceUntil: meta.graceUntil,
      lastVerifiedAt: meta.lastVerifiedAt,
      installId: app.store.peek().installMeta.installId,
      verificationSource: "local-preview",
    };
  }

  function buildMissingLicenseState() {
    const meta = deriveStatus();
    return {
      key: "missing-license",
      badgeLabel: "License Needed",
      title: "Enter your license ID to unlock the paid app.",
      message: "This build expects an active monthly subscription. Add the license ID in Settings, then verify online.",
      tone: "warning",
      readOnly: true,
      action: "settings",
      licenseId: "",
      paidUntil: meta.paidUntil,
      graceUntil: meta.graceUntil,
      lastVerifiedAt: meta.lastVerifiedAt,
      installId: app.store.peek().installMeta.installId,
      verificationSource: meta.verificationSource,
    };
  }

  function buildUnconfiguredState() {
    return {
      key: "unconfigured",
      badgeLabel: "Verification Required",
      title: "License verification is not configured for this build.",
      message: "Connect this app to the subscription backend before distributing it to drivers.",
      tone: "danger",
      readOnly: true,
      action: "settings",
      licenseId: app.store.peek().licenseMeta.licenseId,
      paidUntil: "",
      graceUntil: "",
      lastVerifiedAt: app.store.peek().licenseMeta.lastVerifiedAt,
      installId: app.store.peek().installMeta.installId,
      verificationSource: "missing-backend",
    };
  }

  function buildOfflineState(meta) {
    const offlineDeadline = utils.toDate(meta.offlineDeadline);
    const status = meta.status || "unverified";
    const hasValidCache = utils.toDate(meta.lastVerifiedAt)
      && offlineDeadline
      && new Date().getTime() <= utils.endOfDay(offlineDeadline).getTime();

    if (!hasValidCache) {
      return {
        key: "verification-overdue",
        badgeLabel: "Verification Overdue",
        title: "Subscription verification is overdue.",
        message: "Reconnect to the internet to verify this license before write access can continue.",
        tone: "danger",
        readOnly: true,
        action: "verify",
        licenseId: meta.licenseId,
        paidUntil: meta.paidUntil,
        graceUntil: meta.graceUntil,
        lastVerifiedAt: meta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: "offline-cache",
      };
    }

    const tone = status === "grace" ? "warning" : "info";
    const title = status === "grace"
      ? "Grace period active while using cached verification."
      : "Using cached subscription verification.";

    return {
      key: status === "grace" ? "offline-grace" : "offline-active",
      badgeLabel: status === "grace" ? "Grace Offline" : "Offline Verified",
      title,
      message: `Last successful verification is still valid offline until ${utils.formatDate(meta.offlineDeadline)}.`,
      tone,
      readOnly: false,
      action: "verify",
      licenseId: meta.licenseId,
      paidUntil: meta.paidUntil,
      graceUntil: meta.graceUntil,
      lastVerifiedAt: meta.lastVerifiedAt,
      installId: app.store.peek().installMeta.installId,
      verificationSource: "offline-cache",
    };
  }

  function buildVerifiedState() {
    const meta = deriveStatus();
    if (!meta.licenseId) {
      return buildMissingLicenseState();
    }

    if (!navigator.onLine) {
      return buildOfflineState(meta);
    }

    if (meta.status === "active") {
      return {
        key: "active",
        badgeLabel: "Subscription Active",
        title: "Subscription active.",
        message: meta.paidUntil
          ? `Paid through ${utils.formatDate(meta.paidUntil)}.`
          : "Your license is verified and fully active.",
        tone: "success",
        readOnly: false,
        action: "verify",
        licenseId: meta.licenseId,
        paidUntil: meta.paidUntil,
        graceUntil: meta.graceUntil,
        lastVerifiedAt: meta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: meta.verificationSource,
      };
    }

    if (meta.status === "grace") {
      return {
        key: "grace",
        badgeLabel: "Grace Period",
        title: "Grace period active.",
        message: `Payment has lapsed. Please renew before ${utils.formatDate(meta.graceUntil || meta.paidUntil)} to avoid read-only mode.`,
        tone: "warning",
        readOnly: false,
        action: "verify",
        licenseId: meta.licenseId,
        paidUntil: meta.paidUntil,
        graceUntil: meta.graceUntil,
        lastVerifiedAt: meta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: meta.verificationSource,
      };
    }

    if (meta.status === "suspended") {
      return {
        key: "suspended",
        badgeLabel: "Suspended",
        title: "This license is suspended or assigned to another device.",
        message: meta.lastMessage || "Contact Data Insights by Ray to re-authorize this installation.",
        tone: "danger",
        readOnly: true,
        action: "settings",
        licenseId: meta.licenseId,
        paidUntil: meta.paidUntil,
        graceUntil: meta.graceUntil,
        lastVerifiedAt: meta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: meta.verificationSource,
      };
    }

    if (meta.status === "expired") {
      return {
        key: "expired",
        badgeLabel: "Expired",
        title: "Your subscription has expired.",
        message: "Please make payment to continue using write features, exports, backups, and invoice PDFs.",
        tone: "danger",
        readOnly: true,
        action: "settings",
        licenseId: meta.licenseId,
        paidUntil: meta.paidUntil,
        graceUntil: meta.graceUntil,
        lastVerifiedAt: meta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: meta.verificationSource,
      };
    }

    return {
      key: "unverified",
      badgeLabel: "Verification Needed",
      title: "Verify this license to unlock the paid app.",
      message: "Connect to the internet and verify this installation before using write features.",
      tone: "warning",
      readOnly: true,
      action: "verify",
      licenseId: meta.licenseId,
      paidUntil: meta.paidUntil,
      graceUntil: meta.graceUntil,
      lastVerifiedAt: meta.lastVerifiedAt,
      installId: app.store.peek().installMeta.installId,
      verificationSource: meta.verificationSource,
    };
  }

  function getState() {
    if (!config.SUBSCRIPTION_ENABLED || config.DEMO_MODE) {
      return {
        key: "subscription-disabled",
        badgeLabel: "Local Access",
        title: "Subscription checks are disabled for this build.",
        message: "This build is running without monthly enforcement.",
        tone: "info",
        readOnly: false,
        action: "",
        licenseId: app.store.peek().licenseMeta.licenseId,
        paidUntil: "",
        graceUntil: "",
        lastVerifiedAt: app.store.peek().licenseMeta.lastVerifiedAt,
        installId: app.store.peek().installMeta.installId,
        verificationSource: "disabled",
      };
    }

    if (!hasBackendConfig()) {
      if (config.DEVELOPER_PREVIEW_ON_LOCALHOST && isLocalPreview()) {
        return buildLocalPreviewState();
      }

      return buildUnconfiguredState();
    }

    if (!utils.stringFrom(app.store.peek().licenseMeta.licenseId)) {
      return buildMissingLicenseState();
    }

    return buildVerifiedState();
  }

  function needsVerification(force = false) {
    if (force) {
      return true;
    }

    const meta = app.store.peek().licenseMeta;
    const lastVerifiedAt = utils.toDate(meta.lastVerifiedAt);
    if (!lastVerifiedAt) {
      return true;
    }

    const nextCheck = new Date(lastVerifiedAt.getTime() + (config.LICENSE_CHECK_INTERVAL_HOURS * 60 * 60 * 1000));
    return Date.now() >= nextCheck.getTime();
  }

  async function verifyOnline() {
    const licenseMeta = app.store.peek().licenseMeta;
    const installMeta = app.store.peek().installMeta;
    const backend = config.LICENSE_BACKEND || {};
    const response = await fetch(getFunctionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: backend.anonKey,
        Authorization: `Bearer ${backend.anonKey}`,
      },
      body: JSON.stringify({
        licenseId: licenseMeta.licenseId,
        installId: installMeta.installId,
        deviceFingerprint: installMeta.deviceFingerprint,
        deviceBindingMode: config.DEVICE_BINDING_MODE,
        appName: config.APP_BRAND_NAME,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "License verification failed.");
    }

    return normalizeRemotePayload(await response.json());
  }

  async function refresh(options = {}) {
    const { force = false, reason = "manual" } = options;

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      ensureInstallIdentity();

      if (!config.SUBSCRIPTION_ENABLED || config.DEMO_MODE) {
        return getState();
      }

      if (!hasBackendConfig()) {
        return getState();
      }

      const licenseId = utils.stringFrom(app.store.peek().licenseMeta.licenseId);
      if (!licenseId) {
        writeLicenseMeta({
          lastAttemptAt: utils.nowISOString(),
          verificationSource: reason,
        });
        return getState();
      }

      if (!needsVerification(force)) {
        return getState();
      }

      if (!navigator.onLine) {
        writeLicenseMeta({
          lastAttemptAt: utils.nowISOString(),
          verificationSource: "offline",
        });
        return getState();
      }

      try {
        const result = await verifyOnline();
        writeLicenseMeta({
          ...result,
          lastAttemptAt: utils.nowISOString(),
          verificationSource: reason,
          lastError: "",
        });
      } catch (error) {
        writeLicenseMeta({
          lastAttemptAt: utils.nowISOString(),
          verificationSource: "error",
          lastError: utils.stringFrom(error?.message, "Verification failed."),
          lastMessage: utils.stringFrom(error?.message, "Verification failed."),
        });
      }

      return getState();
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function init() {
    ensureInstallIdentity();
    window.addEventListener("online", () => {
      refresh({ force: true, reason: "online" }).catch(() => {
        // A later manual refresh can retry.
      });
    });
    window.addEventListener("focus", () => {
      refresh({ force: false, reason: "focus" }).catch(() => {
        // Ignore periodic background failures.
      });
    });

    return refresh({ force: false, reason: "startup" });
  }

  return {
    getState,
    hasBackendConfig,
    init,
    isLocalPreview,
    refresh,
  };
};
