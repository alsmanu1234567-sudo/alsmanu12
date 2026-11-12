/**
 * patch-phase4b-routing-fix.mjs
 * Phase 4b: إصلاح نقاط الدخول الوحيدة
 *
 * الإصلاحات:
 *  OP-1: تسجيل payment/media/document handlers في Router
 *  OP-2: تسجيل fw_ prefix في Dispatcher
 *  OP-3: إزالة payment/photo/document blocks من message listener → routeMessage يتولى الكل
 *  OP-4: إزالة fw_ direct call من callback listener → Dispatcher يتولى الأمر
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUARD     = 'PATCH_PHASE4B_ROUTING_FIX_APPLIED';
const INDEX     = join(__dirname, 'dist', 'index.mjs');

let src = readFileSync(INDEX, 'utf8');
if (src.includes(GUARD)) {
  console.log(`[patch-phase4b] Already applied — skipping.`);
  process.exit(0);
}

let modified = src;
let ops = 0;

// ══════════════════════════════════════════════════════════════════════════════
// OP-1+2: إضافة type handler registrations + fw_ في بلوك Phase 4
// ══════════════════════════════════════════════════════════════════════════════

const PHASE4_ANCHOR = `  _routerMod.setMessageHandler(handleTextMessage);
  _dispatcherMod.setCallbackHandler(handleCallback);`;

if (!modified.includes(PHASE4_ANCHOR)) {
  console.error('[patch-phase4b] OP-1 anchor not found — aborting'); process.exit(1);
}

const PHASE4_REPLACEMENT = `  _routerMod.setMessageHandler(handleTextMessage);
  _dispatcherMod.setCallbackHandler(handleCallback);

  // ── Phase 4b: Payment Handler [${GUARD}] ─────────────────────────────────
  _routerMod.setPaymentHandler(async (bot2, msg2) => {
    const _uid = String(msg2.from?.id);
    const _pay = msg2.successful_payment;
    if (_pay.invoice_payload === "mizaj_stars_purchase") {
      const { saveUser: _sv } = await Promise.resolve().then(() => (init_database(), database_exports));
      const { TIER_MAX_NUMBERS: _tmn } = await Promise.resolve().then(() => (init_constants(), constants_exports));
      _sv(_uid, { tier: "mizaj", maxNumbers: _tmn["mizaj"] || 999 });
      await bot2.sendMessage(msg2.chat.id,
        "\u{1F389} *\u0634\u0643\u0631\u0627\u064B \u0639\u0644\u0649 \u062F\u0639\u0645\u0643!*\n\n\u2705 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 *\u0645\u064A\u0632\u0627\u062C* \u0628\u0646\u062C\u0627\u062D!\n\u2B50 1 \u0646\u062C\u0645\u0629 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u062A\u0644\u0642\u0651\u0627\u0647\u0627 \u0627\u0644\u0645\u0637\u0648\u0631\n\n\u{1F525}\u{1F525} \u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u062C\u0645\u064A\u0639 \u0645\u064A\u0632\u0627\u062A \u0645\u064A\u0632\u0627\u062C \u0627\u0644\u0622\u0646!",
        { parse_mode: "Markdown" });
      const _dv2 = parseInt(DEVELOPER_ID);
      if (!isNaN(_dv2)) {
        await bot2.sendMessage(_dv2,
          "\u2B50 *\u062F\u0641\u0639\u0629 \u0646\u062C\u0648\u0645 \u062C\u062F\u064A\u062F\u0629!*\n\n\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: " + _uid +
          "\n\u0627\u0644\u0645\u064A\u0632\u0629: \u0645\u064A\u0632\u0627\u062C\n\u0627\u0644\u0645\u0628\u0644\u063A: 1 \u0646\u062C\u0645\u0629").catch(() => {});
      }
    }
  });

  // ── Phase 4b: Media Handler (photo/video) [${GUARD}] ─────────────────────
  _routerMod.setMediaHandler(async (bot2, msg2) => {
    const _uid = String(msg2.from?.id);
    const { getState: _gs } = await Promise.resolve().then(() => (init_state(), state_exports));
    const _st = _gs(_uid);
    if (_st.state === "awaiting_status_image" || _st.state === "awaiting_status_video") {
      const { handleStatusMedia: _hsm } = await Promise.resolve().then(() => (init_status(), status_exports));
      await _hsm(bot2, msg2.chat.id, _uid, msg2, _st);
      return true;
    }
    return false;
  });

  // ── Phase 4b: Document Handler [${GUARD}] ────────────────────────────────
  _routerMod.setDocumentHandler(async (bot2, msg2) => {
    const _uid = String(msg2.from?.id);
    const { getState: _gsD } = await Promise.resolve().then(() => (init_state(), state_exports));
    const _dst = _gsD(_uid);
    if (_dst.state === "awaiting_reply_import_json" || _dst.state === "awaiting_code_parts") {
      try {
        const _fl = await bot2.getFileLink(msg2.document.file_id);
        const _ft = await (await fetch(_fl)).text();
        const { clearState: _clr } = await Promise.resolve().then(() => (init_state(), state_exports));
        const { saveAutoReply: _sar } = await Promise.resolve().then(() => (init_auto_reply(), auto_reply_exports))
          .catch(() => ({ saveAutoReply: saveAutoReply }));
        _clr(_uid);
        try {
          const _imp = JSON.parse(_ft);
          const _arr = Array.isArray(_imp) ? _imp : [_imp];
          let _cnt = 0;
          for (const _r of _arr.slice(0, 100)) {
            if (_r.trigger && _r.replyContent !== undefined) {
              try { _sar(_uid, _r); _cnt++; } catch { saveAutoReply(_uid, _r); _cnt++; }
            }
          }
          await bot2.sendMessage(msg2.chat.id, "\u2705 \u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F " + _cnt + " \u0631\u062F\u0651\u0627\u064B \u0645\u0646 \u0627\u0644\u0645\u0644\u0641!");
        } catch (_e) {
          await bot2.sendMessage(msg2.chat.id, "\u274C \u0645\u0644\u0641 JSON \u063A\u064A\u0631 \u0635\u062D\u064A\u062D: " + _e.message);
        }
      } catch (_e) {
        await bot2.sendMessage(msg2.chat.id, "\u274C \u062E\u0637\u0623 \u0641\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641: " + _e.message);
      }
    }
  });

  // ── Phase 4b: fw_ Forward Callbacks → Dispatcher prefix [${GUARD}] ───────
  _dispatcherMod.registerPrefix('fw_', async (_data, _bot, _query) => {
    const { handleForwardCallback: _hfc } = await import('./forward.mjs');
    await _hfc(_query).catch(() => false);
  });

  logger.info(
    { handlers: ['payment','media','document'], fwPrefix: true },
    '[${GUARD}] All message types + fw_ routed through Router & Dispatcher'
  );`;

modified = modified.replace(PHASE4_ANCHOR, PHASE4_REPLACEMENT);
ops++;
console.log('[patch-phase4b] OP-1+2: type handlers registered in Router + fw_ in Dispatcher ✅');

// ══════════════════════════════════════════════════════════════════════════════
// OP-3: إزالة payment/photo/document blocks من message listener
//       نستخدم regex لتجنب مشكلة unicode escapes في template literals
// ══════════════════════════════════════════════════════════════════════════════

// المنطق: نجد قسم "pingWorker + payment block + photo + document + text guard + subscription + DB + routeMessage"
// ونستبدله بـ "pingWorker + subscription للنص فقط + DB sync للنص + routeMessage للكل"

const MSG_REGION_RE = /( {6}workerManager\.pingWorker\(userId\);[\s\S]*?if \(msg\.successful_payment\) \{[\s\S]*?return;\s*\}\s*if \(msg\.photo \|\| msg\.video\) \{[\s\S]*?\}\s*\/\/ PATCH_FIX: [\s\S]*?return; \/\/ لا تعالج Documents في حالات أخرى\s*\}\s*if \(!msg\.text\) return;\s*if \(msg\.text !== "\/start"\) \{[\s\S]*?return;\s*\}\s*\}\s*const \{ getUser: _gu, saveUser: _su \}[\s\S]*?if \(_u\.telegramChatId !== msg\.chat\.id\) _su\(userId, \{ telegramChatId: msg\.chat\.id \}\);)\s*await _routerMod\.routeMessage\(bot, msg\); \/\/ PATCH_PHASE4_ACTIVATE_APPLIED/;

const MSG_REGION_REPLACEMENT = `      workerManager.pingWorker(userId);
      // [${GUARD}] Subscription guard (text only — payment/media/document bypass automatically)
      if (msg.text && msg.text !== "/start") {
        const { subscribed: _sub, missing: _mis } = await checkUserSubscription(bot, userId);
        if (!_sub) {
          await bot.sendMessage(msg.chat.id, buildChannelRequiredMessage(_mis), {
            parse_mode: "Markdown",
            disable_web_page_preview: true
          });
          return;
        }
      }
      // DB sync (text only)
      if (msg.text) {
        const { getUser: _gu, saveUser: _su } = await Promise.resolve().then(() => (init_database(), database_exports));
        const _u = _gu(userId);
        if (_u.telegramChatId !== msg.chat.id) _su(userId, { telegramChatId: msg.chat.id });
      }
      // ── Single routing entry point: Router handles ALL types ──────────────
      await _routerMod.routeMessage(bot, msg); // ${GUARD}`;

if (!MSG_REGION_RE.test(modified)) {
  // Try to locate which part failed
  const hasPayment = modified.includes('if (msg.successful_payment) {');
  const hasPhoto   = modified.includes('if (msg.photo || msg.video) {');
  const hasDoc     = modified.includes('if (msg.document && !msg.text) {');
  const hasTextGrd = modified.includes('if (!msg.text) return;');
  console.error('[patch-phase4b] OP-3 regex did not match.');
  console.error(`  payment block: ${hasPayment}, photo block: ${hasPhoto}, doc block: ${hasDoc}, text guard: ${hasTextGrd}`);
  process.exit(1);
}
modified = modified.replace(MSG_REGION_RE, MSG_REGION_REPLACEMENT);
ops++;
console.log('[patch-phase4b] OP-3: message listener simplified — Router now handles all types ✅');

// ══════════════════════════════════════════════════════════════════════════════
// OP-4: إزالة fw_ direct block من callback listener
// ══════════════════════════════════════════════════════════════════════════════

const FW_RE = /\/\/ PATCH_FORWARD_HOOK_V1 ── قسم التحويل ──\s*if \(\(query\.data \|\| ""\)\.startsWith\("fw_"\)\) \{[\s\S]*?if \(handled\) return;\s*\}\s*(await _dispatcherMod\.routeCallback\(bot, query\); \/\/ PATCH_PHASE4_ACTIVATE_APPLIED)/;

if (!FW_RE.test(modified)) {
  console.error('[patch-phase4b] OP-4 regex did not match.'); process.exit(1);
}
modified = modified.replace(FW_RE, `// [${GUARD}] fw_ now registered in Dispatcher — no direct bypass\n      $1`);
ops++;
console.log('[patch-phase4b] OP-4: fw_ direct call removed — Dispatcher handles it via prefix ✅');

// ── كتابة الملف ──────────────────────────────────────────────────────────────
writeFileSync(INDEX, modified, 'utf8');
console.log(`\n[patch-phase4b] ✅ ${ops}/4 ops applied. Guard: "${GUARD}"`);
console.log('[patch-phase4b] Next: node --check dist/index.mjs && node tests/validate-engine.mjs');
