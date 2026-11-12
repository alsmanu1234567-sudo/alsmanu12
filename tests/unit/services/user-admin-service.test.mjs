// tests/unit/services/user-admin-service.test.mjs
// Unit Tests — user-admin-service

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTier,
  getValidTiers,
  changeTier,
  deleteUser,
  modifyUserPoints,
} from '../../../dist/services/admin/user-admin-service.mjs';

// ─── isValidTier ─────────────────────────────────────────────────

test('isValidTier: فئات صحيحة', () => {
  assert.equal(isValidTier('free'), true);
  assert.equal(isValidTier('pro'), true);
  assert.equal(isValidTier('promax'), true);
  assert.equal(isValidTier('khariq'), true);
  assert.equal(isValidTier('khariqpro'), true);
  assert.equal(isValidTier('mizaj'), true);
});

test('isValidTier: فئة غير صحيحة', () => {
  assert.equal(isValidTier('superuser'), false);
  assert.equal(isValidTier(''), false);
  assert.equal(isValidTier('admin'), false);
});

test('isValidTier: غير حساس لحالة الأحرف', () => {
  assert.equal(isValidTier('FREE'), true);
  assert.equal(isValidTier('PRO'), true);
});

// ─── getValidTiers ────────────────────────────────────────────────

test('getValidTiers: ترجع مصفوفة', () => {
  const tiers = getValidTiers();
  assert.ok(Array.isArray(tiers));
  assert.ok(tiers.includes('free'));
  assert.ok(tiers.includes('mizaj'));
});

test('getValidTiers: لا تُعدِّل القائمة الأصلية', () => {
  const t1 = getValidTiers();
  t1.push('hacked');
  const t2 = getValidTiers();
  assert.ok(!t2.includes('hacked'));
});

// ─── changeTier ──────────────────────────────────────────────────

test('changeTier: تغيير ناجح', () => {
  const saved = {};
  const saveUser = (id, data) => { Object.assign(saved, data); };
  const r = changeTier('123', 'pro', saveUser);
  assert.equal(r.ok, true);
  assert.equal(r.tier, 'pro');
  assert.equal(saved.tier, 'pro');
});

test('changeTier: فئة غير صحيحة', () => {
  const saveUser = () => { throw new Error('should not be called'); };
  const r = changeTier('123', 'invalid_tier', saveUser);
  assert.equal(r.ok, false);
});

// ─── deleteUser ──────────────────────────────────────────────────

test('deleteUser: حذف مستخدم موجود', () => {
  const users = [
    { telegramId: '1' },
    { telegramId: '2' },
    { telegramId: '3' },
  ];
  const getAllUsers = () => users;
  const r = deleteUser('2', getAllUsers);
  assert.equal(r.ok, true);
  assert.equal(users.length, 2);
  assert.ok(users.every(u => u.telegramId !== '2'));
});

test('deleteUser: مستخدم غير موجود', () => {
  const users = [{ telegramId: '1' }];
  const r = deleteUser('999', () => users);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_found');
});

// ─── modifyUserPoints ────────────────────────────────────────────

test('modifyUserPoints: إضافة نقاط', () => {
  const calls = [];
  const addPoints = (id, amount, reason) => { calls.push({ id, amount, reason }); return 150; };
  modifyUserPoints('123', 50, 1, addPoints);
  assert.equal(calls[0].amount, 50);
  assert.ok(calls[0].reason.includes('إضافة'));
});

test('modifyUserPoints: خصم نقاط', () => {
  const calls = [];
  const addPoints = (id, amount, reason) => { calls.push({ id, amount, reason }); };
  modifyUserPoints('123', 30, -1, addPoints);
  assert.equal(calls[0].amount, -30);
  assert.ok(calls[0].reason.includes('خصم'));
});
