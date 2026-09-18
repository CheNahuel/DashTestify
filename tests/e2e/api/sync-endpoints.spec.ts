import { expect, test } from "@playwright/test";
import { POST as syncDailyPost } from "../../../src/app/api/internal/sync-daily/route";
import { POST as syncIntradayPost } from "../../../src/app/api/internal/sync-intraday/route";

test("sync-daily endpoint requires valid secret header", async () => {
  const response = await syncDailyPost(
    new Request("http://localhost/api/internal/sync-daily", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }) as any
  );

  expect(response.status).toBe(401);

  const data = (await response.json()) as { error?: string };
  expect(data.error).toContain("Unauthorized");
});

test("sync-daily endpoint rejects incorrect secret", async () => {
  const originalSecret = process.env.INTERNAL_SYNC_SECRET;

  try {
    process.env.INTERNAL_SYNC_SECRET = "test-secret-123";

    const response = await syncDailyPost(
      new Request("http://localhost/api/internal/sync-daily", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-secret",
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(response.status).toBe(401);

    const data = (await response.json()) as { error?: string };
    expect(data.error).toContain("Unauthorized");
  } finally {
    process.env.INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("sync-intraday endpoint requires valid secret header", async () => {
  const response = await syncIntradayPost(
    new Request("http://localhost/api/internal/sync-intraday", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }) as any
  );

  expect(response.status).toBe(401);

  const data = (await response.json()) as { error?: string };
  expect(data.error).toContain("Unauthorized");
});

test("sync-intraday endpoint rejects incorrect secret", async () => {
  const originalSecret = process.env.INTERNAL_SYNC_SECRET;

  try {
    process.env.INTERNAL_SYNC_SECRET = "test-secret-456";

    const response = await syncIntradayPost(
      new Request("http://localhost/api/internal/sync-intraday", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-secret",
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(response.status).toBe(401);

    const data = (await response.json()) as { error?: string };
    expect(data.error).toContain("Unauthorized");
  } finally {
    process.env.INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("sync endpoints missing secret in env returns 401", async () => {
  const originalSecret = process.env.INTERNAL_SYNC_SECRET;

  try {
    delete process.env.INTERNAL_SYNC_SECRET;

    const dailyResponse = await syncDailyPost(
      new Request("http://localhost/api/internal/sync-daily", {
        method: "POST",
        headers: {
          Authorization: "Bearer any-secret",
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(dailyResponse.status).toBe(401);

    const intradayResponse = await syncIntradayPost(
      new Request("http://localhost/api/internal/sync-intraday", {
        method: "POST",
        headers: {
          Authorization: "Bearer any-secret",
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(intradayResponse.status).toBe(401);
  } finally {
    if (originalSecret) {
      process.env.INTERNAL_SYNC_SECRET = originalSecret;
    }
  }
});

test("sync endpoints handle missing authorization header", async () => {
  const originalSecret = process.env.INTERNAL_SYNC_SECRET;

  try {
    process.env.INTERNAL_SYNC_SECRET = "test-secret";

    const dailyResponse = await syncDailyPost(
      new Request("http://localhost/api/internal/sync-daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(dailyResponse.status).toBe(401);

    const intradayResponse = await syncIntradayPost(
      new Request("http://localhost/api/internal/sync-intraday", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }) as any
    );

    expect(intradayResponse.status).toBe(401);
  } finally {
    process.env.INTERNAL_SYNC_SECRET = originalSecret;
  }
});
