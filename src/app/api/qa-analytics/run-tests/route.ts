import { NextResponse } from "next/server";

import {
  abortQaAnalyticsRun,
  readQaAnalyticsRunState,
  startQaAnalyticsRun,
  type QaAnalyticsRunMode,
} from "@/lib/qa-analytics/run-tests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMode(value: unknown): QaAnalyticsRunMode | null {
  if (value === "mock" || value === "live") {
    return value;
  }

  return null;
}

export async function GET() {
  const state = await readQaAnalyticsRunState();

  return NextResponse.json({ run: state }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
    const mode = parseMode(body?.mode);

    if (!mode) {
      return NextResponse.json({ error: "mode must be either mock or live." }, { status: 400 });
    }

    const result = await startQaAnalyticsRun(mode);

    if (!result.started) {
      return NextResponse.json(
        {
          error: "A test run is already in progress.",
          run: result.state,
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    return NextResponse.json({ run: result.state }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start the test run." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const result = await abortQaAnalyticsRun();

    return NextResponse.json(
      { aborted: result.aborted },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to stop the test run." },
      { status: 500 },
    );
  }
}
