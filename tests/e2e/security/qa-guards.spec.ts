import { expect, test } from "@playwright/test";

import { areLocalQaToolsEnabled } from "@/lib/runtime-env";

test.describe("Local QA production guards", () => {
  test("helper disables local QA tools in production-like environments", () => {
    expect(areLocalQaToolsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(areLocalQaToolsEnabled({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
    expect(areLocalQaToolsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(
      areLocalQaToolsEnabled(
        { NODE_ENV: "development" },
        new Headers({ "x-qa-local-tools": "0" }),
      ),
    ).toBe(false);
  });

  test("AI failure analysis redirects when local QA tools are disabled", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-qa-local-tools": "0" });
    await page.goto("/ai-failure-analysis");
    await page.waitForURL(/\/quality-analytics/);
    await expect(page.getByRole("heading", { name: "Metrics overview" })).toBeVisible();
  });

  test("run-tests API returns 403 when local QA tools are disabled", async ({ request }) => {
    const response = await request.post("/api/quality-analytics/run-tests", {
      headers: { "x-qa-local-tools": "0" },
      data: { mode: "mock" },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Local QA tools are only available in development.",
    });
  });

  test("local-ai apply API returns 403 when local QA tools are disabled", async ({ request }) => {
    const response = await request.post("/api/quality-analytics/local-ai", {
      headers: { "x-qa-local-tools": "0" },
      data: { action: "apply", analysisId: "test-id" },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Local QA tools are only available in development.",
    });
  });
});

test.describe("Quality metrics configuration errors", () => {
  test("shows a visible error when Supabase metrics fail to load", async ({ page }) => {
    await page.route("**/rest/v1/test_runs*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Invalid API key",
          code: "401",
        }),
      });
    });

    await page.route("**/api/quality-analytics/test-trends*", async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: "Supabase is not configured." },
      });
    });

    await page.route("**/api/quality-analytics/top-failures*", async (route) => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.route("**/api/quality-analytics/flaky-tests*", async (route) => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.route("**/api/quality-analytics/failures-by-branch*", async (route) => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.goto("/quality-analytics");

    const alert = page.getByTestId("supabase-config-error");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Unable to load quality metrics");
    await expect(alert).toContainText("NEXT_PUBLIC_SUPABASE_URL");
  });
});
