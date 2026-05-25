import simpleGit, { type SimpleGit } from "simple-git";

export async function checkoutBranchFromBase(repoRoot: string, branchName: string, baseRef: string): Promise<SimpleGit> {
  const git = simpleGit(repoRoot);

  await git.checkout(["-B", branchName, baseRef]);

  return git;
}
