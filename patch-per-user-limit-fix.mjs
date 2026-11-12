// PATCH: إصلاح زر "حد لكل شخص / 8 ساعات" في قسم الردود التلقائية
// المشكلة: الزر موجود لكن ما في callback handler له
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/index.mjs");
const GUARD = "PATCH_PER_USER_LIMIT_FIX_APPLIED";

let c = readFileSync(DIST, "utf8");
if (c.includes(GUARD)) { console.log("ℹ️  باتش (مطبّق سابقاً): إصلاح زر حد كل شخص"); process.exit(0); }

// نبحث عن مكان معالجة reply_daily_limit في auto-reply.mjs أو index.mjs
// ونضيف callback handler مماثل لـ reply_per_user_limit

// إضافة handler لـ reply_per_user_limit بعد reply_daily_limit handler في index.mjs
const OLD_PATTERN = `  if (data === "reply_schedule") {`;

const NEW_ADDITION = `  // ${GUARD}
  if (data === "reply_per_user_limit") {
    const repliesPU = getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود. أضف رداً أولاً.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\\n\\nاختر الرد الذي تريد ضبط الحد له:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) {
      await bot2.sendMessage(chatId, "❌ الرد غير موجود");
      return true;
    }
    setState(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      \`👤 *حد كل شخص / 8 ساعات*\\n\\nالرد: "\${replyPU2.trigger.slice(0, 30)}"\\nالحد الحالي: \${replyPU2.perUserLimit || 0} (0 = بلا حد)\\n\\nأرسل الرقم الجديد (0 = بلا حد، 1 = مرة واحدة كل 8 ساعات):\`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "reply_schedule") {`;

if (c.includes(OLD_PATTERN) && !c.includes(GUARD)) {
  c = c.replace(OLD_PATTERN, NEW_ADDITION);
  writeFileSync(DIST, c, "utf8");
  console.log("✅ باتش (1 تعديل): إصلاح زر حد كل شخص / 8 ساعات");
} else if (c.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): إصلاح زر حد كل شخص");
} else {
  // البحث عن نمط بديل في auto-reply.mjs
  const DIST_AR = join(__dirname, "dist/auto-reply.mjs");
  let c2 = readFileSync(DIST_AR, "utf8");
  const OLD2 = `  if (data === "reply_schedule") {`;
  if (c2.includes(OLD2)) {
    const NEW2 = `  // ${GUARD}
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\\n\\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      \`👤 *حد كل شخص / 8 ساعات*\\n\\nالرد: "\${replyPU2.trigger.slice(0,30)}"\\nالحد الحالي: \${replyPU2.perUserLimit || 0}\\n\\nأرسل الرقم الجديد (0 = بلا حد):\`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  if (data === "reply_schedule") {`;
    c2 = c2.replace(OLD2, NEW2);
    writeFileSync(DIST_AR, c2, "utf8");
    console.log("✅ باتش (1 تعديل auto-reply): إصلاح زر حد كل شخص");
  } else {
    console.log("⚠️  باتش (0 تعديل): لم يعثر على نقطة الإدراج");
  }
}
