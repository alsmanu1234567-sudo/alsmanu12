#!/usr/bin/env node
/**
 * تنظيف آمن لمخلفات هذا البوت فقط.
 * المعاينة: node bootstrap/cleanup.mjs --dry-run
 * التنفيذ:  node bootstrap/cleanup.mjs --confirm CLEAN_BOT
 * مسح بيانات runtime أيضاً: أضف --purge-data --confirm-data DELETE_BOT_DATA
 */
import { existsSync, readdirSync, realpathSync, rmSync, statSync } from "fs";
import { dirname, join, relative, resolve, sep } from "path";
import { fileURLToPath } from "url";

const BASE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const purgeData = process.argv.includes("--purge-data");
const confirm = process.argv.includes("--confirm") && process.argv.includes("CLEAN_BOT");
const confirmData = process.argv.includes("--confirm-data") && process.argv.includes("DELETE_BOT_DATA");

const CACHE_TARGETS = [
  ".runtime",
  ".cache",
  ".npm",
  "tmp",
  "temp",
  "downloads",
  "coverage",
  ".nyc_output",
  "logs",
  "npm-debug.log",
  "pnpm-debug.log",
  "yarn-error.log",
];
const DATA_TARGETS = ["data", "auth_info", "sessions", "session", "baileys_auth_info"];

function insideProject(target) {
  const root = existsSync(BASE_DIR) ? realpathSync(BASE_DIR) : BASE_DIR;
  const absolute = resolve(target);
  return absolute !== root && absolute.startsWith(root + sep);
}

function sizeOf(target) {
  try {
    const stat = statSync(target, { throwIfNoEntry: false });
    if (!stat) return 0;
    if (!stat.isDirectory()) return stat.size;
    return readdirSync(target).reduce((sum, name) => sum + sizeOf(join(target, name)), 0);
  } catch { return 0; }
}

function format(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function collect(names) {
  return names.map((name) => join(BASE_DIR, name)).filter(existsSync);
}

const targets = collect([...CACHE_TARGETS, ...(purgeData ? DATA_TARGETS : [])]);
let total = 0;
for (const target of targets) {
  if (!insideProject(target)) throw new Error(`رفض مسار خارج المشروع: ${target}`);
  const bytes = sizeOf(target);
  total += bytes;
  console.log(`${dryRun ? "[معاينة]" : "[حذف]"} ${relative(BASE_DIR, target)} (${format(bytes)})`);
}

if (dryRun) {
  console.log(`الإجمالي المتوقع: ${format(total)}`);
  process.exit(0);
}
if (!confirm) {
  console.error("رفض التنفيذ: استخدم --confirm CLEAN_BOT أو ابدأ بـ --dry-run.");
  process.exit(2);
}
if (purgeData && !confirmData) {
  console.error("رفض مسح البيانات: أضف --confirm-data DELETE_BOT_DATA.");
  process.exit(3);
}
for (const target of targets) rmSync(target, { recursive: true, force: true });
console.log(`اكتمل تنظيف ${targets.length} مساراً وتحرير نحو ${format(total)}.`);
