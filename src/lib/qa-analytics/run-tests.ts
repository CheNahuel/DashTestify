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
  progress: number;
  currentStep: number | null;
  totalSteps: number | null;
  message: string;
  log: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
};

const repoRoot = process.cwd();
const runStatePath = path.join(os.tmpdir(), "dash-testify-qa-analytics", "run-tests-state.json");

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

function createInitialState(mode: QaAnalyticsRunMode): QaAnalyticsRunState {
  return {
    jobId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode,
    status: "running",
    progress: 0,
    currentStep: null,
    totalSteps: null,
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
  return readJsonFile<QaAnalyticsRunState>(runStatePath);
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

  const updateStateFromOutput = async (chunk: Buffer | string) => {
    const text = stripAnsi(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    const nextLog = `${state.log}${text}`;
    const progress = extractProgress(nextLog);

    state.log = nextLog.slice(-12000);
    state.progress = Math.max(state.progress, progress.progress);
    state.currentStep = progress.currentStep;
    state.totalSteps = progress.totalSteps;
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
    state.progress = code === 0 ? 100 : state.progress;
    state.finishedAt = finishedAt;
    state.exitCode = code;
    state.message = code === 0 ? "Test run completed successfully." : `Test run failed with exit code ${code}.`;
    state.log = state.log.slice(-12000);

    void persistState(state);
  });

  child.on("error", (error) => {
    state.status = "failed";
    state.finishedAt = new Date().toISOString();
    state.exitCode = null;
    state.message = error.message;
    state.log = `${state.log}\n${error.stack || error.message}`.trim();

    void persistState(state);
  });

  return { state, started: true as const };
}

