window.AgapeKidsApp = window.AgapeKidsApp || {};

window.AgapeKidsApp.utils = (() => {
  const APP_NAME = "Agape Kids";
  const APP_SLUG = "agape-kids";
  const CHURCH_NAME = "Agape Christian Centre";
  const CHURCH_LOCATION = "Louis Trichardt";
  const APP_TAGLINE = "Warm, safe children's church operations for every Sunday.";
  const DEFAULT_LANGUAGE = "en";
  const LANGUAGE_LOCALES = {
    en: "en-ZA",
    af: "af-ZA",
  };

  const ROLE_LABELS = {
    admin: "Admin",
    leader: "Ministry Leader",
    volunteer: "Volunteer",
    desk: "Check-in Desk",
  };

  const ROLE_PERMISSIONS = {
    admin: {
      settings: true,
      reports: true,
      ministry: true,
      managePolls: true,
      votePolls: true,
      sync: true,
      destructiveData: true,
    },
    leader: {
      settings: true,
      reports: true,
      ministry: true,
      managePolls: true,
      votePolls: true,
      sync: true,
      destructiveData: false,
    },
    volunteer: {
      settings: false,
      reports: false,
      ministry: false,
      managePolls: false,
      votePolls: true,
      sync: false,
      destructiveData: false,
    },
    desk: {
      settings: false,
      reports: false,
      ministry: false,
      managePolls: false,
      votePolls: false,
      sync: false,
      destructiveData: false,
    },
  };

  const COPY = {
    en: {
      button_install: "Install",
      button_theme: "Theme",
      nav_dashboard: "Dashboard",
      nav_children: "Children",
      nav_checkin: "Check-In",
      nav_ministry: "Ministry",
      nav_polls: "Polls",
      nav_reports: "Reports",
      nav_settings: "Settings",
    },
    af: {
      button_install: "Installeer",
      button_theme: "Tema",
      nav_dashboard: "Oorsig",
      nav_children: "Kinders",
      nav_checkin: "Inboek",
      nav_ministry: "Bediening",
      nav_polls: "Stemmings",
      nav_reports: "Verslae",
      nav_settings: "Instellings",
    },
  };

  function t(key, language = DEFAULT_LANGUAGE) {
    return COPY[language]?.[key] || COPY.en[key] || key;
  }

  function applyCopy(language = DEFAULT_LANGUAGE) {
    document.querySelectorAll("[data-copy]").forEach((element) => {
      element.textContent = t(element.dataset.copy, language);
    });
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function numberFrom(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function integerFrom(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function stringFrom(value, fallback = "") {
    return typeof value === "string" ? value.trim() : fallback;
  }

  function booleanFrom(value, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function nowISOString() {
    return new Date().toISOString();
  }

  function toDate(value) {
    if (!value) {
      return null;
    }

    const candidate = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  function toLocalDateInputValue(value = new Date()) {
    const date = toDate(value);
    if (!date) {
      return "";
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toLocalDateTimeInputValue(value = new Date()) {
    const date = toDate(value);
    if (!date) {
      return "";
    }

    return `${toLocalDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function startOfDay(value) {
    const date = toDate(value);
    if (!date) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
  }

  function endOfDay(value) {
    const date = toDate(value);
    if (!date) {
      return null;
    }

    date.setHours(23, 59, 59, 999);
    return date;
  }

  function addDays(value, days) {
    const date = toDate(value) || new Date();
    date.setDate(date.getDate() + numberFrom(days, 0));
    return date;
  }

  function daysBetween(fromValue, toValue) {
    const fromDate = startOfDay(fromValue);
    const toDateValue = startOfDay(toValue);
    if (!fromDate || !toDateValue) {
      return 0;
    }

    return Math.round((toDateValue.getTime() - fromDate.getTime()) / 86400000);
  }

  function startOfMonth(value = new Date()) {
    const date = toDate(value) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(value = new Date()) {
    const date = toDate(value) || new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  function isWithinRange(dateValue, fromValue, toValue) {
    const date = toDate(dateValue);
    if (!date) {
      return false;
    }

    const fromDate = fromValue ? startOfDay(fromValue) : null;
    const toDateValue = toValue ? endOfDay(toValue) : null;
    if (fromDate && date < fromDate) {
      return false;
    }
    if (toDateValue && date > toDateValue) {
      return false;
    }

    return true;
  }

  function languageLocale(language = DEFAULT_LANGUAGE) {
    return LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES[DEFAULT_LANGUAGE];
  }

  function formatDate(value, language = DEFAULT_LANGUAGE, options = { year: "numeric", month: "short", day: "numeric" }) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat(languageLocale(language), options).format(date) : "Unknown";
  }

  function formatTime(value, language = DEFAULT_LANGUAGE) {
    const date = toDate(value);
    if (!date) {
      return "--:--";
    }

    return new Intl.DateTimeFormat(languageLocale(language), {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatDateTime(value, language = DEFAULT_LANGUAGE) {
    const date = toDate(value);
    if (!date) {
      return "Unknown";
    }

    return `${formatDate(date, language)}  |  ${formatTime(date, language)}`;
  }

  function formatRelativeDate(value, language = DEFAULT_LANGUAGE) {
    const date = toDate(value);
    if (!date) {
      return "Unknown";
    }

    const today = startOfDay(new Date());
    const diff = daysBetween(today, date);
    if (diff === 0) {
      return language === "af" ? "Vandag" : "Today";
    }
    if (diff === 1) {
      return language === "af" ? "More" : "Tomorrow";
    }
    if (diff === -1) {
      return language === "af" ? "Gister" : "Yesterday";
    }
    return formatDate(date, language);
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function slugify(value, fallback = APP_SLUG) {
    const slug = String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback;
  }

  function sumBy(list, selector) {
    return list.reduce((sum, item) => sum + numberFrom(selector(item)), 0);
  }

  function groupBy(list, selector) {
    return list.reduce((groups, item) => {
      const key = selector(item) || "Unspecified";
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  function sortByDateDesc(list, key) {
    return [...list].sort((left, right) => {
      const leftTime = toDate(left?.[key])?.getTime() || 0;
      const rightTime = toDate(right?.[key])?.getTime() || 0;
      return rightTime - leftTime;
    });
  }

  function sortByName(list, selector) {
    return [...list].sort((left, right) => selector(left).localeCompare(selector(right)));
  }

  function unique(list) {
    return [...new Set(list)];
  }

  function buildPresetRange(key) {
    const today = new Date();

    if (key === "today") {
      const date = toLocalDateInputValue(today);
      return { from: date, to: date, label: "Today" };
    }

    if (key === "90d") {
      return {
        from: toLocalDateInputValue(addDays(today, -89)),
        to: toLocalDateInputValue(today),
        label: "Last 90 days",
      };
    }

    return {
      from: toLocalDateInputValue(startOfMonth(today)),
      to: toLocalDateInputValue(endOfMonth(today)),
      label: "This month",
    };
  }

  function formatBytes(bytes) {
    const size = numberFrom(bytes);
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function buildChildDisplayName(child) {
    const fullName = `${stringFrom(child?.firstName)} ${stringFrom(child?.lastName)}`.trim();
    return fullName || stringFrom(child?.displayName, "Unnamed child");
  }

  function buildGuardianSummary(child) {
    const guardians = Array.isArray(child?.guardians) ? child.guardians.filter((guardian) => guardian?.name) : [];
    if (!guardians.length) {
      return "No guardian listed";
    }

    return guardians.map((guardian) => guardian.name).join("  |  ");
  }

  function buildAgeLabel(birthDate) {
    const date = toDate(birthDate);
    if (!date) {
      return "Age not set";
    }

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age -= 1;
    }

    return age >= 0 ? `${age} yrs` : "Age not set";
  }

  function buildAttendanceStatusLabel(status) {
    const labels = {
      "checked-in": "Checked in",
      "checked-out": "Checked out",
      absent: "Absent",
      "not-checked-in": "Not checked in",
    };

    return labels[status] || "Pending";
  }

  function attendanceStreak(history) {
    const attendedDays = unique(history
      .filter((record) => record.status === "checked-in" || record.status === "checked-out")
      .map((record) => record.serviceDate))
      .sort()
      .reverse();

    let streak = 0;
    let previousDate = null;
    for (const dateValue of attendedDays) {
      if (!previousDate) {
        streak += 1;
        previousDate = dateValue;
        continue;
      }

      const gap = Math.abs(daysBetween(dateValue, previousDate));
      if (gap <= 14) {
        streak += 1;
        previousDate = dateValue;
        continue;
      }

      break;
    }

    return streak;
  }

  function generatePickupCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function normalizePhone(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function parsePollOptions(raw) {
    return String(raw ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({
        id: makeId("option"),
        label,
      }));
  }

  function buildPollShareMessage(poll, shareUrl) {
    return [
      `${poll.title} - ${APP_NAME}`,
      poll.description || "Please share your vote.",
      `Voting closes: ${poll.endDate || "soon"}`,
      shareUrl,
    ].filter(Boolean).join("\n");
  }

  function openFilePicker(input) {
    if (!input) {
      return false;
    }

    input.value = "";
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return true;
      } catch (error) {
        // Fall through to click.
      }
    }

    input.click();
    return true;
  }

  function extensionFromFileName(fileName) {
    const match = /\.([a-z0-9]+)$/i.exec(fileName || "");
    return match ? `.${match[1].toLowerCase()}` : "";
  }

  function mimeTypeFromFileName(fileName, fallback = "application/octet-stream") {
    const extension = extensionFromFileName(fileName);
    const mimeTypes = {
      ".json": "application/json",
      ".txt": "text/plain",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return mimeTypes[extension] || fallback;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 32768;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  }

  async function blobToBase64(blob) {
    return arrayBufferToBase64(await blob.arrayBuffer());
  }

  function getCapacitorBridge() {
    return window.Capacitor?.registerPlugin ? window.Capacitor : null;
  }

  function getNativeExportPlugins() {
    const bridge = getCapacitorBridge();
    if (!bridge) {
      return null;
    }

    return {
      bridge,
      Filesystem: bridge.registerPlugin("Filesystem"),
      Share: bridge.registerPlugin("Share"),
    };
  }

  async function ensureNativeDocumentsPermission(Filesystem) {
    try {
      const status = await Filesystem.checkPermissions();
      if (status?.publicStorage === "granted") {
        return "DOCUMENTS";
      }
      const requested = await Filesystem.requestPermissions();
      if (requested?.publicStorage === "granted") {
        return "DOCUMENTS";
      }
    } catch (error) {
      // Fall back to cache.
    }

    return "CACHE";
  }

  function buildNativeExportPath(fileName) {
    return `${APP_SLUG}/${Date.now()}-${slugify(fileName.replace(/\.[^.]+$/, ""), APP_SLUG)}${extensionFromFileName(fileName)}`;
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return {
      fileName,
      method: "download",
      url,
    };
  }

  function isShareCancelled(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return error?.name === "AbortError" || message.includes("cancel");
  }

  async function shareBlob(blob, fileName, meta = {}) {
    if (typeof File === "undefined" || !navigator.share) {
      return false;
    }

    const file = new File([blob], fileName, {
      type: blob.type || mimeTypeFromFileName(fileName),
    });

    const shareData = {
      title: meta.title || file.name,
      text: meta.text || "",
      files: [file],
    };

    if (navigator.canShare && !navigator.canShare(shareData)) {
      return false;
    }

    await navigator.share(shareData);
    return true;
  }

  async function exportFile(options) {
    const {
      blob,
      fileName,
      mode = "download",
      title = fileName,
      text = "",
    } = options;

    if (!blob || !fileName) {
      throw new Error("A file export could not be prepared.");
    }

    const nativePlugins = getNativeExportPlugins();
    const canUseNative = nativePlugins?.bridge.isNativePlatform?.();
    if (canUseNative) {
      const { Filesystem, Share } = nativePlugins;
      const desiredDirectory = mode === "download"
        ? await ensureNativeDocumentsPermission(Filesystem)
        : "CACHE";
      const path = buildNativeExportPath(fileName);
      const data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path,
        data,
        directory: desiredDirectory,
        recursive: true,
      });

      if (mode === "share" || desiredDirectory === "CACHE") {
        try {
          await Share.share({
            title,
            text,
            files: [writeResult.uri],
            dialogTitle: title,
          });
          return { fileName, method: "native-share", uri: writeResult.uri };
        } catch (error) {
          if (isShareCancelled(error)) {
            return { fileName, method: "cancelled" };
          }
          throw error;
        }
      }

      return { fileName, method: "native-save", uri: writeResult.uri };
    }

    if (mode === "share") {
      try {
        const shared = await shareBlob(blob, fileName, { title, text });
        if (shared) {
          return { fileName, method: "web-share" };
        }
      } catch (error) {
        if (isShareCancelled(error)) {
          return { fileName, method: "cancelled" };
        }
        throw error;
      }
    }

    return downloadBlob(blob, fileName);
  }

  return {
    APP_NAME,
    APP_SLUG,
    APP_TAGLINE,
    CHURCH_LOCATION,
    CHURCH_NAME,
    DEFAULT_LANGUAGE,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    addDays,
    applyCopy,
    arrayBufferToBase64,
    attendanceStreak,
    blobToBase64,
    booleanFrom,
    buildAgeLabel,
    buildAttendanceStatusLabel,
    buildChildDisplayName,
    buildGuardianSummary,
    buildNativeExportPath,
    buildPollShareMessage,
    buildPresetRange,
    clone,
    daysBetween,
    endOfDay,
    endOfMonth,
    escapeHtml,
    exportFile,
    formatBytes,
    formatDate,
    formatDateTime,
    formatRelativeDate,
    formatTime,
    generatePickupCode,
    getCapacitorBridge,
    groupBy,
    integerFrom,
    isWithinRange,
    languageLocale,
    makeId,
    mimeTypeFromFileName,
    normalizePhone,
    nowISOString,
    numberFrom,
    openFilePicker,
    pad,
    parsePollOptions,
    slugify,
    sortByDateDesc,
    sortByName,
    startOfDay,
    startOfMonth,
    stringFrom,
    sumBy,
    t,
    toDate,
    toLocalDateInputValue,
    toLocalDateTimeInputValue,
    unique,
  };
})();



