#!/usr/bin/env node
/**
 * patch-new-features-2.mjs — الجزء الثاني: زر القائمة + شرائط التقدم
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath  = join(__dirname, "dist", "index.mjs");
const GUARD     = "// PATCH_NEW_FEATURES_2_APPLIED";

let code = readFileSync(filePath, "utf8");
if (code.includes(GUARD)) {
  console.log("\u23ED\uFE0F  \u0645\u064F\u0637\u0628\u064E\u0651\u0642 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 patch-new-features-2");
  process.exit(0);
}

let patches = 0;
function patch(old, neo, desc) {
  if (!code.includes(old)) { console.warn("\u26A0\uFE0F  \u0644\u0645 \u064A\u064F\u062C\u064E\u062F:", desc); return; }
  code = code.replace(old, neo);
  console.log("\u2705", desc);
  patches++;
}

// ════════════════════════════════════════════════════════
// PATCH 1: إضافة زر "أكواد خاصة" للقائمة — بأنماط مُهرَّبة صحيحة
// ════════════════════════════════════════════════════════
// الملف يحتوي على النص الحرفي: \uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629
// لذا نستخدم \\u في سلاسل JavaScript للبحث عن النص الحرفي
patch(
  'callback_data: "mymsgs_show_cod" }, { text: "\\uD83C\\uDFE0 \\u0627\\u0644\\u0631\\u0626\\u064A\\u0633\\u064A\\u0629", callback_data: "home" }]',
  'callback_data: "mymsgs_show_codes" }],\n      [{ text: "\\u{1F517} \\u0631\\u0645\\u0632 \\u0631\\u0628\\u0637 \\u0631\\u0642\\u0645", callback_data: "mymsgs_show_cod" }, { text: "\\uD83C\\uDFE0 \\u0627\\u0644\\u0631\\u0626\\u064A\\u0633\\u064A\\u0629", callback_data: "home" }]',
  "\u0625\u0636\u0627\u0641\u0629 \u0632\u0631 \u0623\u0643\u0648\u0627\u062F \u062E\u0627\u0635\u0629"
);

// ════════════════════════════════════════════════════════
// PATCH 2: شريط تقدم لتحميل فيديو يوتيوب (vid)
// ════════════════════════════════════════════════════════
// الأنماط خالصة ASCII — لا مشكلة في الهروب
patch(
  "              const { searchAndDownloadYouTubeVideo: searchAndDownloadYouTubeVideo2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeVideo2(query, count, 0, quality);",
  [
    // GUARD داخل الكود المحقون
    '              // PATCH_NEW_FEATURES_2_APPLIED',
    '              let _vPK = null;',
    '              try {',
    '                const _vSent = await activeSock.sendMessage(jid, { text: "\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644... \u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%" });',
    '                _vPK = _vSent && _vSent.key || null;',
    '              } catch {}',
    '              const { searchAndDownloadYouTubeVideo: searchAndDownloadYouTubeVideo2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));',
    '              const results = await searchAndDownloadYouTubeVideo2(query, count, 0, quality);',
    '              if (_vPK) activeSock.sendMessage(jid, { text: "\u2705 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u062D\u0645\u064A\u0644 (" + results.length + " \u0641\u064A\u062F\u064A\u0648) \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%", edit: _vPK }).catch(() => {});'
  ].join("\n"),
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u064A\u0648\u062A\u064A\u0648\u0628 (vid)"
);

// ════════════════════════════════════════════════════════
// PATCH 3: شريط تقدم تيك توك
// ════════════════════════════════════════════════════════
patch(
  "              const { searchAndDownloadTikTok: searchAndDownloadTikTok2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadTikTok2(query, count);",
  [
    '              let _ttPK = null;',
    '              try {',
    '                const _ttSent = await activeSock.sendMessage(jid, { text: "\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0645\u0646 \u062A\u064A\u0643 \u062A\u0648\u0643...\n\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%" });',
    '                _ttPK = _ttSent && _ttSent.key || null;',
    '              } catch {}',
    '              const { searchAndDownloadTikTok: searchAndDownloadTikTok2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));',
    '              const results = await searchAndDownloadTikTok2(query, count);',
    '              if (_ttPK) activeSock.sendMessage(jid, { text: "\u2705 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u062D\u0645\u064A\u0644 (" + results.length + " \u0641\u064A\u062F\u064A\u0648)\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%", edit: _ttPK }).catch(() => {});'
  ].join("\n"),
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u062A\u064A\u0643 \u062A\u0648\u0643"
);

// ════════════════════════════════════════════════════════
// PATCH 4: شريط تقدم الأغاني (song)
// ════════════════════════════════════════════════════════
patch(
  "              const { searchAndDownloadYouTubeAudio: searchAndDownloadYouTubeAudio2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));\n              const results = await searchAndDownloadYouTubeAudio2(query, count, 0);",
  [
    '              let _sgPK = null;',
    '              try {',
    '                const _sgSent = await activeSock.sendMessage(jid, { text: "\u23F3 \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...\n\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 50%" });',
    '                _sgPK = _sgSent && _sgSent.key || null;',
    '              } catch {}',
    '              const { searchAndDownloadYouTubeAudio: searchAndDownloadYouTubeAudio2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));',
    '              const results = await searchAndDownloadYouTubeAudio2(query, count, 0);',
    '              if (_sgPK) activeSock.sendMessage(jid, { text: "\u2705 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u062D\u0645\u064A\u0644 (" + results.length + " \u0623\u063A\u0646\u064A\u0629)\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%", edit: _sgPK }).catch(() => {});'
  ].join("\n"),
  "\u0634\u0631\u064A\u0637 \u062A\u0642\u062F\u0645 \u0627\u0644\u0623\u063A\u0627\u0646\u064A (song)"
);

// ════════════════════════════════════════════════════════
writeFileSync(filePath, code, "utf8");
console.log("\n\u2705 \u062A\u0645 \u062A\u0637\u0628\u064A\u0642 " + patches + " \u062A\u0639\u062F\u064A\u0644 \u2014 patch-new-features-2");
