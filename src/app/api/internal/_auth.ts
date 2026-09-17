import { NextRequest, NextResponse } from "next/server";

export function validateSyncSecret(request: NextRequest): { valid: false; response: Response } | { valid: true } {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.INTERNAL_SYNC_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: "Unauthorized: invalid or missing secret" },
        { status: 401 }
      ),
    };
  }

  return { valid: true };
}

export function syncSuccessResponse(message: string, result: unknown) {
  return NextResponse.json(
    {
      success: true,
      message,
      result,
    },
    { status: 200 }
  );
}

export function syncErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}
