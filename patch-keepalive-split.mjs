// patch-keepalive-split.mjs
// Phase 3 — استخراج Keepalive من dist/index.mjs → dist/keepalive.mjs
// الحارسة: PATCH_KEEPALIVE_SPLIT_APPLIED

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_KEEPALIVE_SPLIT_APPLIED';

let content = readFileSync(target, 'utf8');

if (content.includes(GUARD)) {
  console.log('[patch-keepalive-split] ← مُطبَّق مسبقاً، تخطي');
  process.exit(0);
}

// ── 1. إضافة import ────────────────────────────────────────────────────────
const importAnchor = "import * as _wmMod from './worker-manager.mjs'; // PATCH_WORKER_MANAGER_SPLIT_APPLIED\n";
// إذا لم يطبّق patch-worker-manager أولاً — أبحث عن مرساة بديلة
const fallbackAnchor = "import * as _arMod from './auto-reply.mjs'; // PATCH_AUTO_REPLY_SPLIT_APPLIED\n";
const usedAnchor = content.includes(importAnchor) ? importAnchor : fallbackAnchor;

if (!content.includes(usedAnchor)) {
  console.error('[patch-keepalive-split] ✗ لم يُعثر على مرساة import');
  process.exit(1);
}

const newImport = `import * as _kaMod from './keepalive.mjs'; // ${GUARD}\n`;
content = content.replace(usedAnchor, usedAnchor + newImport);

// ── 2. استبدال قسم keepalive.ts بـ stubs ─────────────────────────────────────
const START_ANCHOR    = '// src/bot/core/keepalive.ts\nfunction registerRestartFn(fn) {';
const END_NEXT_SECTION = '\n// ../../node_modules/.pnpm/qrcode@1.5.4';

const startIdx = content.indexOf(START_ANCHOR);
if (startIdx === -1) {
  console.error('[patch-keepalive-split] ✗ لم يُعثر على بداية keepalive.ts');
  process.exit(1);
}

const endIdx = content.indexOf(END_NEXT_SECTION, startIdx);
if (endIdx === -1) {
  console.error('[patch-keepalive-split] ✗ لم يُعثر على نهاية keepalive.ts');
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after  = content.substring(endIdx); // يبدأ من \n// ../../node_modules/...

const stub = `// src/bot/core/keepalive.ts — فُصِل في dist/keepalive.mjs [${GUARD}]
function registerRestartFn(fn) { return _kaMod.registerRestartFn(fn); }
function heartbeat() { return _kaMod.heartbeat(); }
function startKeepalive() { return _kaMod.startKeepalive(); }
function getKeepaliveStats() { return _kaMod.getKeepaliveStats(); }
var restartFn, isAlive, heartbeatInterval, watchdogInterval, lastHeartbeat, restartCount;
var init_keepalive = __esm({
  "src/bot/core/keepalive.ts"() {
    "use strict";
    init_logger();
    _kaMod.setDeps({ logger });
    restartFn = null; isAlive = true; heartbeatInterval = null;
    watchdogInterval = null; lastHeartbeat = Date.now(); restartCount = 0;
  }
});`;

content = before + stub + after;

writeFileSync(target, content, 'utf8');
console.log('[patch-keepalive-split] ✓ Keepalive مُستخرَج → dist/keepalive.mjs');
