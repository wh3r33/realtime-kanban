import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const issues = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const body = html.match(/<body\b[^>]*>/i)?.[0] || "";
  if (!/\bdata-route=/.test(body)) issues.push(`${relative(file)} missing body[data-route]`);
  if (!/\bdata-page=/.test(body)) issues.push(`${relative(file)} missing body[data-page]`);

  const scoped = body.match(/data-route=["']\/boards\/:boardId[^"']*["']/);
  if (scoped) {
    const expected = ["board", "activity", "members", "settings"];
    for (const route of expected) {
      if (!html.includes(`data-board-route="${route}"`)) {
        issues.push(`${relative(file)} missing data-board-route="${route}"`);
      }
    }
  }
}

const docs = ["README.md", "ARCHITECTURE.md", "MIGRATION_CHECKLIST.md"];
for (const doc of docs) {
  try {
    const text = readFileSync(join(root, doc), "utf8");
    if (!text.trim()) issues.push(`${doc} is empty`);
  } catch {
    issues.push(`${doc} is missing`);
  }
}

report(issues, "route metadata audit passed");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if ([".git", ".idea", ".venv", "node_modules"].includes(entry)) return [];
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
  console.error(found.join("\n"));
  process.exit(1);
}
