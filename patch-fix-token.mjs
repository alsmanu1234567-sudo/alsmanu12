// PATCH: إصلاح ${token} الحرفية في index.mjs
// يستبدل النص الحرفي "${token}" بالتوكن الفعلي
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/index.mjs");
const GUARD = "PATCH_FIX_TOKEN_APPLIED";

let c = readFileSync(DIST, "utf8");
if (c.includes(GUARD)) { console.log("ℹ️  باتش (مطبّق سابقاً): إصلاح ${token} الحرفية"); process.exit(0); }

const REAL_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8648687130:AAHjEUZibwFPlToGwS65bHRGnwzPOQ91CDY";
const REAL_DEV   = process.env.DEVELOPER_ID       || "7428421245";

let fixes = 0;

// إصلاح ${token} الحرفية
const old1 = 'process.env.TELEGRAM_BOT_TOKEN = "${token}";';
const new1 = `process.env.TELEGRAM_BOT_TOKEN = "${REAL_TOKEN}"; // ${GUARD}`;
if (c.includes(old1)) { c = c.replaceAll(old1, new1); fixes++; }

// إصلاح ${devId} الحرفية
const old2 = 'process.env.DEVELOPER_ID       = "${devId}";';
const new2 = `process.env.DEVELOPER_ID       = "${REAL_DEV}";`;
if (c.includes(old2)) { c = c.replaceAll(old2, new2); fixes++; }

// نفس الأنماط بدون مسافات إضافية
const old3 = 'process.env.DEVELOPER_ID = "${devId}";';
const new3 = `process.env.DEVELOPER_ID = "${REAL_DEV}";`;
if (c.includes(old3)) { c = c.replaceAll(old3, new3); fixes++; }

if (fixes > 0) {
  writeFileSync(DIST, c, "utf8");
  console.log(`✅ باتش (${fixes} تعديل): إصلاح ${"{"}token${"}"} الحرفية`);
} else {
  console.log("ℹ️  باتش (0 تعديل): إصلاح ${token} الحرفية (لم يعثر على النمط)");
}
