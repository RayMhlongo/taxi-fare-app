const { test, expect } = require("@playwright/test");

function trackClientErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, consoleErrors };
}

async function expectNoClientErrors(errors) {
  expect(errors.pageErrors, `Page errors: ${errors.pageErrors.join(" | ")}`).toEqual([]);
  expect(
    errors.consoleErrors.filter((message) => !message.includes("Failed to load resource: the server responded with a status of 404")),
    `Console errors: ${errors.consoleErrors.join(" | ")}`
  ).toEqual([]);
}

async function closeModal(page) {
  const cancelButton = page.getByRole("button", { name: "Cancel" }).last();
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    return;
  }

  await page.locator("[data-close-modal]").last().click();
}

async function createCustomer(page, overrides = {}) {
  await page.getByRole("button", { name: "Customers" }).click();
  await page.locator("#openCustomerModalBtn").click();
  await page.locator("#customerNameInput").fill(overrides.name || "Acme Shuttle");
  await page.locator("#customerPhoneInput").fill(overrides.phone || "+27 72 123 4567");
  await page.locator("#customerEmailInput").fill(overrides.email || "accounts@acme.test");
  await page.locator("#customerCompanyInput").fill(overrides.company || "Acme Logistics");
  await page.locator("#customerRouteNotesInput").fill(overrides.routeNotes || "Rosebank to Sandton");
  if (overrides.billingType) {
    await page.locator("#customerBillingTypeInput").selectOption(overrides.billingType);
  }
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("Customer saved.")).toBeVisible();
}

async function createTrip(page, overrides = {}) {
  await page.getByRole("button", { name: "Trips" }).click();
  await page.locator("#openTripModalBtn").click();
  await page.locator("#tripPickupInput").fill(overrides.pickup || "Rosebank");
  await page.locator("#tripDropoffInput").fill(overrides.dropoff || "Sandton");
  await page.locator("#tripPassengerInput").fill(overrides.passenger || "Monthly Account");
  if (overrides.customerLabel) {
    await page.locator("#tripCustomerSelect").selectOption({ label: overrides.customerLabel });
  }
  if (overrides.paymentMethod) {
    await page.locator("#tripPaymentInput").selectOption(overrides.paymentMethod);
  }
  await page.locator("#tripFareInput").fill(overrides.fare || "450");
  if (overrides.paymentMethod === "mixed" && overrides.cashPortion) {
    await page.locator("#tripCashPortionInput").fill(overrides.cashPortion);
  }
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByText(overrides.updated ? "Trip updated." : "Trip saved.")).toBeVisible();
}

async function setupNativeExportMock(page) {
  await page.evaluate(() => {
    window.__nativeExportCalls = [];

    const filesystem = {
      checkPermissions: async () => ({ publicStorage: "granted" }),
      requestPermissions: async () => ({ publicStorage: "granted" }),
      writeFile: async (options) => {
        window.__nativeExportCalls.push({ type: "writeFile", options });
        return { uri: `file:///mock/${options.path}` };
      },
    };

    const share = {
      share: async (options) => {
        window.__nativeExportCalls.push({ type: "share", options });
        return { activityType: "mock" };
      },
    };

    window.Capacitor = {
      isNativePlatform: () => true,
      registerPlugin: (name) => (name === "Filesystem" ? filesystem : share),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("taxiFareAssets");
  });
});

