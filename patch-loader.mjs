#!/usr/bin/env node
/**
 * patch-loader.mjs — إصلاح قسم التنزيل في dist/index.mjs
 *
 * ما يفعله:
 *  1. إصلاح مسار ffmpeg (يُضيف المسار الجديد + يجرب which)
 *  2. تقليل timeout لـ loader.to (من 3 دقائق إلى 12 ثانية)
 *     حتى ينتقل سريعاً إلى yt-dlp
 *
 * استخدام: node patch-loader.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G="\x1b[32m", Y="\x1b[33m", N="\x1b[0m";
const ok  = m => console.log(G+"✅ "+m+N);
const wrn = m => console.log(Y+"⚠️  "+m+N);

if (!fs.existsSync(FILE)) { console.error("dist/index.mjs غير موجود"); process.exit(1); }
let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

// ── Guard ──────────────────────────────────────────────────────
const LOADER_GUARD = "// PATCH_LOADER_APPLIED_v1";
if (code.includes(LOADER_GUARD)) {
  ok("patch-loader: مُطبَّق مسبقاً — تخطّي");
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════
// PATCH 1: إصلاح مسار ffmpeg — إضافة المسار الجديد للنيكس
// ══════════════════════════════════════════════════════════════
patch(
  `_ffmpegPath = await findBinary("ffmpeg", [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg",
    "/home/container/ffmpeg",
    // Pterodactyl
    "/opt/ffmpeg"
  ]);`,
  `_ffmpegPath = await findBinary("ffmpeg", [
    // PATCH_LOADER_APPLIED_v1
    process.env.FFMPEG_PATH || "",
    "/nix/store/krp1xgk77d2wgh49vavxv25bcb10m88z-replit-runtime-path/bin/ffmpeg",
    "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/home/container/ffmpeg",
    "/opt/ffmpeg"
  ].filter(Boolean));`,
  "إصلاح مسار ffmpeg (إضافة المسار الجديد)"
);

// ══════════════════════════════════════════════════════════════
// PATCH 2: تقليل timeout لـ loader.to (من 12e4 إلى 12e3)
// المشكلة: loader.to معطل ويُرجع خطأً فورياً لكن
//           الـ fallback يحتاج انتظار timeout أحياناً
// ══════════════════════════════════════════════════════════════

// في video download: loaderToDownload(v.url, loaderFmt, 18e4)
patch(
  `const buffer = await loaderToDownload(v.url, loaderFmt, 18e4);`,
  `const buffer = await loaderToDownload(v.url, loaderFmt, 12e3);`,
  "تقليل timeout loader.to للفيديو (18min → 12sec)"
);

// في audio download: loaderToDownload(v.url, "mp3", 18e4)
patch(
  `const buffer = await loaderToDownload(v.url, "mp3", 18e4);`,
  `const buffer = await loaderToDownload(v.url, "mp3", 12e3);`,
  "تقليل timeout loader.to للصوت (18min → 12sec)"
);

// ══════════════════════════════════════════════════════════════
// PATCH 3: تقليل AbortSignal timeout في loaderToDownload start
// ══════════════════════════════════════════════════════════════
patch(
  `"https://loader.to/ajax/download.php?url=" + encodeURIComponent(ytUrl) + "&format=" + format + "&lang=en",
    { headers: { "User-Agent": UA2, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(3e4) }`,
  `"https://loader.to/ajax/download.php?url=" + encodeURIComponent(ytUrl) + "&format=" + format + "&lang=en",
    { headers: { "User-Agent": UA2, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(8e3) }`,
  "تقليل timeout loader.to start request (30s → 8s)"
);

// ══════════════════════════════════════════════════════════════
// حفظ
// ══════════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "✅ تم حفظ " + patches + " تعديل على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي تعديل" + N + "\n");
}
