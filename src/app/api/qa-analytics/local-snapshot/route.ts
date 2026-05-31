import { NextResponse } from "next/server";

import { loadLocalQaAnalyticsSnapshot } from "../_local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await loadLocalQaAnalyticsSnapshot();

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load local QA Analytics snapshot." },
      { status: 500 },
    );
  }
}
