#!/usr/bin/env node
/**
 * patch-dispatch-fix.mjs
 * ─────────────────────────────────────────────────────────────────
 * إصلاح البنية في _dispatchIncomingMsg بعد patch-pipeline-fix.mjs
 *
 * المشكلة: patch-pipeline-fix أنشأ _dispatchIncomingMsg لكن:
 *   1. تحتوي على "for (const msg of messages)" من المعالج القديم
 *   2. "continue;" بدلاً من "return;" (مستخدمة داخل الدالة الآن)
 *   3. "});" في نهايتها بدلاً من "}" (كانت لإغلاق الـ listener القديم)
 *   4. "type" مرجع من الـ closure القديم
 *
 * الإصلاحات:
 *   ① حذف "for (const msg of messages) {"
 *   ② حذف "}" + تغيير "});" إلى "}" في نهاية الدالة
 *   ③ استبدال "continue;" بـ "return;" داخل جسم الدالة
 *   ④ حذف "type" من استدعاء logger داخل الدالة
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => { console.error(R + "❌ " + m + N); process.exit(1); };

const INDEX = path.join(__dirname, "dist", "index.mjs");
if (!fs.existsSync(INDEX)) fail("dist/index.mjs غير موجود!");

let idx = fs.readFileSync(INDEX, "utf8");
const BEFORE = idx.length;
let changes = 0;

// ── مساعد patch ─────────────────────────────────────────────────
function patch(label, search, replace, idempotency = null) {
  const check = idempotency || replace.slice(0, 60);
  if (idx.includes(check)) { wrn(`تخطي (مطبّق): ${label}`); return; }
  if (!idx.includes(search)) { wrn(`لم يُعثر: ${label}`); return; }
  idx = idx.replace(search, replace);
  changes++;
  ok(label);
}

// ════════════════════════════════════════════════════════════════
// FIX 1: حذف "for (const msg of messages) {"
// ════════════════════════════════════════════════════════════════
patch(
  "1) حذف for (const msg of messages)",
  `  async function _dispatchIncomingMsg(sock2, uid, msg) {
    for (const msg of messages) {`,
  `  async function _dispatchIncomingMsg(sock2, uid, msg) {`,
  `  async function _dispatchIncomingMsg(sock2, uid, msg) {\n    const jid`
);

// ════════════════════════════════════════════════════════════════
// FIX 2: إزالة } الزائدة + تحويل }); إلى } في نهاية الدالة
// ════════════════════════════════════════════════════════════════
// نبحث عن النمط: "    }\n  });" الذي يمثّل:
//   "    }" ← إغلاق for loop  (الآن زائد)
//   "  });" ← إغلاق الـ listener القديم (يجب أن يصبح "  }")
patch(
  "2) تحويل }\\n}); إلى } في نهاية _dispatchIncomingMsg",
  `    }
  });
  // مزامنة جهات الاتصال`,
  `  }
  // مزامنة جهات الاتصال`,
  `  }\n  // مزامنة جهات الاتصال`
);

// ════════════════════════════════════════════════════════════════
// FIX 3: "type" مرجع من الـ closure القديم — نحذفه من logger
// ════════════════════════════════════════════════════════════════
// كان: logger.info({ jid, text: text2, type }, "[fromMe] message received");
// يصبح: logger.info({ jid, text: text2 }, "[fromMe] message received");
patch(
  "3) حذف 'type' من logger.info داخل _dispatchIncomingMsg",
  `logger.info({ jid, text: text2, type }, "[fromMe] message received");`,
  `logger.info({ jid, text: text2 }, "[fromMe] message received"); // [DISPATCH-FIX]`
);

// ════════════════════════════════════════════════════════════════
// FIX 4: استبدال "continue;" بـ "return;" داخل _dispatchIncomingMsg
// (نفعل هذا بعد إزالة الـ for loop حتى لا يتراكم continue بلا loop)
// ════════════════════════════════════════════════════════════════

// نجد جسم الدالة (من فتحها إلى إغلاقها) ونستبدل continue; فيه
const FN_OPEN  = `  async function _dispatchIncomingMsg(sock2, uid, msg) {`;
const FN_CLOSE = `  }\n  // مزامنة جهات الاتصال`;

const fnStart = idx.indexOf(FN_OPEN);
const fnEnd   = idx.indexOf(FN_CLOSE, fnStart);

if (fnStart === -1 || fnEnd === -1) {
  wrn(`4) لم تُعثَر على حدود _dispatchIncomingMsg (fnStart=${fnStart}, fnEnd=${fnEnd})`);
} else {
  const BEFORE_SECTION = idx.slice(fnStart, fnEnd);
  const AFTER_SECTION  = BEFORE_SECTION.split("continue;").join("return; // [DISPATCH-FIX]");
  if (BEFORE_SECTION !== AFTER_SECTION) {
    const cnt = (BEFORE_SECTION.match(/continue;/g) || []).length;
    idx = idx.slice(0, fnStart) + AFTER_SECTION + idx.slice(fnEnd);
    changes++;
    ok(`4) تحويل ${cnt} × continue; إلى return; داخل _dispatchIncomingMsg`);
  } else {
    wrn("4) لا continue; للتحويل (مطبّق سابقاً)");
  }
}

// ── حفظ ─────────────────────────────────────────────────────────
if (changes > 0) {
  fs.writeFileSync(INDEX, idx, "utf8");
  ok(`\n✅ ${changes} إصلاح طُبِّق — index.mjs (${BEFORE} → ${idx.length} بايت)`);
} else {
  wrn("لا تغييرات جديدة.");
}
