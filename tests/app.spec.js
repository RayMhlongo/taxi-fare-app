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
  expect(errors.consoleErrors, `Console errors: ${errors.consoleErrors.join(" | ")}`).toEqual([]);
}

async function createChild(page, overrides = {}) {
  await page.locator("#openChildModalBtn").click();
  await expect(page.locator("#childModal")).toBeVisible();
  await page.locator("#childFirstNameInput").fill(overrides.firstName || "Hannah", { force: true });
  await page.locator("#childLastNameInput").fill(overrides.lastName || "Mhlongo", { force: true });
  await page.locator("#childGradeInput").fill(overrides.grade || "Grade 2", { force: true });
  await page.locator("#childGuardianOneNameInput").fill(overrides.guardian || "Nomsa Mhlongo", { force: true });
  await page.locator("#childGuardianOnePhoneInput").fill(overrides.phone || "+27 72 123 4567", { force: true });
  await page.locator("#childPickupCodeInput").fill(overrides.pickupCode || "2244", { force: true });
  await page.getByRole("button", { name: "Save child" }).click();
  await expect(page.getByText("Child profile saved.")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test("core navigation, theme toggle, and backup export work", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.locator("#appLoader")).toBeHidden();
  await expect(page.getByRole("banner").getByRole("heading", { name: "Agape Kids" })).toBeVisible();

  await page.getByRole("button", { name: "Children", exact: true }).click();
  await expect(page.locator('[data-screen="children"]')).toHaveClass(/active/);

  await page.getByRole("button", { name: "Check-In", exact: true }).click();
  await expect(page.locator('[data-screen="checkin"]')).toHaveClass(/active/);

  await page.getByRole("button", { name: "Theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);

  await page.getByRole("button", { name: "Settings" }).click();
  const backupDownload = page.waitForEvent("download");
  await page.locator("#exportBackupBtn").click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/agape-kids-backup-.*\.json/);

  await expectNoClientErrors(errors);
});

test("child registration and check-out verification flow works", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.locator("#appLoader")).toBeHidden();
  await page.getByRole("button", { name: "Children", exact: true }).click();
  await createChild(page);
  await expect(page.getByRole("heading", { name: "Hannah Mhlongo" })).toBeVisible();

  await page.getByRole("button", { name: "Check-In", exact: true }).click();
  await page.getByRole("button", { name: "Check in" }).last().click();
  await expect(page.getByText("Hannah Mhlongo checked in.")).toBeVisible();

  await page.getByRole("button", { name: "Check out" }).first().click();
  await expect(page.locator("#attendanceModal")).toBeVisible();
  await page.locator("#attendancePickedUpByInput").fill("Nomsa Mhlongo");
  await page.locator("#attendancePickupCodeInput").fill("2244");
  await page.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(page.getByText("Pickup verified.")).toBeVisible();

  await expectNoClientErrors(errors);
});

test("poll creation, voting, and workbook export work", async ({ page }) => {
  const errors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.locator("#appLoader")).toBeHidden();
  await page.getByRole("button", { name: "Polls", exact: true }).click();
  await page.locator("#openPollModalBtn").click();
  await page.locator("#pollTitleInput").fill("Camp date preference");
  await page.locator("#pollDescriptionInput").fill("Help us choose the best church camp date.");
  await page.locator("#pollStatusInput").selectOption("active");
  await page.locator("#pollOptionsInput").fill("Friday evening\nSaturday morning");
  await page.getByRole("button", { name: "Save poll" }).click();
  await expect(page.getByText("Poll saved.")).toBeVisible();

  await page.getByLabel("Friday evening").check();
  await page.getByRole("button", { name: "Cast vote" }).click();
  await expect(page.getByText("Vote captured.")).toBeVisible();

  await page.getByRole("button", { name: "Reports" }).click();
  const workbookDownload = page.waitForEvent("download");
  await page.locator("#exportWorkbookBtn").click();
  const workbook = await workbookDownload;
  expect(workbook.suggestedFilename()).toMatch(/agape-kids-report-.*\.xlsx/);

  await expectNoClientErrors(errors);
});
