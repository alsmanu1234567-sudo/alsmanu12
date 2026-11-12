/**
 * extract-phase5.mjs
 * يستخرج handleTextMessage → dist/text-handler.mjs
 * ويستخرج handleCallback     → dist/callback-handler.mjs
 *
 * التحويلات:
 *  1. يضيف setDeps() لكل ملف
 *  2. يستبدل IIFE patterns بـ _deps._mod_X() getters
 *  3. يُضيف destructuring للمتغيرات المُحقنة في بداية كل دالة
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC  = join(__dirname, 'dist', 'index.mjs');

const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

// ── أداة قراءة نطاق سطور ───────────────────────────────────────────────────
function getLines(from, to) {   // 1-indexed inclusive
  return lines.slice(from - 1, to).join('\n');
}

// ── تحويل IIFE patterns ─────────────────────────────────────────────────────
// قبل: Promise.resolve().then(() => (init_X(), X_exports))
// بعد: _deps._mod_X()
function transformIIFEs(code, modMap) {
  let result = code;
  for (const [modName, getter] of Object.entries(modMap)) {
    // match: (init_modName(), modName_exports)
    const pat = new RegExp(
      `Promise\\.resolve\\(\\)\\.then\\(\\(\\) => \\(init_${modName}\\(\\),\\s*${modName}_exports\\)\\)`,
      'g'
    );
    result = result.replace(pat, `_deps._mod_${modName}()`);
  }
  return result;
}

// ── استخراج handleCallback ───────────────────────────────────────────────────
{
  const CB_START = 324374;   // line number 1-indexed
  const CB_END   = 324597;   // السطر الأخير من الدالة (السطر 324598 هو showHelp)

  let body = getLines(CB_START, CB_END);

  // استبدال IIFE patterns
  const cbMods = {
    auto_reply:      'auto_reply',
    baileys_session: 'baileys_session',
    github:          'github',
    messages2:       'messages2',      // init_messages2 → messages_exports
  };
  // خاص: init_messages2 → messages_exports (الاسم مختلف)
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_messages2\(\),\s*messages_exports\)\)/g,
    '_deps._mod_messages2()'
  );
  body = transformIIFEs(body, {
    auto_reply:      'auto_reply',
    baileys_session: 'baileys_session',
    github:          'github',
  });

  // تغيير signature من `async function handleCallback` إلى exported
  body = body.replace(
    'async function handleCallback(bot2, query) {',
    'export async function handleCallback(bot2, query) {\n  const { getUser, saveUser, getState, setState, clearState, DEVELOPER_ID, mainMenuKeyboard, getWelcomeText, replyTargetKeyboard, cancelKeyboard, callsMenuKeyboard, securityMenuKeyboard, personsMenuKeyboard, handleMsgsCallback, handleMyMsgsCallback, handleLinkingCallback, handleNumbersCallback, handleNumberCallback, handleAutoReplyCallback, handlePointsCallback, handleConfirmBuy, handleSecurityCallback, handleCallsCallback, handlePersonsCallback, handleBridgeCallback, handleScheduleCallback, handleReportsCallback, handleAiCallback, handleAiCallback2, handleGroupsCallback, handleGroupsV2, handleStatusCallback, handleDevTexts, handleDevChannels, handleDevKeepalive, handleDevTextCallback, handleDevChannelsCallback, handleDevCallback, handleBulkPoints, handleEvilFeature, handleDevEconomy, handleDevInbox, showHelp, showInfo2, handleMsgToDev, handleBuyMizajStars } = _deps;'
  );

  const cbFile = `// dist/callback-handler.mjs
// Phase 5: handleCallback extracted from dist/index.mjs
// جميع الاعتماديات مُحقنة عبر setDeps()

let _deps = null;

export function setDeps(d) {
  _deps = d;
}

${body}
`;

  writeFileSync(join(__dirname, 'dist', 'callback-handler.mjs'), cbFile, 'utf8');
  console.log('[Phase5] ✅ dist/callback-handler.mjs created');
}

// ── استخراج handleTextMessage ────────────────────────────────────────────────
{
  const TXT_START = 299339;
  const TXT_END   = 300836;   // السطر الأخير (300837 هو handleTriggerTypeCallback2)

  let body = getLines(TXT_START, TXT_END);

  // استبدال IIFE patterns
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_constants\(\),\s*constants_exports\)\)/g,
    '_deps._mod_constants()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_database\(\),\s*database_exports\)\)/g,
    '_deps._mod_database()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_db\(\),\s*db_exports\)\)/g,
    '_deps._mod_db()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_github\(\),\s*github_exports\)\)/g,
    '_deps._mod_github()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_groups_handler\(\),\s*groups_handler_exports\)\)/g,
    '_deps._mod_groups_handler()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_keyboards\(\),\s*keyboards_exports\)\)/g,
    '_deps._mod_keyboards()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_my_msgs\(\),\s*my_msgs_exports\)\)/g,
    '_deps._mod_my_msgs()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_phone_lookup\(\),\s*phone_lookup_exports\)\)/g,
    '_deps._mod_phone_lookup()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_search_utils\(\),\s*search_utils_exports\)\)/g,
    '_deps._mod_search_utils()'
  );
  body = body.replace(
    /Promise\.resolve\(\)\.then\(\(\) => \(init_status\(\),\s*status_exports\)\)/g,
    '_deps._mod_status()'
  );

  // تغيير signature
  body = body.replace(
    'async function handleTextMessage(bot2, msg) {',
    `export async function handleTextMessage(bot2, msg) {
  const { getUser, saveUser, getState, setState, clearState, DEVELOPER_ID, BOT_USERNAME, DEVELOPER_NAME, inMemoryDB, TIER_NAMES, setDynamicPrice, mainMenuKeyboard, cancelKeyboard, personsMenuKeyboard, callsMenuKeyboard, securityMenuKeyboard, bridgeMenuKeyboard, scheduleMenuKeyboard, replyTargetKeyboard, handleStart, handleHelp, showConnect, handleLinkQr, handleLinkNumber, handleAddReply2, showPoints, showFeatures, handleNumbersMenu, handleAiMenu, showReplies2, handleNumberStateInput, handleAutoReplyTextInput, handleGithubTextInput2, handleGroupsTextInput, handleStatusTextInput2, handleMyMsgsTextInput2, handleTextEditInput, handleChannelGuardInput, handleDevTexts, handleDevChannels, handleDevKeepalive, sendDevPanel, sendDevUsers, sendDevStats, sendDevErrors, sendDevInbox, sendDevEconomy, sendUserProfile, showInfo, showReplies, handleAddReply, handleGodMode, handleImpersonate, handleModifyPoints, handleGrantFeature, handleRevokeFeature, handleBanUser, handleUnbanUser, handleDeleteUser, handlePersonPicV2 } = _deps;`
  );

  const txtFile = `// dist/text-handler.mjs
// Phase 5: handleTextMessage extracted from dist/index.mjs
// جميع الاعتماديات مُحقنة عبر setDeps()

let _deps = null;

export function setDeps(d) {
  _deps = d;
}

${body}
`;

  writeFileSync(join(__dirname, 'dist', 'text-handler.mjs'), txtFile, 'utf8');
  console.log('[Phase5] ✅ dist/text-handler.mjs created');
}

console.log('\n[Phase5] Run syntax check: node --check dist/callback-handler.mjs && node --check dist/text-handler.mjs');
