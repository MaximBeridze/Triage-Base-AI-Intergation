import {
  mkdir,
  writeFile,
  rename,
  readdir,
  readFile,
  appendFile,
} from "node:fs/promises";
import path from "node:path";
import type { Run } from "./runs";
const root = process.env.TRIAGE_STORAGE_DIR || process.cwd();
const directory = path.join(root, "runs");
export async function saveRun(run: Run) {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${run.id}.json`);
  await writeFile(target + ".tmp", JSON.stringify(run, null, 2));
  // Windows readers/antivirus can briefly lock the destination during replace.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(target + ".tmp", target);
      break;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : "";
      if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY"].includes(String(code)))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
export async function listRuns(): Promise<Run[]> {
  await mkdir(directory, { recursive: true });
  const names = (await readdir(directory)).filter((n) =>
    /^[a-f0-9-]+\.json$/.test(n),
  );
  const runs: Run[] = [];
  for (const name of names) {
    // A corrupt local file must not hide the remaining run history.
    try {
      const run = JSON.parse(
        await readFile(path.join(directory, name), "utf8"),
      );
      if (run.id && Array.isArray(run.rows) && run.summary) runs.push(run);
    } catch {
      console.warn("Skipped unreadable run file:", name);
    }
  }
  return runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function logCall(value: object) {
  await mkdir(path.join(root, "logs"), { recursive: true });
  await appendFile(
    path.join(root, "logs", "llm-calls.jsonl"),
    JSON.stringify(value) + "\n",
  );
}
