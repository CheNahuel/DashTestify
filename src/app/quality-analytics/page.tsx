import simpleGit from "simple-git";

import { MetricsPage } from "@/components/quality-analytics/metrics-page";

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
  return <MetricsPage />;
}
