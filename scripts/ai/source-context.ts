import fs from "fs";
import path from "path";

const SOURCE_CONTEXT_MAX_CHARS = 24_000;
const IGNORED_DIRECTORIES = new Set([".git", ".next", "node_modules", "playwright-report", "test-results"]);

export type SourceFileContext = {
  path: string;
  content: string;
  truncated: boolean;
};

function normalizeSourcePath(filePath: string) {
  return filePath
    .trim()
    .replace(/^a\//, "")
    .replace(/^b\//, "")
    .replace(/^\/+/, "");
}

async function findSourceFile(repoRoot: string, requestedPath: string): Promise<string | null> {
  const normalizedPath = normalizeSourcePath(requestedPath);
  const directCandidates = [
    normalizedPath,
    `tests/${normalizedPath}`,
    `tests/e2e/${normalizedPath}`,
    normalizedPath.replace(/^tests\//, ""),
  ].map((candidate) => path.resolve(/*turbopackIgnore: true*/ repoRoot, candidate));

  for (const candidate of directCandidates) {
    const stat = await fs.promises.stat(candidate).catch(() => null);

    if (stat?.isFile()) {
      return candidate;
    }
  }

  const walk = async (dir: string): Promise<string | null> => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(/*turbopackIgnore: true*/ dir, entry.name);

      if (entry.isDirectory()) {
        const found = await walk(entryPath);

        if (found) {
          return found;
        }
      } else if (entry.isFile()) {
        const relativePath = path.relative(repoRoot, entryPath).replace(/\\/g, "/");

        if (relativePath.endsWith(normalizedPath) || relativePath.endsWith(normalizedPath.replace(/^tests\//, ""))) {
          return entryPath;
        }
      }
    }

    return null;
  };

  return walk(repoRoot);
}

export async function readSourceFileContext(
  repoRoot: string,
  requestedPath?: string | null,
): Promise<SourceFileContext | null> {
  if (!requestedPath?.trim()) {
    return null;
  }

  const sourceFile = await findSourceFile(repoRoot, requestedPath);

  if (!sourceFile) {
    return null;
  }

  const content = await fs.promises.readFile(sourceFile, "utf8");
  const truncated = content.length > SOURCE_CONTEXT_MAX_CHARS;

  return {
    path: path.relative(repoRoot, sourceFile).replace(/\\/g, "/"),
    content: truncated ? content.slice(0, SOURCE_CONTEXT_MAX_CHARS) : content,
    truncated,
  };
}
