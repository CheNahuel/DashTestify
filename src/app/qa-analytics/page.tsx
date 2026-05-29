import simpleGit from "simple-git";

import { QaAnalyticsPage } from "@/components/qa-analytics/qa-analytics-page";

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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const currentBranch = await getCurrentBranchName();
  const mode = params.view === "live" || process.env.VERCEL === "1" ? "live" : "local";

  return <QaAnalyticsPage mode={mode} currentBranch={currentBranch} />;
}
