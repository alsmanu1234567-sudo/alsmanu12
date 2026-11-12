// patch-router-init.mjs
// Phase 3 — تهيئة Message Router & Dispatcher في dist/index.mjs
// الحارسة: PATCH_ROUTER_INIT_APPLIED
// يُسجِّل جميع الوحدات المُستخرَجة في الراوتر والمنتقل — لا يغيّر سلوك التوجيه الحالي.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_ROUTER_INIT_APPLIED';

let content = readFileSync(target, 'utf8');

if (content.includes(GUARD)) {
  console.log('[patch-router-init] ← مُطبَّق مسبقاً، تخطي');
  process.exit(0);
}

// ── 1. إضافة imports ───────────────────────────────────────────────────────
const anchors = [
  "import * as _drMod from './daily-report.mjs'; // PATCH_DAILY_REPORT_SPLIT_APPLIED\n",
  "import * as _kaMod from './keepalive.mjs'; // PATCH_KEEPALIVE_SPLIT_APPLIED\n",
  "import * as _wmMod from './worker-manager.mjs'; // PATCH_WORKER_MANAGER_SPLIT_APPLIED\n",
  "import * as _arMod from './auto-reply.mjs'; // PATCH_AUTO_REPLY_SPLIT_APPLIED\n",
];
const usedAnchor = anchors.find(a => content.includes(a));
if (!usedAnchor) {
  console.error('[patch-router-init] ✗ لم يُعثر على مرساة import');
  process.exit(1);
}

const newImports = `import * as _routerMod     from './message-router.mjs'; // ${GUARD}
import * as _dispatcherMod from './dispatcher.mjs';     // ${GUARD}
`;
content = content.replace(usedAnchor, usedAnchor + newImports);

// ── 2. حقن تهيئة الراوتر والمنتقل قبل startDailyReport ─────────────────────
const INJECT_ANCHOR = '  startKeepalive();\n  startDailyReport(bot);';

if (!content.includes(INJECT_ANCHOR)) {
  console.error('[patch-router-init] ✗ لم يُعثر على نقطة الحقن (startKeepalive/startDailyReport)');
  process.exit(1);
}

const registrationBlock = `  startKeepalive();
  // ── Phase 3: تهيئة الراوتر والمنتقل [${GUARD}] ─────────────────────────
  _routerMod.setDeps({ logger });
  _dispatcherMod.setDeps({ logger });
  // تسجيل جميع الوحدات في الراوتر
  _routerMod.registerModule('auto-reply',     _arMod);
  _routerMod.registerModule('ai',             _aiMod);
  _routerMod.registerModule('calls',          _callsMod);
  _routerMod.registerModule('groups',         _groupsMod);
  _routerMod.registerModule('persons',        _personsMod);
  _routerMod.registerModule('points',         _pointsMod);
  _routerMod.registerModule('reports',        _reportsMod);
  _routerMod.registerModule('status',         _statusMod);
  _routerMod.registerModule('developer',      _devMod);
  _routerMod.registerModule('my-msgs',        _mmMod);
  _routerMod.registerModule('bridge',         _bridgeMod);
  _routerMod.registerModule('schedule',       _scheduleMod);
  _routerMod.registerModule('security',       _securityMod);
  _routerMod.registerModule('worker-manager', _wmMod);
  _routerMod.registerModule('keepalive',      _kaMod);
  _routerMod.registerModule('daily-report',   _drMod);
  logger.info(_routerMod.getStats(), 'Router initialized — modules registered');
  logger.info(_dispatcherMod.getStats(), 'Dispatcher initialized');
  // ── نهاية Phase 3 ───────────────────────────────────────────────────────
  startDailyReport(bot);`;

content = content.replace(INJECT_ANCHOR, registrationBlock);

writeFileSync(target, content, 'utf8');
console.log('[patch-router-init] ✓ Router & Dispatcher مُهيَّآن في dist/index.mjs');
