import { serve } from "https://deno.land/std@0.175.0/http/server.ts";

const NEXT_PUBLIC_URL = Deno.env.get("NEXT_PUBLIC_URL") || "http://localhost:3000";
const INTERNAL_SYNC_SECRET = Deno.env.get("INTERNAL_SYNC_SECRET");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log("[Edge Function] sync-intraday: Triggering intraday sync");

    const response = await fetch(`${NEXT_PUBLIC_URL}/api/internal/sync-intraday`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INTERNAL_SYNC_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timestamp: new Date().toISOString() }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Edge Function] sync-intraday failed: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Sync failed: ${response.statusText}`,
          details: errorText,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("[Edge Function] sync-intraday completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Edge Function] sync-intraday error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
