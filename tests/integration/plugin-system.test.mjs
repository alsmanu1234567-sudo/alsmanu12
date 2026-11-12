// tests/integration/plugin-system.test.mjs
// Integration Tests — Plugin System كامل

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as reg from '../../dist/plugins/plugin-registry.mjs';
import * as loader from '../../dist/plugins/plugin-loader.mjs';
import * as registry from '../../dist/handlers/registry.mjs';

// ─── Plugin Registry Integration ─────────────────────────────────

test('[INT] Plugin Registry: 18 plugin مسجّل', () => {
  const stats = registry.getStats();
  assert.equal(stats.total, 18, `المتوقع 18 plugin، وجد ${stats.total}`);
});

test('[INT] Plugin Registry: جميع الـ 18 مفعّلة', () => {
  const stats = registry.getStats();
  assert.equal(stats.enabled, 18, `المتوقع 18 مفعّل، وجد ${stats.enabled}`);
});

test('[INT] Plugin Registry: لا plugins معطّلة', () => {
  const stats = registry.getStats();
  assert.equal(stats.disabled, 0);
});

test('[INT] Plugin Registry: جميعها healthy', () => {
  const stats = registry.getStats();
  assert.equal(stats.healthy, 18);
  assert.equal(stats.degraded, 0);
  assert.equal(stats.failed, 0);
});

// ─── Plugin Names Validation ──────────────────────────────────────

const EXPECTED_PLUGINS = [
  'system', 'download', 'linking', 'auto-reply', 'points',
  'groups', 'ai', 'persons', 'bridge', 'security', 'developer',
  'numbers', 'status', 'calls', 'reports', 'schedule', 'msgs', 'github',
];

test('[INT] Plugin Registry: أسماء الـ plugins صحيحة', () => {
  const stats = registry.getStats();
  for (const name of EXPECTED_PLUGINS) {
    assert.ok(
      stats.names.includes(name),
      `Plugin '${name}' غير موجود في Registry`
    );
  }
});

test('[INT] Plugin Registry: لا plugins مكررة', () => {
  const stats = registry.getStats();
  const unique = new Set(stats.names);
  assert.equal(unique.size, stats.names.length, 'يوجد plugins مكررة!');
});

// ─── Health Report Integration ────────────────────────────────────

test('[INT] Health Report: جميع الـ 18 في التقرير', () => {
  const health = registry.getHealthReport();
  assert.equal(health.length, 18);
});

test('[INT] Health Report: كل plugin لها enabled=true', () => {
  const health = registry.getHealthReport();
  for (const p of health) {
    assert.equal(p.enabled, true, `Plugin '${p.name}' معطّلة!`);
  }
});

test('[INT] Health Report: كل plugin لها status=healthy', () => {
  const health = registry.getHealthReport();
  for (const p of health) {
    assert.equal(p.status, 'healthy', `Plugin '${p.name}' غير healthy!`);
  }
});

// ─── Text Handlers Ordering ───────────────────────────────────────

test('[INT] getTextHandlers: مرتّبة تصاعدياً بـ textOrder', () => {
  const handlers = loader.getTextHandlers();
  assert.ok(handlers.length > 0, 'لا يوجد text handlers');
  for (let i = 1; i < handlers.length; i++) {
    assert.ok(
      handlers[i].manifest.textOrder >= handlers[i - 1].manifest.textOrder,
      'الترتيب غير صحيح'
    );
  }
});

test('[INT] getTextHandlers: system plugin هو الأول', () => {
  const handlers = loader.getTextHandlers();
  assert.equal(handlers[0].manifest.name, 'system');
});

// ─── Dispatch Integration ─────────────────────────────────────────

test('[INT] dispatchText: يرجع false عند عدم وجود معالج', async () => {
  const fakeBot = {};
  const fakeMsg = { text: '/unknown_command_xyz_12345', chat: { id: 1 }, from: { id: 1 } };
  const result = await registry.dispatchText(fakeBot, fakeMsg);
  assert.equal(result, false);
});

test('[INT] dispatchCallback: يرجع false على callback مجهول', async () => {
  const fakeBot = {};
  const fakeQuery = { data: 'completely_unknown_data_xyz', from: { id: 1 }, message: { chat: { id: 1 } } };
  const result = await registry.dispatchCallback(fakeBot, fakeQuery);
  assert.equal(result, false);
});

// ─── Enable/Disable Lifecycle ─────────────────────────────────────

test('[INT] enablePlugin/disablePlugin: دورة حياة كاملة', () => {
  const name = 'msgs';
  registry.disablePlugin(name);
  const handlers = loader.getTextHandlers();
  assert.ok(!handlers.some(h => h.manifest.name === name), `Plugin '${name}' ما زالت تعمل بعد disable`);

  registry.enablePlugin(name);
  const handlers2 = loader.getTextHandlers();
  assert.ok(handlers2.some(h => h.manifest.name === name), `Plugin '${name}' لم تُفعَّل`);
});

// ─── setDeps Distribution ─────────────────────────────────────────

test('[INT] setDepsAll: يُوزَّع دون استثناء', () => {
  assert.doesNotThrow(() => {
    registry.setDepsAll({ testKey: 'testValue' });
  });
});
