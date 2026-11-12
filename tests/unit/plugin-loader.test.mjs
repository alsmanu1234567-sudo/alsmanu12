// tests/unit/plugin-loader.test.mjs
// Unit Tests — Plugin Loader

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as loader from '../../dist/plugins/plugin-loader.mjs';
import * as reg from '../../dist/plugins/plugin-registry.mjs';

function clearRegistry() {
  for (const n of reg.getNames()) reg.unregister(n);
}

function makeModule(name, textOrder = 99, cbOrder = null) {
  const manifest = {
    name,
    type: 'handler',
    textOrder,
    enabled: true,
  };
  if (cbOrder !== null) manifest.cbOrder = cbOrder;
  return {
    pluginManifest: manifest,
    handleText: async () => false,
    setDeps: () => {},
  };
}

// ─── loadPlugin ───────────────────────────────────────────────────

test('loadPlugin: تسجيل ناجح', () => {
  clearRegistry();
  const mod = makeModule('lp-test-1');
  const r = loader.loadPlugin(mod);
  assert.equal(r.ok, true);
  assert.equal(r.name, 'lp-test-1');
  assert.equal(reg.has('lp-test-1'), true);
  clearRegistry();
});

test('loadPlugin: بدون manifest → فشل', () => {
  clearRegistry();
  const r = loader.loadPlugin({ handleText: async () => {}, setDeps: () => {} });
  assert.equal(r.ok, false);
});

test('loadPlugin: plugin مسجّل مسبقاً → already registered', () => {
  clearRegistry();
  const mod = makeModule('lp-dup');
  loader.loadPlugin(mod);
  const r = loader.loadPlugin(mod);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already registered');
  clearRegistry();
});

// ─── loadAll ─────────────────────────────────────────────────────

test('loadAll: يحمّل عدة plugins', () => {
  clearRegistry();
  const mods = [makeModule('la-1'), makeModule('la-2'), makeModule('la-3')];
  const r = loader.loadAll(mods);
  assert.equal(r.loaded, 3);
  assert.equal(r.failed, 0);
  clearRegistry();
});

test('loadAll: يحسب المكررات', () => {
  clearRegistry();
  const mod = makeModule('la-dup');
  const r = loader.loadAll([mod, mod]);
  assert.equal(r.loaded, 1);
  assert.equal(r.skipped, 1);
  clearRegistry();
});

// ─── getTextHandlers ──────────────────────────────────────────────

test('getTextHandlers: مرتّبة تصاعدياً', () => {
  clearRegistry();
  loader.loadAll([makeModule('th-c', 3), makeModule('th-a', 1), makeModule('th-b', 2)]);
  const handlers = loader.getTextHandlers();
  const names = handlers.map(h => h.manifest.name);
  assert.deepEqual(names, ['th-a', 'th-b', 'th-c']);
  clearRegistry();
});

test('getTextHandlers: لا تشمل plugins بـ textOrder=0', () => {
  clearRegistry();
  const mod = makeModule('th-zero', 0);
  loader.loadPlugin(mod);
  const handlers = loader.getTextHandlers();
  assert.ok(!handlers.some(h => h.manifest.name === 'th-zero'));
  clearRegistry();
});

// ─── getCbHandlers ────────────────────────────────────────────────

test('getCbHandlers: مرتّبة تصاعدياً', () => {
  clearRegistry();
  const m1 = makeModule('cb-1', 0, 2);
  m1.handleCallback = async () => false;
  const m2 = makeModule('cb-2', 0, 1);
  m2.handleCallback = async () => false;
  loader.loadAll([m1, m2]);
  const handlers = loader.getCbHandlers();
  assert.equal(handlers[0].manifest.name, 'cb-2');
  clearRegistry();
});

// ─── distributeDeps ───────────────────────────────────────────────

test('distributeDeps: يوزّع على جميع plugins', () => {
  clearRegistry();
  const received = [];
  const mod = makeModule('dep-test');
  mod.setDeps = (d) => received.push(d);
  loader.loadPlugin(mod);
  loader.distributeDeps({ db: 'test-db' });
  assert.equal(received.length, 1);
  assert.equal(received[0].db, 'test-db');
  clearRegistry();
});

// ─── Health ───────────────────────────────────────────────────────

test('recordError: يُسجّل الخطأ', () => {
  clearRegistry();
  loader.loadPlugin(makeModule('health-test'));
  loader.recordError('health-test', 'خطأ اختباري');
  const report = loader.getHealthReport();
  const entry = report.find(p => p.name === 'health-test');
  assert.ok(entry);
  assert.equal(entry.status, 'degraded');
  clearRegistry();
});

test('markHealthy: يُحدِّث الحالة', () => {
  clearRegistry();
  loader.loadPlugin(makeModule('healthy-test'));
  loader.recordError('healthy-test', 'خطأ');
  loader.markHealthy('healthy-test');
  const report = loader.getHealthReport();
  const entry = report.find(p => p.name === 'healthy-test');
  assert.equal(entry.status, 'healthy');
  clearRegistry();
});

// ─── Enable/Disable ───────────────────────────────────────────────

test('enablePlugin/disablePlugin: دورة حياة', () => {
  clearRegistry();
  loader.loadPlugin(makeModule('ed-test'));
  loader.disablePlugin('ed-test');
  const disabled = loader.getTextHandlers().find(h => h.manifest.name === 'ed-test');
  assert.equal(disabled, undefined);
  loader.enablePlugin('ed-test');
  const enabled = loader.getTextHandlers().find(h => h.manifest.name === 'ed-test');
  assert.ok(enabled);
  clearRegistry();
});

// ─── Stats ────────────────────────────────────────────────────────

test('getStats: إحصائيات صحيحة', () => {
  clearRegistry();
  loader.loadAll([makeModule('st-1'), makeModule('st-2')]);
  const stats = loader.getStats();
  assert.ok(stats.total >= 2);
  clearRegistry();
});
