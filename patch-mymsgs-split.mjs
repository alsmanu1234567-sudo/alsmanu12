// patch-mymsgs-split.mjs — فصل قسم رسائلي إلى dist/my-msgs.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INDEX = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_MYMSGS_SPLIT_APPLIED';

let src = readFileSync(INDEX, 'utf8');

if (src.includes(GUARD)) {
  console.log(`\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A \u0625\u0644\u0649 dist/my-msgs.mjs`);
  process.exit(0);
}

let changes = 0;

// ── 1. إضافة الـ import في رأس الملف ──
const IMPORT_LINE = `import * as _mmMod from './my-msgs.mjs';\n`;
const FIRST_IMPORT = src.indexOf('\nimport ');
if (FIRST_IMPORT === -1 || src.includes(IMPORT_LINE)) {
  if (!src.includes(IMPORT_LINE)) {
    console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0625\u064A\u062C\u0627\u062F \u0645\u0648\u0636\u0639 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F');
    process.exit(1);
  }
} else {
  src = src.slice(0, FIRST_IMPORT + 1) + IMPORT_LINE + src.slice(FIRST_IMPORT + 1);
  changes++;
}

// ── 2. استبدال قسم رسائلي كاملاً ──
const SECTION_START = '\n// src/bot/features/my-msgs/index.ts\nvar my_msgs_exports = {};';
const SECTION_END   = '\n// src/bot/core/number-manager.ts';

const startIdx = src.indexOf(SECTION_START);
const endIdx   = src.indexOf(SECTION_END, startIdx);

if (startIdx === -1) {
  console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0625\u064A\u062C\u0627\u062F \u0628\u062F\u0627\u064A\u0629 \u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0625\u064A\u062C\u0627\u062F \u0646\u0647\u0627\u064A\u0629 \u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A');
  process.exit(1);
}

const originalLen = endIdx - startIdx;

const REPLACEMENT = `
// src/bot/features/my-msgs/index.ts \u2014 \u0641\u064F\u0635\u0644 \u0641\u064A dist/my-msgs.mjs [${GUARD}]
var my_msgs_exports = {};
__export(my_msgs_exports, {
  getMyMsgsSettings: () => getMyMsgsSettings,
  handleMyMsgsCallback: () => handleMyMsgsCallback,
  handleMyMsgsMenu: () => handleMyMsgsMenu,
  handleMyMsgsTextInput: () => handleMyMsgsTextInput,
  myMsgsMenuKeyboard: () => myMsgsMenuKeyboard,
  saveMyMsgsSettings: () => saveMyMsgsSettings
});
function getMyMsgsSettings(user) { return _mmMod.getMyMsgsSettings(user); }
function saveMyMsgsSettings(userId, settings) { return _mmMod.saveMyMsgsSettings(userId, settings); }
function myMsgsMenuKeyboard(s) { return _mmMod.myMsgsMenuKeyboard(s); }
function myMsgsFeatureSubMenu(s, feature) { return _mmMod.myMsgsFeatureSubMenu(s, feature); }
async function handleMyMsgsMenu(bot2, chatId, userId) { return _mmMod.handleMyMsgsMenu(bot2, chatId, userId); }
async function handleMyMsgsCallback(bot2, chatId, userId, data) { return _mmMod.handleMyMsgsCallback(bot2, chatId, userId, data); }
async function handleMyMsgsTextInput(bot2, chatId, userId, text, state) { return _mmMod.handleMyMsgsTextInput(bot2, chatId, userId, text, state); }
var DEFAULTS;
var init_my_msgs = __esm({
  "src/bot/features/my-msgs/index.ts"() {
    "use strict";
    init_database();
    init_keyboards();
    DEFAULTS = {
      profilePicCmd: "/mg",
      exportMembersCmd: "/gm",
      copyCmd: "/copy",
      imgCmd: "/img",
      vidCmd: "/vid",
      tiktokCmd: "/tiktok",
      songCmd: "/song",
      aiCmd: "/ai",
      delCmd: "/del",
      aiImgCmd: "/\u0635\u0648\u0631\u0629",
      filmCmd: "/film",
      statusCopyCmd: "/\u062D\u0627\u0644\u0629",
      profilePicEnabled: true,
      exportMembersEnabled: true,
      copyEnabled: true,
      imgEnabled: true,
      vidEnabled: true,
      tiktokEnabled: true,
      songEnabled: true,
      aiEnabled: true,
      delEnabled: true,
      aiImgEnabled: true,
      filmEnabled: true,
      statusCopyEnabled: true,
      codEnabled: true,
      tagEnabled: false,
      tagCmd: "!tag"
    };
    _mmMod.setDeps({ getUser, saveUser, cancelKeyboard, inMemoryDB, init_state, state_exports });
  }
});`;

src = src.slice(0, startIdx) + REPLACEMENT + src.slice(endIdx);
changes++;
console.log(`\u2705 \u062A\u0645 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A (${originalLen.toLocaleString()} \u062D\u0631\u0641 \u2192 ${REPLACEMENT.length.toLocaleString()} \u062D\u0631\u0641)`);

writeFileSync(INDEX, src, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (${changes} \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A \u0625\u0644\u0649 dist/my-msgs.mjs`);
