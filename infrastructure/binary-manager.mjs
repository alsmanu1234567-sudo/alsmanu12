/**
 * infrastructure/binary-manager.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: إدارة الثنائيات الخارجية المطلوبة للبوت.
 *
 * حالياً: yt-dlp — أداة تنزيل الوسائط.
 *
 * استراتيجية الحصول على yt-dlp (بالترتيب):
 *   1. bin/yt-dlp محلياً (مثبّت مسبقاً)
 *   2. yt-dlp في PATH
 *   3. تحميل من GitHub Releases عبر curl
 *   4. تحميل عبر fetch() (احتياط)
 *
 * تعتمد على: core/logger.mjs
 */

import { execSync, execFile } from "child_process";
import { promisify }          from "util";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join }               from "path";
import { ok, wrn }            from "../core/logger.mjs";
import { getPlatformBinary }  from "../utils/platform.mjs";

const execFileAsync = promisify(execFile);

// ── ffmpeg-static ────────────────────────────────────────────

/**
 * يتأكد أن ثنائي ffmpeg-static مُنزَّل فعلاً.
 * مدراء الحزم (خصوصاً pnpm) يتخطون سكربت postinstall الذي ينزّل الثنائي،
 * فتبقى الحزمة "مثبتة" لكن بلا ffmpeg حقيقي — ما يكسر دمج الفيديو
 * وتحويل الصوت. لا يفعل شيئاً إن كان ffmpeg موجوداً في النظام (يوفر ~80MB).
 * @param {string} baseDir — جذر المشروع
 */
export async function ensureFfmpegStatic(baseDir) {
  // ffmpeg النظام موجود؟ لا حاجة للثنائي المرفق
  try {
    execSync("ffmpeg -version", { stdio: "ignore", timeout: 5_000 });
    ok("ffmpeg: موجود في النظام");
    return { ok: true, source: "system" };
  } catch {}
  try {
    const { createRequire } = await import("module");
    const req = createRequire(join(baseDir, "package.json"));
    let binPath = null;
    try { binPath = req("ffmpeg-static"); } catch {}
    if (binPath && existsSync(binPath)) {
      ok("ffmpeg-static: الثنائي جاهز");
      return { ok: true, source: "static" };
    }
    if (binPath) {
      // الحزمة موجودة لكن الثنائي غائب → شغّل سكربت التنزيل الخاص بها
      const { dirname } = await import("path");
      const pkgDir = dirname(req.resolve("ffmpeg-static/package.json"));
      wrn("ffmpeg-static: الثنائي غائب — جارٍ تنزيله...");
      execSync("node install.js", { cwd: pkgDir, stdio: "ignore", timeout: 300_000 });
      if (existsSync(binPath)) {
        ok("ffmpeg-static: تم تنزيل الثنائي ✔");
        return { ok: true, source: "static-downloaded" };
      }
    }
  } catch (e) {
    wrn("ffmpeg-static: فشل التنزيل — " + String(e?.message || e).slice(0, 80));
  }
  return { ok: false };
}

// ── yt-dlp ───────────────────────────────────────────────────

/**
 * يضمن توفر yt-dlp وتسجيل مساره في YTDLP_PATH.
 * @param {string} baseDir — جذر المشروع (alsmanu5/)
 */
export async function ensureYtDlp(baseDir) {
  const binPath = join(baseDir, "bin", "yt-dlp");

  // 1. ثنائي محلي موجود
  if (existsSync(binPath)) {
    try {
      const { stdout } = await execFileAsync(binPath, ["--version"], { timeout: 8_000 });
      ok("yt-dlp: v" + stdout.trim() + " (bin/yt-dlp)");
      process.env.YTDLP_PATH = binPath;
      return;
    } catch {
      wrn("yt-dlp: موجود لكن لا يعمل — سأعيد التحميل...");
    }
  }

  // 2. في PATH
  try {
    const sys = execSync("which yt-dlp 2>/dev/null", { timeout: 3_000 }).toString().trim();
    if (sys && existsSync(sys)) {
      const { stdout } = await execFileAsync(sys, ["--version"], { timeout: 5_000 });
      ok("yt-dlp: v" + stdout.trim() + " (PATH)");
      process.env.YTDLP_PATH = sys;
      return;
    }
  } catch {}

  // 3. تحميل من GitHub
  wrn("yt-dlp: غير موجود — جارٍ التحميل من GitHub...");
  mkdirSync(join(baseDir, "bin"), { recursive: true });

  const fileName = getPlatformBinary("yt-dlp");
  const dlUrl    = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${fileName}`;

  if (await _downloadViaCurl(dlUrl, binPath)) return;
  if (await _downloadViaFetch(dlUrl, binPath)) return;

  wrn("yt-dlp: فشل التحميل — ميزات التنزيل لن تعمل");
}

// ── مساعدات التحميل (خاصة بالوحدة) ─────────────────────────
async function _downloadViaCurl(url, dest) {
  try {
    execSync(
      `curl -fsSL ${JSON.stringify(url)} -o ${JSON.stringify(dest)}`,
      { timeout: 120_000, stdio: "pipe" }
    );
    return await _verifyAndRegister(dest, "curl");
  } catch {
    wrn("curl فشل — أجرّب fetch...");
    return false;
  }
}

async function _downloadViaFetch(url, dest) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const buf = Buffer.from(await resp.arrayBuffer());
    writeFileSync(dest, buf);
    return await _verifyAndRegister(dest, "fetch");
  } catch (e) {
    wrn("fetch فشل: " + e.message);
    return false;
  }
}

async function _verifyAndRegister(binPath, method) {
  try {
    chmodSync(binPath, 0o755);
    const { stdout } = await execFileAsync(binPath, ["--version"], { timeout: 8_000 });
    ok(`yt-dlp: تم التحميل (${method}) — v${stdout.trim()}`);
    process.env.YTDLP_PATH = binPath;
    return true;
  } catch {
    return false;
  }
}
