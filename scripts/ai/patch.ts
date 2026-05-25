import fs from "fs";
import os from "os";
import path from "path";

import simpleGit from "simple-git";

function stripMarkdownFences(raw: string) {
  return raw
    .replace(/^```(?:diff|patch|text)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function stripAnsiEscapeCodes(raw: string) {
  return raw.replace(/\u001b\[[0-9;]*m/g, "");
}

function isUnifiedDiff(patch: string) {
  return patch.includes("diff --git ") || patch.startsWith("--- ") || patch.includes("\n@@ ");
}

function normalizePatchPath(filePath: string) {
  return filePath
    .trim()
    .replace(/^a\//, "")
    .replace(/^b\//, "")
    .replace(/^\/+/, "");
}

function splitContentLines(content: string) {
  const hasTrailingNewline = content.endsWith("\n");
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (hasTrailingNewline) {
    lines.pop();
  }

  return { hasTrailingNewline, lines };
}

function renderContentLines(lines: string[], hasTrailingNewline: boolean) {
  const content = lines.join("\n");

  return hasTrailingNewline ? `${content}\n` : content;
}

function extractTargetFile(patch: string) {
  const plusLineMatch = patch.match(/^\+\+\+ b\/(.+)$/m);

  if (plusLineMatch?.[1]) {
    return plusLineMatch[1].trim();
  }

  const diffLineMatch = patch.match(/^diff --git a\/(.+) b\/(.+)$/m);

  if (diffLineMatch?.[2]) {
    return diffLineMatch[2].trim();
  }

  throw new Error("Unable to determine the target file from generated_patch.");
}

type ParsedHunk = {
  oldStart: number | null;
  newStart: number | null;
  oldLines: string[];
  newLines: string[];
  ops: Array<{ type: "context" | "remove" | "add"; text: string }>;
};

function parseUnifiedDiffHunks(patch: string) {
  const lines = patch.split(/\r?\n/);
  const hunks: ParsedHunk[] = [];
  let index = 0;

  while (index < lines.length) {
    const header = lines[index];

    if (!header.startsWith("@@")) {
      index += 1;
      continue;
    }

    const hunkHeaderMatch = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    index += 1;

    const oldLines: string[] = [];
    const newLines: string[] = [];
    const ops: Array<{ type: "context" | "remove" | "add"; text: string }> = [];

    while (index < lines.length && !lines[index].startsWith("@@") && !lines[index].startsWith("diff --git ")) {
      const line = lines[index];

      if (line.startsWith("-")) {
        const text = line.slice(1);
        oldLines.push(text);
        ops.push({ type: "remove", text });
      } else if (line.startsWith("+")) {
        const text = line.slice(1);
        newLines.push(text);
        ops.push({ type: "add", text });
      } else if (line.startsWith(" ")) {
        const contextLine = line.slice(1);
        oldLines.push(contextLine);
        newLines.push(contextLine);
        ops.push({ type: "context", text: contextLine });
      } else if (line.startsWith("\\ No newline at end of file")) {
        // Handled implicitly by the line splitting helpers.
      } else if (line.trim().length === 0) {
        // Preserve blank lines inside the hunk.
        oldLines.push("");
        newLines.push("");
        ops.push({ type: "context", text: "" });
      } else {
        throw new Error(`Unsupported patch line: ${line}`);
      }

      index += 1;
    }

    hunks.push({
      oldStart: hunkHeaderMatch ? Number(hunkHeaderMatch[1]) : null,
      newStart: hunkHeaderMatch ? Number(hunkHeaderMatch[3]) : null,
      oldLines,
      newLines,
      ops,
    });
  }

  return hunks;
}

function rewritePatchTargetPath(patch: string, targetFile: string) {
  const normalizedTarget = normalizePatchPath(targetFile);

  return patch
    .replace(/^diff --git a\/.+ b\/.+$/m, `diff --git a/${normalizedTarget} b/${normalizedTarget}`)
    .replace(/^--- .+$/m, `--- a/${normalizedTarget}`)
    .replace(/^\+\+\+ .+$/m, `+++ b/${normalizedTarget}`);
}

function sanitizeUnifiedDiffHeaders(patch: string) {
  const lines = patch.split(/\r?\n/);
  const hunks = parseUnifiedDiffHunks(patch);
  let hunkIndex = 0;

  return lines
    .map((line) => {
      if (!line.startsWith("@@")) {
        return line;
      }

      const hunk = hunks[hunkIndex++];
      const oldStart = hunk.oldStart ?? 1;
      const newStart = hunk.newStart ?? oldStart;

      return `@@ -${oldStart},${hunk.oldLines.length} +${newStart},${hunk.newLines.length} @@`;
    })
    .join("\n");
}

function normalizeLineForMatch(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function findLineIndexRelaxed(haystack: string[], needle: string) {
  const exactIndex = haystack.findIndex((line) => line === needle);

  if (exactIndex >= 0) {
    return exactIndex;
  }

  const normalizedNeedle = normalizeLineForMatch(needle);

  if (!normalizedNeedle) {
    return -1;
  }

  return haystack.findIndex((line) => normalizeLineForMatch(line) === normalizedNeedle);
}

function findSequence(haystack: string[], needle: string[], preferredIndex: number) {
  if (needle.length === 0) {
    return Math.max(0, Math.min(preferredIndex, haystack.length));
  }

  const searchFrom = Math.max(0, Math.min(preferredIndex, haystack.length));
  const windows = [
    ...Array.from({ length: Math.max(0, haystack.length - needle.length + 1) }, (_, offset) => offset),
  ];

  const preferredHit = windows.find((start) => {
    if (start !== searchFrom) {
      return false;
    }

    return needle.every((line, lineIndex) => haystack[start + lineIndex] === line);
  });

  if (typeof preferredHit === "number") {
    return preferredHit;
  }

  const exactHit = windows.find((start) => needle.every((line, lineIndex) => haystack[start + lineIndex] === line));

  return typeof exactHit === "number" ? exactHit : -1;
}

function applyUnifiedDiffToContent(originalContent: string, patch: string) {
  const { hasTrailingNewline, lines: originalLines } = splitContentLines(originalContent);
  const updatedLines = [...originalLines];
  const hunks = parseUnifiedDiffHunks(patch);

  for (const hunk of hunks) {
    const preferredIndex = Math.max(0, (hunk.oldStart ?? 1) - 1);
    const matchIndex = findSequence(updatedLines, hunk.oldLines, preferredIndex);

    if (matchIndex >= 0) {
      updatedLines.splice(matchIndex, hunk.oldLines.length, ...hunk.newLines);
      continue;
    }

    const removeLines = hunk.ops.filter((op) => op.type === "remove").map((op) => op.text);
    const addLines = hunk.ops.filter((op) => op.type === "add").map((op) => op.text);

    if (removeLines.length > 0) {
      let relaxedMatchIndex = -1;

      for (const removeLine of removeLines) {
        relaxedMatchIndex = findLineIndexRelaxed(updatedLines, removeLine);

        if (relaxedMatchIndex >= 0) {
          break;
        }
      }

      if (relaxedMatchIndex >= 0) {
        updatedLines.splice(relaxedMatchIndex, 1, ...addLines);
        continue;
      }
    }

    throw new Error("Could not locate the target lines for the generated patch.");
  }

  return renderContentLines(updatedLines, hasTrailingNewline);
}

async function resolveTargetFile(repoRoot: string, targetFile: string) {
  const normalizedTarget = normalizePatchPath(targetFile);
  const directCandidates = [
    path.resolve(repoRoot, normalizedTarget),
    path.resolve(repoRoot, normalizedTarget.replace(/^tests\//, "")),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const walk = async (dir: string): Promise<string | null> => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await walk(entryPath);

        if (found) {
          return found;
        }
      } else if (entry.isFile()) {
        const relativePath = path.relative(repoRoot, entryPath).replace(/\\/g, "/");

        if (relativePath.endsWith(normalizedTarget) || relativePath.endsWith(normalizedTarget.replace(/^tests\//, ""))) {
          return entryPath;
        }
      }
    }

    return null;
  };

  return walk(repoRoot);
}

export async function applyGeneratedPatch(
  repoRoot: string,
  generatedPatch: string,
  options: { targetFileHint?: string } = {},
) {
  const patch = stripAnsiEscapeCodes(stripMarkdownFences(generatedPatch));

  if (!isUnifiedDiff(patch)) {
    throw new Error("generated_patch must be a unified diff that git apply can understand.");
  }

  const git = simpleGit(repoRoot);
  const patchFile = path.join(
    os.tmpdir(),
    `ai-patch-${Date.now()}-${Math.random().toString(16).slice(2)}.patch`,
  );
  const targetFile = options.targetFileHint ? normalizePatchPath(options.targetFileHint) : extractTargetFile(patch);
  const resolvedTargetFile = await resolveTargetFile(repoRoot, targetFile);
  const patchToApply = sanitizeUnifiedDiffHeaders(
    resolvedTargetFile ? rewritePatchTargetPath(patch, path.relative(repoRoot, resolvedTargetFile)) : patch,
  );

  await fs.promises.writeFile(patchFile, patchToApply, "utf8");

  try {
    await git.raw(["apply", "--3way", "--whitespace=nowarn", patchFile]);
    return;
  } catch (error) {
    const absoluteTargetFile = resolvedTargetFile;

    if (!absoluteTargetFile) {
      throw error;
    }

    const originalContent = await fs.promises.readFile(absoluteTargetFile, "utf8");
    const updatedContent = applyUnifiedDiffToContent(originalContent, patchToApply);

    await fs.promises.writeFile(absoluteTargetFile, updatedContent, "utf8");
  } finally {
    await fs.promises.unlink(patchFile).catch(() => undefined);
  }
}