test("core navigation and action buttons respond", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "InsightRide" })).toBeVisible();

  await page.locator("#dashboardAddTripBtn").click();
  await expect(page.locator("#tripModal")).toBeVisible();
  await closeModal(page);

  await page.locator("#dashboardAddExpenseBtn").click();
  await expect(page.locator("#expenseModal")).toBeVisible();
  await closeModal(page);

  await page.locator("#dashboardAddCustomerBtn").click();
  await expect(page.locator("#customerModal")).toBeVisible();
  await closeModal(page);

  await page.locator("#dashboardOpenInvoicesBtn").click();
  await expect(page.locator('[data-screen="invoices"]')).toHaveClass(/active/);

  await page.getByRole("button", { name: "Trips" }).click();
  await expect(page.locator('[data-screen="trips"]')).toHaveClass(/active/);
  await page.locator("#openTripModalBtn").click();
  await expect(page.locator("#tripModal")).toBeVisible();
  await closeModal(page);

  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page.locator('[data-screen="expenses"]')).toHaveClass(/active/);
  await page.locator("#openExpenseModalBtn").click();
  await expect(page.locator("#expenseModal")).toBeVisible();
  await closeModal(page);

  await page.getByRole("button", { name: "Customers" }).click();
  await expect(page.locator('[data-screen="customers"]')).toHaveClass(/active/);
  await page.locator("#openCustomerModalBtn").click();
  await expect(page.locator("#customerModal")).toBeVisible();
  await closeModal(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('[data-screen="settings"]')).toHaveClass(/active/);

  await page.locator("#themeToggleBtn").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);

  const backupDownload = page.waitForEvent("download");
  await page.locator("#exportBackupBtn").click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/insight-ride-backup-.*\.json/);

  await expectNoClientErrors(errors);
});

test("customer linked trip can be saved, invoiced, and exported as pdf", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");

  await createCustomer(page);
  await expect(page.getByRole("heading", { name: "Acme Shuttle" })).toBeVisible();

  await createTrip(page, {
    customerLabel: "Acme Shuttle (Monthly customer)",
  });
  await expect(page.getByRole("heading", { name: "Rosebank to Sandton" })).toBeVisible();

  await page.getByRole("button", { name: "Invoices" }).click();
  await page.locator("#invoiceCustomerSelect").selectOption({ label: "Acme Shuttle (Monthly customer)" });
  await expect(page.locator("#saveInvoiceBtn")).toBeEnabled();
  await expect(page.locator("#downloadInvoiceBtn")).toBeEnabled();
  await expect(page.locator("#shareInvoiceBtn")).toBeEnabled();
  await expect(page.locator("#invoicePreview")).toContainText("Acme Shuttle");
  await expect(page.locator("#invoicePreview .invoice-total")).toContainText("450");

  await page.locator("#saveInvoiceBtn").click();
  await expect(page.getByText("Invoice saved.")).toBeVisible();
  await expect(page.locator("#invoiceArchive")).toContainText("Acme Shuttle");

  const pdfDownload = page.waitForEvent("download");
  await page.locator("#downloadInvoiceBtn").click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  await expectNoClientErrors(errors);
});

test("expense actions and report export work after data entry", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");

  await page.getByRole("button", { name: "Expenses" }).click();
  await page.locator("#openExpenseModalBtn").click();
  await page.locator("#expenseCategoryInput").selectOption("fuel");
  await page.locator("#expenseAmountInput").fill("320");
  await page.locator("#expenseQuantityInput").fill("1");
  await page.locator("#expenseDescriptionInput").fill("Fuel top-up");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Expense saved.")).toBeVisible();
  await expect(page.getByText("Fuel top-up")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#expenseModal")).toBeVisible();
  await page.locator("#expenseAmountInput").fill("350");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Expense updated.")).toBeVisible();

  const workbookDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Reports" }).click();
  await page.locator("#exportWorkbookBtn").click();
  const workbook = await workbookDownload;
  expect(workbook.suggestedFilename()).toMatch(/insight-ride-report-.*\.xlsx/);

  await page.getByRole("button", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("#confirmModal")).toBeVisible();
  await page.locator("#confirmAcceptBtn").click();
  await expect(page.getByText("Expense deleted.")).toBeVisible();

  await expectNoClientErrors(errors);
});

