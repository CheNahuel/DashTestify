import { NextRequest, NextResponse } from "next/server";
import { syncIntraday } from "@/sync/syncIntraday";

export const maxDuration = 60; // 1 minute

/**
 * Internal endpoint for intraday crypto data sync.
 * Protected by INTERNAL_SYNC_SECRET header.
 * Called by Supabase Edge Functions via pg_cron (every 5 minutes).
 */
export async function POST(request: NextRequest) {
  try {
    // Validate secret header
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.INTERNAL_SYNC_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized: invalid or missing secret" },
        { status: 401 }
      );
    }

    console.log("[sync-intraday] Starting intraday sync from Edge Function");

    // Run intraday sync
    const result = await syncIntraday();

    console.log("[sync-intraday] Completed:", result);

    return NextResponse.json(
      {
        success: true,
        message: "Intraday sync completed",
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[sync-intraday] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
