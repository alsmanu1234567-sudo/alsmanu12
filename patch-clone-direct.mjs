#!/usr/bin/env node
/**
 * patch-clone-direct.mjs
 * إصلاح: نقل البوت — توليد الملف مباشرة بدون أسئلة نعم/لا
 * GUARD: PATCH_CLONE_DIRECT_APPLIED
 */

import { readFileSync, writeFileSync } from "fs";

const FILE  = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_CLONE_DIRECT_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): نسخ البوت مباشر");
  process.exit(0);
}

let applied = 0;

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) {
    console.warn(`⚠️  [patch-clone-direct] لم يُعثر على: ${desc}`);
    return;
  }
  code = code.replace(oldStr, newStr);
  applied++;
}

// ═══════════════════════════════════════════════════
// A: handleCloneGen — توليد مباشر بدون أسئلة نعم/لا
// ═══════════════════════════════════════════════════
patch(
  `async function handleCloneGen(bot2, chatId, userId) {
  await bot2.sendMessage(chatId, "\\u{1F50D} \\u062C\\u0627\\u0631\\u064A \\u0627\\u0643\\u062A\\u0634\\u0627\\u0641 \\u0639\\u0646\\u0648\\u0627\\u0646 \\u0627\\u0644\\u0627\\u0633\\u062A\\u0636\\u0627\\u0641\\u0629 \\u0627\\u0644\\u062D\\u0627\\u0644\\u064A\\u0629...");
  let detectedAddr = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8e3) });
    const { ip } = await r.json();
    const port2 = process.env.PORT || "5000";
    detectedAddr = \`\${ip}:\${port2}\`;
  } catch {
  }
  const replitDomain = (process.env.REPLIT_DOMAINS || "").split(",")[0].trim();
  const replitUrl = replitDomain ? \`https://\${replitDomain}/bot\` : null;
  let msg = \`\\u{1F501} *\\u0646\\u0638\\u0627\\u0645 \\u0646\\u0633\\u062E \\u0627\\u0644\\u0628\\u0648\\u062A*

\`;
  if (detectedAddr) {
    msg += \`\\u{1F310} \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u0627\\u0644\\u0645\\u0643\\u062A\\u0634\\u0641: \\\`\${detectedAddr}\\\`
\`;
    msg += \`\\u{1F4E1} Replit (\\u0627\\u062D\\u062A\\u064A\\u0627\\u0637\\u064A): \${replitUrl || "\\u063A\\u064A\\u0631 \\u0645\\u062A\\u0627\\u062D"}

\`;
    msg += \`\\u0647\\u0644 \\u0647\\u0630\\u0627 \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u0635\\u062D\\u064A\\u062D \\u0644\\u0644\\u0627\\u0633\\u062A\\u0636\\u0627\\u0641\\u0629 \\u0627\\u0644\\u062D\\u0627\\u0644\\u064A\\u0629\\u061F\`;
  } else {
    msg += \`\\u26A0\\uFE0F \\u0644\\u0645 \\u0623\\u062A\\u0645\\u0643\\u0646 \\u0645\\u0646 \\u0627\\u0643\\u062A\\u0634\\u0627\\u0641 \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u062A\\u0644\\u0642\\u0627\\u0626\\u064A\\u0627\\u064B

\`;
    msg += \`\\u064A\\u0645\\u0643\\u0646\\u0643 \\u0625\\u062F\\u062E\\u0627\\u0644\\u0647 \\u064A\\u062F\\u0648\\u064A\\u0627\\u064B \\u0623\\u0648 \\u0627\\u0633\\u062A\\u062E\\u062F\\u0627\\u0645 Replit \\u0643\\u0645\\u0635\\u062F\\u0631 \\u0627\\u062D\\u062A\\u064A\\u0627\\u0637\\u064A \\u0641\\u0642\\u0637.\`;
  }
  const keyboard = { inline_keyboard: [] };
  if (detectedAddr) {
    keyboard.inline_keyboard.push([
      { text: \`\\u2705 \\u0646\\u0639\\u0645\\u060C \\u0627\\u0633\\u062A\\u062E\\u062F\\u0645 \${detectedAddr}\`, callback_data: \`dev_clone_confirm_\${encodeURIComponent(detectedAddr)}\` }
    ]);
  }
  keyboard.inline_keyboard.push([
    { text: "\\u270F\\uFE0F \\u0623\\u062F\\u062E\\u0644 \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u064A\\u062F\\u0648\\u064A\\u0627\\u064B", callback_data: "dev_clone_custom" }
  ]);
  if (replitUrl) {
    keyboard.inline_keyboard.push([
      { text: "\\u2601\\uFE0F Replit \\u0641\\u0642\\u0637 (\\u0628\\u062F\\u0648\\u0646 \\u0639\\u0646\\u0648\\u0627\\u0646 \\u0645\\u062D\\u0644\\u064A)", callback_data: "dev_clone_replit_only" }
    ]);
  }
  keyboard.inline_keyboard.push([{ text: "\\u{1F519} \\u0644\\u0644\\u0645\\u0637\\u0648\\u0631", callback_data: "dev_panel" }]);
  await bot2.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
}`,
  `async function handleCloneGen(bot2, chatId, userId) {
  // PATCH_CLONE_DIRECT: يولّد الملف فوراً بدون أسئلة
  let detectedAddr = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8e3) });
    const { ip } = await r.json();
    const port2 = process.env.PORT || "5000";
    detectedAddr = \`\${ip}:\${port2}\`;
  } catch {}
  await generateAndSendClone(bot2, chatId, detectedAddr);
}`,
  "handleCloneGen مباشر"
);

// ═══════════════════════════════════════════════════
// تطبيق وحفظ
// ═══════════════════════════════════════════════════
if (applied === 0) {
  console.warn("⚠️  patch-clone-direct: لم يُطبَّق أي تعديل");
  process.exit(0);
}

code = code.replace(
  "async function generateAndSendClone(bot2, chatId, customAddr) {",
  GUARD + "\nasync function generateAndSendClone(bot2, chatId, customAddr) {"
);

writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${applied} تعديل): نسخ البوت مباشر بدون أسئلة`);
