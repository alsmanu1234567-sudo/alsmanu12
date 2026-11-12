// tests/perf/performance.test.mjs
// Performance Benchmarks — قياس أوقات التشغيل والتحميل

import { test } from 'node:test';
import assert from 'node:assert/strict';

const THRESHOLDS = {
  pluginRegistryImport: 200,   // ms
  pluginLoaderImport:   200,
  registryLoad:        2000,   // وقت تحميل 18 plugins كاملة
  discoverHandlers:    3000,   // Auto Discovery كامل
  dispatchText:          50,   // توجيه رسالة واحدة
  dispatchCallback:      50,
  memoryAfterLoad:      150,   // MB — حد الذاكرة
};

function ms(hrtime) {
  return Math.round(hrtime[0] * 1000 + hrtime[1] / 1e6);
}

// ─── Import Times ─────────────────────────────────────────────────

test('[PERF] plugin-registry.mjs: وقت الاستيراد', async () => {
  const start = process.hrtime();
  await import('../../dist/plugins/plugin-registry.mjs');
  const elapsed = ms(process.hrtime(start));
  console.log(`    plugin-registry import: ${elapsed}ms (حد: ${THRESHOLDS.pluginRegistryImport}ms)`);
  assert.ok(elapsed < THRESHOLDS.pluginRegistryImport, `بطيء جداً: ${elapsed}ms`);
});

test('[PERF] plugin-loader.mjs: وقت الاستيراد', async () => {
  const start = process.hrtime();
  await import('../../dist/plugins/plugin-loader.mjs');
  const elapsed = ms(process.hrtime(start));
  console.log(`    plugin-loader import: ${elapsed}ms (حد: ${THRESHOLDS.pluginLoaderImport}ms)`);
  assert.ok(elapsed < THRESHOLDS.pluginLoaderImport, `بطيء جداً: ${elapsed}ms`);
});

// ─── Registry Load (18 plugins) ───────────────────────────────────

test('[PERF] Handler Registry: وقت تحميل 18 plugin', async () => {
  const start = process.hrtime();
  const registry = await import('../../dist/handlers/registry.mjs');
  const elapsed = ms(process.hrtime(start));
  const stats = registry.getStats();
  console.log(`    Registry load (${stats.total} plugins): ${elapsed}ms (حد: ${THRESHOLDS.registryLoad}ms)`);
  assert.ok(elapsed < THRESHOLDS.registryLoad, `بطيء جداً: ${elapsed}ms`);
  assert.equal(stats.total, 18);
});

// ─── Auto Discovery ───────────────────────────────────────────────

test('[PERF] Auto Discovery: وقت اكتشاف جميع الـ handlers', async () => {
  const loader = await import('../../dist/plugins/plugin-loader.mjs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const handlersDir = join(__dirname, '../../dist/handlers');

  const start = process.hrtime();
  const result = await loader.discover(handlersDir);
  const elapsed = ms(process.hrtime(start));

  console.log(`    Auto Discovery (${result.discovered} discovered): ${elapsed}ms (حد: ${THRESHOLDS.discoverHandlers}ms)`);
  assert.ok(elapsed < THRESHOLDS.discoverHandlers, `بطيء جداً: ${elapsed}ms`);
});

// ─── Dispatch Performance ─────────────────────────────────────────

test('[PERF] dispatchText: وقت التوجيه النصي (رسالة مجهولة)', async () => {
  const registry = await import('../../dist/handlers/registry.mjs');
  const bot = {};
  const msg = { text: '/unknown_xyz_perf_test', chat: { id: 1 }, from: { id: 1 } };

  const start = process.hrtime();
  await registry.dispatchText(bot, msg);
  const elapsed = ms(process.hrtime(start));

  console.log(`    dispatchText (unknown cmd): ${elapsed}ms (حد: ${THRESHOLDS.dispatchText}ms)`);
  assert.ok(elapsed < THRESHOLDS.dispatchText, `بطيء جداً: ${elapsed}ms`);
});

test('[PERF] dispatchCallback: وقت التوجيه (callback مجهول)', async () => {
  const registry = await import('../../dist/handlers/registry.mjs');
  const bot = {};
  const query = { data: 'unknown_cb_perf_xyz', from: { id: 1 }, message: { chat: { id: 1 } } };

  const start = process.hrtime();
  await registry.dispatchCallback(bot, query);
  const elapsed = ms(process.hrtime(start));

  console.log(`    dispatchCallback (unknown): ${elapsed}ms (حد: ${THRESHOLDS.dispatchCallback}ms)`);
  assert.ok(elapsed < THRESHOLDS.dispatchCallback, `بطيء جداً: ${elapsed}ms`);
});

// ─── Memory Usage ─────────────────────────────────────────────────

test('[PERF] Memory: استخدام الذاكرة بعد تحميل النظام', async () => {
  // نتأكد من تحميل كل شيء
  await import('../../dist/handlers/registry.mjs');
  await import('../../dist/plugins/plugin-loader.mjs');
  await import('../../dist/message-router.mjs');
  await import('../../dist/dispatcher.mjs');
  await import('../../dist/worker-manager.mjs');

  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

  console.log(`    Heap Used: ${heapMB}MB (حد: ${THRESHOLDS.memoryAfterLoad}MB)`);
  console.log(`    RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
  assert.ok(heapMB < THRESHOLDS.memoryAfterLoad, `استخدام ذاكرة مرتفع: ${heapMB}MB`);
});

// ─── getTextHandlers Performance ──────────────────────────────────

test('[PERF] getTextHandlers: وقت جلب قائمة handlers', async () => {
  const loader = await import('../../dist/plugins/plugin-loader.mjs');

  const ITERATIONS = 1000;
  const start = process.hrtime();
  for (let i = 0; i < ITERATIONS; i++) {
    loader.getTextHandlers();
  }
  const elapsed = ms(process.hrtime(start));
  const perCall = (elapsed / ITERATIONS).toFixed(3);

  console.log(`    getTextHandlers x${ITERATIONS}: ${elapsed}ms total, ${perCall}ms per call`);
  assert.ok(elapsed < 500, `بطيء: ${elapsed}ms لـ ${ITERATIONS} استدعاء`);
});
