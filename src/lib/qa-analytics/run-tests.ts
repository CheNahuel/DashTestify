import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export type QaAnalyticsRunMode = "mock" | "live";
export type QaAnalyticsRunStatus = "idle" | "running" | "success" | "failed";

export type QaAnalyticsRunState = {
  jobId: string;
  mode: QaAnalyticsRunMode;
  status: QaAnalyticsRunStatus;
  ownerPid?: number | null;
  pid?: number | null;
  isStale?: boolean;
  progress: number;
  currentStep: number | null;
  totalSteps: number | null;
  currentTestLabel: string | null;
  message: string;
  log: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
};

const repoRoot = process.cwd();
const runStatePath = path.join(os.tmpdir(), "dash-testify-qa-analytics", "run-tests-state.json");
const staleRunningGraceMs = 30_000;

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function deleteJsonFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing files.
  }
}

async function readRunStateFile() {
  return readJsonFile<QaAnalyticsRunState>(runStatePath);
}

function stripAnsi(value: string) {
  return value.replace(
    /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}

function extractProgress(log: string) {
  const matches = [...log.matchAll(/\[(\d+)\/(\d+)\]/g)];

  if (matches.length === 0) {
    return { currentStep: null, totalSteps: null, progress: 0 };
  }

  const last = matches[matches.length - 1];
  const currentStep = Number.parseInt(last[1], 10);
  const totalSteps = Number.parseInt(last[2], 10);

  if (!Number.isFinite(currentStep) || !Number.isFinite(totalSteps) || totalSteps <= 0) {
    return { currentStep: null, totalSteps: null, progress: 0 };
  }

  return {
    currentStep,
    totalSteps,
    progress: Math.max(0, Math.min(100, Math.round((currentStep / totalSteps) * 100))),
  };
}

function lastMeaningfulLine(log: string) {
  const lines = stripAnsi(log)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) || "";
}

function extractCurrentTestLabel(log: string) {
  const lines = stripAnsi(log)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const match = line.match(/›\s*(.+)$/);

    if (match?.[1] && line.includes("[") && line.includes("]") && line.includes("›")) {
      return match[1].trim();
    }
  }

  return null;
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function createInitialState(mode: QaAnalyticsRunMode): QaAnalyticsRunState {
  return {
    jobId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode,
    status: "running",
    ownerPid: process.pid,
    pid: null,
    progress: 0,
    currentStep: null,
    totalSteps: null,
    currentTestLabel: null,
    message: `Starting ${mode === "live" ? "e2e live" : "e2e mock"} run...`,
    log: "",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
  };
}

async function persistState(state: QaAnalyticsRunState) {
  await writeJsonFile(runStatePath, state);
}

export async function readQaAnalyticsRunState() {
  const state = await readRunStateFile();

  if (!state) {
    return null;
  }

  if (state.status === "success" || state.status === "failed") {
    return {
      ...state,
      pid: null,
    };
  }

  if (state.status === "running") {
    const pid = typeof state.pid === "number" ? state.pid : null;
    const startedAt = new Date(state.startedAt).getTime();
    const isRecent = Number.isFinite(startedAt) && Date.now() - startedAt < staleRunningGraceMs;

    if ((pid && isProcessAlive(pid)) || (!pid && isRecent)) {
      return state;
    }

    await deleteJsonFile(runStatePath);

    return {
      ...state,
      status: "failed",
      pid: null,
      isStale: true,
      progress: 100,
      finishedAt: new Date().toISOString(),
      exitCode: null,
      currentTestLabel: null,
      message: "Previous test run appears to have been interrupted. You can start a new run.",
    };
  }

  return state;
}

export async function abortQaAnalyticsRun() {
  const state = await readRunStateFile();

  if (!state) {
    return { aborted: false as const };
  }

  if (state.status === "running") {
    const pid = typeof state.pid === "number" ? state.pid : null;
    const ownerPid = typeof state.ownerPid === "number" ? state.ownerPid : null;

    if (pid && ownerPid === process.pid && isProcessAlive(pid) && pid !== process.pid) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Ignore process races during shutdown.
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (isProcessAlive(pid)) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Ignore if the process already exited.
        }
      }
    }
  }

  await deleteJsonFile(runStatePath);

  return { aborted: true as const };
}

export async function startQaAnalyticsRun(mode: QaAnalyticsRunMode) {
  const currentState = await readQaAnalyticsRunState();

  if (currentState?.status === "running") {
    return { state: currentState, started: false as const };
  }

  const state = createInitialState(mode);
  await persistState(state);

  const script = mode === "live" ? "test:e2e:live" : "test:e2e";
  const child = spawn("npm", ["run", script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  state.pid = child.pid ?? null;
  await persistState(state);

  const updateStateFromOutput = async (chunk: Buffer | string) => {
    const text = stripAnsi(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    const nextLog = `${state.log}${text}`;
    const progress = extractProgress(nextLog);

    state.log = nextLog.slice(-12000);
    state.progress = Math.max(state.progress, progress.progress);
    state.currentStep = progress.currentStep;
    state.totalSteps = progress.totalSteps;
    state.currentTestLabel = extractCurrentTestLabel(nextLog) || state.currentTestLabel;
    state.message = lastMeaningfulLine(nextLog) || state.message;

    await persistState(state);
  };

  child.stdout.on("data", (chunk) => {
    void updateStateFromOutput(chunk);
  });

  child.stderr.on("data", (chunk) => {
    void updateStateFromOutput(chunk);
  });

  child.on("close", (code) => {
    const finishedAt = new Date().toISOString();
    state.status = code === 0 ? "success" : "failed";
    state.pid = null;
    state.progress = code === 0 ? 100 : state.progress;
    state.finishedAt = finishedAt;
    state.exitCode = code;
    state.currentTestLabel = null;
    state.message = code === 0 ? "Test run completed successfully." : `Test run failed with exit code ${code}.`;
    state.log = state.log.slice(-12000);

    void persistState(state);
  });

  child.on("error", (error) => {
    state.status = "failed";
    state.pid = null;
    state.finishedAt = new Date().toISOString();
    state.exitCode = null;
    state.currentTestLabel = null;
    state.message = error.message;
    state.log = `${state.log}\n${error.stack || error.message}`.trim();

    void persistState(state);
  });

  return { state, started: true as const };
}
