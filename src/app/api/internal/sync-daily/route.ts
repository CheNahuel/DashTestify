import { NextRequest } from "next/server";
import { syncDaily } from "@/sync/syncDaily";
import { validateSyncSecret, syncSuccessResponse, syncErrorResponse } from "../_auth";

export const maxDuration = 300; // 5 minutes

/**
 * Internal endpoint for daily crypto data sync.
 * Protected by INTERNAL_SYNC_SECRET header.
 * Called by Supabase Edge Functions via pg_cron.
 */
export async function POST(request: NextRequest) {
  const auth = validateSyncSecret(request);
  if (!auth.valid) {
    return auth.response;
  }

  try {
    console.log("[sync-daily] Starting daily sync from Edge Function");
    const result = await syncDaily();
    console.log("[sync-daily] Completed:", result);
    return syncSuccessResponse("Daily sync completed", result);
  } catch (error) {
    console.error("[sync-daily] Error:", error);
    return syncErrorResponse(error);
  }
}
