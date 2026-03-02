import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { marked } from "marked";

const DEFAULT_SOURCE = "~/CoCwork/Reports";
const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.join(ROOT_DIR, "dist");
const REPORTS_DIR = path.join(DIST_DIR, "reports");
const TEMPLATE_PATH = path.join(ROOT_DIR, "src", "template", "index.html");

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

function extractDateFromFileName(fileName) {
  const match = fileName.match(/^daily-insight-(\d{4}-\d{2}-\d{2})\.(html|md)$/i);
  if (!match) return null;
  return { date: match[1], ext: match[2].toLowerCase() };
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

async function ensureCleanDist() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

function toHtmlDocument(title, bodyContent) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 24px auto;
      max-width: 980px;
      padding: 0 16px 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      color: #111827;
      background: #ffffff;
    }
    img { max-width: 100%; }
    pre {
      overflow-x: auto;
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

async function main() {
  const cliSource = parseCliSourceArg(process.argv.slice(2));
  const sourceRaw = cliSource || process.env.REPORTS_DIR || DEFAULT_SOURCE;
  const sourceDir = path.resolve(expandHomeDir(sourceRaw));

  const sourceStat = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new Error(`数据源目录不存在或不可读: ${sourceDir}`);
  }

  const allFiles = await walkFiles(sourceDir);
  const targetFiles = allFiles.filter((filePath) => /\.(html|md)$/i.test(filePath));

  const reportByDate = new Map();
  for (const filePath of targetFiles) {
    const fileName = path.basename(filePath);
    const parsed = extractDateFromFileName(fileName);
    if (!parsed) continue;

    const current = reportByDate.get(parsed.date);
    if (!current) {
      reportByDate.set(parsed.date, { ...parsed, filePath });
      continue;
    }

    // 同一天同时存在 md 和 html 时，优先使用 html。
    if (current.ext !== "html" && parsed.ext === "html") {
      reportByDate.set(parsed.date, { ...parsed, filePath });
    }
  }

  const reports = [...reportByDate.entries()]
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => b.date.localeCompare(a.date));

  await ensureCleanDist();

  for (const item of reports) {
    const raw = await fs.readFile(item.filePath, "utf8");
    const outputPath = path.join(REPORTS_DIR, `${item.date}.html`);

    if (item.ext === "html") {
      await fs.writeFile(outputPath, raw, "utf8");
    } else {
      const converted = marked.parse(raw);
      const wrapped = toHtmlDocument(`Report ${item.date}`, converted);
      await fs.writeFile(outputPath, wrapped, "utf8");
    }
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    sourceDir,
    total: reports.length,
    reports: reports.map((r) => ({
      date: r.date,
      path: `./reports/${r.date}.html`
    }))
  };

  const template = await fs.readFile(TEMPLATE_PATH, "utf8");
  await fs.writeFile(path.join(DIST_DIR, "index.html"), template, "utf8");
  await fs.writeFile(path.join(DIST_DIR, "reports.json"), JSON.stringify(metadata, null, 2), "utf8");

  console.log(`Build done: ${reports.length} report(s) -> ${DIST_DIR}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
