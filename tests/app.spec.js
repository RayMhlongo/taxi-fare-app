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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("taxiFareAssets");
  });
});

test("core navigation and action buttons respond", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Taxi Fare" })).toBeVisible();

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
  expect(backup.suggestedFilename()).toMatch(/taxi-fare-backup-.*\.json/);

  await expectNoClientErrors(errors);
});

test("customer linked trip can be saved, invoiced, and exported as pdf", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");

  await page.getByRole("button", { name: "Customers" }).click();
  await page.locator("#openCustomerModalBtn").click();
  await page.locator("#customerNameInput").fill("Acme Shuttle");
  await page.locator("#customerPhoneInput").fill("+27 72 123 4567");
  await page.locator("#customerEmailInput").fill("accounts@acme.test");
  await page.locator("#customerCompanyInput").fill("Acme Logistics");
  await page.locator("#customerRouteNotesInput").fill("Rosebank to Sandton");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("Customer saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acme Shuttle" })).toBeVisible();

  await page.getByRole("button", { name: "Trips" }).click();
  await page.locator("#openTripModalBtn").click();
  await page.locator("#tripPickupInput").fill("Rosebank");
  await page.locator("#tripDropoffInput").fill("Sandton");
  await page.locator("#tripPassengerInput").fill("Monthly Account");
  await page.locator("#tripCustomerSelect").selectOption({ label: "Acme Shuttle (Monthly customer)" });
  await page.locator("#tripDistanceInput").fill("18.4");
  await page.locator("#tripDurationInput").fill("35");
  await page.locator("#tripFareInput").fill("450");
  await page.locator("#tripTipsInput").fill("25");
  await page.locator("#tripNotesInput").fill("Morning airport transfer");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByText("Trip saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rosebank to Sandton" })).toBeVisible();

  await page.getByRole("button", { name: "Invoices" }).click();
  await page.locator("#invoiceCustomerSelect").selectOption({ label: "Acme Shuttle (Monthly customer)" });
  await expect(page.locator("#saveInvoiceBtn")).toBeEnabled();
  await expect(page.locator("#downloadInvoiceBtn")).toBeEnabled();
  await expect(page.locator("#invoicePreview")).toContainText("Acme Shuttle");
  await expect(page.locator("#invoicePreview .invoice-total")).toContainText("475");

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
  expect(workbook.suggestedFilename()).toMatch(/taxi-fare-report-.*\.xlsx/);

  await page.getByRole("button", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("#confirmModal")).toBeVisible();
  await page.locator("#confirmAcceptBtn").click();
  await expect(page.getByText("Expense deleted.")).toBeVisible();

  await expectNoClientErrors(errors);
});
