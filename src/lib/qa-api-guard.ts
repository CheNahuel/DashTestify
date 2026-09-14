import { NextResponse } from "next/server";

import { areLocalQaToolsEnabled } from "@/lib/runtime-env";

export function rejectUnlessLocalQaTools(request: Request) {
  if (areLocalQaToolsEnabled(process.env, request.headers)) {
    return null;
  }

  return NextResponse.json(
    { error: "Local QA tools are only available in development." },
    { status: 403 },
  );
}
