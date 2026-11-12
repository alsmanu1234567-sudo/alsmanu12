#!/usr/bin/env node
/**
 * patch-fixes-v3.mjs
 * إصلاحات:
 *  C — حالات الآخرين: عرض من الذاكرة مباشرة (بدون "فعّل الحفظ أولاً")
 *  E — اكتشاف نماذج الذكاء: عرض كل النماذج فوراً بدون اختبار NVIDIA API
 *  F — تتبع ردود البوت (append): حذف رسائل البوت أيضاً
 * GUARD: PATCH_FIXES_V3_APPLIED
 */

import { readFileSync, writeFileSync } from "fs";

const FILE  = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_FIXES_V3_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): إصلاحات v3");
  process.exit(0);
}

let applied = 0;

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) {
    console.warn(`⚠️  [patch-fixes-v3] لم يُعثر على: ${desc}`);
    return;
  }
  code = code.replace(oldStr, newStr);
  applied++;
}

// ═══════════════════════════════════════════════════
// C: عرض حالات الآخرين من الذاكرة (statusBuf) بدون شرط الحفظ
// ═══════════════════════════════════════════════════
patch(
  `  if (data === "status_view_others") {
    if (!sock) {
      await bot2.sendMessage(chatId, "\\u274C \\u0631\\u0628\\u0637 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0623\\u0648\\u0644\\u0627\\u064B");
      return true;
    }
    await bot2.sendMessage(
      chatId,
      \`\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646*

\\u0644\\u0645\\u0634\\u0627\\u0647\\u062F\\u0629 \\u0648\\u062A\\u0646\\u0632\\u064A\\u0644 \\u062D\\u0627\\u0644\\u0627\\u062A \\u062C\\u0647\\u0627\\u062A \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644:
\\u2022 \\u0641\\u0639\\u0651\\u0644 "\\u{1F4BE} \\u062D\\u0641\\u0638 \\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646" \\u0644\\u062D\\u0641\\u0638\\u0647\\u0627 \\u062A\\u0644\\u0642\\u0627\\u0626\\u064A\\u0627\\u064B
\\u2022 \\u0643\\u0644 \\u062D\\u0627\\u0644\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629 \\u062A\\u0631\\u0627\\u0647\\u0627 \\u0641\\u064A \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0633\\u062A\\u064F\\u062D\\u0641\\u0638 \\u0648\\u062A\\u064F\\u0631\\u0633\\u0644 \\u0647\\u0646\\u0627

\\u0627\\u0644\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0645\\u062D\\u0641\\u0648\\u0638\\u0629 \\u062D\\u062A\\u0649 \\u0627\\u0644\\u0622\\u0646: \${statusSettings.savedCount || 0}\`,
      { parse_mode: "Markdown", reply_markup: statusMainKeyboard() }
    );
    return true;
  }`,
  `  if (data === "status_view_others") {
    if (!sock) {
      await bot2.sendMessage(chatId, "\\u274C \\u0631\\u0628\\u0637 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0623\\u0648\\u0644\\u0627\\u064B");
      return true;
    }
    // PATCH_V3: عرض الحالات من الذاكرة مباشرة بدون شرط الحفظ
    if (!inMemoryDB.statusBuf) inMemoryDB.statusBuf = new Map();
    const _statuses = inMemoryDB.statusBuf.get(userId) || [];
    if (_statuses.length === 0) {
      await bot2.sendMessage(
        chatId,
        "\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646*\\n\\n\\u23F3 \\u0644\\u0645 \\u062A\\u0635\\u0644 \\u0623\\u064A \\u062D\\u0627\\u0644\\u0629 \\u062D\\u062A\\u0649 \\u0627\\u0644\\u0622\\u0646.\\n\\u062A\\u0623\\u0643\\u062F \\u0645\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u062B\\u0645 \\u0627\\u0646\\u062A\\u0638\\u0631 \\u0648\\u0635\\u0648\\u0644 \\u062D\\u0627\\u0644\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629.",
        { parse_mode: "Markdown", reply_markup: statusMainKeyboard() }
      );
      return true;
    }
    const _recent = _statuses.slice(-25).reverse();
    let _stMsg = "\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646 (" + _statuses.length + " \\u062D\\u0627\\u0644\\u0629):*\\n\\n";
    for (const _s of _recent) {
      const _num = _s.jid ? _s.jid.split("@")[0] : "?";
      const _time = new Date(_s.ts).toLocaleTimeString("ar");
      const _type = _s.hasMedia ? "\\u{1F5BC}\\uFE0F \\u0648\\u0633\\u0627\\u0626\\u0637" : ("\\u{1F4DD} " + (_s.text ? _s.text.slice(0, 55) : "\\u0646\\u0635"));
      _stMsg += "\\u2022 +" + _num + " [" + _time + "]: " + _type + "\\n";
    }
    await bot2.sendMessage(chatId, _stMsg, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
    return true;
  }`,
  "status_view_others من الذاكرة"
);

