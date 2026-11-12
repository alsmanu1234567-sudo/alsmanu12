/**
 * infrastructure/process-manager.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: إدارة دورة حياة عملية البوت (child process).
 *
 * العمليات:
 *   • التحقق من وجود dist/index.mjs
 *   • إطلاق البوت كعملية فرعية (spawn) مع إعادة تشغيل تلقائية
 *   • إخطار المراقب (engine) بتغيرات الحالة
 *   • تحديد الحد الأقصى لإعادات التشغيل لمنع حلقة لا نهائية
 *
 * تعتمد على: core/logger.mjs
 * Exports: spawnBot, validateEntry
 */

import { spawn }     from "child_process";
import { existsSync } from "fs";
import { join }      from "path";
import { ok, wrn, logErr } from "../core/logger.mjs";

const MAX_RESTARTS   = 10;         // حد أقصى لإعادات التشغيل في الجلسة
const RESTART_DELAY  = 3_000;      // 3 ثوانٍ انتظار بين كل إعادة تشغيل

// ── التحقق من ملف الدخول ─────────────────────────────────────
/**
 * @param {string} baseDir
 * @returns {string} مسار dist/index.mjs
 */
export function validateEntry(baseDir) {
  const entry = join(baseDir, "dist", "index.mjs");
  if (!existsSync(entry)) {
    // نستخدم console.error مباشرة لأن err() يوقف العملية
    // وهنا نريد أن نُعيد القيمة ونتعامل معها في bootstrap
    throw new Error("dist/index.mjs غير موجود — شغّل deploy.mjs أولاً");
  }
  return entry;
}

// ── إطلاق عملية البوت ────────────────────────────────────────
/**
 * يطلق dist/index.mjs كعملية فرعية مع إعادة تشغيل تلقائية عند الخروج.
 *
 * @param {string}   baseDir    — جذر المشروع
 * @param {object}   [options]
 * @param {Function} [options.onSpawn]   — callback(child) عند كل إطلاق جديد
 * @param {Function} [options.onExit]    — callback(code, signal) عند الخروج
 * @param {boolean}  [options.autoRestart=true] — إعادة التشغيل التلقائية
 * @returns {{ getChild: Function, stop: Function }}
 */
export function spawnBot(baseDir, options = {}) {
  const { onSpawn = null, onExit = null, autoRestart = true } = options;

  let entry;
  try {
    entry = validateEntry(baseDir);
  } catch (e) {
    logErr(e.message);
    process.exit(1);
  }

  let child        = null;
  let restartCount = 0;
  let stopped      = false;

  function launch() {
    if (stopped) return;

    ok(`🚀 تشغيل البوت... (محاولة ${restartCount + 1})\n`);

    child = spawn(
      "node",
      ["--enable-source-maps", entry],
      { cwd: baseDir, stdio: "inherit", env: process.env }
    );

    if (onSpawn) onSpawn(child);

    child.on("error", e => logErr(`خطأ في العملية: ${e.message}`));

    child.on("exit", (code, signal) => {
      if (onExit) onExit(code, signal);

      if (stopped) return;

      // خروج طبيعي بكود 0 — لا إعادة تشغيل
      if (code === 0) {
        process.exit(0);
        return;
      }

      // إعادة تشغيل تلقائية (عند crash أو SIGTERM من recovery manager)
      if (autoRestart && restartCount < MAX_RESTARTS) {
        restartCount++;
        const exitInfo = code !== null ? `exit=${code}` : `signal=${signal}`;
        wrn(`⚠️  البوت توقف (${exitInfo}) — إعادة التشغيل ${restartCount}/${MAX_RESTARTS} بعد ${RESTART_DELAY}ms`);
        setTimeout(launch, RESTART_DELAY);
      } else if (restartCount >= MAX_RESTARTS) {
        logErr(`🛑 حُدِّد الحد الأقصى (${MAX_RESTARTS} إعادة) — إيقاف نهائي`);
        process.exit(code ?? 1);
      } else {
        process.exit(code ?? 1);
      }
    });
  }

  launch();

  return {
    /** يُعيد مرجع العملية الفرعية الحالية. */
    getChild: () => child,
    /** يُوقف إعادة التشغيل التلقائية وينهي العملية. */
    stop: () => {
      stopped = true;
      if (child) child.kill("SIGTERM");
    },
  };
}
