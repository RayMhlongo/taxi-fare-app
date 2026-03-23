window.TaxiFareApp = window.TaxiFareApp || {};

window.TaxiFareApp.storage = (() => {
  const { utils } = window.TaxiFareApp;

  const STORAGE_KEY = "taxiFareV2";
  const LEGACY_STORAGE_KEY = "taxiFareV1";
  const LEGACY_THEME_KEY = "taxiFare_dark";
  const SCHEMA_VERSION = 2;
  const RECEIPT_DB_NAME = "taxiFareAssets";
  const RECEIPT_STORE_NAME = "receipts";

  const SETTINGS_DEFAULTS = {
    driverName: "",
    businessName: "",
    driverPhone: "",
    driverEmail: "",
    vehiclePlate: "",
    businessAddress: "",
    vatNumber: "",
    currency: "ZAR",
    theme: "system",
    role: "owner",
    invoiceTheme: "modern",
    invoicePrefix: "IR",
    paymentTerms: "Payment due within 7 days.",
    invoiceNotes: "",
  };

  let receiptDbPromise = null;

  function defaultState() {
    const now = utils.nowISOString();

    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        migratedFrom: null,
      },
      settings: { ...SETTINGS_DEFAULTS },
      trips: [],
      expenses: [],
      customers: [],
      invoices: [],
    };
  }

  function sanitizeSettings(raw = {}, legacyTheme = "") {
    const theme = ["light", "dark", "system"].includes(raw.theme)
      ? raw.theme
      : raw.darkMode === true
        ? "dark"
        : legacyTheme || "system";

    return {
      ...SETTINGS_DEFAULTS,
      driverName: utils.stringFrom(raw.driverName),
      businessName: utils.stringFrom(raw.businessName),
      driverPhone: utils.stringFrom(raw.driverPhone),
      driverEmail: utils.stringFrom(raw.driverEmail),
      vehiclePlate: utils.stringFrom(raw.vehiclePlate),
      businessAddress: utils.stringFrom(raw.businessAddress),
      vatNumber: utils.stringFrom(raw.vatNumber),
      currency: ["ZAR", "USD", "EUR", "GBP"].includes(raw.currency) ? raw.currency : "ZAR",
      theme,
      role: ["owner", "manager", "driver"].includes(raw.role) ? raw.role : "owner",
      invoiceTheme: ["modern", "minimal"].includes(raw.invoiceTheme) ? raw.invoiceTheme : "modern",
      invoicePrefix: utils.stringFrom(raw.invoicePrefix, "IR").slice(0, 10) || "IR",
      paymentTerms: utils.stringFrom(raw.paymentTerms, SETTINGS_DEFAULTS.paymentTerms),
      invoiceNotes: utils.stringFrom(raw.invoiceNotes),
    };
  }

  function derivePaymentBreakdown(trip, paymentMethod) {
    const total = utils.tripTotal(trip);

    if (paymentMethod === "cash") {
      return { cashCollected: total, digitalCollected: 0 };
    }

    if (paymentMethod === "mixed") {
      const cashCollected = Math.max(0, Math.min(total, utils.numberFrom(trip.cashCollected)));
      return { cashCollected, digitalCollected: Math.max(0, total - cashCollected) };
    }

    return { cashCollected: 0, digitalCollected: total };
  }

  function sanitizeTrip(raw = {}) {
    const paymentMethod = Object.prototype.hasOwnProperty.call(utils.PAYMENT_METHODS, raw.paymentMethod || raw.payment)
      ? (raw.paymentMethod || raw.payment)
      : "cash";

    const createdAt = utils.toDate(raw.createdAt || raw.dateTime) ? new Date(raw.createdAt || raw.dateTime).toISOString() : utils.nowISOString();
    const updatedAt = utils.toDate(raw.updatedAt || raw.createdAt || raw.dateTime)
      ? new Date(raw.updatedAt || raw.createdAt || raw.dateTime).toISOString()
      : createdAt;
    const dateTime = utils.toDate(raw.dateTime || raw.date)
      ? new Date(raw.dateTime || raw.date).toISOString()
      : createdAt;

    const trip = {
      id: utils.stringFrom(raw.id, utils.makeId("trip")),
      createdAt,
      updatedAt,
      dateTime,
      pickup: utils.stringFrom(raw.pickup, "Unknown pickup"),
      dropoff: utils.stringFrom(raw.dropoff, "Unknown dropoff"),
      passengerName: utils.stringFrom(raw.passengerName || raw.passenger),
      distanceKm: utils.numberFrom(raw.distanceKm ?? raw.distance),
      durationMin: utils.integerFrom(raw.durationMin ?? raw.duration),
      fare: utils.numberFrom(raw.fare),
      tips: utils.numberFrom(raw.tips),
      paymentMethod,
      customerId: utils.stringFrom(raw.customerId),
      notes: utils.stringFrom(raw.notes),
      cashCollected: 0,
      digitalCollected: 0,
    };

    const breakdown = derivePaymentBreakdown({
      ...trip,
      cashCollected: raw.cashCollected,
    }, paymentMethod);

    trip.cashCollected = breakdown.cashCollected;
    trip.digitalCollected = breakdown.digitalCollected;

    return trip;
  }

  function sanitizeExpense(raw = {}) {
    const createdAt = utils.toDate(raw.createdAt || raw.date) ? new Date(raw.createdAt || raw.date).toISOString() : utils.nowISOString();

    const receipt = raw.receipt && raw.receipt.assetId
      ? {
        assetId: utils.stringFrom(raw.receipt.assetId),
        name: utils.stringFrom(raw.receipt.name, "receipt.jpg"),
        type: utils.stringFrom(raw.receipt.type, "image/jpeg"),
        size: utils.numberFrom(raw.receipt.size),
        width: utils.numberFrom(raw.receipt.width),
        height: utils.numberFrom(raw.receipt.height),
      }
      : null;

    return {
      id: utils.stringFrom(raw.id, utils.makeId("expense")),
      createdAt,
      updatedAt: utils.toDate(raw.updatedAt || raw.createdAt || raw.date)
        ? new Date(raw.updatedAt || raw.createdAt || raw.date).toISOString()
        : createdAt,
      date: utils.toLocalDateInputValue(raw.date || raw.createdAt || new Date()),
      category: Object.prototype.hasOwnProperty.call(utils.EXPENSE_CATEGORIES, raw.category) ? raw.category : "other",
      amount: utils.numberFrom(raw.amount),
      quantity: utils.numberFrom(raw.quantity ?? raw.qty, 1) || 1,
      description: utils.stringFrom(raw.description, "Expense"),
      receipt,
    };
  }

  function sanitizeCustomer(raw = {}) {
    const createdAt = utils.toDate(raw.createdAt) ? new Date(raw.createdAt).toISOString() : utils.nowISOString();

    return {
      id: utils.stringFrom(raw.id, utils.makeId("customer")),
      createdAt,
      updatedAt: utils.toDate(raw.updatedAt || raw.createdAt)
        ? new Date(raw.updatedAt || raw.createdAt).toISOString()
        : createdAt,
      name: utils.stringFrom(raw.name || raw.fullName || raw.businessName, "Unnamed customer"),
      phone: utils.stringFrom(raw.phone),
      email: utils.stringFrom(raw.email),
      routeNotes: utils.stringFrom(raw.routeNotes || raw.pickupArea),
      billingType: ["monthly", "regular"].includes(raw.billingType) ? raw.billingType : "monthly",
      companyDetails: utils.stringFrom(raw.companyDetails || raw.companyName),
      taxNumber: utils.stringFrom(raw.taxNumber || raw.vatNumber),
      invoiceNotes: utils.stringFrom(raw.invoiceNotes),
      status: ["active", "inactive"].includes(raw.status) ? raw.status : "active",
    };
  }

  function sanitizeInvoiceLineItem(raw = {}) {
    return {
      tripId: utils.stringFrom(raw.tripId),
      dateTime: utils.toDate(raw.dateTime) ? new Date(raw.dateTime).toISOString() : utils.nowISOString(),
      route: utils.stringFrom(raw.route, "Unknown route"),
      description: utils.stringFrom(raw.description || raw.route, "Trip"),
      distanceKm: utils.numberFrom(raw.distanceKm),
      fare: utils.numberFrom(raw.fare),
      tips: utils.numberFrom(raw.tips),
      total: utils.numberFrom(raw.total ?? raw.lineTotal ?? raw.fare),
      paymentMethod: utils.stringFrom(raw.paymentMethod, "cash"),
    };
  }

  function sanitizeInvoice(raw = {}) {
    const createdAt = utils.toDate(raw.createdAt || raw.issueDate) ? new Date(raw.createdAt || raw.issueDate).toISOString() : utils.nowISOString();
    const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems.map(sanitizeInvoiceLineItem) : [];

    return {
      id: utils.stringFrom(raw.id, utils.makeId("invoice")),
      createdAt,
      updatedAt: utils.toDate(raw.updatedAt || raw.createdAt || raw.issueDate)
        ? new Date(raw.updatedAt || raw.createdAt || raw.issueDate).toISOString()
        : createdAt,
      invoiceNumber: utils.stringFrom(raw.invoiceNumber, `INV-${Date.now()}`),
      customerId: utils.stringFrom(raw.customerId),
      customerSnapshot: raw.customerSnapshot ? {
        name: utils.stringFrom(raw.customerSnapshot.name),
        phone: utils.stringFrom(raw.customerSnapshot.phone),
        email: utils.stringFrom(raw.customerSnapshot.email),
        routeNotes: utils.stringFrom(raw.customerSnapshot.routeNotes),
        billingType: utils.stringFrom(raw.customerSnapshot.billingType),
        companyDetails: utils.stringFrom(raw.customerSnapshot.companyDetails),
        taxNumber: utils.stringFrom(raw.customerSnapshot.taxNumber),
        invoiceNotes: utils.stringFrom(raw.customerSnapshot.invoiceNotes),
      } : null,
      driverSnapshot: raw.driverSnapshot ? {
        driverName: utils.stringFrom(raw.driverSnapshot.driverName),
        businessName: utils.stringFrom(raw.driverSnapshot.businessName),
        driverPhone: utils.stringFrom(raw.driverSnapshot.driverPhone),
        driverEmail: utils.stringFrom(raw.driverSnapshot.driverEmail),
        businessAddress: utils.stringFrom(raw.driverSnapshot.businessAddress),
        vatNumber: utils.stringFrom(raw.driverSnapshot.vatNumber),
        vehiclePlate: utils.stringFrom(raw.driverSnapshot.vehiclePlate),
      } : null,
      issueDate: utils.toLocalDateInputValue(raw.issueDate || createdAt),
      dueDate: utils.toLocalDateInputValue(raw.dueDate || createdAt),
      rangeStart: utils.toLocalDateInputValue(raw.rangeStart || createdAt),
      rangeEnd: utils.toLocalDateInputValue(raw.rangeEnd || createdAt),
      paymentTerms: utils.stringFrom(raw.paymentTerms),
      notes: utils.stringFrom(raw.notes),
      template: ["modern", "minimal"].includes(raw.template) ? raw.template : "modern",
      lineItems,
      totals: {
        subtotal: utils.numberFrom(raw.totals?.subtotal),
        tips: utils.numberFrom(raw.totals?.tips),
        total: utils.numberFrom(raw.totals?.total ?? utils.sumBy(lineItems, (item) => item.total)),
        tripCount: utils.integerFrom(raw.totals?.tripCount ?? lineItems.length),
        distanceKm: utils.numberFrom(raw.totals?.distanceKm),
      },
    };
  }

  function sanitizeState(raw = {}, options = {}) {
    const base = defaultState();
    const state = {
      meta: {
        ...base.meta,
        schemaVersion: SCHEMA_VERSION,
        createdAt: utils.stringFrom(raw.meta?.createdAt, base.meta.createdAt),
        updatedAt: utils.nowISOString(),
        migratedFrom: raw.meta?.migratedFrom || options.migratedFrom || null,
      },
      settings: sanitizeSettings(raw.settings || {}, options.legacyTheme),
      trips: Array.isArray(raw.trips) ? raw.trips.map(sanitizeTrip) : [],
      expenses: Array.isArray(raw.expenses) ? raw.expenses.map(sanitizeExpense) : [],
      customers: Array.isArray(raw.customers) ? raw.customers.map(sanitizeCustomer) : [],
      invoices: Array.isArray(raw.invoices) ? raw.invoices.map(sanitizeInvoice) : [],
    };

    return state;
  }

  function parseStoredJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function loadState() {
    const current = parseStoredJson(STORAGE_KEY);

    if (current) {
      return sanitizeState(current);
    }

    const legacy = parseStoredJson(LEGACY_STORAGE_KEY);
    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY) === "1" ? "dark" : "";

    if (legacy) {
      const migrated = sanitizeState(legacy, {
        migratedFrom: LEGACY_STORAGE_KEY,
        legacyTheme,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return defaultState();
  }

  function persistState(state) {
    const next = sanitizeState(state, { migratedFrom: state.meta?.migratedFrom || null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function openReceiptDb() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }

    if (!receiptDbPromise) {
      receiptDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(RECEIPT_DB_NAME, 1);

        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(RECEIPT_STORE_NAME)) {
            database.createObjectStore(RECEIPT_STORE_NAME, { keyPath: "assetId" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open receipt storage."));
      });
    }

    return receiptDbPromise;
  }

  async function runReceiptTransaction(mode, task) {
    const database = await openReceiptDb();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(RECEIPT_STORE_NAME, mode);
      const store = transaction.objectStore(RECEIPT_STORE_NAME);
      const request = task(store);

      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || new Error("Receipt storage failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Receipt storage failed."));
    });
  }

  async function putReceiptAsset(asset) {
    return runReceiptTransaction("readwrite", (store) => store.put(asset));
  }

  async function getReceiptAsset(assetId) {
    return runReceiptTransaction("readonly", (store) => store.get(assetId));
  }

  async function deleteReceiptAsset(assetId) {
    if (!assetId) {
      return null;
    }

    return runReceiptTransaction("readwrite", (store) => store.delete(assetId));
  }

  async function clearReceiptAssets() {
    return runReceiptTransaction("readwrite", (store) => store.clear());
  }

  async function buildBackupPayload(state) {
    const expensesWithReceipts = state.expenses.filter((expense) => expense.receipt?.assetId);
    const receiptEntries = await Promise.all(expensesWithReceipts.map(async (expense) => {
      const asset = await getReceiptAsset(expense.receipt.assetId);
      if (!asset) {
        return null;
      }

      return {
        expenseId: expense.id,
        assetId: asset.assetId,
        name: asset.name,
        type: asset.type,
        size: utils.numberFrom(asset.size),
        width: utils.numberFrom(asset.width),
        height: utils.numberFrom(asset.height),
        dataUrl: asset.dataUrl,
      };
    }));

    return {
      meta: {
        app: utils.APP_NAME,
        format: "backup-v2",
        exportedAt: utils.nowISOString(),
        schemaVersion: SCHEMA_VERSION,
      },
      data: utils.clone(state),
      receipts: receiptEntries.filter(Boolean),
    };
  }

  function normalizeBackupPayload(payload) {
    if (payload?.meta?.format === "backup-v2" && payload.data) {
      return {
        data: sanitizeState(payload.data),
        receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
      };
    }

    if (payload && (Array.isArray(payload.trips) || Array.isArray(payload.expenses) || payload.settings)) {
      return {
        data: sanitizeState(payload, { migratedFrom: "backup-import" }),
        receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
      };
    }

    throw new Error(`The selected file is not a valid ${utils.APP_NAME} backup.`);
  }

  function createStore() {
    let state = loadState();
    const listeners = new Set();

    function notify() {
      listeners.forEach((listener) => listener(utils.clone(state)));
    }

    function peek() {
      return state;
    }

    function read() {
      return utils.clone(state);
    }

    function replace(nextState) {
      state = persistState(nextState);
      notify();
      return read();
    }

    function update(recipe) {
      const draft = read();
      const result = recipe(draft) || draft;
      return replace(result);
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    async function exportBackup() {
      return buildBackupPayload(state);
    }

    async function restoreBackup(payload, options = {}) {
      const normalized = normalizeBackupPayload(payload);
      const safetyBackup = options.createSafetyBackup ? await buildBackupPayload(state) : null;
      await clearReceiptAssets();

      for (const receipt of normalized.receipts) {
        if (!receipt.assetId || !receipt.dataUrl) {
          continue;
        }

        await putReceiptAsset({
          assetId: utils.stringFrom(receipt.assetId),
          expenseId: utils.stringFrom(receipt.expenseId),
          name: utils.stringFrom(receipt.name, "receipt.jpg"),
          type: utils.stringFrom(receipt.type, "image/jpeg"),
          size: utils.numberFrom(receipt.size),
          width: utils.numberFrom(receipt.width),
          height: utils.numberFrom(receipt.height),
          dataUrl: utils.stringFrom(receipt.dataUrl),
        });
      }

      replace(normalized.data);

      return {
        safetyBackup,
        counts: {
          trips: normalized.data.trips.length,
          expenses: normalized.data.expenses.length,
          customers: normalized.data.customers.length,
          invoices: normalized.data.invoices.length,
        },
      };
    }

    async function resetAll() {
      await clearReceiptAssets();
      replace(defaultState());
    }

    function getStorageSummary() {
      const serialized = JSON.stringify(state);
      return {
        schemaVersion: SCHEMA_VERSION,
        trips: state.trips.length,
        expenses: state.expenses.length,
        customers: state.customers.length,
        invoices: state.invoices.length,
        estimatedBytes: serialized.length * 2,
      };
    }

    return {
      clearReceiptAssets,
      deleteReceiptAsset,
      exportBackup,
      getReceiptAsset,
      getStorageSummary,
      peek,
      putReceiptAsset,
      read,
      replace,
      resetAll,
      restoreBackup,
      subscribe,
      update,
    };
  }

  return {
    LEGACY_STORAGE_KEY,
    SCHEMA_VERSION,
    SETTINGS_DEFAULTS,
    STORAGE_KEY,
    createStore,
    defaultState,
    sanitizeState,
  };
})();
