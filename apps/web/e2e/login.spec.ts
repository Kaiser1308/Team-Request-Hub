import { expect, test } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders the login page", async ({ page }) => {
    await test.step("show the app heading", async () => {
      await expect(page.getByRole("heading", { name: "Team Request Hub" })).toBeVisible();
    });

    await test.step("show the Google login button", async () => {
      await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    });

    await test.step("capture desktop screenshot", async () => {
      await page.screenshot({ path: "e2e/screenshots/login-page.png", fullPage: true });
    });
  });

  test("Google login button is enabled", async ({ page }) => {
    const googleButton = page.getByRole("button", { name: /google/i });

    await expect(googleButton).toBeEnabled();
  });

  test("renders on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await expect(page.getByRole("heading", { name: "Team Request Hub" })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/login-mobile.png", fullPage: true });
  });
});
