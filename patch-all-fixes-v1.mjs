#!/usr/bin/env node
/**
 * patch-all-fixes-v1.mjs
 * إصلاحات شاملة:
 *  1 — إضافة معالج مبكر لحالات البث قبل handleMyMsgsTextInput
 *  2 — إضافة حلقة الإرسال المفقودة في awaiting_bulk_broadcast_msg
 *  3 — إصلاح زر reply_per_user_limit بعرض قائمة الردود أولاً
 *  4 — زر دليل الذكاء الاصطناعي في قسم الردود التلقائية
 *  5 — رفع الكود على أجزاء مع زر "اكتملت؟"
 *  6 — استيراد JSON عبر ملف Document من تيليغرام
 *  7 — تحميل الفيديو مباشرة في الذاكرة بدون قرص
 * GUARD: PATCH_ALL_FIXES_V1_APPLIED
 */

import { readFileSync, writeFileSync } from "fs";

const FILE  = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_ALL_FIXES_V1_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش مطبّق سابقاً: patch-all-fixes-v1");
  process.exit(0);
}

let applied = 0;
const warnings = [];

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) {
    warnings.push("⚠️  لم يُعثر على: " + desc);
    return false;
  }
  code = code.replace(oldStr, newStr);
  applied++;
  console.log("✅ تم: " + desc);
  return true;
}

