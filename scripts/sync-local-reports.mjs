import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_SOURCE = "~/CoCwork/Reports";
const TARGET_DIR = path.resolve(process.cwd(), "reports-source");

function expandHomeDir(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function parseCliSourceArg(argv) {
  const byEquals = argv.find((arg) => arg.startsWith("--source="));
  if (byEquals) return byEquals.split("=").slice(1).join("=");
  const idx = argv.indexOf("--source");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return null;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath);
      return fullPath;
    })
  );
  return files.flat();
}

async function main() {
  const cliSource = parseCliSourceArg(process.argv.slice(2));
  const sourceRaw = cliSource || process.env.REPORTS_DIR || DEFAULT_SOURCE;
  const sourceDir = path.resolve(expandHomeDir(sourceRaw));

  const sourceStat = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new Error(`本地报告目录不存在: ${sourceDir}`);
  }

  const allFiles = await walkFiles(sourceDir);
  const filtered = allFiles.filter((fullPath) => {
    const name = path.basename(fullPath);
    return /^daily-insight-\d{4}-\d{2}-\d{2}\.(html|md)$/i.test(name);
  });

  await fs.rm(TARGET_DIR, { recursive: true, force: true });
  await fs.mkdir(TARGET_DIR, { recursive: true });

  for (const fullPath of filtered) {
    const name = path.basename(fullPath);
    await fs.copyFile(fullPath, path.join(TARGET_DIR, name));
  }

  console.log(`Synced ${filtered.length} file(s) -> ${TARGET_DIR}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
