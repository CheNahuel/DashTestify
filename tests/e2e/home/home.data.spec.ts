import { test, expect } from "@playwright/test";

test("coin shows price and percentage", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const selectedAsset = page.getByRole("heading", { name: "Bitcoin" });

  await expect(selectedAsset).toBeVisible();
  await expect(page.getByText('$').first()).toBeVisible();
  await expect(page.getByText('%').first()).toBeVisible();
});
