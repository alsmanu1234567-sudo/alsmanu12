/**
 * core/health.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: فحص متطلبات النظام قبل تشغيل البوت.
 *
 * الفحوصات:
 *   • إصدار Node.js
 *   • الذاكرة الحرة
 *   • مسار ffmpeg
 *
 * تعتمد على: core/logger.mjs فقط.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import os from "os";
import { ok, wrn, err } from "./logger.mjs";

// ── المسارات المعروفة لـ ffmpeg ──────────────────────────────
const FFMPEG_PATHS = [
  "/nix/store/k28ypnisbhajg3x1kv5hy7h2vjbajkvy-replit-runtime-path/bin/ffmpeg",
  "/nix/store/krp1xgk77d2wgh49vavxv25bcb10m88z-replit-runtime-path/bin/ffmpeg",
  "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg",
  "/usr/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/run/current-system/sw/bin/ffmpeg",
];

// ── فحص إصدار Node.js ────────────────────────────────────────
/**
 * @param {number} minMajor — الحد الأدنى المقبول (افتراضي 18)
 */
export function checkNodeVersion(minMajor = 18) {
  const major = parseInt(process.version.slice(1));
  if (major < minMajor) {
    err(`Node.js ${process.version} قديم — مطلوب v${minMajor}+`);
  }
  ok("Node.js " + process.version);
}

// ── فحص الذاكرة الحرة ────────────────────────────────────────
/**
 * @param {number} minFreeMB — الحد الأدنى بالميغابايت (افتراضي 150)
 */
export function checkRAM(minFreeMB = 150) {
  const freeMB  = Math.floor(os.freemem()  / 1024 / 1024);
  const totalMB = Math.floor(os.totalmem() / 1024 / 1024);

  if (freeMB < minFreeMB) {
    wrn(`الذاكرة المتاحة منخفضة: ${freeMB}MB من ${totalMB}MB`);
    wrn("   قد يفشل تحميل الملفات الكبيرة — يُنصح بإعادة التشغيل");
  } else {
    ok(`RAM: ${freeMB}MB متاح من ${totalMB}MB`);
  }
}

// ── الكشف عن ffmpeg وتسجيله في process.env ──────────────────
/**
 * يبحث في المسارات المعروفة ثم في PATH.
 * @returns {string|null} المسار الكامل أو null
 */
export function detectFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    ok("ffmpeg: " + process.env.FFMPEG_PATH + " (من البيئة)");
    return process.env.FFMPEG_PATH;
  }

  for (const candidate of FFMPEG_PATHS) {
    if (existsSync(candidate)) {
      process.env.FFMPEG_PATH = candidate;
      ok("ffmpeg: " + candidate);
      return candidate;
    }
  }

  try {
    const fp = execSync("which ffmpeg 2>/dev/null", { timeout: 3000 })
      .toString().trim();
    if (fp && existsSync(fp)) {
      process.env.FFMPEG_PATH = fp;
      ok("ffmpeg: " + fp + " (من PATH)");
      return fp;
    }
  } catch {}

  wrn("ffmpeg: غير موجود — تحويل الستيكر/الصوت سيتعطل");
  return null;
}

// ── تقرير صحة النظام كامل ────────────────────────────────────
/**
 * يُشغّل جميع الفحوصات بالتسلسل.
 * @param {{ minNode?: number, minRAM?: number }} opts
 */
export function runAllChecks(opts = {}) {
  checkNodeVersion(opts.minNode ?? 18);
  checkRAM(opts.minRAM ?? 150);
  detectFfmpeg();
}
