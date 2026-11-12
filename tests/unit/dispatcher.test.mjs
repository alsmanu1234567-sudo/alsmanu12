// tests/unit/dispatcher.test.mjs
// Unit Tests — Dispatcher

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as dispatcher from '../../dist/dispatcher.mjs';

function makeBot() { return {}; }
function makeQuery(data) {
  return { data, from: { id: 1 }, message: { chat: { id: 1 } } };
}

// ─── registerPrefix ───────────────────────────────────────────────

test('registerPrefix: تسجيل prefix', () => {
  dispatcher.registerPrefix('test_', async () => {});
  const prefixes = dispatcher.getRegisteredPrefixes();
  assert.ok(prefixes.includes('test_'));
});

// ─── dispatch ─────────────────────────────────────────────────────

test('dispatch: prefix match يُعالَج', async () => {
  let handled = '';
  dispatcher.registerPrefix('pfx_', async () => { handled = 'prefix'; });
  await dispatcher.dispatch('pfx_something', makeBot(), makeQuery('pfx_something'));
  assert.equal(handled, 'prefix');
});

test('dispatch: fallback → callbackHandler', async () => {
  let handled = '';
  dispatcher.setCallbackHandler(async () => { handled = 'callback'; });
  await dispatcher.dispatch('unknown_data', makeBot(), makeQuery('unknown_data'));
  assert.equal(handled, 'callback');
});

test('dispatch: بدون data → false', async () => {
  const r = await dispatcher.dispatch('', makeBot(), makeQuery(''));
  assert.equal(r, false);
});

// ─── setCallbackHandler ───────────────────────────────────────────

test('setCallbackHandler: تسجيل ناجح', () => {
  dispatcher.setCallbackHandler(async () => {});
  const stats = dispatcher.getStats();
  assert.equal(stats.hasCallbackHandler, true);
});

// ─── getStats ─────────────────────────────────────────────────────

test('getStats: يرجع إحصائيات صحيحة', () => {
  const stats = dispatcher.getStats();
  assert.ok(typeof stats.prefixes === 'number');
  assert.ok(typeof stats.hasCallbackHandler === 'boolean');
});

// ─── routeCallback ────────────────────────────────────────────────

test('routeCallback: يُوجَّه عبر prefix', async () => {
  let hit = false;
  dispatcher.registerPrefix('cb_', async () => { hit = true; });
  await dispatcher.routeCallback(makeBot(), makeQuery('cb_test'));
  assert.equal(hit, true);
});

test('routeCallback: بدون handler → false', async () => {
  dispatcher.setCallbackHandler(null);
  const r = await dispatcher.routeCallback(makeBot(), makeQuery('anything'));
  assert.equal(r, false);
});
