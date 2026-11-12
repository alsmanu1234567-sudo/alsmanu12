// patch-daily-report-split.mjs
// Phase 3 — استخراج Daily Report من dist/index.mjs → dist/daily-report.mjs
// الحارسة: PATCH_DAILY_REPORT_SPLIT_APPLIED

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_DAILY_REPORT_SPLIT_APPLIED';

let content = readFileSync(target, 'utf8');

if (content.includes(GUARD)) {
  console.log('[patch-daily-report-split] ← مُطبَّق مسبقاً، تخطي');
  process.exit(0);
}

// ── 1. إضافة import ────────────────────────────────────────────────────────
// ابحث عن مرساة import — نفضّل مرساة keepalive إن وُجدت
const anchors = [
  "import * as _kaMod from './keepalive.mjs'; // PATCH_KEEPALIVE_SPLIT_APPLIED\n",
  "import * as _wmMod from './worker-manager.mjs'; // PATCH_WORKER_MANAGER_SPLIT_APPLIED\n",
  "import * as _arMod from './auto-reply.mjs'; // PATCH_AUTO_REPLY_SPLIT_APPLIED\n",
];
const usedAnchor = anchors.find(a => content.includes(a));
if (!usedAnchor) {
  console.error('[patch-daily-report-split] ✗ لم يُعثر على مرساة import');
  process.exit(1);
}

const newImport = `import * as _drMod from './daily-report.mjs'; // ${GUARD}\n`;
content = content.replace(usedAnchor, usedAnchor + newImport);

// ── 2. استبدال قسم daily-report.ts بـ stubs ──────────────────────────────────
const START_ANCHOR    = '// src/bot/core/daily-report.ts\ninit_database();\ninit_constants();\ninit_workers();\ninit_logger();\nvar dailyReportTimer = null;\nvar botRef2 = null;';
const END_NEXT_SECTION = '\n// src/bot/index.ts\nvar bot = null;';

const startIdx = content.indexOf(START_ANCHOR);
if (startIdx === -1) {
  console.error('[patch-daily-report-split] ✗ لم يُعثر على بداية daily-report.ts');
  process.exit(1);
}

const endIdx = content.indexOf(END_NEXT_SECTION, startIdx);
if (endIdx === -1) {
  console.error('[patch-daily-report-split] ✗ لم يُعثر على نهاية daily-report.ts');
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after  = content.substring(endIdx); // يبدأ من \n// src/bot/index.ts\nvar bot = null;

const stub = `// src/bot/core/daily-report.ts — فُصِل في dist/daily-report.mjs [${GUARD}]
init_database();
init_constants();
init_workers();
init_logger();
var dailyReportTimer = null;
var botRef2 = null;
function setBotRefForReport(bot2) { return _drMod.setBotRefForReport(bot2); }
function startDailyReport(bot2) {
  _drMod.setDeps({ logger, getAllUsers, inMemoryDB, workerManager, DEVELOPER_ID });
  return _drMod.startDailyReport(bot2);
}`;

content = before + stub + after;

writeFileSync(target, content, 'utf8');
console.log('[patch-daily-report-split] ✓ Daily Report مُستخرَج → dist/daily-report.mjs');
