import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("floating crypto AI assistant stays fixed and preserves its conversation", async ({
  dashboardData,
  dashboardPage,
}) => {
  const { page } = dashboardPage;

  await page.route("**/api/ai-providers-status", async (route) => {
    await route.fulfill({
      json: {
        providers: [{ name: "claude", label: "Claude", configured: true }],
      },
    });
  });

  await page.route("**/api/crypto-ai-analyst", async (route) => {
    await route.fulfill({
      json: {
        answer: "Bitcoin is showing a positive trend.",
        sources: ["/assets"],
        provider: "claude",
      },
    });
  });

  await dashboardPage.goto(dashboardData.urls.home.replace("mockData=1&", ""));
  await waitForDashboardData(page);

  const launcher = page.getByTestId("crypto-ai-launcher");
  const panel = page.getByTestId("crypto-ai-panel");

  await expect(launcher).toBeVisible();
  await expect(panel).toHaveAttribute("aria-hidden", "true");

  const initialLauncherBox = await launcher.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrolledLauncherBox = await launcher.boundingBox();
  expect(scrolledLauncherBox?.y).toBe(initialLauncherBox?.y);

  await launcher.click();
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  const emptyPanelBox = await panel.boundingBox();
  expect(emptyPanelBox?.height).toBeLessThan(500);

  const input = page.getByPlaceholder("Ask about crypto market...");
  await input.fill("What is Bitcoin's current volatility today?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(panel).toContainText("Bitcoin is showing a positive trend.");
  await expect(
    page.getByRole("button", { name: "How has Bitcoin performed this year?" }),
  ).toBeVisible();
  const activePanelBox = await panel.boundingBox();
  expect(activePanelBox?.height).toBeGreaterThan(emptyPanelBox?.height ?? 0);

  await panel.getByRole("button", { name: "Close Crypto AI Analyst" }).click();
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await launcher.click();

  await expect(panel).toContainText("What is Bitcoin's current volatility today?");
  await expect(panel).toContainText("Bitcoin is showing a positive trend.");
});

test("failed analyst requests restore the submitted suggestion after dismiss", async ({
  dashboardData,
  dashboardPage,
}) => {
  const { page } = dashboardPage;

  await page.route("**/api/ai-providers-status", async (route) => {
    await route.fulfill({
      json: {
        providers: [{ name: "claude", label: "Claude", configured: true }],
      },
    });
  });

  await page.route("**/api/crypto-ai-analyst", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Provider unavailable" }),
    });
  });

  await dashboardPage.goto(dashboardData.urls.home.replace("mockData=1&", ""));
  await waitForDashboardData(page);
  await page.getByTestId("crypto-ai-launcher").click();

  const failedQuestion = "What are today's biggest gainers?";
  await page.getByRole("button", { name: failedQuestion }).click();
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Provider unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();

  await expect(page.getByRole("button", { name: failedQuestion })).toBeVisible();
});

test("successful suggested questions refresh and exclude the submitted question", async ({
  dashboardData,
  dashboardPage,
}) => {
  const { page } = dashboardPage;

  await page.route("**/api/ai-providers-status", async (route) => {
    await route.fulfill({
      json: {
        providers: [{ name: "claude", label: "Claude", configured: true }],
      },
    });
  });

  await page.route("**/api/crypto-ai-analyst", async (route) => {
    await route.fulfill({
      json: {
        answer: "The market is moving higher.",
        sources: ["/assets"],
        provider: "claude",
      },
    });
  });

  await dashboardPage.goto(dashboardData.urls.home.replace("mockData=1&", ""));
  await waitForDashboardData(page);
  await page.getByTestId("crypto-ai-launcher").click();

  const submittedQuestion = "What are today's biggest gainers?";
  await page.getByRole("button", { name: submittedQuestion }).click();
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("The market is moving higher.")).toBeVisible();
  await expect(page.getByRole("button", { name: submittedQuestion })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compare Bitcoin and Ethereum over the last 6 months." }),
  ).toBeVisible();
});

test("blocks chat input when no provider is configured", async ({
  dashboardData,
  dashboardPage,
}) => {
  const { page } = dashboardPage;

  await page.route("**/api/ai-providers-status", async (route) => {
    await route.fulfill({
      json: {
        providers: [
          { name: "claude", label: "Claude", configured: false },
          { name: "openai", label: "OpenAI", configured: false },
        ],
      },
    });
  });

  await dashboardPage.goto(dashboardData.urls.home.replace("mockData=1&", ""));
  await waitForDashboardData(page);
  await page.getByTestId("crypto-ai-launcher").click();

  const providerSelect = page.getByRole("combobox", { name: "AI Provider" });
  const input = page.getByPlaceholder("Select a configured provider first");
  const sendButton = page.getByRole("button", { name: "Send" });

  await expect(providerSelect).toHaveValue("");
  await expect(input).toBeDisabled();
  await expect(sendButton).toBeDisabled();
});
