// tests/unit/services/blocklist-service.test.mjs
// Unit Tests — blocklist-service (pure functions)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockCaller,
  unblockCaller,
  isCallerBlocked,
  getBlockedCallers,
} from '../../../dist/services/calls/blocklist-service.mjs';

// ─── blockCaller ─────────────────────────────────────────────────

test('blockCaller: إضافة رقم جديد', () => {
  const user = { blockedCallers: [] };
  const r = blockCaller(user, '966501234567');
  assert.equal(r.wasAlreadyBlocked, false);
  assert.ok(r.blocked.includes('966501234567'));
});

test('blockCaller: رقم موجود مسبقاً', () => {
  const user = { blockedCallers: ['966501234567'] };
  const r = blockCaller(user, '966501234567');
  assert.equal(r.wasAlreadyBlocked, true);
  assert.equal(r.blocked.length, 1);
});

test('blockCaller: لا يُعدِّل الـ user الأصلي', () => {
  const user = { blockedCallers: ['111'] };
  blockCaller(user, '222');
  assert.equal(user.blockedCallers.length, 1);
});

test('blockCaller: user بدون blockedCallers', () => {
  const user = {};
  const r = blockCaller(user, '123');
  assert.ok(r.blocked.includes('123'));
  assert.equal(r.wasAlreadyBlocked, false);
});

// ─── unblockCaller ────────────────────────────────────────────────

test('unblockCaller: إزالة رقم موجود', () => {
  const user = { blockedCallers: ['111', '222', '333'] };
  const r = unblockCaller(user, '222');
  assert.ok(!r.blocked.includes('222'));
  assert.equal(r.blocked.length, 2);
});

test('unblockCaller: رقم غير موجود', () => {
  const user = { blockedCallers: ['111'] };
  const r = unblockCaller(user, '999');
  assert.equal(r.blocked.length, 1);
});

// ─── isCallerBlocked ─────────────────────────────────────────────

test('isCallerBlocked: محظور', () => {
  const user = { blockedCallers: ['123', '456'] };
  assert.equal(isCallerBlocked(user, '123'), true);
});

test('isCallerBlocked: غير محظور', () => {
  const user = { blockedCallers: ['123'] };
  assert.equal(isCallerBlocked(user, '999'), false);
});

test('isCallerBlocked: قائمة فارغة', () => {
  assert.equal(isCallerBlocked({}, '123'), false);
});

// ─── getBlockedCallers ────────────────────────────────────────────

test('getBlockedCallers: ترجع نسخة', () => {
  const user = { blockedCallers: ['a', 'b'] };
  const result = getBlockedCallers(user);
  result.push('c');
  assert.equal(user.blockedCallers.length, 2);
});

test('getBlockedCallers: قائمة فارغة', () => {
  assert.deepEqual(getBlockedCallers({}), []);
});
