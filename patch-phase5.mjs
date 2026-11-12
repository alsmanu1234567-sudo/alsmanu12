/**
 * patch-phase5.mjs
 * Phase 5: استخراج handleTextMessage و handleCallback من dist/index.mjs
 *
 * الخطوات:
 *  1. إضافة imports لـ callback-handler.mjs و text-handler.mjs
 *  2. إضافة Phase 5 registration block مع setDeps() للوحدتين الجديدتين
 *  3. تحويل handleTextMessage و handleCallback في index.mjs إلى stubs تفوّض للوحدات الجديدة
 *
 * Guard: PATCH_PHASE5_HANDLERS_EXTRACTED
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_PHASE5_HANDLERS_EXTRACTED';

let src = readFileSync(INDEX_PATH, 'utf8');

if (src.includes(GUARD)) {
  console.log(`[Phase5] ℹ️  Guard '${GUARD}' موجود — التعديل مُطبَّق مسبقاً، لا حاجة للإعادة.`);
  process.exit(0);
}

let changeCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// 1. إضافة imports لـ callback-handler.mjs و text-handler.mjs
// ─────────────────────────────────────────────────────────────────────────────
const IMPORT_ANCHOR = `import * as _dispatcherMod from './dispatcher.mjs';     // PATCH_ROUTER_INIT_APPLIED`;
const IMPORT_NEW = `import * as _dispatcherMod from './dispatcher.mjs';     // PATCH_ROUTER_INIT_APPLIED
import * as _txtHandlerMod  from './text-handler.mjs';   // PATCH_PHASE5_HANDLERS_EXTRACTED
import * as _cbHandlerMod   from './callback-handler.mjs'; // PATCH_PHASE5_HANDLERS_EXTRACTED`;

if (src.includes(IMPORT_ANCHOR) && !src.includes(`_txtHandlerMod`)) {
  src = src.replace(IMPORT_ANCHOR, IMPORT_NEW);
  changeCount++;
  console.log('[Phase5] ✅ Step 1: imports added');
} else {
  console.log('[Phase5] ⚠️  Step 1: imports already present or anchor not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. إضافة Phase 5 registration block
// ─────────────────────────────────────────────────────────────────────────────
const REG_ANCHOR = `  // ── نهاية Phase 3 ───────────────────────────────────────────────────────
  startDailyReport(bot);`;

const PHASE5_BLOCK = `  // ── Phase 5: Text & Callback Handlers Extraction [${GUARD}] ──────────────
  {
    // ── deps مشتركة ──────────────────────────────────────────────────────────
    const _p5CommonDeps = {
      // DB & State
      getUser, saveUser, getState, setState, clearState,
      // Constants
      DEVELOPER_ID,
      // InMemory
      inMemoryDB,
      // UI utils
      mainMenuKeyboard, cancelKeyboard, getWelcomeText,
      replyTargetKeyboard, personsMenuKeyboard,
      callsMenuKeyboard, securityMenuKeyboard, bridgeMenuKeyboard,
      scheduleMenuKeyboard,
      // Module IIFE getters (لأن bundled modules تستخدم IIFE init pattern)
      _mod_auto_reply:       () => { init_auto_reply();       return auto_reply_exports;      },
      _mod_baileys_session:  () => { init_baileys_session();  return baileys_session_exports; },
      _mod_github:           () => { init_github();           return github_exports;           },
      _mod_messages2:        () => { init_messages2();        return messages_exports;         },
      _mod_constants:        () => { init_constants();        return constants_exports;        },
      _mod_database:         () => { init_database();         return database_exports;         },
      _mod_db:               () => { init_db();               return db_exports;               },
      _mod_groups_handler:   () => { init_groups_handler();   return groups_handler_exports;   },
      _mod_keyboards:        () => { init_keyboards();        return keyboards_exports;        },
      _mod_my_msgs:          () => { init_my_msgs();          return my_msgs_exports;          },
      _mod_phone_lookup:     () => { init_phone_lookup();     return phone_lookup_exports;     },
      _mod_search_utils:     () => { init_search_utils();     return search_utils_exports;     },
      _mod_status:           () => { init_status();           return status_exports;           },
    };

    // ── deps الـ text-handler ──────────────────────────────────────────────────
    const _p5TxtDeps = {
      ..._p5CommonDeps,
      BOT_USERNAME, DEVELOPER_NAME, TIER_NAMES, setDynamicPrice,
      // Command handlers (defined later in index.mjs but hoisted as functions)
      handleStart, handleHelp, showConnect, handleLinkQr, handleLinkNumber,
      handleAddReply2, showPoints, showFeatures, handleNumbersMenu, handleAiMenu,
      showReplies2, handleNumberStateInput, handleAutoReplyTextInput,
      handleGithubTextInput2, handleGroupsTextInput, handleStatusTextInput2,
      handleMyMsgsTextInput2, handleTextEditInput, handleChannelGuardInput,
      handleDevTexts, handleDevChannels, handleDevKeepalive,
      sendDevPanel, sendDevUsers, sendDevStats, sendDevErrors,
      sendDevInbox, sendDevEconomy, sendUserProfile,
      showInfo, showReplies, handleAddReply,
      handleGodMode, handleImpersonate, handleModifyPoints,
      handleGrantFeature, handleRevokeFeature, handleBanUser,
      handleUnbanUser, handleDeleteUser, handlePersonPicV2,
    };

    // ── deps الـ callback-handler ─────────────────────────────────────────────
    const _p5CbDeps = {
      ..._p5CommonDeps,
      // Callback sub-handlers (functions defined in index.mjs)
      handleMsgsCallback, handleMyMsgsCallback, handleLinkingCallback,
      handleNumbersCallback, handleNumberCallback,
      handleAutoReplyCallback, handlePointsCallback, handleConfirmBuy,
      handleSecurityCallback, handleCallsCallback, handlePersonsCallback,
      handleBridgeCallback, handleScheduleCallback, handleReportsCallback,
      handleAiCallback, handleAiCallback2, handleGroupsCallback, handleGroupsV2,
      handleStatusCallback,
      handleDevTexts, handleDevChannels, handleDevKeepalive,
      handleDevTextCallback, handleDevChannelsCallback, handleDevCallback,
      handleBulkPoints, handleEvilFeature, handleDevEconomy, handleDevInbox,
      showHelp, showInfo2, handleMsgToDev, handleBuyMizajStars,
    };

    _txtHandlerMod.setDeps(_p5TxtDeps);
    _cbHandlerMod.setDeps(_p5CbDeps);

    // إعادة تسجيل معالج الرسائل ومعالج الـ callbacks للوحدات المستخرجة
    _routerMod.setMessageHandler(_txtHandlerMod.handleTextMessage);
    _dispatcherMod.setCallbackHandler(_cbHandlerMod.handleCallback);

    logger.info({ phase: 5 }, '[${GUARD}] Text & Callback handlers extracted to separate modules');
  }

  // ── نهاية Phase 3 ───────────────────────────────────────────────────────
  startDailyReport(bot);`;

if (src.includes(REG_ANCHOR)) {
  src = src.replace(REG_ANCHOR, PHASE5_BLOCK);
  changeCount++;
  console.log('[Phase5] ✅ Step 2: Phase 5 registration block added');
} else {
  console.log('[Phase5] ❌ Step 2: REG_ANCHOR not found!');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. تحويل handleTextMessage و handleCallback إلى stubs
// ─────────────────────────────────────────────────────────────────────────────

// --- Stub handleTextMessage ---
const TXT_SIG = 'async function handleTextMessage(bot2, msg) {';
const TXT_END_MARKER = 'async function handleTriggerTypeCallback2(';

const txtStart = src.indexOf(TXT_SIG);
const txtEnd   = src.indexOf(TXT_END_MARKER, txtStart);

if (txtStart !== -1 && txtEnd !== -1) {
  const original = src.slice(txtStart, txtEnd);
  const stub = `async function handleTextMessage(bot2, msg) {
  // [${GUARD}] Extracted to dist/text-handler.mjs — stub delegates to module
  return _txtHandlerMod.handleTextMessage(bot2, msg);
}
`;
  src = src.slice(0, txtStart) + stub + src.slice(txtEnd);
  changeCount++;
  console.log(`[Phase5] ✅ Step 3a: handleTextMessage stubbed (was ${original.split('\n').length} lines)`);
} else {
  console.log('[Phase5] ❌ Step 3a: handleTextMessage NOT found — check line ranges');
  process.exit(1);
}

// --- Stub handleCallback ---
const CB_SIG = 'async function handleCallback(bot2, query) {';
const CB_END_MARKER = 'async function showHelp(';

const cbStart = src.indexOf(CB_SIG);
const cbEnd   = src.indexOf(CB_END_MARKER, cbStart);

if (cbStart !== -1 && cbEnd !== -1) {
  const original = src.slice(cbStart, cbEnd);
  const stub = `async function handleCallback(bot2, query) {
  // [${GUARD}] Extracted to dist/callback-handler.mjs — stub delegates to module
  return _cbHandlerMod.handleCallback(bot2, query);
}
`;
  src = src.slice(0, cbStart) + stub + src.slice(cbEnd);
  changeCount++;
  console.log(`[Phase5] ✅ Step 3b: handleCallback stubbed (was ${original.split('\n').length} lines)`);
} else {
  console.log('[Phase5] ❌ Step 3b: handleCallback NOT found — check signature');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write output
// ─────────────────────────────────────────────────────────────────────────────
writeFileSync(INDEX_PATH, src, 'utf8');
console.log(`\n[Phase5] ✅ Done — ${changeCount} changes applied to dist/index.mjs`);
console.log('[Phase5] Run: node --check dist/index.mjs && node tests/validate-engine.mjs');
