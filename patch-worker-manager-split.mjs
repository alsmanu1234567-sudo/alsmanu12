// patch-worker-manager-split.mjs
// Phase 3 — استخراج WorkerManager من dist/index.mjs → dist/worker-manager.mjs
// الحارسة: PATCH_WORKER_MANAGER_SPLIT_APPLIED

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, 'dist', 'index.mjs');

const GUARD = 'PATCH_WORKER_MANAGER_SPLIT_APPLIED';

let content = readFileSync(target, 'utf8');

if (content.includes(GUARD)) {
  console.log('[patch-worker-manager-split] ← مُطبَّق مسبقاً، تخطي');
  process.exit(0);
}

// ── 1. إضافة import ────────────────────────────────────────────────────────
const importAnchor = "import * as _arMod from './auto-reply.mjs'; // PATCH_AUTO_REPLY_SPLIT_APPLIED\n";
if (!content.includes(importAnchor)) {
  console.error('[patch-worker-manager-split] ✗ لم يُعثر على مرساة import');
  process.exit(1);
}

const newImport = `import * as _wmMod from './worker-manager.mjs'; // ${GUARD}\n`;
content = content.replace(importAnchor, importAnchor + newImport);

// ── 2. استبدال قسم workers.ts بـ stub ────────────────────────────────────────
const START_ANCHOR = '// src/bot/core/workers.ts\nvar WorkerManager, workerManager;\nvar init_workers = __esm({';
const END_NEXT_SECTION = '\n// src/bot/features/my-msgs/index.ts';

const startIdx = content.indexOf(START_ANCHOR);
if (startIdx === -1) {
  console.error('[patch-worker-manager-split] ✗ لم يُعثر على بداية workers.ts');
  process.exit(1);
}

// ابحث عن نهاية الـ __esm block — نجد التقسيم التالي
const endIdx = content.indexOf(END_NEXT_SECTION, startIdx);
if (endIdx === -1) {
  console.error('[patch-worker-manager-split] ✗ لم يُعثر على نهاية workers.ts');
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after  = content.substring(endIdx); // يبدأ من \n// src/bot/features/my-msgs...

const stub = `// src/bot/core/workers.ts — فُصِل في dist/worker-manager.mjs [${GUARD}]
var WorkerManager, workerManager;
var init_workers = __esm({
  "src/bot/core/workers.ts"() {
    "use strict";
    init_logger();
    init_database();
    _wmMod.setDeps({ inMemoryDB, logger });
    WorkerManager = _wmMod.WorkerManager;
    workerManager = _wmMod.workerManager;
  }
});`;

content = before + stub + after;

writeFileSync(target, content, 'utf8');
console.log('[patch-worker-manager-split] ✓ WorkerManager مُستخرَج → dist/worker-manager.mjs');
