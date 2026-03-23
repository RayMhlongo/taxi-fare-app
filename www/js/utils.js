window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.utils = (() => {
  const APP_NAME = "InsightRide";
  const APP_SLUG = "insight-ride";
  const BRAND_NAME = "Data Insights by Ray";
  const APP_TAGLINE = "Smart fares. Smarter rides.";
  const DEFAULT_LOCALE = "en-ZA";
  const CURRENCY_LOCALES = {
    ZAR: "en-ZA",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
  };

  const EXPENSE_CATEGORIES = {
    fuel: "Fuel",
    maintenance: "Maintenance",
    toll: "Toll",
    parking: "Parking",
    cleaning: "Cleaning",
    insurance: "Insurance",
    registration: "Registration",
    other: "Other",
  };

  const PAYMENT_METHODS = {
    cash: "Cash",
    card: "Card",
    mobile: "Mobile payment",
    mixed: "Mixed",
  };

  const BILLING_TYPES = {
    monthly: "Monthly customer",
    regular: "Regular customer",
  };

  const ROLE_LABELS = {
    owner: "Owner",
    manager: "Manager",
    driver: "Driver",
  };

  const ROLE_PERMISSIONS = {
    owner: {
      customers: true,
      invoices: true,
      reports: true,
      settings: true,
      destructiveData: true,
    },
    manager: {
      customers: true,
      invoices: true,
      reports: true,
      settings: true,
      destructiveData: false,
    },
    driver: {
      customers: false,
      invoices: false,
      reports: true,
      settings: true,
      destructiveData: false,
    },
  };

  function nowISOString() {
    return new Date().toISOString();
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function numberFrom(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function integerFrom(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function stringFrom(value, fallback = "") {
    return typeof value === "string" ? value.trim() : fallback;
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

  function toDate(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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

  function startOfMonth(value = new Date()) {
    const date = toDate(value) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(value = new Date()) {
    const date = toDate(value) || new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  function addDays(value, days) {
    const date = toDate(value) || new Date();
    date.setDate(date.getDate() + numberFrom(days, 0));
    return date;
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

  function formatDate(value, options = { year: "numeric", month: "short", day: "numeric" }) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date) : "Unknown";
  }

  function formatTime(value) {
    const date = toDate(value);
    return date
      ? new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
      : "--:--";
  }

  function formatDateTime(value) {
    const date = toDate(value);
    if (!date) {
      return "Unknown";
    }

    return `${formatDate(date)} at ${formatTime(date)}`;
  }

  function formatCurrency(amount, currency = "ZAR") {
    const safeAmount = numberFrom(amount, 0);
    const locale = CURRENCY_LOCALES[currency] || DEFAULT_LOCALE;

    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(safeAmount);
    } catch (error) {
      return `${currency} ${safeAmount.toFixed(2)}`;
    }
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

  function sortByDateDesc(list, key) {
    return [...list].sort((left, right) => {
      const leftTime = toDate(left?.[key])?.getTime() || 0;
      const rightTime = toDate(right?.[key])?.getTime() || 0;
      return rightTime - leftTime;
    });
  }

  function groupBy(list, selector) {
    return list.reduce((groups, item) => {
      const key = selector(item);
      const safeKey = key || "Unspecified";
      groups[safeKey] = groups[safeKey] || [];
      groups[safeKey].push(item);
      return groups;
    }, {});
  }

  function tripTotal(trip) {
    return numberFrom(trip?.fare) + numberFrom(trip?.tips);
  }

  function expenseTotal(expense) {
    return numberFrom(expense?.amount);
  }

  function buildRouteLabel(trip) {
    const pickup = stringFrom(trip?.pickup, "Unknown pickup");
    const dropoff = stringFrom(trip?.dropoff, "Unknown dropoff");
    return `${pickup} to ${dropoff}`;
  }

  function customerNameFromState(customers, customerId) {
    return customers.find((customer) => customer.id === customerId)?.name || "Walk-in";
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read file."));
      reader.readAsText(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
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

  function extensionFromFileName(fileName) {
    const match = /\.([a-z0-9]+)$/i.exec(fileName || "");
    return match ? `.${match[1].toLowerCase()}` : "";
  }

  function mimeTypeFromFileName(fileName, fallback = "application/octet-stream") {
    const extension = extensionFromFileName(fileName);
    const mimeTypes = {
      ".json": "application/json",
      ".pdf": "application/pdf",
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
      const slice = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...slice);
    }

    return btoa(binary);
  }

  async function blobToBase64(blob) {
    return arrayBufferToBase64(await blob.arrayBuffer());
  }

  function buildNativeExportPath(fileName) {
    const extension = extensionFromFileName(fileName);
    const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
    return `${APP_SLUG}/${Date.now()}-${slugify(baseName || APP_NAME, APP_SLUG)}${extension}`;
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
      // Fall back to cache if public storage is not available.
    }

    return "CACHE";
  }

  function isShareCancelled(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return error?.name === "AbortError" || message.includes("cancel");
  }

  async function compressImageFile(file, options = {}) {
    const {
      maxWidth = 1280,
      maxHeight = 1280,
      quality = 0.72,
    } = options;

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const candidate = new Image();
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => reject(new Error("Could not load image."));
        candidate.src = objectUrl;
      });

      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not prepare receipt image.");
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      return {
        width,
        height,
        dataUrl,
        size: estimateDataUrlSize(dataUrl),
        type: "image/jpeg",
        name: `${slugify(file.name.replace(/\.[^.]+$/, ""), "receipt")}.jpg`,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function estimateDataUrlSize(dataUrl) {
    const base64 = dataUrl.split(",")[1] || "";
    return Math.round((base64.length * 3) / 4);
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

  function buildPresetRange(key) {
    const today = new Date();

    if (key === "today") {
      const date = toLocalDateInputValue(today);
      return { from: date, to: date, label: "Today" };
    }

    if (key === "7d") {
      return {
        from: toLocalDateInputValue(addDays(today, -6)),
        to: toLocalDateInputValue(today),
        label: "Last 7 days",
      };
    }

    if (key === "30d") {
      return {
        from: toLocalDateInputValue(addDays(today, -29)),
        to: toLocalDateInputValue(today),
        label: "Last 30 days",
      };
    }

    return {
      from: toLocalDateInputValue(startOfMonth(today)),
      to: toLocalDateInputValue(endOfMonth(today)),
      label: "This month",
    };
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

  async function shareFile(file, meta = {}) {
    if (!navigator.share) {
      return false;
    }

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

  async function shareBlob(blob, fileName, meta = {}) {
    if (typeof File === "undefined") {
      return false;
    }

    const file = new File([blob], fileName, {
      type: blob.type || mimeTypeFromFileName(fileName),
    });

    return shareFile(file, meta);
  }

  async function exportFile(options) {
    const {
      blob,
      fileName,
      mimeType = blob.type || mimeTypeFromFileName(fileName),
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

          return {
            fileName,
            method: mode === "share" ? "native-share" : "native-share-fallback",
            uri: writeResult.uri,
          };
        } catch (error) {
          if (isShareCancelled(error)) {
            return {
              fileName,
              method: "cancelled",
            };
          }

          throw error;
        }
      }

      return {
        directory: desiredDirectory,
        fileName,
        method: "native-save",
        mimeType,
        uri: writeResult.uri,
      };
    }

    if (mode === "share") {
      try {
        const shared = await shareBlob(blob, fileName, { title, text });
        if (shared) {
          return {
            fileName,
            method: "web-share",
          };
        }
      } catch (error) {
        if (isShareCancelled(error)) {
          return {
            fileName,
            method: "cancelled",
          };
        }

        throw error;
      }
    }

    return downloadBlob(blob, fileName);
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
        // Fall back to click when showPicker is unsupported or blocked.
      }
    }

    input.click();
    return true;
  }

  function pickTopEntry(entries) {
    return entries.reduce((best, current) => {
      if (!best || current.value > best.value) {
        return current;
      }

      return best;
    }, null);
  }

  return {
    APP_NAME,
    APP_SLUG,
    APP_TAGLINE,
    BILLING_TYPES,
    BRAND_NAME,
    CURRENCY_LOCALES,
    DEFAULT_LOCALE,
    EXPENSE_CATEGORIES,
    PAYMENT_METHODS,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    addDays,
    arrayBufferToBase64,
    blobToBase64,
    buildPresetRange,
    buildNativeExportPath,
    buildRouteLabel,
    clone,
    compressImageFile,
    customerNameFromState,
    downloadBlob,
    endOfDay,
    endOfMonth,
    escapeHtml,
    estimateDataUrlSize,
    expenseTotal,
    exportFile,
    formatBytes,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatTime,
    getCapacitorBridge,
    groupBy,
    integerFrom,
    isWithinRange,
    makeId,
    mimeTypeFromFileName,
    nowISOString,
    numberFrom,
    openFilePicker,
    pad,
    pickTopEntry,
    readFileAsDataURL,
    readFileAsText,
    shareFile,
    slugify,
    sortByDateDesc,
    startOfDay,
    startOfMonth,
    stringFrom,
    sumBy,
    toDate,
    toLocalDateInputValue,
    toLocalDateTimeInputValue,
    tripTotal,
  };
})();
