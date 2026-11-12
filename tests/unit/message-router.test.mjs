// tests/unit/message-router.test.mjs
// Unit Tests — Message Router

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as router from '../../dist/message-router.mjs';

function makeFakeBot() {
  return { sendMessage: async () => {} };
}

// ─── setMessageHandler / routeMessage (text) ──────────────────────

test('routeMessage: يوجّه رسالة نصية', async () => {
  let called = false;
  router.setMessageHandler(async (bot, msg) => { called = true; });
  const msg = { text: 'مرحبا' };
  await router.routeMessage(makeFakeBot(), msg);
  assert.equal(called, true);
});

test('routeMessage: يوجّه successful_payment', async () => {
  let calledPayment = false;
  router.setPaymentHandler(async (bot, msg) => { calledPayment = true; });
  const msg = { successful_payment: { invoice_payload: 'test' } };
  await router.routeMessage(makeFakeBot(), msg);
  assert.equal(calledPayment, true);
});

test('routeMessage: يوجّه photo', async () => {
  let calledMedia = false;
  router.setMediaHandler(async (bot, msg) => { calledMedia = true; return true; });
  const msg = { photo: [{}] };
  const result = await router.routeMessage(makeFakeBot(), msg);
  assert.equal(calledMedia, true);
  assert.equal(result, true);
});

test('routeMessage: يوجّه document', async () => {
  let calledDoc = false;
  router.setDocumentHandler(async (bot, msg) => { calledDoc = true; });
  const msg = { document: { file_id: 'test' } };
  await router.routeMessage(makeFakeBot(), msg);
  assert.equal(calledDoc, true);
});

test('routeMessage: document بدون handler → false', async () => {
  router.setDocumentHandler(null);
  const msg = { document: { file_id: 'test' } };
  const r = await router.routeMessage(makeFakeBot(), msg);
  assert.equal(r, false);
});

test('routeMessage: رسالة بدون نص → false', async () => {
  router.setMessageHandler(null);
  const msg = { sticker: {} };
  const r = await router.routeMessage(makeFakeBot(), msg);
  assert.equal(r, false);
});

// ─── Module Registration ──────────────────────────────────────────

test('registerModule: تسجيل وحدة', () => {
  router.registerModule('test-module', {});
  const stats = router.getStats();
  assert.ok(stats.modules >= 1);
});

// ─── Stats ────────────────────────────────────────────────────────

test('getStats: يرجع إحصائيات صحيحة', () => {
  const stats = router.getStats();
  assert.ok(typeof stats.modules === 'number');
  assert.ok(typeof stats.hasMessageHandler === 'boolean');
  assert.ok(typeof stats.hasPaymentHandler === 'boolean');
  assert.ok(typeof stats.hasMediaHandler === 'boolean');
  assert.ok(typeof stats.hasDocumentHandler === 'boolean');
});