// ═══════════════════════════════════════════════════
// E: اكتشاف النماذج — عرض الكل فوراً بدون اختبار API
// ═══════════════════════════════════════════════════
patch(
  `    const loading = await bot2.sendMessage(chatId, "\\u{1F50D} \\u062C\\u0627\\u0631\\u064D \\u0627\\u0643\\u062A\\u0634\\u0627\\u0641 \\u0627\\u0644\\u0646\\u0645\\u0627\\u0630\\u062C \\u0627\\u0644\\u0645\\u062A\\u0627\\u062D\\u0629...\\n\\u0642\\u062F \\u064A\\u0633\\u062A\\u063A\\u0631\\u0642 \\u0647\\u0630\\u0627 \\u062F\\u0642\\u064A\\u0642\\u0629 \\u0648\\u0627\\u062D\\u062F\\u0629.");
    const models = await probeModels(userId);
    await bot2.deleteMessage(chatId, loading.message_id).catch(() => {
    });
    if (models.length === 0) {
      await bot2.sendMessage(
        chatId,
        \`\\u274C \\u0644\\u0645 \\u064A\\u062A\\u0645 \\u0627\\u0644\\u0639\\u062B\\u0648\\u0631 \\u0639\\u0644\\u0649 \\u0646\\u0645\\u0627\\u0630\\u062C \\u062A\\u0639\\u0645\\u0644.

\\u062A\\u062D\\u0642\\u0642 \\u0645\\u0646 \\u0635\\u062D\\u0629 \\u0627\\u0644\\u0645\\u0641\\u062A\\u0627\\u062D \\u0648\\u0623\\u0646 \\u0644\\u062F\\u064A\\u0643 \\u0631\\u0635\\u064A\\u062F\\u0627\\u064B \\u0641\\u064A \\u062D\\u0633\\u0627\\u0628\\u0643.\`,
        { reply_markup: { inline_keyboard: [[{ text: "\\u{1F519} \\u0631\\u062C\\u0648\\u0639", callback_data: "menu_ai" }]] } }
      );
      return;
    }
    const currentModel = getUserSelectedModel(userId);
    await bot2.sendMessage(
      chatId,
      \`\\u2705 \\u0648\\u062C\\u062F\\u0646\\u0627 *\${models.length}* \\u0646\\u0645\\u0627\\u0630\\u062C \\u062A\\u0639\\u0645\\u0644 \\u0639\\u0644\\u0649 \\u0645\\u0641\\u062A\\u0627\\u062D\\u0643:

\\u0627\\u062E\\u062A\\u0631 \\u0627\\u0644\\u0646\\u0645\\u0648\\u0630\\u062C \\u0627\\u0644\\u0645\\u0641\\u0636\\u0644:\`,
      { parse_mode: "Markdown", reply_markup: aiModelsKeyboard(models, currentModel) }
    );
    return;`,
  `    // PATCH_V3: عرض كل النماذج فوراً بدون اختبار NVIDIA API
    const _allModels = getAllModels();
    const _curModel  = getUserSelectedModel(userId);
    await bot2.sendMessage(
      chatId,
      \`\\u{1F916} *\\u062C\\u0645\\u064A\\u0639 \\u0646\\u0645\\u0627\\u0630\\u062C \\u0627\\u0644\\u0630\\u0643\\u0627\\u0621 \\u0627\\u0644\\u0627\\u0635\\u0637\\u0646\\u0627\\u0639\\u064A (\${_allModels.length}):*

\\u0627\\u062E\\u062A\\u0631 \\u0627\\u0644\\u0646\\u0645\\u0648\\u0630\\u062C \\u0627\\u0644\\u0645\\u0641\\u0636\\u0644 \\u2014 \\u062C\\u0645\\u064A\\u0639\\u0647\\u0627 \\u062A\\u0639\\u0645\\u0644 \\u0645\\u0639 NVIDIA API Key:\`,
      { parse_mode: "Markdown", reply_markup: aiModelsKeyboard(_allModels, _curModel) }
    );
    return;`,
  "عرض كل نماذج الذكاء فوراً"
);

// ═══════════════════════════════════════════════════
// F: تتبع ردود البوت (append type) لحذفها لاحقاً
//    Baileys يرسل رسائل البوت كـ "append" وليس "notify"
// ═══════════════════════════════════════════════════
patch(
  `function registerMessageHandler(sock, userId) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;`,
  `function registerMessageHandler(sock, userId) {
  // PATCH_V3: تتبع ردود البوت (append) لحذفها لاحقاً
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "append") {
      for (const _m of messages) {
        if (_m.key?.fromMe && _m.key?.id && _m.key?.remoteJid) {
          const _ck = \`\${userId}:\${_m.key.remoteJid}\`;
          const _arr = userSentMsgCache.get(_ck) || [];
          if (!_arr.some((_x) => _x.key?.id === _m.key.id)) {
            _arr.push({ key: _m.key });
            if (_arr.length > 200) _arr.shift();
            userSentMsgCache.set(_ck, _arr);
          }
        }
      }
      return;
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;`,
  "تتبع ردود البوت (append type)"
);

// ═══════════════════════════════════════════════════
// تطبيق وحفظ
// ═══════════════════════════════════════════════════
if (applied === 0) {
  console.warn("⚠️  patch-fixes-v3: لم يُطبَّق أي تعديل");
  process.exit(0);
}

// إضافة GUARD في مكان ثابت
code = GUARD + "\n" + code;

writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${applied} تعديل): إصلاحات v3: حالات+نماذج ذكاء+تتبع ردود البوت`);
