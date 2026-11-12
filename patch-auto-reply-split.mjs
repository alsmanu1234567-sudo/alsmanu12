#!/usr/bin/env node
// patch-auto-reply-split.mjs
// فصل قسم الردود التلقائية إلى ملف مستقل dist/auto-reply.mjs
// يُعدّل dist/index.mjs ليفوّض الاستدعاءات للملف المستقل

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUARD     = "PATCH_AUTO_REPLY_SPLIT_APPLIED";
const INDEX     = join(__dirname, "dist", "index.mjs");
const AR_FILE   = join(__dirname, "dist", "auto-reply.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);
const err = m => { console.error(R + "❌ " + m + N); process.exit(1); };

// ── فحص dist/index.mjs ───────────────────────────────────────
if (!existsSync(INDEX)) err("dist/index.mjs غير موجود");
let src = readFileSync(INDEX, "utf8");

// ── حارس: تمنع التطبيق المزدوج ───────────────────────────────
if (src.includes(GUARD)) {
  console.log(Y + "⚠️  الباتش مُطبَّق مسبقاً — لم يُطبَّق أي تعديل" + N);
  process.exit(0);
}

// ── التحقق من وجود ملف auto-reply.mjs ─────────────────────────
if (!existsSync(AR_FILE)) {
  err("dist/auto-reply.mjs غير موجود — تأكد من وجود الملف أولاً");
}
ok("dist/auto-reply.mjs موجود ✓");

let changed = 0;

// ── 1. إضافة import في بداية الملف ──────────────────────────────
// نضيف بعد سطر PATCH_FIXES_V3_APPLIED
const importLine = `import * as _arMod from './auto-reply.mjs'; // ${GUARD}`;
if (src.startsWith("// PATCH_FIXES_V3_APPLIED")) {
  src = src.replace(
    "// PATCH_FIXES_V3_APPLIED",
    `// PATCH_FIXES_V3_APPLIED\n${importLine}`
  );
  changed++;
  ok("تمت إضافة import لـ auto-reply.mjs");
} else if (!src.includes("_arMod")) {
  // fallback: أضف بعد أول import statement
  const firstImport = src.indexOf("import ");
  const lineEnd = src.indexOf("\n", firstImport);
  src = src.slice(0, lineEnd + 1) + importLine + "\n" + src.slice(lineEnd + 1);
  changed++;
  ok("تمت إضافة import لـ auto-reply.mjs (fallback)");
}

// ── 2. استبدال قسم الردود التلقائية بدوال تفويض ────────────────
// القسم يبدأ بـ: // src/bot/features/auto-reply/index.ts
// وينتهي بعد: init_auto_reply = __esm({ ... });

const AR_START = `// src/bot/features/auto-reply/index.ts
var auto_reply_exports = {};
__export(auto_reply_exports, {
  handleAddReply: () => handleAddReply,
  handleAutoReplyCallback: () => handleAutoReplyCallback,
  handleAutoReplyTextInput: () => handleAutoReplyTextInput,
  handleTriggerTypeCallback: () => handleTriggerTypeCallback,
  showReplies: () => showReplies
});`;

// نبحث عن بداية القسم
const startIdx = src.indexOf(AR_START);
if (startIdx === -1) {
  wrn("لم يُعثَر على بداية قسم الردود التلقائية — ربما تم استبداله بباتش آخر");
} else {
  // نبحث عن نهاية init_auto_reply block
  const initBlock = `var init_auto_reply = __esm({
  "src/bot/features/auto-reply/index.ts"() {
    "use strict";
    init_database();
    init_state();
    init_keyboards();
    init_constants();
  }
});`;

  const endSearchStart = startIdx;
  const endIdx = src.indexOf(initBlock, endSearchStart);

  if (endIdx === -1) {
    wrn("لم يُعثَر على نهاية init_auto_reply — سيتم استبدال قسم التصدير فقط");
    // استبدال أقل: فقط إضافة setDeps بعد init_keyboards في __esm
  } else {
    const endOfBlock = endIdx + initBlock.length;
    const oldSection = src.slice(startIdx, endOfBlock);

    const newSection = `// src/bot/features/auto-reply/index.ts — فُصل في ملف مستقل
// ============================================================
// الكود الكامل موجود في: dist/auto-reply.mjs
// هذا الملف يحتوي دوال تفويض تستدعي الملف المستقل
// ============================================================
var auto_reply_exports = {};
__export(auto_reply_exports, {
  handleAddReply: () => handleAddReply,
  handleAutoReplyCallback: () => handleAutoReplyCallback,
  handleAutoReplyTextInput: () => handleAutoReplyTextInput,
  handleTriggerTypeCallback: () => handleTriggerTypeCallback,
  showReplies: () => showReplies
});
// دوال تفويض — تستدعي dist/auto-reply.mjs مباشرة
async function showReplies(bot2, chatId, userId) {
  return _arMod.showReplies(bot2, chatId, userId);
}
async function handleAddReply(bot2, chatId, userId) {
  return _arMod.handleAddReply(bot2, chatId, userId);
}
async function handleAutoReplyCallback(bot2, chatId, userId, data) {
  return _arMod.handleAutoReplyCallback(bot2, chatId, userId, data);
}
async function handleTriggerTypeCallback(bot2, chatId, userId, data) {
  return _arMod.handleTriggerTypeCallback(bot2, chatId, userId, data);
}
async function handleAutoReplyTextInput(bot2, chatId, userId, text, state) {
  return _arMod.handleAutoReplyTextInput(bot2, chatId, userId, text, state);
}
var init_auto_reply = __esm({
  "src/bot/features/auto-reply/index.ts"() {
    "use strict";
    init_database();
    init_state();
    init_keyboards();
    init_constants();
    // تسجيل الاعتماديات مع ملف الردود التلقائية المستقل
    _arMod.setDeps({
      getUserReplies,
      saveAutoReply,
      deleteAutoReply,
      toggleAutoReply,
      getReplyStat,
      incrementReplyStat,
      inMemoryDB,
      addPoints,
      getUser,
      getState,
      setState,
      clearState,
      appendTextPart,
      clearTextParts,
      getMergedText,
      repliesMenuKeyboard,
      replyTypeKeyboard,
      triggerTypeKeyboard,
      replyScopeKeyboard,
      replyTargetKeyboard,
      replyListKeyboard,
      singleReplyKeyboard,
      cancelKeyboard,
      backAndHome,
      mainMenuKeyboard,
      longTextDoneKeyboard,
      DEVELOPER_ID,
      VARIABLES_HELP,
      getAiManager: () => { init_ai_manager(); return ai_manager_exports; },
      getNumberManager: () => { init_number_manager(); return number_manager_exports; }
    });
  }
});`;

    src = src.slice(0, startIdx) + newSection + src.slice(endOfBlock);
    changed++;
    ok("تم استبدال قسم الردود التلقائية بدوال تفويض (" + (endOfBlock - startIdx) + " حرف → " + newSection.length + " حرف)");
  }
}

// ── 3. كتابة الملف المعدّل ────────────────────────────────────
if (changed === 0) {
  wrn("لم يُطبَّق أي تعديل — ربما البنية تغيّرت");
} else {
  writeFileSync(INDEX, src, "utf8");
  ok(`تم حفظ dist/index.mjs (${changed} تعديل)`);
  ok("✅ الفصل مكتمل:");
  ok("   • dist/auto-reply.mjs — الكود الكامل للردود التلقائية");
  ok("   • dist/index.mjs — دوال تفويض تستدعي الملف المستقل");
}
