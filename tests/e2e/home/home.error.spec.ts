import { test, expect } from "@playwright/test";

test("handles API error", async ({ page }) => {
  await page.route("**/api/coins/markets*", async (route) => {
    await route.abort();
  });

  await page.goto("http://localhost:3000");

  await expect(page.getByRole("heading", { name: "Track prices, compare trends, and inspect historical movement." })).toBeVisible();
});
