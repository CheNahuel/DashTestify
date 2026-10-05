import { headers } from "next/headers";
import { redirect } from "next/navigation";
import simpleGit from "simple-git";

import { AiFailureAnalysisPage } from "@/components/quality-analytics/ai-failure-analysis-page";
import { areLocalQaToolsEnabled } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

async function getCurrentBranchName() {
  if (process.env.VERCEL_GIT_COMMIT_REF) {
    return process.env.VERCEL_GIT_COMMIT_REF;
  }

  try {
    const git = simpleGit(process.cwd());
    const branchSummary = await git.branchLocal();

    return branchSummary.current || "unknown branch";
  } catch {
    return "unknown branch";
  }
}

export default async function Page() {
  const requestHeaders = await headers();

  if (!areLocalQaToolsEnabled(process.env, requestHeaders)) {
    redirect("/quality-analytics");
  }

  const currentBranch = await getCurrentBranchName();

  return <AiFailureAnalysisPage currentBranch={currentBranch} />;
}
