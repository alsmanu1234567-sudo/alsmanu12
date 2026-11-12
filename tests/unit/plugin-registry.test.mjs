// tests/unit/plugin-registry.test.mjs
// Unit Tests — Plugin Registry

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// نستورد Registry مباشرة — Map داخلية معزولة لكل استيراد
// نستخدم dynamic import لضمان instance منفصل
const reg = await import('../../dist/plugins/plugin-registry.mjs');

// دالة تنظيف — تُزيل كل plugins
function clearAll() {
  const names = reg.getNames();
  for (const n of names) reg.unregister(n);
}

function makeModule() {
  return {
    handleText: async () => false,
    setDeps: () => {},
  };
}

function makeManifest(name, overrides = {}) {
  return {
    name,
    type: 'handler',
    textOrder: 1,
    enabled: true,
    ...overrides,
  };
}

// ─── Registration ─────────────────────────────────────────────────

test('register: تسجيل plugin جديد', () => {
  clearAll();
  const mod = makeModule();
  const manifest = makeManifest('test-plugin');
  reg.register('test-plugin', mod, manifest);
  assert.equal(reg.has('test-plugin'), true);
  clearAll();
});

test('register: plugin مسجّل مرتين → استثناء', () => {
  clearAll();
  reg.register('dup', makeModule(), makeManifest('dup'));
  assert.throws(() => reg.register('dup', makeModule(), makeManifest('dup')));
  clearAll();
});

test('unregister: حذف plugin', () => {
  clearAll();
  reg.register('to-remove', makeModule(), makeManifest('to-remove'));
  assert.equal(reg.has('to-remove'), true);
  reg.unregister('to-remove');
  assert.equal(reg.has('to-remove'), false);
});

test('unregister: حذف plugin غير موجود → false', () => {
  const result = reg.unregister('nonexistent');
  assert.equal(result, false);
});

// ─── Lookup ───────────────────────────────────────────────────────

test('get: يرجع entry صحيح', () => {
  clearAll();
  reg.register('get-test', makeModule(), makeManifest('get-test'));
  const entry = reg.get('get-test');
  assert.ok(entry);
  assert.equal(entry.name, 'get-test');
  clearAll();
});

test('get: plugin غير موجود → null', () => {
  assert.equal(reg.get('nonexistent'), null);
});

// ─── Discovery ────────────────────────────────────────────────────

test('getAll: يرجع جميع الـ plugins', () => {
  clearAll();
  reg.register('a', makeModule(), makeManifest('a'));
  reg.register('b', makeModule(), makeManifest('b'));
  const all = reg.getAll();
  assert.equal(all.length, 2);
  clearAll();
});

test('getEnabled: يرجع المفعّلة فقط', () => {
  clearAll();
  reg.register('en1', makeModule(), makeManifest('en1', { enabled: true }));
  reg.register('dis1', makeModule(), makeManifest('dis1', { enabled: false }));
  const enabled = reg.getEnabled();
  assert.equal(enabled.length, 1);
  assert.equal(enabled[0].name, 'en1');
  clearAll();
});

test('getByType: يفلتر بالنوع', () => {
  clearAll();
  reg.register('h1', makeModule(), makeManifest('h1', { type: 'handler' }));
  reg.register('s1', makeModule(), makeManifest('s1', { type: 'service' }));
  const handlers = reg.getByType('handler');
  assert.equal(handlers.length, 1);
  clearAll();
});

test('getNames: يرجع الأسماء فقط', () => {
  clearAll();
  reg.register('x', makeModule(), makeManifest('x'));
  reg.register('y', makeModule(), makeManifest('y'));
  const names = reg.getNames();
  assert.ok(names.includes('x'));
  assert.ok(names.includes('y'));
  clearAll();
});

// ─── Enable / Disable ─────────────────────────────────────────────

test('enable/disable: دورة حياة', () => {
  clearAll();
  reg.register('toggle', makeModule(), makeManifest('toggle'));
  assert.equal(reg.get('toggle').enabled, true);
  reg.disable('toggle');
  assert.equal(reg.get('toggle').enabled, false);
  reg.enable('toggle');
  assert.equal(reg.get('toggle').enabled, true);
  clearAll();
});

test('enable: plugin غير موجود → false', () => {
  assert.equal(reg.enable('missing'), false);
});

test('disable: plugin غير موجود → false', () => {
  assert.equal(reg.disable('missing'), false);
});

// ─── Health ───────────────────────────────────────────────────────

test('setHealth/getHealth: يحدّث الصحة', () => {
  clearAll();
  reg.register('healthy', makeModule(), makeManifest('healthy'));
  reg.setHealth('healthy', 'degraded', 'test error');
  const h = reg.getHealth('healthy');
  assert.equal(h.status, 'degraded');
  assert.ok(h.errors.length > 0);
  clearAll();
});

test('getHealth: plugin غير موجود → null', () => {
  assert.equal(reg.getHealth('nonexistent'), null);
});

// ─── Validation ───────────────────────────────────────────────────

test('validate: module صحيح → ok', () => {
  const mod = { handleText: async () => {}, setDeps: () => {} };
  const manifest = makeManifest('v1');
  const r = reg.validate(mod, manifest);
  assert.equal(r.ok, true);
});

test('validate: بدون manifest → fail', () => {
  const r = reg.validate({}, null);
  assert.equal(r.ok, false);
});

test('validate: بدون name → fail', () => {
  const r = reg.validate(makeModule(), { type: 'handler', textOrder: 1 });
  assert.equal(r.ok, false);
});

test('validate: بدون textOrder وcbOrder → fail', () => {
  const r = reg.validate(makeModule(), { name: 'x', type: 'handler' });
  assert.equal(r.ok, false);
});

test('validate: بدون handleText وhandleCallback → fail', () => {
  const mod = { setDeps: () => {} };
  const r = reg.validate(mod, makeManifest('x'));
  assert.equal(r.ok, false);
});

test('validate: بدون setDeps → fail', () => {
  const mod = { handleText: async () => {} };
  const r = reg.validate(mod, makeManifest('x'));
  assert.equal(r.ok, false);
});

// ─── Metadata ─────────────────────────────────────────────────────

test('getMetadata: يرجع metadata صحيح', () => {
  clearAll();
  reg.register('meta-test', makeModule(), makeManifest('meta-test'));
  const meta = reg.getMetadata('meta-test');
  assert.ok(meta);
  assert.equal(meta.name, 'meta-test');
  assert.ok(meta.manifest);
  assert.ok(meta.health);
  clearAll();
});

// ─── Statistics ───────────────────────────────────────────────────

test('getStats: إحصائيات صحيحة', () => {
  clearAll();
  reg.register('s1', makeModule(), makeManifest('s1'));
  reg.register('s2', makeModule(), makeManifest('s2', { enabled: false }));
  const stats = reg.getStats();
  assert.equal(stats.total, 2);
  assert.equal(stats.enabled, 1);
  assert.equal(stats.disabled, 1);
  assert.equal(stats.healthy, 2);
  clearAll();
});
