#!/usr/bin/env node
/**
 * patch-fixes-v2.mjs
 * إصلاحات: مزامنة جهات الاتصال + عرض الحالات + حذف الرسائل + نماذج الذكاء الاصطناعي
 * GUARD: PATCH_FIXES_V2_APPLIED
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_FIXES_V2_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log('ℹ️  باتش (مطبّق سابقاً): إصلاحات v2: جهات الاتصال+حالات+حذف+نماذج ذكاء');
  process.exit(0);
}

let applied = 0;

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) {
    console.warn(`⚠️  [patch-fixes-v2] لم يُعثر على: ${desc}`);
    return;
  }
  code = code.replace(oldStr, newStr);
  applied++;
}

// ═══════════════════════════════════════════════════
// A: مزامنة جهات الاتصال والمجموعات تلقائياً عند ربط واتساب
// ═══════════════════════════════════════════════════
patch(
  '      }\n    }\n  });\n}\nfunction registerCallHandler(sock, userId) {',
  '      }\n    }\n  });\n  // مزامنة جهات الاتصال من واتساب تلقائياً\n  sock.ev.on("contacts.upsert", (cList) => {\n    if (!Array.isArray(cList)) return;\n    for (const c of cList) {\n      if (c && c.id && c.id.endsWith("@s.whatsapp.net")) {\n        const nm = c.name || c.notify || c.verifiedName || "";\n        try { addContact(userId, c.id, nm); } catch {}\n      }\n    }\n  });\n  // مزامنة المجموعات من واتساب تلقائياً\n  sock.ev.on("groups.upsert", (gList) => {\n    if (!Array.isArray(gList)) return;\n    const groups = inMemoryDB.groupsCache.get(userId) || [];\n    for (const g of gList) {\n      if (!g || !g.id) continue;\n      const idx = groups.findIndex((x) => x.id === g.id);\n      const entry = { id: g.id, subject: g.subject || g.id.split("@")[0], participants: (g.participants || []).length, ts: Date.now() };\n      if (idx >= 0) groups[idx] = entry; else groups.push(entry);\n    }\n    if (groups.length > 0) inMemoryDB.groupsCache.set(userId, groups);\n  });\n}\nfunction registerCallHandler(sock, userId) {',
  'مزامنة جهات الاتصال والمجموعات'
);

// ═══════════════════════════════════════════════════
// B: التقاط حالات الأصدقاء في الذاكرة (بدون الحاجة لتفعيل الحفظ)
// ═══════════════════════════════════════════════════
patch(
  '      if (!jid || jid === "status@broadcast") continue;',
  '      if (!jid) continue;\n      if (jid === "status@broadcast") {\n        if (!msg.key.fromMe) {\n          if (!inMemoryDB.statusBuf) inMemoryDB.statusBuf = new Map();\n          const _sb = inMemoryDB.statusBuf.get(userId) || [];\n          const _sJid = msg.key.participant || "";\n          const _sTxt = extractText(msg);\n          const _sMed = !!(msg.message && (msg.message.imageMessage || msg.message.videoMessage || msg.message.audioMessage));\n          _sb.push({ jid: _sJid, text: _sTxt, hasMedia: _sMed, ts: Date.now() });\n          if (_sb.length > 300) _sb.shift();\n          inMemoryDB.statusBuf.set(userId, _sb);\n        }\n        continue;\n      }',
  'التقاط حالات status@broadcast'
);

// ═══════════════════════════════════════════════════
// C: إصلاح عرض حالات الآخرين – يعرض من الذاكرة مباشرة
// ═══════════════════════════════════════════════════
patch(
  '  if (data === "status_view_others") {\n    if (!sock) {\n      await bot2.sendMessage(chatId, "\\u274C \\u0631\\u0628\\u0637 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0623\\u0648\\u0644\\u0627\\u064B");\n      return true;\n    }\n    await bot2.sendMessage(\n      chatId,\n      `\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646*\\n\\n\\u0644\\u0645\\u0634\\u0627\\u0647\\u062F\\u0629 \\u0648\\u062A\\u0646\\u0632\\u064A\\u0644 \\u062D\\u0627\\u0644\\u0627\\u062A \\u062C\\u0647\\u0627\\u062A \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644:\\n\\u2022 \\u0641\\u0639\\u0651\\u0644 "\\u{1F4BE} \\u062D\\u0641\\u0638 \\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646" \\u0644\\u062D\\u0641\\u0638\\u0647\\u0627 \\u062A\\u0644\\u0642\\u0627\\u0626\\u064A\\u0627\\u064B\\n\\u2022 \\u0643\\u0644 \\u062D\\u0627\\u0644\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629 \\u062A\\u0631\\u0627\\u0647\\u0627 \\u0641\\u064A \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0633\\u062A\\u064F\\u062D\\u0641\\u0638 \\u0648\\u062A\\u064F\\u0631\\u0633\\u0644 \\u0647\\u0646\\u0627\\n\\n\\u0627\\u0644\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0645\\u062D\\u0641\\u0648\\u0638\\u0629 \\u062D\\u062A\\u0649 \\u0627\\u0644\\u0622\\u0646: ${statusSettings.savedCount || 0}`,\n      { parse_mode: "Markdown", reply_markup: statusMainKeyboard() }\n    );\n    return true;\n  }',
  '  if (data === "status_view_others") {\n    if (!sock) {\n      await bot2.sendMessage(chatId, "\\u274C \\u0631\\u0628\\u0637 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u0623\\u0648\\u0644\\u0627\\u064B");\n      return true;\n    }\n    if (!inMemoryDB.statusBuf) inMemoryDB.statusBuf = new Map();\n    const _statuses = inMemoryDB.statusBuf.get(userId) || [];\n    if (_statuses.length === 0) {\n      await bot2.sendMessage(chatId, "\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646*\\n\\n\\u23F3 \\u0644\\u0645 \\u062A\\u0635\\u0644 \\u0623\\u064A \\u062D\\u0627\\u0644\\u0629 \\u062D\\u062A\\u0649 \\u0627\\u0644\\u0622\\u0646.\\n\\u062A\\u0623\\u0643\\u062F \\u0645\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644 \\u0648\\u0627\\u062A\\u0633\\u0627\\u0628 \\u062B\\u0645 \\u0627\\u0646\\u062A\\u0638\\u0631 \\u0648\\u0635\\u0648\\u0644 \\u062D\\u0627\\u0644\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629.", { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });\n      return true;\n    }\n    const _recent = _statuses.slice(-20).reverse();\n    let _stMsg = "\\u{1F441}\\uFE0F *\\u062D\\u0627\\u0644\\u0627\\u062A \\u0627\\u0644\\u0622\\u062E\\u0631\\u064A\\u0646 (" + _statuses.length + " \\u062D\\u0627\\u0644\\u0629):*\\n\\n";\n    for (const _s of _recent) {\n      const _num = _s.jid ? _s.jid.split("@")[0] : "?";\n      const _time = new Date(_s.ts).toLocaleTimeString("ar");\n      const _type = _s.hasMedia ? "\\u{1F5BC}\\uFE0F \\u0648\\u0633\\u0627\\u0626\\u0637" : ("\\u{1F4DD} " + (_s.text ? _s.text.slice(0, 60) : "\\u0646\\u0635"));\n      _stMsg += "\\u2022 +" + _num + " [" + _time + "]: " + _type + "\\n";\n    }\n    await bot2.sendMessage(chatId, _stMsg, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });\n    return true;\n  }',
  'إصلاح عرض حالات الآخرين'
);

// ═══════════════════════════════════════════════════
// D: تتبع جميع الرسائل الصادرة (من البوت) لحذفها لاحقاً
// ═══════════════════════════════════════════════════
patch(
  '      const cacheKey = `${userId}:${jid}`;\n      if (msg.key.fromMe) {',
  '      const cacheKey = `${userId}:${jid}`;\n      // تتبع جميع الرسائل الصادرة تلقائياً (بما فيها ردود البوت)\n      if (msg.key.fromMe && msg.key.id) {\n        const _existing = userSentMsgCache.get(cacheKey) || [];\n        if (!_existing.some((x) => x.key && x.key.id === msg.key.id)) {\n          cacheSentMsg(cacheKey, msg.key);\n        }\n      }\n      if (msg.key.fromMe) {',
  'تتبع الرسائل الصادرة تلقائياً'
);

// ═══════════════════════════════════════════════════
// E: نماذج الذكاء الاصطناعي – عرض الكل بدون اختبار
// ═══════════════════════════════════════════════════
patch(
  '    const loading = await bot2.sendMessage(chatId, "\\u{1F50D} \\u062C\\u0627\\u0631\\u064D \\u0627\\u0643\\u062A\\u0634\\u0627\\u0641 \\u0627\\u0644\\u0646\\u0645\\u0627\\u0630\\u062C \\u0627\\u0644\\u0645\\u062A\\u0627\\u062D\\u0629...\\n\\u0642\\u062F \\u064A\\u0633\\u062A\\u063A\\u0631\\u0642 \\u0647\\u0630\\u0627 \\u062F\\u0642\\u064A\\u0642\\u0629 \\u0648\\u0627\\u062D\\u062F\\u0629.");\n    const models = await probeModels(userId);\n    await bot2.deleteMessage(chatId, loading.message_id).catch(() => {\n    });\n    if (models.length === 0) {\n      await bot2.sendMessage(\n        chatId,\n        `\\u274C \\u0644\\u0645 \\u064A\\u062A\\u0645 \\u0627\\u0644\\u0639\\u062B\\u0648\\u0631 \\u0639\\u0644\\u0649 \\u0646\\u0645\\u0627\\u0630\\u062C \\u062A\\u0639\\u0645\\u0644.\\n\\n\\u062A\\u062D\\u0642\\u0642 \\u0645\\u0646 \\u0635\\u062D\\u0629 \\u0627\\u0644\\u0645\\u0641\\u062A\\u0627\\u062D \\u0648\\u0623\\u0646 \\u0644\\u062F\\u064A\\u0643 \\u0631\\u0635\\u064A\\u062F\\u0627\\u064B \\u0641\\u064A \\u062D\\u0633\\u0627\\u0628\\u0643.`,\n        { reply_markup: { inline_keyboard: [[{ text: "\\u{1F519} \\u0631\\u062C\\u0648\\u0639", callback_data: "menu_ai" }]] } }\n      );\n      return;\n    }\n    const currentModel = getUserSelectedModel(userId);\n    await bot2.sendMessage(\n      chatId,\n      `\\u2705 \\u0648\\u062C\\u062F\\u0646\\u0627 *${models.length}* \\u0646\\u0645\\u0627\\u0630\\u062C \\u062A\\u0639\\u0645\\u0644 \\u0639\\u0644\\u0649 \\u0645\\u0641\\u062A\\u0627\\u062D\\u0643:\\n\\n\\u0627\\u062E\\u062A\\u0631 \\u0627\\u0644\\u0646\\u0645\\u0648\\u0630\\u062C \\u0627\\u0644\\u0645\\u0641\\u0636\\u0644:`,\n      { parse_mode: "Markdown", reply_markup: aiModelsKeyboard(models, currentModel) }\n    );\n    return;',
  '    const _allM = getAllModels();\n    const _curM = getUserSelectedModel(userId);\n    await bot2.sendMessage(\n      chatId,\n      `\\u{1F916} *\\u062C\\u0645\\u064A\\u0639 \\u0646\\u0645\\u0627\\u0630\\u062C \\u0627\\u0644\\u0630\\u0643\\u0627\\u0621 \\u0627\\u0644\\u0627\\u0635\\u0637\\u0646\\u0627\\u0639\\u064A (${_allM.length}):*\\n\\n\\u0627\\u062E\\u062A\\u0631 \\u0627\\u0644\\u0646\\u0645\\u0648\\u0630\\u062C \\u0627\\u0644\\u0645\\u0641\\u0636\\u0644 \\u2014 \\u062C\\u0645\\u064A\\u0639\\u0647\\u0627 \\u062A\\u0639\\u0645\\u0644 \\u0645\\u0639 NVIDIA API Key:`,\n      { parse_mode: "Markdown", reply_markup: aiModelsKeyboard(_allM, _curM) }\n    );\n    return;',
  'عرض كل نماذج الذكاء بدون اختبار'
);

// ═══════════════════════════════════════════════════
// تطبيق وحفظ
// ═══════════════════════════════════════════════════
if (applied === 0) {
  console.warn('⚠️  patch-fixes-v2: لم يُطبَّق أي تعديل');
  process.exit(0);
}

code = code.replace(
  'sock.ev.on("messages.upsert", async ({ messages, type }) => {',
  GUARD + '\n  sock.ev.on("messages.upsert", async ({ messages, type }) => {'
);

writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${applied} تعديل): إصلاحات v2: جهات الاتصال+حالات+حذف+نماذج ذكاء`);
