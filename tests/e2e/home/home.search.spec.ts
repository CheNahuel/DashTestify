import { test, expect } from "@playwright/test";

test("search filters coins", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const searchInput = page.getByPlaceholder("Search crypto...");

  await searchInput.fill("bitcoin");

  await expect(page.getByRole("heading", { name: "Bitcoin" })).toBeVisible();
});
