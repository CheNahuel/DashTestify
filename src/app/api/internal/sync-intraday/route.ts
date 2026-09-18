import { NextRequest } from "next/server";
import { syncIntraday } from "@/sync/syncIntraday";
import { validateSyncSecret, syncSuccessResponse, syncErrorResponse } from "../_auth";

export const maxDuration = 60; // 1 minute

/**
 * Internal endpoint for intraday crypto data sync.
 * Protected by INTERNAL_SYNC_SECRET header.
 * Called by Supabase Edge Functions via pg_cron (every 5 minutes).
 */
export async function POST(request: NextRequest) {
  const auth = validateSyncSecret(request);
  if (!auth.valid) {
    return auth.response;
  }

  try {
    console.log("[sync-intraday] Starting intraday sync from Edge Function");
    const result = await syncIntraday();
    console.log("[sync-intraday] Completed:", result);
    return syncSuccessResponse("Intraday sync completed", result);
  } catch (error) {
    console.error("[sync-intraday] Error:", error);
    return syncErrorResponse(error);
  }
}
