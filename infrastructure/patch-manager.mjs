/**
 * infrastructure/patch-manager.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: إدارة سجل تعديلات dist/ وتطبيقها بالترتيب.
 *
 * كل تعديل له:
 *   • file  — اسم الملف نسبةً إلى جذر المشروع
 *   • desc  — وصف مختصر لما يفعله
 *
 * القواعد:
 *   • كل تعديل يحتوي على حارس (guard) يمنع التطبيق المزدوج.
 *   • الفشل في تعديل واحد لا يوقف البقية.
 *   • النتيجة: ok / تخطي / تحذير.
 *
 * تعتمد على: core/logger.mjs
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { ok, wrn, inf, section } from "../core/logger.mjs";

// ── سجل التعديلات — مرتبة حسب الاعتماد (dependency order) ──
const PATCH_REGISTRY = [
  { file: "patch-cod.mjs",               desc: "/cod لربط واتسآب" },
  { file: "patch-fixes.mjs",             desc: "إصلاحات cod + تيليجرام" },
  { file: "patch-download.mjs",          desc: "تنزيل vid/song/film/tiktok" },
  { file: "patch-loader.mjs",            desc: "إصلاح ffmpeg + loader.to timeout" },
  { file: "patch-mymsgs.mjs",            desc: "رسائلي: أوامر إدارة الأكواد والحالات وصيانة الميزات" },
  { file: "patch-video-fix.mjs",         desc: "إصلاح تنزيل vid/song/film: cobalt+timeout+RAM" },
  { file: "patch-dl-v3.mjs",             desc: "إصلاح شامل v3: smartSearch+cobalt-API+y2mate" },
  { file: "patch-film-v4.mjs",           desc: "فيلم v4: downloadMovieSmart+جودات+ضغط تلقائي" },
  { file: "patch-github-token.mjs",      desc: "إدارة GitHub Token: تعيين+حذف+تشفير" },
  { file: "patch-github-v2.mjs",         desc: "GitHub Token v2: AES-256 + قراءة من config.json" },
  { file: "patch-new-features.mjs",      desc: "أكواد خاصة+ساحر+معالج WA+/حالة" },
  { file: "patch-new-features-2.mjs",    desc: "زر قائمة+شريط تقدم vid/tiktok/song" },
  { file: "patch-fixes-v2.mjs",          desc: "مزامنة جهات الاتصال" },
  { file: "patch-fixes-v3.mjs",          desc: "عرض حالات+نماذج ذكاء فوراً" },
  { file: "patch-clone-direct.mjs",      desc: "نسخ البوت مباشر بدون أسئلة" },
  { file: "patch-del-append.mjs",        desc: "تتبع ردود البوت (append) للحذف" },
  { file: "patch-fix-clone-url.mjs",     desc: "إصلاح URL النسخ: حذف /bot" },
  { file: "patch-multi-number.mjs",      desc: "إصلاح الأرقام المتعددة: كل رقم بإعداداته" },
  { file: "patch-all-fixes-v1.mjs",      desc: "إصلاحات شاملة: بث+ردود+فيديو+دليل AI+كود أجزاء" },
  { file: "patch-bugfix-final.mjs",      desc: "إصلاح حد كل شخص / 8 ساعات + فيلم URL مباشر" },
  { file: "patch-stream-dl.mjs",         desc: "بث مباشر YouTube→WhatsApp: صفر ملفات" },
  { file: "patch-stream-dl-v2.mjs",      desc: "stream-dl v2: directUrl+جودات صحيحة+offset" },
  { file: "patch-auto-reply-split.mjs",  desc: "فصل الردود التلقائية إلى dist/auto-reply.mjs" },
  { file: "patch-mymsgs-split.mjs",      desc: "فصل رسائلي إلى dist/my-msgs.mjs" },
  { file: "patch-status-split.mjs",      desc: "فصل الحالات إلى dist/status.mjs" },
  { file: "patch-calls-split.mjs",       desc: "فصل المكالمات إلى dist/calls.mjs" },
  { file: "patch-reports-split.mjs",     desc: "فصل البلاغات إلى dist/reports.mjs" },
  { file: "patch-persons-split.mjs",     desc: "فصل الأشخاص إلى dist/persons.mjs" },
  { file: "patch-ai-split.mjs",          desc: "فصل الذكاء الاصطناعي إلى dist/ai.mjs" },
  { file: "patch-groups-split.mjs",      desc: "فصل المجموعات إلى dist/groups.mjs" },
  { file: "patch-fix-token.mjs",         desc: "إصلاح التوكن الحرفي ${token}" },
  { file: "patch-per-user-limit-fix.mjs",desc: "إصلاح زر حد كل شخص / 8 ساعات" },
  { file: "patch-translate-v3.mjs",      desc: "تحسين الترجمة v3: Google + رد على رسالة" },
  { file: "patch-forward-hook.mjs",      desc: "قسم التحويل: ربط forward.mjs بـ index.mjs" },
  { file: "patch-master-fix.mjs",        desc: "الإصلاح الشامل: جلسات+GitHub+god_reconnect" },
  { file: "patch-security-split.mjs",        desc: "فصل الأمان والخصوصية إلى dist/security.mjs" },
  { file: "patch-schedule-split.mjs",        desc: "فصل الرسائل المجدولة إلى dist/schedule.mjs" },
  { file: "patch-bridge-split.mjs",          desc: "فصل الجسر الذكي إلى dist/bridge.mjs" },
  // ── Phase 3 — Worker Manager & Message Routing Refactor ──────────────────
  { file: "patch-worker-manager-split.mjs",  desc: "Phase 3: استخراج WorkerManager → dist/worker-manager.mjs" },
  { file: "patch-keepalive-split.mjs",       desc: "Phase 3: استخراج Keepalive Watchdog → dist/keepalive.mjs" },
  { file: "patch-daily-report-split.mjs",    desc: "Phase 3: استخراج التقرير اليومي → dist/daily-report.mjs" },
  { file: "patch-router-init.mjs",           desc: "Phase 3: تهيئة Message Router & Dispatcher في dist/index.mjs" },
  // ── Phase 4 — Message Router & Dispatcher Activation ─────────────────────
  { file: "patch-phase4-activate.mjs",       desc: "Phase 4: تفعيل Router & Dispatcher — نقطة الدخول الوحيدة للرسائل والـ callbacks" },
  { file: "patch-voice-convert.mjs",         desc: "رسائلي: صوت←نص (/نص) ونص←صوت (/صوت) عبر FreeTTS.org" },
  { file: "patch-fix-bot-username-grant.mjs", desc: "إصلاح ReferenceError في BOT_USERNAME (رابط الإحالة/شراء الميزات) + التحقق من صحة الفئة في /grant_feature" },
  { file: "patch-fix-voice-audio.mjs",         desc: "إصلاح صيغة الصوت الحقيقية (OGG/Opus عبر ffmpeg) + دعم /صوت المباشر بدون رد + مهلة زمنية لتفريغ الصوت" },
];

// ── تطبيق تعديل واحد ─────────────────────────────────────────
function applyOne(baseDir, { file, desc }) {
  const pf = join(baseDir, file);

  if (!existsSync(pf)) {
    inf(`تعديل غير موجود (اختياري): ${file}`);
    return { status: "missing" };
  }

  try {
    const out = execSync(`node ${JSON.stringify(pf)}`, {
      cwd: baseDir,
      stdio: "pipe",
      timeout: 30_000,
    }).toString();

    const applied = (out.match(/✅/g) || []).length;
    const alreadyApplied =
      out.includes("مُطبَّق سابقاً") ||
      out.includes("already applied") ||
      out.includes("لم يُطبَّق أي تعديل");

    if (alreadyApplied && applied <= 1) {
      inf(`تعديل (مطبّق سابقاً): ${desc}`);
      return { status: "skipped" };
    }

    if (applied > 0) {
      ok(`تعديل (${applied} تغيير): ${desc}`);
      return { status: "applied", count: applied };
    }

    inf(`تعديل (0 تغيير): ${desc}`);
    return { status: "noop" };

  } catch (e) {
    const msg = (
      (e.stdout || "").toString() +
      (e.stderr  || "").toString()
    ).trim().slice(0, 200);
    wrn(`تحذير ${file}: ${msg}`);
    return { status: "error", message: msg };
  }
}

// ── تطبيق جميع التعديلات بالترتيب ───────────────────────────
/**
 * @param {string} baseDir — جذر المشروع (alsmanu5/)
 * @returns {{ applied: number, skipped: number, errors: number }}
 */
