import { expect, test } from "@playwright/test";

test.describe("Render & studio E2E (mocked Zvid/Python)", () => {
  test("login screen validates credentials and render progress endpoint responds with mocked state", async ({
    page,
  }) => {
    await page.route("**/api/render-progress**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          progress: 100,
          outputUrl: "/api/media/mock-out.mp4",
        }),
      });
    });

    await page.route("**/api/webhooks/zvid", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Lachvid/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
  });
});
