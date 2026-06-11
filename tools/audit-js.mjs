import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const jsFiles = walk(join(root, "js")).filter((file) => file.endsWith(".js"));
const toolFiles = walk(join(root, "tools")).filter((file) => file.endsWith(".mjs"));
const issues = [];

for (const file of [...jsFiles, ...toolFiles]) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) issues.push(`${relative(file)}\n${result.stderr.trim()}`);
}

if (existsSync(join(root, "realtime-kanban"))) {
  issues.push("duplicated realtime-kanban folder exists at project root");
}

for (const doc of ["README.md", "ARCHITECTURE.md", "MIGRATION_CHECKLIST.md"]) {
  if (!existsSync(join(root, doc))) issues.push(`${doc} is missing`);
}

report(issues, "js audit passed");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function relative(file) {
  return file.replace(`${root}/`, "");
}

function report(found, success) {
  if (!found.length) {
    console.log(success);
    process.exit(0);
  }
  console.error(found.join("\n\n"));
  process.exit(1);
}