test("backup restore imports valid data and refreshes the app", async ({ page }) => {
  const errors = trackClientErrors(page);

  const backupPayload = {
    meta: {
      app: "InsightRide",
      format: "backup-v2",
      exportedAt: "2026-03-23T10:00:00.000Z",
      schemaVersion: 2,
    },
    data: {
      meta: {
        schemaVersion: 2,
        createdAt: "2026-03-23T10:00:00.000Z",
        updatedAt: "2026-03-23T10:00:00.000Z",
        migratedFrom: null,
      },
      settings: {
        driverName: "Ray Mhlongo",
        businessName: "Data Insights by Ray",
        driverPhone: "+27 72 000 0000",
        driverEmail: "ray@example.com",
        vehiclePlate: "RAY 123 GP",
        businessAddress: "Johannesburg",
        vatNumber: "",
        currency: "ZAR",
        theme: "dark",
        role: "owner",
        invoiceTheme: "modern",
        invoicePrefix: "IR",
        paymentTerms: "Payment due within 7 days.",
        invoiceNotes: "",
      },
      trips: [{
        id: "trip_restore_1",
        createdAt: "2026-03-22T08:00:00.000Z",
        updatedAt: "2026-03-22T08:00:00.000Z",
        dateTime: "2026-03-22T08:00:00.000Z",
        pickup: "Midrand",
        dropoff: "Centurion",
        passengerName: "Monthly Client",
        paymentMethod: "card",
        distanceKm: 0,
        durationMin: 0,
        fare: 180,
        tips: 0,
        customerId: "customer_restore_1",
        notes: "",
        cashCollected: 0,
        digitalCollected: 180,
      }],
      expenses: [],
      customers: [{
        id: "customer_restore_1",
        createdAt: "2026-03-22T08:00:00.000Z",
        updatedAt: "2026-03-22T08:00:00.000Z",
        name: "Restore Client",
        phone: "+27 82 000 0000",
        email: "restore@example.com",
        routeNotes: "Midrand to Centurion",
        billingType: "monthly",
        companyDetails: "Restore Co",
        taxNumber: "",
        invoiceNotes: "",
        status: "active",
      }],
      invoices: [],
    },
    receipts: [],
  };

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("#safetyBackupToggle").uncheck();
  await page.locator("#restoreBackupInput").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backupPayload)),
  });

  await expect(page.locator("#confirmModal")).toBeVisible();
  await page.locator("#confirmAcceptBtn").click();
  await expect(page.getByText("Backup restored successfully.")).toBeVisible();

  await page.getByRole("button", { name: "Customers" }).click();
  await expect(page.getByRole("heading", { name: "Restore Client" })).toBeVisible();

  await page.getByRole("button", { name: "Trips" }).click();
  await expect(page.getByRole("heading", { name: "Midrand to Centurion" })).toBeVisible();

  await expectNoClientErrors(errors);
});

test("native export actions use Capacitor save and share flows", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await setupNativeExportMock(page);

  await createCustomer(page, {
    name: "Native Exports Co",
    email: "native@example.com",
    company: "Native Exports Co",
  });
  await createTrip(page, {
    pickup: "Fourways",
    dropoff: "Bryanston",
    passenger: "Billing Client",
    fare: "240",
    customerLabel: "Native Exports Co (Monthly customer)",
  });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("#exportBackupBtn").click();
  await expect(page.getByText(/Backup .*device|Backup .*share sheet|Backup .*downloaded|Backup exported\./)).toBeVisible();

  await page.getByRole("button", { name: "Reports" }).click();
  await page.locator("#exportWorkbookBtn").click();
  await expect(page.getByText(/Workbook .*device|Workbook .*share sheet|Workbook downloaded\.|Workbook exported\./)).toBeVisible();

  await page.getByRole("button", { name: "Invoices" }).click();
  await page.locator("#invoiceCustomerSelect").selectOption({ label: "Native Exports Co (Monthly customer)" });
  await page.locator("#downloadInvoiceBtn").click();
  await expect(page.getByText(/Invoice PDF .*device|Invoice PDF exported\./)).toBeVisible();
  await page.locator("#shareInvoiceBtn").click();
  await expect(page.getByText(/Invoice PDF opened in the share sheet\./)).toBeVisible();

  const nativeCalls = await page.evaluate(() => window.__nativeExportCalls);
  const writeCalls = nativeCalls.filter((call) => call.type === "writeFile");
  const shareCalls = nativeCalls.filter((call) => call.type === "share");
  const writtenPaths = writeCalls.map((call) => call.options.path);

  expect(writtenPaths.some((path) => path.endsWith(".json"))).toBeTruthy();
  expect(writtenPaths.some((path) => path.endsWith(".xlsx"))).toBeTruthy();
  expect(writtenPaths.some((path) => path.endsWith(".pdf"))).toBeTruthy();
  expect(shareCalls).toHaveLength(1);
  expect(shareCalls[0].options.files[0]).toContain(".pdf");

  await expectNoClientErrors(errors);
});
