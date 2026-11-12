/**
 * infrastructure/package-manager.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: ضمان توفر حزم npm اللازمة لتشغيل البوت.
 *
 * العمليات:
 *   1. تثبيت node_modules إذا كانت غائبة
 *   2. التحقق من الحزم الحرجة وتثبيتها منفردة إذا نقصت
 *
 * الحزم الحرجة = حزم تؤثر مباشرة على ميزات المستخدم (التنزيل، الإرسال).
 *
 * تعتمد على: core/logger.mjs
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ok, wrn, section } from "../core/logger.mjs";

// ── الحزم التي يجب التحقق منها بشكل فردي ────────────────────
const CRITICAL_PACKAGES = [
  "@whiskeysockets/baileys",
  "yt-search",
  "node-telegram-bot-api",
  "sharp",
  // ffmpeg مرفق كحزمة احتياطية خفيفة (منصة واحدة، ~80MB) — يُستخدم فقط
  // إن لم يكن ffmpeg مثبتاً في النظام. أُزيلت ffprobe-static (351MB كانت
  // تملأ القرص وتوقف البوت) ونستخرج مدة الصوت من ffmpeg نفسه.
  "ffmpeg-static",
];

// ── تثبيت node_modules إذا غائبة ────────────────────────────
function ensureNodeModules(baseDir) {
  const nm = join(baseDir, "node_modules");
  if (existsSync(nm)) {
    ok("node_modules: موجود");
    return true;
  }

  wrn("node_modules: غائب — جارٍ npm install...");
  try {
    execSync("npm install --no-package-lock 2>&1 | tail -5", {
      stdio: "inherit",
      cwd:   baseDir,
      timeout: 180_000,
    });
    ok("تم تثبيت الحزم بنجاح");
    return true;
  } catch {
    wrn("فشل npm install — سأحاول تثبيت الحزم الحرجة منفردة");
    return false;
  }
}

// ── التحقق من الحزم الحرجة وتثبيت الناقص ────────────────────
function ensureCriticalPackages(baseDir) {
  const manifest = JSON.parse(readFileSync(join(baseDir, "package.json"), "utf8"));
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  };
  const missing = CRITICAL_PACKAGES.filter((pkg) => {
    const packageDir = join(baseDir, "node_modules", pkg);
    if (!existsSync(packageDir)) return true;
    if (pkg !== "@whiskeysockets/baileys") return false;
    try {
      const installed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).version;
      return installed !== declared[pkg];
    } catch {
      return true;
    }
  });

  if (missing.length === 0) {
    ok("كل الحزم الحرجة مثبّتة ✔");
    return;
  }

  wrn(`حزم ناقصة: ${missing.join(", ")} — جارٍ التثبيت...`);
  try {
    execSync(
      `npm install --no-package-lock ${missing.map((pkg) => declared[pkg] && pkg === "@whiskeysockets/baileys" ? `${pkg}@${declared[pkg]}` : pkg).join(" ")} 2>&1 | tail -3`,
      { stdio: "inherit", cwd: baseDir, timeout: 120_000 }
    );
    ok("تم تثبيت الحزم الناقصة");
  } catch (e) {
    wrn("فشل تثبيت بعض الحزم: " + (e.message?.slice(0, 80) ?? ""));
  }
}

// ── النقطة الرئيسية للاستدعاء ────────────────────────────────
/**
 * @param {string} baseDir — جذر المشروع (alsmanu5/)
 */
export async function ensure(baseDir) {
  section("التبعيات");
  const installed = ensureNodeModules(baseDir);
  if (!installed) {
    throw new Error("تعذر تثبيت node_modules — تحقق من اتصال npm ثم أعد التشغيل");
  }
  ensureCriticalPackages(baseDir);
}
