import { NextRequest, NextResponse } from "next/server";
import { syncDaily } from "@/sync/syncDaily";

export const maxDuration = 300; // 5 minutes

/**
 * Internal endpoint for daily crypto data sync.
 * Protected by INTERNAL_SYNC_SECRET header.
 * Called by Supabase Edge Functions via pg_cron.
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

    console.log("[sync-daily] Starting daily sync from Edge Function");

    // Run daily sync
    const result = await syncDaily();

    console.log("[sync-daily] Completed:", result);

    return NextResponse.json(
      {
        success: true,
        message: "Daily sync completed",
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[sync-daily] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
