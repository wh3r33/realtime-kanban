import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const root = process.cwd();
const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const issues = [];

for (const file of htmlFiles) {
  const html = await read(file);
  const refs = [
    ...matches(html, /\b(?:href|src)=["']([^"']+)["']/g),
    ...matches(html, /url\(["']?([^"')]+)["']?\)/g)
  ];
  for (const ref of refs) {
    if (isExternal(ref) || ref.startsWith("#") || ref.startsWith("mailto:") || ref.startsWith("tel:")) continue;
    const [cleanRef] = ref.split(/[?#]/);
    if (!cleanRef) continue;
    const target = normalize(join(dirname(file), cleanRef));
    if (!existsSync(target)) issues.push(`${relative(file)} -> missing ${ref}`);
  }
}

const duplicateRoot = join(root, "realtime-kanban");
if (existsSync(duplicateRoot)) issues.push("duplicated realtime-kanban folder exists at project root");

report(issues, "link/assets audit passed");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if ([".git", ".idea", ".venv", "node_modules"].includes(entry)) return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function read(file) {
  return await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"));
}

function matches(text, pattern) {
  return Array.from(text.matchAll(pattern), (match) => match[1]);
}

function isExternal(ref) {
  return /^(?:https?:)?\/\//.test(ref) || ref.startsWith("data:");
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
