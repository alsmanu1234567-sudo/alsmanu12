/**
 * core/config.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤوليات:
 *   1. قراءة config.json وتطبيق قيمه على process.env
 *   2. تعيين قيم افتراضية للمتغيرات غير المضبوطة
 *
 * تعتمد على: utils/token-codec.mjs (لفك تشفير القيم المشفرة)
 *             core/logger.mjs       (للطباعة)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { decode } from "../utils/token-codec.mjs";
import { ok, wrn, inf } from "./logger.mjs";

// ── القيم الافتراضية المعروفة ─────────────────────────────────
const ENV_DEFAULTS = {
  TELEGRAM_BOT_TOKEN: "8424252675:AAH1de_dMpiYKusK_d4uYxNMTX8dzSh8ucI",
  DEVELOPER_ID:       "7428421245",
  PORT:               "5000",
  MAX_RAM_MB:         "600",
};

// ── تحميل config.json ─────────────────────────────────────────
/**
 * يقرأ config.json من baseDir، يفك تشفير أي مفتاح ينتهي بـ _ENC،
 * ثم يكتب الجميع في process.env (لا يُكتب على قيمة موجودة).
 *
 * @param {string} baseDir — المجلد الجذر للمشروع
 */
export function loadConfig(baseDir) {
  const cfgPath = join(baseDir, "config.json");

  if (!existsSync(cfgPath)) {
    inf("config.json: غير موجود (اختياري)");
    return;
  }

  let cfg;
  try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  } catch (e) {
    wrn("config.json: خطأ في التحليل — " + e.message);
    return;
  }

  let loaded = 0;
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) continue;

    if (k.endsWith("_ENC")) {
      const envKey = k.replace("_ENC", "");
      if (!process.env[envKey]) {
        process.env[envKey] = decode(v);
        loaded++;
      }
    } else {
      if (!process.env[k]) {
        process.env[k] = String(v);
        loaded++;
      }
    }
  }

  ok(`config.json: ${loaded} إعداد محمّل (من ${Object.keys(cfg).length} إجمالي)`);
}

// ── تطبيق القيم الافتراضية ────────────────────────────────────
/**
 * يضبط القيم الافتراضية لأي متغير بيئة غير مضبوط.
 * يُستدعى دائماً بعد loadConfig().
 */
export function applyDefaults() {
  for (const [k, v] of Object.entries(ENV_DEFAULTS)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

// ── قراءة إعداد بأمان ─────────────────────────────────────────
/**
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string}
 */
export function get(key, fallback = "") {
  return process.env[key] || fallback;
}