// ══════════════════════════════════════════════════════════════════
// إصلاح 1: معالج مبكر لحالات البث قبل handleMyMsgsTextInput
// ══════════════════════════════════════════════════════════════════
patch(
  `  const { handleMyMsgsTextInput: handleMyMsgsTextInput2 } = await Promise.resolve().then(() => (init_my_msgs(), my_msgs_exports));
  const handledMyMsgs = await handleMyMsgsTextInput2(bot2, chatId, userId, text, state);
  if (handledMyMsgs) return;`,
  `  // PATCH_ALL_FIXES_V1: معالج مبكر لحالات البث
  const _earlyBroadcastStates = ["awaiting_broadcast_message", "awaiting_bulk_broadcast_msg", "awaiting_bulk_points_amount", "awaiting_bulk_points_message"];
  if (!_earlyBroadcastStates.includes(state.state)) {
    const { handleMyMsgsTextInput: handleMyMsgsTextInput2 } = await Promise.resolve().then(() => (init_my_msgs(), my_msgs_exports));
    const handledMyMsgs = await handleMyMsgsTextInput2(bot2, chatId, userId, text, state);
    if (handledMyMsgs) return;
  }`,
  "معالج مبكر لحالات البث قبل handleMyMsgsTextInput"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 2: حلقة الإرسال المفقودة في awaiting_bulk_broadcast_msg
// ══════════════════════════════════════════════════════════════════
patch(
  `    case "awaiting_bulk_broadcast_msg": {
      const s = getState(userId);
      const targets = getBulkUsers(s.data.bulkCategory || "all");
      clearState(userId);
      await bot2.sendMessage(chatId, \`\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0644\u0640 \${targets.length} \u0645\u0633\u062A\u062E\u062F\u0645\`);
      break;
    }`,
  `    case "awaiting_bulk_broadcast_msg": {
      const s_bb = getState(userId);
      const cat_bb = s_bb.data?.bulkCategory || "all";
      const targets_bb = getBulkUsers(cat_bb);
      clearState(userId);
      // PATCH_FIX: حلقة الإرسال الفعلية كانت مفقودة
      const tids_bb = targets_bb.map(u => String(u.telegramId || u.id || u)).filter(Boolean);
      await bot2.sendMessage(chatId, "\u{1F4E4} \u0628\u062F\u0623 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0625\u0644\u0649 " + tids_bb.length + " \u0645\u0633\u062A\u062E\u062F\u0645...");
      let ok_bb = 0, fail_bb = 0;
      for (const tid_bb of tids_bb) {
        try {
          await bot2.sendMessage(tid_bb, "\u{1F4E2} *\u0631\u0633\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u0637\u0648\u0631*\n\n" + text, { parse_mode: "Markdown" });
          ok_bb++;
        } catch { fail_bb++; }
        await new Promise(r => setTimeout(r, 300));
      }
      await bot2.sendMessage(chatId, "\u2705 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644!\n\u2714\uFE0F \u0646\u062C\u062D: " + ok_bb + "\n\u274C \u0641\u0634\u0644: " + fail_bb + "\n\u{1F465} \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: " + tids_bb.length);
      break;
    }`,
  "حلقة الإرسال في awaiting_bulk_broadcast_msg"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 3: زر reply_per_user_limit — عرض قائمة الردود أولاً
// ══════════════════════════════════════════════════════════════════
patch(
  `  if (data === "reply_per_user_limit") {
    const stPU2 = getState(userId);
    const ridPU2 = stPU2?.data?.replyId || stPU2?.data?.limitReplyId;
    if (!ridPU2) {
      await bot2.sendMessage(chatId, "\u274C \u0627\u0641\u062A\u062D \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0631\u062F \u0645\u062D\u062F\u062F \u0623\u0648\u0644\u064B\u0627");
      return true;
    }
    setState(userId, "awaiting_reply_per_user_limit", { limitReplyId: ridPU2 });
    await bot2.sendMessage(chatId, "\u{1F464} *\u062D\u062F \u0644\u0643\u0644 \u0634\u062E\u0635 (\u0643\u0644 8 \u0633\u0627\u0639\u0627\u062A)*\n\n\u0623\u062F\u062E\u0644 \u0639\u062F\u062F \u0627\u0644\u0631\u062F\u0648\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u0644\u0643\u0644 \u0634\u062E\u0635 \u0641\u064A 8 \u0633\u0627\u0639\u0627\u062A:\n(0 = \u0628\u0644\u0627 \u062D\u062F)", { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }`,
  `  if (data === "reply_per_user_limit") {
    const stPU2 = getState(userId);
    const ridPU2 = stPU2?.data?.replyId || stPU2?.data?.limitReplyId;
    if (!ridPU2) {
      // PATCH_FIX: عرض قائمة الردود للاختيار بدل رسالة الخطأ
      const allRepliesPU = getUserReplies(userId);
      if (allRepliesPU.length === 0) {
        await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u062F\u0648\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0629. \u0623\u0636\u0641 \u0631\u062F\u0627\u064B \u0623\u0648\u0644\u0627\u064B.");
        return true;
      }
      const puBtns = allRepliesPU.slice(0, 20).map(r => ([{
        text: (r.isActive ? "\u2705" : "\u274C") + " " + (r.trigger || "?").slice(0, 30),
        callback_data: "pu_limit_sel_" + r.id
      }]));
      puBtns.push([{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_replies" }]);
      await bot2.sendMessage(chatId,
        "\u{1F464} *\u062D\u062F \u0644\u0643\u0644 \u0634\u062E\u0635 / 8 \u0633\u0627\u0639\u0627\u062A*\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0631\u062F:",
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: puBtns } }
      );
      return true;
    }
    setState(userId, "awaiting_reply_per_user_limit", { limitReplyId: ridPU2 });
    await bot2.sendMessage(chatId, "\u{1F464} *\u062D\u062F \u0644\u0643\u0644 \u0634\u062E\u0635 (\u0643\u0644 8 \u0633\u0627\u0639\u0627\u062A)*\n\n\u0623\u062F\u062E\u0644 \u0639\u062F\u062F \u0627\u0644\u0631\u062F\u0648\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u0644\u0643\u0644 \u0634\u062E\u0635 \u0641\u064A 8 \u0633\u0627\u0639\u0627\u062A:\n(0 = \u0628\u0644\u0627 \u062D\u062F)", { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  // PATCH_FIX: اختيار الرد من قائمة "حد لكل شخص"
  if (data.startsWith("pu_limit_sel_")) {
    const puRid = data.replace("pu_limit_sel_", "");
    const puReply = getUserReplies(userId).find(r => r.id === puRid);
    if (!puReply) { await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F"); return true; }
    setState(userId, "awaiting_reply_per_user_limit", { limitReplyId: puRid });
    const curLimit = puReply.perUserLimit || 0;
    await bot2.sendMessage(chatId,
      "\u{1F464} *\u062D\u062F \u0644\u0643\u0644 \u0634\u062E\u0635 / 8 \u0633\u0627\u0639\u0627\u062A*\n\n\u{1F511} \u0627\u0644\u0631\u062F: \"" + puReply.trigger + "\"\n\u{1F4CA} \u0627\u0644\u062D\u062F \u0627\u0644\u062D\u0627\u0644\u064A: " + (curLimit === 0 ? "\u0628\u0644\u0627 \u062D\u062F" : curLimit + " \u0645\u0631\u0629") + "\n\n\u0623\u062F\u062E\u0644 \u0627\u0644\u062D\u062F \u0627\u0644\u062C\u062F\u064A\u062F (0 = \u0628\u0644\u0627 \u062D\u062F):",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }`,
  "إصلاح reply_per_user_limit مع قائمة اختيار الرد"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 4 + 5: زر دليل AI وزر رفع الكود بأجزاء في repliesMenuKeyboard
// ══════════════════════════════════════════════════════════════════
patch(
  `      [{ text: "\u{1F4E4} \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0631\u062F\u0648\u062F (JSON)", callback_data: "reply_export" }, { text: "\u{1F4E5} \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0631\u062F\u0648\u062F", callback_data: "reply_import" }],
      [{ text: "\u{1F524} \u0641\u0644\u062A\u0631 \u0627\u0644\u0644\u063A\u0629", callback_data: "reply_lang_filter" }, { text: "\u{1F4CB} \u0646\u0633\u062E \u0631\u062F \u0645\u0648\u062C\u0648\u062F", callback_data: "reply_duplicate" }],`,
  `      [{ text: "\u{1F4E4} \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0631\u062F\u0648\u062F (JSON)", callback_data: "reply_export" }, { text: "\u{1F4E5} \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0631\u062F\u0648\u062F", callback_data: "reply_import" }],
      [{ text: "\u{1F916} \u062F\u0644\u064A\u0644 \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", callback_data: "reply_ai_guide" }, { text: "\u{1F4DD} \u0631\u0641\u0639 \u0643\u0648\u062F \u0639\u0644\u0649 \u0623\u062C\u0632\u0627\u0621", callback_data: "reply_code_parts" }],
      [{ text: "\u{1F524} \u0641\u0644\u062A\u0631 \u0627\u0644\u0644\u063A\u0629", callback_data: "reply_lang_filter" }, { text: "\u{1F4CB} \u0646\u0633\u062E \u0631\u062F \u0645\u0648\u062C\u0648\u062F", callback_data: "reply_duplicate" }],`,
  "إضافة زر دليل AI وزر رفع الكود بأجزاء في repliesMenuKeyboard"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 4b + 5b: معالجات الزرين الجديدين (قبل reply_enable_all)
// ══════════════════════════════════════════════════════════════════
patch(
  `  if (data === "reply_enable_all") {`,
  `  // PATCH_FIX: دليل الذكاء الاصطناعي — يشرح هيكل البوت للـ AI الخارجي
  if (data === "reply_ai_guide") {
    const sampleR = getUserReplies(userId)[0] || {
      id: "reply_abc123", trigger: "\u0645\u0631\u062D\u0628\u0627", triggerType: "contains", caseSensitive: false,
      replyType: "text", replyContent: "\u0648\u0639\u0644\u064A\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645!",
      target: "all", scope: "both", isActive: true, dailyLimit: 0, perUserLimit: 0,
      scheduleFrom: null, scheduleTo: null, langFilter: null, morphEdits: [], rotatingMessages: []
    };
    const sampleJson = JSON.stringify(sampleR, null, 2);
    const rotEx = JSON.stringify({
      trigger: "\u0627\u062D\u0648\u0627\u0644\u0643", triggerType: "contains", replyType: "rotating",
      rotatingMessages: ["\u0628\u062E\u064A\u0631 \u0648\u0627\u0644\u062D\u0645\u062F \u0644\u0644\u0647", "\u062A\u0645\u0627\u0645 \u0634\u0643\u0631\u0627\u064B"],
      target: "all", scope: "both", isActive: true, dailyLimit: 0, perUserLimit: 0
    }, null, 2);
    const aiEx = JSON.stringify({
      trigger: "\u0645\u0627 \u0631\u0623\u064A\u0643", triggerType: "starts", replyType: "ai",
      replyContent: "\u0623\u0646\u062A \u0645\u0633\u0627\u0639\u062F \u0648\u062F\u064A. \u0623\u062C\u0628 \u0628\u0627\u062E\u062A\u0635\u0627\u0631.",
      target: "all", scope: "private", isActive: true, dailyLimit: 10, perUserLimit: 2
    }, null, 2);

    const BT = "\x60\x60\x60";
    const guide = [
      "\u{1F916} *\u062F\u0644\u064A\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u2014 \u0628\u0648\u062A \u0648\u0627\u062A\u0633\u0622\u0628*",
      "\u0623\u0631\u0633\u0644 \u0647\u0630\u0627 \u0644\u0623\u064A AI \u0644\u064A\u0641\u0647\u0645 \u0647\u064A\u0643\u0644 \u0627\u0644\u0628\u0648\u062A \u0648\u064A\u0628\u0646\u064A \u0631\u062F\u0648\u062F\u0627\u064B \u062C\u0627\u0647\u0632\u0629.\n",
      "## 1. \u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629",
      "\u0627\u0644\u0628\u0648\u062A \u064A\u0639\u0645\u0644 \u0639\u0628\u0631 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u0648\u064A\u062A\u062D\u0643\u0645 \u0628\u062C\u0644\u0633\u0629 \u0648\u0627\u062A\u0633\u0622\u0628 (Baileys). \u0643\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062F\u064A\u0647 \u0645\u062C\u0645\u0648\u0639\u0629 autoReplies \u062A\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u062A\u0633\u0622\u0628 \u0627\u0644\u0648\u0627\u0631\u062F\u0629.\n",
      "## 2. \u0647\u064A\u0643\u0644 \u0645\u0644\u0641 \u0627\u0644\u0631\u062F (JSON)",
      BT + "json\n" + sampleJson + "\n" + BT + "\n",
      "## 3. \u0634\u0631\u062D \u0627\u0644\u062D\u0642\u0648\u0644",
      "- **trigger**: \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629",
      "- **triggerType**: [exact | contains | starts | ends | regex]",
      "- **replyType**: [text | ai | reaction | morphing | rotating | image | audio | video | document | sticker]",
      "- **replyContent**: \u0646\u0635 \u0623\u0648 URL \u0623\u0648 \"__ai_default__\" \u0644\u0644\u0630\u0643\u0627\u0621",
      "- **target**: [all | specific | multiple] | **scope**: [both | private | group]",
      "- **dailyLimit**: \u062D\u062F \u064A\u0648\u0645\u064A (0 = \u0628\u0644\u0627 \u062D\u062F) | **perUserLimit**: \u062D\u062F \u0644\u0643\u0644 \u0634\u062E\u0635 \u0643\u0644 8\u0633\u0627\u0639\u0627\u062A",
      "- **scheduleFrom/scheduleTo**: HH:mm | **langFilter**: [arabic | english | null]",
      "- **morphEdits**: [{text, delaySeconds}] \u0644\u0644\u0631\u062F \u0627\u0644\u0645\u062A\u062D\u0648\u0644",
      "- **rotatingMessages**: [\u0646\u0635, ...] \u0644\u0644\u0631\u062F \u0627\u0644\u0645\u062A\u0646\u0627\u0648\u0628\n",
      "## 4. \u0645\u062B\u0627\u0644 \u0631\u062F \u062F\u0648\u0631\u064A",
      BT + "json\n" + rotEx + "\n" + BT + "\n",
      "## 5. \u0645\u062B\u0627\u0644 \u0631\u062F \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A",
      BT + "json\n" + aiEx + "\n" + BT + "\n",
      "## 6. \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
      "\u0623\u0631\u0633\u0644 \u0645\u0644\u0641 .json \u0628\u0647\u064A\u0643\u0644 [{...}] \u2014 \u0623\u0648 \u0627\u0644\u0635\u0642 \u0627\u0644\u0646\u0635 \u0645\u0628\u0627\u0634\u0631\u0629 \u2014 \u0641\u064A \u0632\u0631 \"\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0631\u062F\u0648\u062F\"."
    ].join("\n");

    const chunks = [];
    for (let i = 0; i < guide.length; i += 4000) chunks.push(guide.slice(i, i + 4000));
    for (const ch of chunks) {
      await bot2.sendMessage(chatId, ch, { parse_mode: "Markdown" });
    }
    return true;
  }

  // PATCH_FIX: رفع الكود بأجزاء
  if (data === "reply_code_parts") {
    setState(userId, "awaiting_code_parts", { parts: [] });
    await bot2.sendMessage(chatId,
      "\u{1F4DD} *\u0631\u0641\u0639 \u0643\u0648\u062F \u0639\u0644\u0649 \u0623\u062C\u0632\u0627\u0621*\n\n\u2022 \u0627\u0631\u0633\u0644 \u0643\u0644 \u062C\u0632\u0621 \u0639\u0644\u0649 \u062D\u062F\u0629\n\u2022 \u0628\u0639\u062F \u0622\u062E\u0631 \u062C\u0632\u0621 \u0627\u0636\u063A\u0637 \"\u0627\u0643\u062A\u0645\u0644\u062A\u061F\"\n\n\u2139\uFE0F \u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u0627\u064B \u0631\u0641\u0639 \u0645\u0644\u0641 .json \u0645\u0628\u0627\u0634\u0631\u0629",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "\u2705 \u0627\u0643\u062A\u0645\u0644\u062A\u061F \u2014 \u0631\u0643\u0651\u0628 \u0627\u0644\u0623\u062C\u0632\u0627\u0621", callback_data: "code_parts_done" }],
        [{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]
      ] } }
    );
    return true;
  }

  // معالج "ركّب الأجزاء"
  if (data === "code_parts_done") {
    const stCP = getState(userId);
    const parts = stCP?.data?.parts || [];
    if (parts.length === 0) {
      await bot2.sendMessage(chatId, "\u26A0\uFE0F \u0644\u0645 \u062A\u0631\u0633\u0644 \u0623\u064A \u062C\u0632\u0621 \u0628\u0639\u062F.");
      return true;
    }
    const assembled = parts.join("");
    clearState(userId);
    try {
      const imported = JSON.parse(assembled);
      if (!Array.isArray(imported)) throw new Error("not array");
      let cnt = 0;
      for (const r of imported.slice(0, 100)) {
        if (r.trigger && r.replyContent !== undefined) { saveAutoReply(userId, r); cnt++; }
      }
      await bot2.sendMessage(chatId, "\u2705 *\u062A\u0645 \u062A\u0631\u0643\u064A\u0628 " + parts.length + " \u062C\u0632\u0621 \u0648\u0627\u0633\u062A\u064A\u0631\u0627\u062F " + cnt + " \u0631\u062F\u062A\u0644\u0642\u0627\u0626\u064A!*", { parse_mode: "Markdown" });
    } catch (e) {
      await bot2.sendMessage(chatId, "\u26A0\uFE0F \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0645\u062C\u0645\u0651\u0639 (" + assembled.length + " \u062D\u0631\u0641) \u0644\u064A\u0633 JSON \u0635\u0627\u0644\u062D\u0627\u064B: " + e.message);
    }
    return true;
  }

  if (data === "reply_enable_all") {`,
  "معالجات دليل AI ورفع الكود بأجزاء"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 5c: معالج النص لحالة awaiting_code_parts
// ══════════════════════════════════════════════════════════════════
patch(
  `  if (state.state === "awaiting_reply_import_json") {`,
  `  // PATCH_FIX: جمع أجزاء الكود
  if (state.state === "awaiting_code_parts") {
    const parts2 = state?.data?.parts || [];
    parts2.push(text);
    setState(userId, "awaiting_code_parts", { parts: parts2 });
    const total = parts2.join("").length;
    await bot2.sendMessage(chatId,
      "\u2705 *\u0627\u0644\u062C\u0632\u0621 " + parts2.length + " \u0648\u0635\u0644!*\n\u{1F4CA} \u0625\u062C\u0645\u0627\u0644\u064A: " + total + " \u062D\u0631\u0641\n\n\u0627\u0631\u0633\u0644 \u0627\u0644\u062C\u0632\u0621 \u0627\u0644\u062A\u0627\u0644\u064A \u0623\u0648 \u0627\u0636\u063A\u0637 \u0627\u0643\u062A\u0645\u0644\u062A:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "\u2705 \u0627\u0643\u062A\u0645\u0644\u062A\u061F \u2014 \u0631\u0643\u0651\u0628 (" + parts2.length + " \u0623\u062C\u0632\u0627\u0621)", callback_data: "code_parts_done" }],
        [{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]
      ] } }
    );
    return true;
  }

  if (state.state === "awaiting_reply_import_json") {`,
  "معالج نص لحالة awaiting_code_parts"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 6: دعم ملفات Document لاستيراد JSON عبر التيليغرام
// ══════════════════════════════════════════════════════════════════
patch(
  `      if (msg.photo || msg.video) {
        const { getState: getState11 } = await Promise.resolve().then(() => (init_state(), state_exports));
        const state = getState11(userId);
        if (state.state === "awaiting_status_image" || state.state === "awaiting_status_video") {
          const { handleStatusMedia: handleStatusMedia2 } = await Promise.resolve().then(() => (init_status(), status_exports));
          await handleStatusMedia2(bot, msg.chat.id, userId, msg, state);
          return;
        }
      }
      if (!msg.text) return;`,
  `      if (msg.photo || msg.video) {
        const { getState: getState11 } = await Promise.resolve().then(() => (init_state(), state_exports));
        const state = getState11(userId);
        if (state.state === "awaiting_status_image" || state.state === "awaiting_status_video") {
          const { handleStatusMedia: handleStatusMedia2 } = await Promise.resolve().then(() => (init_status(), status_exports));
          await handleStatusMedia2(bot, msg.chat.id, userId, msg, state);
          return;
        }
      }
      // PATCH_FIX: معالج ملفات Document (JSON) عند الاستيراد أو رفع الكود
      if (msg.document && !msg.text) {
        const { getState: getState12 } = await Promise.resolve().then(() => (init_state(), state_exports));
        const docSt = getState12(userId);
        if (docSt.state === "awaiting_reply_import_json" || docSt.state === "awaiting_code_parts") {
          try {
            const fLink = await bot.getFileLink(msg.document.file_id);
            const fRes  = await fetch(fLink);
            const fText = await fRes.text();
            const { clearState: clrDocSt } = await Promise.resolve().then(() => (init_state(), state_exports));
            const { saveAutoReply: saveARDoc, getUserReplies: getURDoc } = await Promise.resolve().then(() => (init_auto_reply(), auto_reply_exports)).catch(() => ({
              saveAutoReply: saveAutoReply, getUserReplies: getUserReplies
            }));
            clrDocSt(userId);
            try {
              const imp = JSON.parse(fText);
              const arr = Array.isArray(imp) ? imp : [imp];
              let cnt = 0;
              for (const r of arr.slice(0, 100)) {
                if (r.trigger && r.replyContent !== undefined) {
                  try { saveARDoc(userId, r); cnt++; } catch { saveAutoReply(userId, r); cnt++; }
                }
              }
              await bot.sendMessage(msg.chat.id, "\u2705 \u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F " + cnt + " \u0631\u062F\u0627\u064B \u0645\u0646 \u0627\u0644\u0645\u0644\u0641!");
            } catch (e) {
              await bot.sendMessage(msg.chat.id, "\u274C \u0645\u0644\u0641 JSON \u063A\u064A\u0631 \u0635\u062D\u064A\u062D: " + e.message);
            }
          } catch (e) {
            await bot.sendMessage(msg.chat.id, "\u274C \u062E\u0637\u0623 \u0641\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641: " + e.message);
          }
          return;
        }
        return; // لا تعالج Documents في حالات أخرى
      }
      if (!msg.text) return;`,
  "دعم ملفات Document لاستيراد JSON"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 7: دالة تحميل الفيديو مباشرة في الذاكرة بدون قرص
// ══════════════════════════════════════════════════════════════════
patch(
  `// PATCH_VIDEO_FIX_v1_APPLIED
async function cobaltDownload(ytUrl, audioOnly, quality) {`,
  `// PATCH_VIDEO_FIX_v1_APPLIED
// PATCH_FIX: تحميل مباشر في الذاكرة بدون قرص عبر yt-dlp --get-url
async function streamDownloadDirect(ytUrl, audioOnly, maxMB) {
  if (maxMB === undefined) maxMB = 50;
  const YTDLP2 = await getYtdlp();
  if (!YTDLP2) throw new Error("yt-dlp \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
  const fmtArgs = audioOnly
    ? ["-f", "bestaudio[ext=m4a]/bestaudio", "--get-url"]
    : ["-f", "best[height<=480][ext=mp4]/best[height<=360]/worst", "--get-url"];
  const cookArgs = await getCookiesArgs();
  const { stdout: dlStdout } = await execFileP(YTDLP2, [
    ytUrl, ...fmtArgs, ...cookArgs,
    "--no-playlist", "--no-warnings",
    "--js-runtimes", "node:" + (await getNodeBin())
  ], { timeout: 30000 });
  const directUrl = dlStdout.trim().split("\n")[0];
  if (!directUrl || !directUrl.startsWith("http")) throw new Error("\u0644\u0645 \u064A\u064F\u062D\u0635\u0644 \u0639\u0644\u0649 \u0631\u0627\u0628\u0637 \u0645\u0628\u0627\u0634\u0631");
  const ctrl2 = new AbortController();
  const tid2 = setTimeout(() => ctrl2.abort(), 120000);
  try {
    const res2 = await fetch(directUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.youtube.com/" },
      signal: ctrl2.signal
    });
    clearTimeout(tid2);
    if (!res2.ok) throw new Error("HTTP " + res2.status);
    const cLen = parseInt(res2.headers.get("content-length") || "0");
    if (cLen > maxMB * 1024 * 1024) throw new Error("\u0627\u0644\u0645\u0644\u0641 " + Math.round(cLen / 1048576) + "MB \u0623\u0643\u0628\u0631 \u0645\u0646 " + maxMB + "MB");
    const buf2 = Buffer.from(await res2.arrayBuffer());
    if (buf2.length < 5000) throw new Error("\u0627\u0644\u0645\u0644\u0641 \u0641\u0627\u0631\u063A");
    return buf2;
  } finally { clearTimeout(tid2); }
}

async function cobaltDownload(ytUrl, audioOnly, quality) {`,
  "إضافة دالة streamDownloadDirect بدون قرص"
);

// ══════════════════════════════════════════════════════════════════
// إصلاح 7b: استخدام streamDownloadDirect كأولوية أولى في downloadVideoSmart
// ══════════════════════════════════════════════════════════════════
patch(
  `    // الأولوية 1: cobalt.tools (أسرع، يتجاوز bot detection)`,
  `    // PATCH_FIX: الأولوية 0 — تحميل مباشر في الذاكرة بدون قرص
    try {
      const buf0 = await streamDownloadDirect(v.url, false, 50);
      return { buffer: buf0, ext: "mp4" };
    } catch (_e0) { /* fallback */ }
    // الأولوية 1: cobalt.tools (أسرع، يتجاوز bot detection)`,
  "إضافة streamDownloadDirect كأولوية 0 في downloadVideoSmart"
);

// ══════════════════════════════════════════════════════════════════
// GUARD + حفظ الملف
// ══════════════════════════════════════════════════════════════════
code = code + "\n" + GUARD + "\n";
writeFileSync(FILE, code, "utf8");

console.log("\n" + "=".repeat(55));
console.log("✅ اكتمل الباتش — تم تطبيق " + applied + " تعديل");
if (warnings.length) {
  console.log("\nتحذيرات:");
  warnings.forEach(w => console.log(w));
}
console.log("=".repeat(55));
