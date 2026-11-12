// patch-phase4-activate.mjs
// Phase 4 — تفعيل Message Router & Callback Dispatcher في dist/index.mjs
// الحارسة: PATCH_PHASE4_ACTIVATE_APPLIED
//
// ما يفعله هذا الـ patch:
//   1. يُسجِّل handleTextMessage في _routerMod كـ message handler رسمي
//   2. يُسجِّل handleCallback في _dispatcherMod كـ callback handler رسمي
//   3. يستبدل استدعاء handleTextMessage المباشر في bot.on('message') بـ routeMessage()
//   4. يستبدل استدعاء handleCallback المباشر في bot.on('callback_query') بـ routeCallback()
//
// النتيجة: Router هو نقطة الدخول الوحيدة للرسائل، Dispatcher للـ callbacks.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_PHASE4_ACTIVATE_APPLIED';

let content = readFileSync(target, 'utf8');

if (content.includes(GUARD)) {
  console.log('[patch-phase4-activate] ← مُطبَّق مسبقاً، تخطي');
  process.exit(0);
}

// ── التحقق من وجود Phase 3 أولاً ───────────────────────────────────────────
if (!content.includes('PATCH_ROUTER_INIT_APPLIED')) {
  console.error('[patch-phase4-activate] ✗ Phase 3 (patch-router-init) غير مُطبَّق — يجب تطبيقه أولاً');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// الخطوة 1: تسجيل handleTextMessage و handleCallback في نهاية بلوك Phase 3
// ═══════════════════════════════════════════════════════════════════════════

const PHASE3_END_ANCHOR = `  logger.info(_dispatcherMod.getStats(), 'Dispatcher initialized');
  // ── نهاية Phase 3 ───────────────────────────────────────────────────────
  startDailyReport(bot);`;

if (!content.includes(PHASE3_END_ANCHOR)) {
  console.error('[patch-phase4-activate] ✗ لم يُعثر على نهاية بلوك Phase 3 في index.mjs');
  process.exit(1);
}

const PHASE4_REGISTRATION = `  logger.info(_dispatcherMod.getStats(), 'Dispatcher initialized');
  // ── Phase 4: تفعيل Router & Dispatcher [${GUARD}] ──────────────────────
  _routerMod.setMessageHandler(handleTextMessage);
  _dispatcherMod.setCallbackHandler(handleCallback);
  logger.info(
    { msgHandler: 'handleTextMessage', cbHandler: 'handleCallback' },
    'Phase 4: Router & Dispatcher activated — all messages route through them'
  );
  // ── نهاية Phase 3 ───────────────────────────────────────────────────────
  startDailyReport(bot);`;

content = content.replace(PHASE3_END_ANCHOR, PHASE4_REGISTRATION);

if (!content.includes(GUARD)) {
  console.error('[patch-phase4-activate] ✗ فشل حقن تسجيل الـ handlers');
  process.exit(1);
}
console.log('[patch-phase4-activate] ✓ الخطوة 1: تسجيل handlers في Router & Dispatcher');

// ═══════════════════════════════════════════════════════════════════════════
// الخطوة 2: توجيه bot.on('message') عبر _routerMod.routeMessage()
// ═══════════════════════════════════════════════════════════════════════════

const MSG_DIRECT_CALL = `      await handleTextMessage(bot, msg);
    } catch (err) {
      logger.error({ err }, "Message handler error");`;

const MSG_ROUTED_CALL = `      await _routerMod.routeMessage(bot, msg); // ${GUARD}
    } catch (err) {
      logger.error({ err }, "Message handler error");`;

if (!content.includes(MSG_DIRECT_CALL)) {
  console.error('[patch-phase4-activate] ✗ لم يُعثر على استدعاء handleTextMessage في bot.on("message")');
  process.exit(1);
}

content = content.replace(MSG_DIRECT_CALL, MSG_ROUTED_CALL);
console.log('[patch-phase4-activate] ✓ الخطوة 2: bot.on("message") يمر عبر _routerMod.routeMessage()');

// ═══════════════════════════════════════════════════════════════════════════
// الخطوة 3: توجيه bot.on('callback_query') عبر _dispatcherMod.routeCallback()
// ═══════════════════════════════════════════════════════════════════════════

const CB_DIRECT_CALL = `      await handleCallback(bot, query);
    } catch (err) {
      logger.error({ err }, "Callback handler error");`;

const CB_ROUTED_CALL = `      await _dispatcherMod.routeCallback(bot, query); // ${GUARD}
    } catch (err) {
      logger.error({ err }, "Callback handler error");`;

if (!content.includes(CB_DIRECT_CALL)) {
  console.error('[patch-phase4-activate] ✗ لم يُعثر على استدعاء handleCallback في bot.on("callback_query")');
  process.exit(1);
}

content = content.replace(CB_DIRECT_CALL, CB_ROUTED_CALL);
console.log('[patch-phase4-activate] ✓ الخطوة 3: bot.on("callback_query") يمر عبر _dispatcherMod.routeCallback()');

// ═══════════════════════════════════════════════════════════════════════════
// الكتابة النهائية
// ═══════════════════════════════════════════════════════════════════════════

writeFileSync(target, content, 'utf8');
console.log('[patch-phase4-activate] ✓ Phase 4 مُطبَّق — Router & Dispatcher مُفعَّلان في dist/index.mjs');
