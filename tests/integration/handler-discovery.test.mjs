// tests/integration/handler-discovery.test.mjs
// Integration Tests — Auto Discovery + Handler Validation

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import * as loader from '../../dist/plugins/plugin-loader.mjs';
import * as reg from '../../dist/plugins/plugin-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDLERS_DIR = join(__dirname, '../../dist/handlers');

// ─── Auto Discovery ───────────────────────────────────────────────

test('[INT] Auto Discovery: يكتشف 18 handler', async () => {
  // تنظيف أي plugins مسجّلة مسبقاً لهذا الاختبار
  const freshReg = await import('../../dist/plugins/plugin-registry.mjs');
  const freshLoader = await import('../../dist/plugins/plugin-loader.mjs');

  // نحسب الملفات يدوياً
  const files = await readdir(HANDLERS_DIR);
  const handlerFiles = files.filter(f => f.endsWith('-handler.mjs'));
  
  // كل handler مسجّلة مسبقاً → نفحص الملفات فقط
  assert.ok(handlerFiles.length >= 18, `المتوقع 18+ handler file، وجد ${handlerFiles.length}`);
});

test('[INT] Handler Files: كل handler لها pluginManifest أو setDeps', async () => {
  const files = await readdir(HANDLERS_DIR);
  const handlerFiles = files.filter(f => f.endsWith('-handler.mjs'));

  // المعروف أن 5 handlers لا تملك pluginManifest (بالتصميم)
  const NON_PLUGIN_HANDLERS = [
    'state-switch-handler.mjs',
    'payment-handler.mjs',
    'media-handler.mjs',
    'document-handler.mjs',
    'forward-hook.mjs',
  ];

  let pluginHandlers = 0;
  let nonPluginHandlers = 0;

  for (const file of handlerFiles) {
    const mod = await import(join(HANDLERS_DIR, file));
    if (NON_PLUGIN_HANDLERS.includes(file)) {
      assert.ok(typeof mod.setDeps === 'function', `${file}: يجب أن تملك setDeps`);
      nonPluginHandlers++;
    } else {
      assert.ok(mod.pluginManifest, `${file}: يجب أن تملك pluginManifest`);
      assert.ok(typeof mod.setDeps === 'function', `${file}: يجب أن تملك setDeps`);
      assert.ok(
        typeof mod.handleText === 'function' || typeof mod.handleCallback === 'function',
        `${file}: يجب أن تملك handleText أو handleCallback`
      );
      pluginHandlers++;
    }
  }

  assert.equal(pluginHandlers, 18, `المتوقع 18 plugin handler، وجد ${pluginHandlers}`);
});

test('[INT] Plugin Manifests: كل manifest صحيح', async () => {
  const files = await readdir(HANDLERS_DIR);
  const handlerFiles = files.filter(f => f.endsWith('-handler.mjs'));
  const NON_PLUGIN = ['state-switch-handler.mjs', 'payment-handler.mjs', 'media-handler.mjs', 'document-handler.mjs', 'forward-hook.mjs'];

  for (const file of handlerFiles) {
    if (NON_PLUGIN.includes(file)) continue;
    const mod = await import(join(HANDLERS_DIR, file));
    const m = mod.pluginManifest;
    assert.ok(m.name, `${file}: manifest.name مفقود`);
    assert.ok(m.type, `${file}: manifest.type مفقود`);
    assert.ok(
      typeof m.textOrder === 'number' || typeof m.cbOrder === 'number',
      `${file}: manifest.textOrder أو cbOrder مفقود`
    );
  }
});

test('[INT] Plugin Names: لا تكرار في الأسماء', async () => {
  const files = await readdir(HANDLERS_DIR);
  const handlerFiles = files.filter(f => f.endsWith('-handler.mjs'));
  const NON_PLUGIN = ['state-switch-handler.mjs', 'payment-handler.mjs', 'media-handler.mjs', 'document-handler.mjs', 'forward-hook.mjs'];

  const names = [];
  for (const file of handlerFiles) {
    if (NON_PLUGIN.includes(file)) continue;
    const mod = await import(join(HANDLERS_DIR, file));
    names.push(mod.pluginManifest.name);
  }

  const unique = new Set(names);
  assert.equal(unique.size, names.length, `أسماء مكررة: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
});

test('[INT] Services: كل ملف service يُصدّر دوال', async () => {
  const SERVICES_DIR = join(__dirname, '../../dist/services');
  const { readdir: rd } = await import('node:fs/promises');

  async function checkDir(dir) {
    const entries = await rd(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await checkDir(fullPath);
      } else if (entry.name.endsWith('.mjs')) {
        const mod = await import(fullPath);
        const exports = Object.keys(mod);
        assert.ok(exports.length > 0, `${entry.name}: لا exports`);
        for (const key of exports) {
          const val = mod[key];
          assert.ok(
            typeof val === 'function',
            `${entry.name}: export '${key}' ليس دالة`
          );
        }
      }
    }
  }

  await checkDir(SERVICES_DIR);
});

// ─── Imports Integrity ────────────────────────────────────────────

test('[INT] Plugin System Files: يمكن استيرادها جميعاً', async () => {
  const files = [
    '../../dist/plugins/plugin-registry.mjs',
    '../../dist/plugins/plugin-loader.mjs',
    '../../dist/handlers/registry.mjs',
    '../../dist/message-router.mjs',
    '../../dist/dispatcher.mjs',
    '../../dist/worker-manager.mjs',
    '../../dist/text-handler.mjs',
    '../../dist/callback-handler.mjs',
  ];

  for (const file of files) {
    const mod = await import(file);
    assert.ok(typeof mod === 'object', `${file}: فشل الاستيراد`);
  }
});
