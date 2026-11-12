/**
 * engine/session-storage.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: قراءة والتحقق من ملفات الجلسات في bot-data/sessions/
 *            وعزل الجلسات التالفة بأمان.
 *
 * الهيكل المتوقع:
 *   bot-data/sessions/<userId>/auth_info_baileys/creds.json
 *
 * تعتمد على: core/logger.mjs, fs/promises
 * Exports: listSessionDirs, validateSession, scanAllSessions,
 *          quarantineSession, reportStorageHealth
 */

import { readdir, readFile, rename, mkdir, stat } from "fs/promises";
import { existsSync }                              from "fs";
import { join }                                    from "path";
import { ok, wrn, inf, logErr }                     from "../core/logger.mjs";

const SESSIONS_DIR   = "bot-data/sessions";
const CREDS_SUBPATH  = join("auth_info_baileys", "creds.json");
const QUARANTINE_DIR = "bot-data/sessions-quarantine";

// الحقول الإلزامية في creds.json الخاص بـ Baileys
const REQUIRED_CREDS_FIELDS = ["noiseKey", "signedIdentityKey", "registrationId"];

/**
 * يسرد جميع userIds الذين لديهم مجلد session.
 * @param {string} baseDir
 * @returns {Promise<string[]>}
 */
export async function listSessionDirs(baseDir) {
  const dir = join(baseDir, SESSIONS_DIR);
  if (!existsSync(dir)) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

/**
 * يتحقق من صحة ملفات جلسة مستخدم واحد.
 * @param {string} baseDir
 * @param {string} userId
 * @returns {Promise<SessionFileInfo>}
 */
export async function validateSession(baseDir, userId) {
  const dir       = join(baseDir, SESSIONS_DIR, userId);
  const credsFile = join(dir, CREDS_SUBPATH);

  if (!existsSync(credsFile)) {
    return { userId, dir, valid: false, error: "creds.json غير موجود", credsSize: null };
  }

  try {
    const info = await stat(credsFile);
    const raw  = await readFile(credsFile, "utf8");

    if (!raw.trim()) {
      return { userId, dir, valid: false, error: "creds.json فارغ", credsSize: 0 };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { userId, dir, valid: false, error: `JSON تالف: ${e.message}`, credsSize: raw.length };
    }

    if (!parsed || typeof parsed !== "object") {
      return { userId, dir, valid: false, error: "creds.json ليس كائناً صالحاً", credsSize: raw.length };
    }

    const missing = REQUIRED_CREDS_FIELDS.filter(f => !(f in parsed));
    if (missing.length > 0) {
      return {
        userId, dir, valid: false,
        error: `حقول Baileys مفقودة: ${missing.join(", ")}`,
        credsSize: raw.length,
      };
    }

    return { userId, dir, valid: true, error: null, credsSize: info.size };
  } catch (e) {
    return { userId, dir, valid: false, error: `خطأ في القراءة: ${e.message}`, credsSize: null };
  }
}

/**
 * يفحص جميع الجلسات الموجودة.
 * @param {string} baseDir
 * @returns {Promise<ScanResult>}
 */
export async function scanAllSessions(baseDir) {
  const userIds = await listSessionDirs(baseDir);
  if (userIds.length === 0) {
    return { total: 0, valid: 0, corrupted: [], all: [] };
  }

  const results  = await Promise.all(userIds.map(uid => validateSession(baseDir, uid)));
  const corrupted = results.filter(r => !r.valid);

  return {
    total:     results.length,
    valid:     results.filter(r => r.valid).length,
    corrupted,
    all:       results,
  };
}

/**
 * يُعزِّل جلسة تالفة بنقل مجلدها إلى منطقة العزل.
 * لا يحذف البيانات — فقط يُبعدها عن المسار الرئيسي.
 *
 * @param {string} baseDir
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function quarantineSession(baseDir, userId) {
  const src = join(baseDir, SESSIONS_DIR, userId);
  const qDir = join(baseDir, QUARANTINE_DIR);
  const dst  = join(qDir, `${userId}_${Date.now()}`);

  if (!existsSync(src)) return false;

  try {
    await mkdir(qDir, { recursive: true });
    await rename(src, dst);
    wrn(`🔒 عزل جلسة: ${userId} → ${dst}`);
    return true;
  } catch (e) {
    logErr(`فشل عزل جلسة ${userId}: ${e.message}`);
    return false;
  }
}

/**
 * يطبع تقرير الحالة على السجل ويُعيد النتائج.
 * @param {string} baseDir
 * @returns {Promise<ScanResult>}
 */
export async function reportStorageHealth(baseDir) {
  const scan = await scanAllSessions(baseDir);
  const msg = `📦 جلسات محفوظة: ${scan.valid}/${scan.total} سليمة` +
    (scan.corrupted.length ? ` — ⚠️ ${scan.corrupted.length} تالفة` : " ✅");
  inf(msg);

  for (const c of scan.corrupted) {
    wrn(`  ⚠️ جلسة تالفة: ${c.userId} — ${c.error}`);
  }
  return scan;
}
