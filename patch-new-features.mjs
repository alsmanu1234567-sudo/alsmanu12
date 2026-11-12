#!/usr/bin/env node
/**
 * patch-new-features.mjs — ميزات جديدة v1:
 *  1. أكواد خاصة في رسائلي (Code Triggers)
 *  2. شريط تقدم التحميل لـ vid / tiktok / song
 *  3. تحسين /حالة — دعم الكود بمسافة
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath  = join(__dirname, "dist", "index.mjs");
const GUARD     = "// PATCH_NEW_FEATURES_v1_APPLIED";

let code = readFileSync(filePath, "utf8");
if (code.includes(GUARD)) {
  console.log("\u23ED\uFE0F  \u0645\u064F\u0637\u0628\u064E\u0651\u0642 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 patch-new-features");
  process.exit(0);
}

let patches = 0;
function patch(old, neo, desc) {
  if (!code.includes(old)) { console.warn("\u26A0\uFE0F  \u0644\u0645 \u064A\u064F\u062C\u064E\u062F \u0627\u0644\u0646\u0645\u0637:", desc); return; }
  code = code.replace(old, neo);
  console.log("\u2705", desc);
  patches++;
}

// ════════════════════════════════════════════════════════
// PATCH 1: زر "أكواد خاصة" في قائمة رسائلي
// ════════════════════════════════════════════════════════
patch(
  "      [{ text: \"\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645\", callback_data: \"mymsgs_show_cod\" }, { text: \"\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629\", callback_data: \"home\" }]",
  "      [{ text: \"\u26A1 \u0623\u0643\u0648\u0627\u062F \u062E\u0627\u0635\u0629\", callback_data: \"mymsgs_show_codes\" }],\n      [{ text: \"\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645\", callback_data: \"mymsgs_show_cod\" }, { text: \"\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629\", callback_data: \"home\" }]",
  "\u0625\u0636\u0627\u0641\u0629 \u0632\u0631 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629"
);

// ════════════════════════════════════════════════════════
// PATCH 2: معالجات callback للأكواد في handleMyMsgsCallback
// ════════════════════════════════════════════════════════
const CB_ANCHOR = "  if (editMap[data]) {\n    const { field, label, example } = editMap[data];";

// نبني كتلة الكود كنص عادي لتفادي مشكلة الـ backtick
const CB_NEW = [
  "  // PATCH_NEW_FEATURES_v1_APPLIED",
  "  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u0623\u0643\u0648\u0627\u062F \u062E\u0627\u0635\u0629 (Code Triggers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "  if (data === \"mymsgs_show_codes\") {",
  "    const codes = s.customCodes || [];",
  "    const rows = codes.map((cc) => [{ text: (cc.enabled !== false ? \"\u2705\" : \"\u274C\") + \" \" + cc.trigger.slice(0,22) + \" (\" + (cc.matchType||\"exact\") + \")\", callback_data: \"mymsgs_code_view_\" + cc.id }]);",
  "    rows.push([{ text: \"\u2795 \u0625\u0636\u0627\u0641\u0629 \u0643\u0648\u062F \u062C\u062F\u064A\u062F\", callback_data: \"mymsgs_codes_add\" }]);",
  "    rows.push([{ text: \"\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0642\u0627\u0626\u0645\u0629\", callback_data: \"menu_mymsgs\" }]);",
  "    await bot2.sendMessage(chatId,",
  "      \"\u26A1 *\u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629*\\n\\n\u0647\u064A \u0623\u0648\u0627\u0645\u0631 \u062A\u0643\u062A\u0628\u0647\u0627 *\u0623\u0646\u062A* \u0641\u064A \u0623\u064A \u0645\u062D\u0627\u062F\u062B\u0629 \u0648\u0627\u062A\u0633\u0622\u0628 \u0641\u064A\u0631\u0633\u0644 \u0627\u0644\u0628\u0648\u062A \u0631\u062F\u0627\u064B \u0645\u062D\u062F\u062F\u0627\u064B.\\n\\n\u0639\u062F\u062F \u0627\u0644\u0623\u0643\u0648\u0627\u062F: \" + codes.length,",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: rows } }",
  "    );",
  "    return;",
  "  }",
  "  if (data.startsWith(\"mymsgs_code_view_\")) {",
  "    const codeId2 = data.replace(\"mymsgs_code_view_\", \"\");",
  "    const codes2 = s.customCodes || [];",
  "    const cc2 = codes2.find((x) => x.id === codeId2);",
  "    if (!cc2) { await bot2.sendMessage(chatId, \"\u274C \u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\"); return; }",
  "    const mtMap = { exact: \"\u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645\", contains: \"\u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649\", starts: \"\u064A\u0628\u062F\u0623 \u0628\u0640\", ends: \"\u064A\u0646\u062A\u0647\u064A \u0628\u0640\" };",
  "    const rtMap = { text: \"\u0646\u0635 \u062B\u0627\u0628\u062A\", rotating: \"\u0645\u062A\u0646\u0627\u0648\u0628\", ai: \"\u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\", image: \"\u0635\u0648\u0631\u0629\" };",
  "    await bot2.sendMessage(chatId,",
  "      \"\u26A1 *\u0643\u0648\u062F: \" + cc2.trigger + \"*\\n\uD83D\uDD0D \u0627\u0644\u062A\u0637\u0627\u0628\u0642: \" + (mtMap[cc2.matchType] || cc2.matchType || \"exact\") + \"\\n\uD83D\uDCDD \u0627\u0644\u0631\u062F: \" + (rtMap[cc2.replyType] || cc2.replyType || \"text\") + \"\\n\u0627\u0644\u062D\u0627\u0644\u0629: \" + (cc2.enabled !== false ? \"\uD83D\uDFE2 \u0645\u064F\u0641\u0639\u064E\u0651\u0644\" : \"\uD83D\uDD34 \u0645\u064F\u0639\u0637\u064E\u0651\u0644\"),",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: [",
  "        [{ text: cc2.enabled !== false ? \"\uD83D\uDD34 \u0625\u064A\u0642\u0627\u0641\" : \"\uD83D\uDFE2 \u062A\u0634\u063A\u064A\u0644\", callback_data: \"mymsgs_code_toggle_\" + codeId2 }],",
  "        [{ text: \"\uD83D\uDDD1\uFE0F \u062D\u0630\u0641 \u0627\u0644\u0643\u0648\u062F\", callback_data: \"mymsgs_code_del_\" + codeId2 }],",
  "        [{ text: \"\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F\", callback_data: \"mymsgs_show_codes\" }]",
  "      ] } }",
  "    );",
  "    return;",
  "  }",
  "  if (data.startsWith(\"mymsgs_code_toggle_\")) {",
  "    const codeId3 = data.replace(\"mymsgs_code_toggle_\", \"\");",
  "    const codes3 = s.customCodes || [];",
  "    const cc3 = codes3.find((x) => x.id === codeId3);",
  "    if (!cc3) { await bot2.sendMessage(chatId, \"\u274C \u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\"); return; }",
  "    cc3.enabled = cc3.enabled === false;",
  "    saveMyMsgsSettings(userId, { customCodes: codes3 });",
  "    await bot2.sendMessage(chatId, (cc3.enabled ? \"\uD83D\uDFE2 \u0645\u064F\u0641\u0639\u064E\u0651\u0644\" : \"\uD83D\uDD34 \u0645\u064F\u0639\u0637\u064E\u0651\u0644\") + \" \u0627\u0644\u0643\u0648\u062F: \" + cc3.trigger, {",
  "      reply_markup: { inline_keyboard: [",
  "        [{ text: cc3.enabled ? \"\uD83D\uDD34 \u0625\u064A\u0642\u0627\u0641\" : \"\uD83D\uDFE2 \u062A\u0634\u063A\u064A\u0644\", callback_data: \"mymsgs_code_toggle_\" + codeId3 }],",
  "        [{ text: \"\uD83D\uDDD1\uFE0F \u062D\u0630\u0641\", callback_data: \"mymsgs_code_del_\" + codeId3 }],",
  "        [{ text: \"\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F\", callback_data: \"mymsgs_show_codes\" }]",
  "      ] }",
  "    });",
  "    return;",
  "  }",
  "  if (data.startsWith(\"mymsgs_code_del_\")) {",
  "    const codeId4 = data.replace(\"mymsgs_code_del_\", \"\");",
  "    const filtered4 = (s.customCodes || []).filter((x) => x.id !== codeId4);",
  "    saveMyMsgsSettings(userId, { customCodes: filtered4 });",
  "    await bot2.sendMessage(chatId, \"\uD83D\uDDD1\uFE0F \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0643\u0648\u062F \u0628\u0646\u062C\u0627\u062D.\", { reply_markup: { inline_keyboard: [[{ text: \"\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F\", callback_data: \"mymsgs_show_codes\" }]] } });",
  "    return;",
  "  }",
  "  if (data === \"mymsgs_codes_add\") {",
  "    const { setState: setStateCA } = await Promise.resolve().then(() => (init_state(), state_exports));",
  "    setStateCA(userId, \"mymsgs_code_step1\");",
  "    await bot2.sendMessage(chatId,",
  "      \"\u26A1 *\u0625\u0636\u0627\u0641\u0629 \u0643\u0648\u062F \u062E\u0627\u0635 \u2014 \u0627\u0644\u062E\u0637\u0648\u0629 1/4*\\n\\n\u0623\u0631\u0633\u0644 \u0646\u0635 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0630\u064A \u0633\u062A\u0643\u062A\u0628\u0647 \u0641\u064A \u0648\u0627\u062A\u0633\u0622\u0628\\n\\n\u0645\u062B\u0627\u0644: !terHeb \u0623\u0648 !msaeda\",",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: [[{ text: \"\u274C \u0625\u0644\u063A\u0627\u0621\", callback_data: \"mymsgs_show_codes\" }]] } }",
  "    );",
  "    return;",
  "  }",
  "  if (data.startsWith(\"mymsgs_code_mt_\")) {",
  "    const { getState: getStateCM, setState: setStateCM } = await Promise.resolve().then(() => (init_state(), state_exports));",
  "    const stCM = getStateCM(userId);",
  "    const mt = data.replace(\"mymsgs_code_mt_\", \"\");",
  "    setStateCM(userId, \"mymsgs_code_step3\", Object.assign({}, stCM && stCM.data || {}, { matchType: mt }));",
  "    await bot2.sendMessage(chatId, \"\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 3/4:* \u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0631\u062F:\", {",
  "      parse_mode: \"Markdown\",",
  "      reply_markup: { inline_keyboard: [",
  "        [{ text: \"\uD83D\uDCDD \u0646\u0635 \u062B\u0627\u0628\u062A\", callback_data: \"mymsgs_code_rt_text\" }],",
  "        [{ text: \"\uD83D\uDD04 \u0645\u062A\u0646\u0627\u0648\u0628 (\u0639\u062F\u0629 \u0631\u062F\u0648\u062F)\", callback_data: \"mymsgs_code_rt_rotating\" }],",
  "        [{ text: \"\uD83E\uDD16 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\", callback_data: \"mymsgs_code_rt_ai\" }],",
  "        [{ text: \"\uD83D\uDDBC\uFE0F \u0635\u0648\u0631\u0629 (\u0628\u062D\u062B \u062A\u0644\u0642\u0627\u0626\u064A)\", callback_data: \"mymsgs_code_rt_image\" }],",
  "        [{ text: \"\u274C \u0625\u0644\u063A\u0627\u0621\", callback_data: \"mymsgs_show_codes\" }]",
  "      ] }",
  "    });",
  "    return;",
  "  }",
  "  if (data.startsWith(\"mymsgs_code_rt_\")) {",
  "    const { getState: getStateCR, setState: setStateCR } = await Promise.resolve().then(() => (init_state(), state_exports));",
  "    const stCR = getStateCR(userId);",
  "    const rt = data.replace(\"mymsgs_code_rt_\", \"\");",
  "    setStateCR(userId, \"mymsgs_code_step4\", Object.assign({}, stCR && stCR.data || {}, { replyType: rt }));",
  "    const rtHints = { text: \"\u0623\u0631\u0633\u0644 \u0646\u0635 \u0627\u0644\u0631\u062F:\", rotating: \"\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u062F\u0648\u062F \u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0640 ||\\n\u0645\u062B\u0627\u0644: \u0623\u0647\u0644\u0627\u064B!||\u0645\u0631\u062D\u0628\u0627\u064B!||\u0647\u0644\u0627 \u0648\u0633\u0647\u0644\u0627!\", ai: \"\u0623\u0631\u0633\u0644 \u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0623\u0648 \u0623\u0631\u0633\u0644 - \u0644\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A:\", image: \"\u0623\u0631\u0633\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u0635\u0648\u0631\u0629:\" };",
  "    await bot2.sendMessage(chatId,",
  "      \"\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 4/4:* \" + (rtHints[rt] || \"\u0623\u0631\u0633\u0644 \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0631\u062F:\"),",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: [[{ text: \"\u274C \u0625\u0644\u063A\u0627\u0621\", callback_data: \"mymsgs_show_codes\" }]] } }",
  "    );",
  "    return;",
  "  }",
  "  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "  if (editMap[data]) {",
  "    const { field, label, example } = editMap[data];"
].join("\n");

patch(CB_ANCHOR, CB_NEW, "\u0625\u0636\u0627\u0641\u0629 \u0645\u0639\u0627\u0644\u062C\u0627\u062A callback \u0644\u0644\u0623\u0643\u0648\u0627\u062F");

// ════════════════════════════════════════════════════════
// PATCH 3: ساحر الأكواد في handleMyMsgsTextInput
// ════════════════════════════════════════════════════════
const TI_ANCHOR = "  if (state.state !== \"mymsgs_edit_cmd\") return false;";

const TI_NEW = [
  "  // \u2500\u2500 \u0633\u0627\u062D\u0631 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629 \u2500\u2500",
  "  if (state.state === \"mymsgs_code_step1\") {",
  "    const trigger = text.trim();",
  "    if (!trigger) { await bot2.sendMessage(chatId, \"\u26A0\uFE0F \u0646\u0635 \u0627\u0644\u0643\u0648\u062F \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0627\u064B\"); return true; }",
  "    const { setState: setStateW2 } = await Promise.resolve().then(() => (init_state(), state_exports));",
  "    setStateW2(userId, \"mymsgs_code_step2\", { trigger });",
  "    await bot2.sendMessage(chatId,",
  "      \"\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 2/4:* \u0627\u0644\u0643\u0648\u062F: \" + trigger + \"\\n\\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u062A\u0637\u0627\u0628\u0642:\",",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: [",
  "        [{ text: \"\uD83C\uDFAF \u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645\", callback_data: \"mymsgs_code_mt_exact\" }, { text: \"\uD83D\uDD0D \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649\", callback_data: \"mymsgs_code_mt_contains\" }],",
  "        [{ text: \"\u25B6\uFE0F \u064A\u0628\u062F\u0623 \u0628\u0640\", callback_data: \"mymsgs_code_mt_starts\" }, { text: \"\u25C0\uFE0F \u064A\u0646\u062A\u0647\u064A \u0628\u0640\", callback_data: \"mymsgs_code_mt_ends\" }],",
  "        [{ text: \"\u274C \u0625\u0644\u063A\u0627\u0621\", callback_data: \"mymsgs_show_codes\" }]",
  "      ] } }",
  "    );",
  "    return true;",
  "  }",
  "  if (state.state === \"mymsgs_code_step4\") {",
  "    const content4 = text.trim();",
  "    if (!content4) { await bot2.sendMessage(chatId, \"\u26A0\uFE0F \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0627\u064B\"); return true; }",
  "    const { clearState: clearStateW4 } = await Promise.resolve().then(() => (init_state(), state_exports));",
  "    const { trigger: trW4, matchType: mtW4, replyType: rtW4 } = state.data || {};",
  "    const newCode4 = {",
  "      id: Date.now() + \"_\" + Math.random().toString(36).slice(2, 6),",
  "      trigger: trW4 || \"\",",
  "      matchType: mtW4 || \"exact\",",
  "      replyType: rtW4 || \"text\",",
  "      replyContent: content4,",
  "      enabled: true",
  "    };",
  "    const existingCodes4 = getMyMsgsSettings(getUser(userId)).customCodes || [];",
  "    saveMyMsgsSettings(userId, { customCodes: [...existingCodes4, newCode4] });",
  "    clearStateW4(userId);",
  "    const mtLbl = { exact: \"\u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645\", contains: \"\u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649\", starts: \"\u064A\u0628\u062F\u0623 \u0628\u0640\", ends: \"\u064A\u0646\u062A\u0647\u064A \u0628\u0640\" };",
  "    const rtLbl = { text: \"\u0646\u0635 \u062B\u0627\u0628\u062A\", rotating: \"\u0645\u062A\u0646\u0627\u0648\u0628\", ai: \"\u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\", image: \"\u0635\u0648\u0631\u0629\" };",
  "    await bot2.sendMessage(chatId,",
  "      \"\u2705 *\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0643\u0648\u062F \u0628\u0646\u062C\u0627\u062D!*\\n\\n\uD83D\uDCCC \u0627\u0644\u0643\u0648\u062F: \" + newCode4.trigger + \"\\n\uD83D\uDD0D \u0627\u0644\u062A\u0637\u0627\u0628\u0642: \" + (mtLbl[newCode4.matchType] || newCode4.matchType) + \"\\n\uD83D\uDCDD \u0627\u0644\u0631\u062F: \" + (rtLbl[newCode4.replyType] || newCode4.replyType),",
  "      { parse_mode: \"Markdown\", reply_markup: { inline_keyboard: [[{ text: \"\u26A1 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629\", callback_data: \"mymsgs_show_codes\" }]] } }",
  "    );",
  "    return true;",
  "  }",
  "  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  "  if (state.state !== \"mymsgs_edit_cmd\") return false;"
].join("\n");

patch(TI_ANCHOR, TI_NEW, "\u0625\u0636\u0627\u0641\u0629 \u0633\u0627\u062D\u0631 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0641\u064A handleMyMsgsTextInput");

// ════════════════════════════════════════════════════════
// PATCH 4: معالج الأكواد الخاصة في محادثات الواتساب
// ════════════════════════════════════════════════════════
const WA_ANCHOR = "        continue;\n      }\n      cachePush(cacheKey, msg);";

const WA_CODES = [
  "        // \u2500\u2500 \u0623\u0643\u0648\u0627\u062F \u062E\u0627\u0635\u0629 (Code Triggers) \u2014 \u0645\u064F\u0637\u0644\u064E\u0642\u0629 \u0628\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0645\u0627\u0644\u0643 \u2500\u2500",
  "        if (myS && Array.isArray(myS.customCodes) && myS.customCodes.length > 0) {",
  "          for (const cc of myS.customCodes) {",
  "            if (cc.enabled === false) continue;",
  "            const ccTrig = (cc.trigger || \"\").toLowerCase();",
  "            const ccTrimmed = trimmed.toLowerCase();",
  "            const ccMT = cc.matchType || \"exact\";",
  "            let ccHit = false;",
  "            if (ccMT === \"exact\") ccHit = ccTrimmed === ccTrig;",
  "            else if (ccMT === \"contains\") ccHit = ccTrimmed.includes(ccTrig);",
  "            else if (ccMT === \"starts\") ccHit = ccTrimmed.startsWith(ccTrig);",
  "            else if (ccMT === \"ends\") ccHit = ccTrimmed.endsWith(ccTrig);",
  "            if (!ccHit) continue;",
  "            try {",
  "              if (cc.replyType === \"ai\") {",
  "                const { getAiReplyForRule: gAIcc } = await Promise.resolve().then(() => (init_ai_manager(), ai_manager_exports));",
  "                const aiPcc = cc.replyContent === \"-\" ? \"\" : (cc.replyContent || \"\");",
  "                const aiTcc = await gAIcc(userId, aiPcc, trimmed);",
  "                if (aiTcc) await activeSock.sendMessage(jid, { text: aiTcc });",
  "              } else if (cc.replyType === \"rotating\") {",
  "                const rmsgs = (cc.replyContent || \"\").split(\"||\").map((s2) => s2.trim()).filter(Boolean);",
  "                if (rmsgs.length > 0) await activeSock.sendMessage(jid, { text: rmsgs[Math.floor(Math.random() * rmsgs.length)] });",
  "              } else if (cc.replyType === \"image\") {",
  "                const iq = cc.replyContent || \"\";",
  "                if (iq) {",
  "                  try {",
  "                    const { searchImages: searchImgCC } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));",
  "                    const imgRes = await searchImgCC(iq, 1);",
  "                    if (imgRes && imgRes[0]) {",
  "                      const ir = await fetch(imgRes[0].url, { signal: AbortSignal.timeout(15000) });",
  "                      const ibuf = Buffer.from(await ir.arrayBuffer());",
  "                      await activeSock.sendMessage(jid, { image: ibuf, caption: iq });",
  "                    }",
  "                  } catch { await activeSock.sendMessage(jid, { text: \"\u274C \u062A\u0639\u0630\u0651\u0631 \u062C\u0644\u0628 \u0627\u0644\u0635\u0648\u0631\u0629\" }); }",
  "                }",
  "              } else {",
  "                const rt = cc.replyContent || \"\";",
  "                if (rt) await activeSock.sendMessage(jid, { text: rt });",
  "              }",
  "            } catch (ccErr) { logger.warn({ ccErr }, \"[customCode] failed\"); }",
  "            break;",
  "          }",
  "        }",
  "        continue;",
  "      }",
  "      cachePush(cacheKey, msg);"
].join("\n");

patch(WA_ANCHOR, WA_CODES, "\u0645\u0639\u0627\u0644\u062C \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u064A \u0648\u0627\u062A\u0633\u0622\u0628");

// ════════════════════════════════════════════════════════
// PATCH 5: شريط تقدم يوتيوب (vid)
// ════════════════════════════════════════════════════════
patch(
  "            try {\n              await activeSock.sendMessage(jid, { text: `\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 \"${query}\" \u2014 \u062C\u0648\u062F\u0629 ${qualityLabel}...` });\n            } catch {\n            }\n            try {\n              const { searchAndDownloadYouTubeVideo: searchAndDownloadYouTubeVideo2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeVideo2(query, count, 0, quality);\n              for (const r of results) {\n                const tags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try {\n                  await activeSock.sendMessage(jid, {\n                    video: r.buffer,\n                    caption: `\u{1F3AC} ${r.title}${tags}`,\n                    mimetype: \"video/mp4\"\n                  });\n                  await new Promise((res) => setTimeout(res, 1e3));\n                } catch {\n                }\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/vid] failed\");\n              const msg2 = e?.message ? `\u274C ${e.message.slice(0,120)}` : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u2014 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B \u0623\u0648 \u062C\u0631\u0651\u0628 \u0627\u0633\u0645\u0627\u064B \u0622\u062E\u0631\";\n              try {\n                await activeSock.sendMessage(jid, { text: msg2 });\n              } catch {\n              }\n            }",
  "            let _vPK = null;\n            try { const _vS = await activeSock.sendMessage(jid, { text: \"\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \\\"\" + query + \"\\\" (\" + qualityLabel + \")...\\n\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 0%\" }); _vPK = _vS && _vS.key || null; } catch {}\n            const _eVP = async (t) => { if (_vPK) try { await activeSock.sendMessage(jid, { text: t, edit: _vPK }); } catch {} };\n            try {\n              await _eVP(\"\u2B07\uFE0F \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...\\n\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%\");\n              const { searchAndDownloadYouTubeVideo: searchAndDownloadYouTubeVideo2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeVideo2(query, count, 0, quality);\n              await _eVP(\"\u2705 \u0627\u0643\u062A\u0645\u0644 (\" + results.length + \" \u0641\u064A\u062F\u064A\u0648)\\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%\");\n              for (const r of results) {\n                const tags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try { await activeSock.sendMessage(jid, { video: r.buffer, caption: `\u{1F3AC} ${r.title}${tags}`, mimetype: \"video/mp4\" }); await new Promise((res) => setTimeout(res, 1e3)); } catch {}\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/vid] failed\");\n              const msg2 = e && e.message ? \"\u274C \" + e.message.slice(0,120) : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\";\n              _eVP(msg2).catch(() => {});\n              if (!_vPK) try { await activeSock.sendMessage(jid, { text: msg2 }); } catch {}\n            }",
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u064A\u0648\u062A\u064A\u0648\u0628 (vid)"
);

// ════════════════════════════════════════════════════════
// PATCH 6: شريط تقدم تيك توك
// ════════════════════════════════════════════════════════
patch(
  "            try {\n              await activeSock.sendMessage(jid, { text: `\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 \"${query}\" \u0641\u064A \u062A\u064A\u0643 \u062A\u0648\u0643...` });\n            } catch {\n            }\n            try {\n              const { searchAndDownloadTikTok: searchAndDownloadTikTok2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadTikTok2(query, count);\n              for (const r of results) {\n                const tags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try {\n                  await activeSock.sendMessage(jid, {\n                    video: r.buffer,\n                    caption: tags || void 0,\n                    mimetype: \"video/mp4\"\n                  });\n                  await new Promise((res) => setTimeout(res, 200));\n                } catch {\n                }\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/tiktok] failed\");\n              const msg2 = e?.message?.includes(\"\u0644\u0645 \u0623\u062C\u062F\") || e?.message?.includes(\"\u0641\u0634\u0644\") ? `\u274C ${e.message}` : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u062A\u064A\u0643 \u062A\u0648\u0643\u060C \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B\";\n              try {\n                await activeSock.sendMessage(jid, { text: msg2 });\n              } catch {\n              }\n            }",
  "            let _ttPK = null;\n            try { const _ttS = await activeSock.sendMessage(jid, { text: \"\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \\\"\" + query + \"\\\" \u0641\u064A \u062A\u064A\u0643 \u062A\u0648\u0643...\\n\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 0%\" }); _ttPK = _ttS && _ttS.key || null; } catch {}\n            const _eTTP = async (t) => { if (_ttPK) try { await activeSock.sendMessage(jid, { text: t, edit: _ttPK }); } catch {} };\n            try {\n              await _eTTP(\"\u2B07\uFE0F \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0645\u0646 \u062A\u064A\u0643 \u062A\u0648\u0643...\\n\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%\");\n              const { searchAndDownloadTikTok: searchAndDownloadTikTok2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadTikTok2(query, count);\n              await _eTTP(\"\u2705 \u0627\u0643\u062A\u0645\u0644 (\" + results.length + \" \u0641\u064A\u062F\u064A\u0648)\\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%\");\n              for (const r of results) {\n                const tags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try { await activeSock.sendMessage(jid, { video: r.buffer, caption: tags || void 0, mimetype: \"video/mp4\" }); await new Promise((res) => setTimeout(res, 200)); } catch {}\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/tiktok] failed\");\n              const msg2 = e && e.message && (e.message.includes(\"\u0644\u0645 \u0623\u062C\u062F\") || e.message.includes(\"\u0641\u0634\u0644\")) ? \"\u274C \" + e.message : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u062A\u064A\u0643 \u062A\u0648\u0643\";\n              _eTTP(msg2).catch(() => {});\n              if (!_ttPK) try { await activeSock.sendMessage(jid, { text: msg2 }); } catch {}\n            }",
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u062A\u064A\u0643 \u062A\u0648\u0643"
);

// ════════════════════════════════════════════════════════
// PATCH 7: شريط تقدم الأغاني (song)
// ════════════════════════════════════════════════════════
patch(
  "            try {\n              await activeSock.sendMessage(jid, { text: \"\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 \\\"\" + query + \"\\\" \u00D7\" + count + \" \u0623\u063A\u0646\u064A\u0629...\" });\n            } catch {\n            }\n            try {\n              const { searchAndDownloadYouTubeAudio: searchAndDownloadYouTubeAudio2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeAudio2(query, count, 0);\n              for (const r of results) {\n                const songTags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try {\n                  await activeSock.sendMessage(jid, { audio: r.buffer, mimetype: \"audio/mpeg\", ptt: false });\n                  if (r.title) await activeSock.sendMessage(jid, { text: \"🎵 \" + r.title + songTags }).catch(() => {});\n                  await new Promise((res) => setTimeout(res, 500));\n                } catch {\n                }\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/song] failed\");\n              const msg2 = e?.message ? `\u274C ${e.message}` : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0646\u064A\u0629 \u2014 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B \u0623\u0648 \u062C\u0631\u0651\u0628 \u0627\u0633\u0645\u0627\u064B \u0622\u062E\u0631\";\n              try {\n                await activeSock.sendMessage(jid, { text: msg2 });\n              } catch {\n              }\n            }",
  "            let _sgPK = null;\n            try { const _sgS = await activeSock.sendMessage(jid, { text: \"\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \\\"\" + query + \"\\\" \u00D7\" + count + \" \u0623\u063A\u0646\u064A\u0629...\\n\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 0%\" }); _sgPK = _sgS && _sgS.key || null; } catch {}\n            const _eSGP = async (t) => { if (_sgPK) try { await activeSock.sendMessage(jid, { text: t, edit: _sgPK }); } catch {} };\n            try {\n              await _eSGP(\"\u2B07\uFE0F \u062C\u0627\u0631\u064D \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u063A\u0627\u0646\u064A...\\n\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%\");\n              const { searchAndDownloadYouTubeAudio: searchAndDownloadYouTubeAudio2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeAudio2(query, count, 0);\n              await _eSGP(\"\u2705 \u0627\u0643\u062A\u0645\u0644 (\" + results.length + \" \u0623\u063A\u0646\u064A\u0629)\\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%\");\n              for (const r of results) {\n                const songTags = hashtags.length > 0 ? \"\\n\" + hashtags.join(\" \") : \"\";\n                try { await activeSock.sendMessage(jid, { audio: r.buffer, mimetype: \"audio/mpeg\", ptt: false }); if (r.title) await activeSock.sendMessage(jid, { text: \"\uD83C\uDFB5 \" + r.title + songTags }).catch(() => {}); await new Promise((res) => setTimeout(res, 500)); } catch {}\n              }\n            } catch (e) {\n              logger.warn({ e }, \"[/song] failed\");\n              const msg2 = e && e.message ? \"\u274C \" + e.message : \"\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0646\u064A\u0629\";\n              _eSGP(msg2).catch(() => {});\n              if (!_sgPK) try { await activeSock.sendMessage(jid, { text: msg2 }); } catch {}\n            }",
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u0627\u0644\u0623\u063A\u0627\u0646\u064A (song)"
);

// ════════════════════════════════════════════════════════
// PATCH 8: /حالة — دعم الكود مع مسافة
// ════════════════════════════════════════════════════════
patch(
  "if (myS.statusCopyEnabled && trimmed === myS.statusCopyCmd) {",
  "if (myS.statusCopyEnabled && (trimmed === myS.statusCopyCmd || trimmed.startsWith(myS.statusCopyCmd + \" \"))) {",
  "/\u062D\u0627\u0644\u0629 \u2014 \u062F\u0639\u0645 \u0627\u0644\u0643\u0648\u062F \u0645\u0639 \u0645\u0633\u0627\u0641\u0629"
);

// ════════════════════════════════════════════════════════
// كتابة الملف
// ════════════════════════════════════════════════════════
writeFileSync(filePath, code, "utf8");
console.log("\n\u2705 \u062A\u0645 \u062A\u0637\u0628\u064A\u0642 " + patches + " \u062A\u0639\u062F\u064A\u0644 \u2014 patch-new-features");
