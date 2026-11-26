import { expect, test } from "@playwright/test";

test("unauthenticated root redirects to login and renders form", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("form")).toBeVisible();
});