export function runAll(baseDir) {
  section("تطبيق التعديلات");

  let applied = 0, skipped = 0, errors = 0, missing = 0;

  for (const patch of PATCH_REGISTRY) {
    const result = applyOne(baseDir, patch);
    if      (result.status === "applied")  applied++;
    else if (result.status === "skipped")  skipped++;
    else if (result.status === "error")    errors++;
    else if (result.status === "missing")  missing++;
  }

  return { applied, skipped, errors, missing };
}

/**
 * Apply only explicitly named registered patches.
 * This keeps maintenance work scoped when unrelated patches have side effects.
 */
export function runSelected(baseDir, files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("runSelected requires a non-empty list of patch filenames");
  }
  const requested = new Set(files);
  const unknown = files.filter(file => !PATCH_REGISTRY.some(patch => patch.file === file));
  if (unknown.length) {
    throw new Error(`Unregistered patch requested: ${unknown.join(", ")}`);
  }

  section("تطبيق تعديلات محددة");
  const results = [];
  for (const patch of PATCH_REGISTRY) {
    if (requested.has(patch.file)) results.push({ file: patch.file, ...applyOne(baseDir, patch) });
  }

  return {
    applied: results.filter(result => result.status === "applied").length,
    skipped: results.filter(result => result.status === "skipped").length,
    errors: results.filter(result => result.status === "error").length,
    results,
  };
}

/** قائمة التعديلات المسجّلة (للقراءة فقط) */
export const patches = Object.freeze(PATCH_REGISTRY.map(p => ({ ...p })));
