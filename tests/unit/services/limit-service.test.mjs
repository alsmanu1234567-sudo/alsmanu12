// tests/unit/services/limit-service.test.mjs
// Unit Tests — limit-service (pure functions)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDailyLimit,
  formatLimit,
  limitReachedMessage,
} from '../../../dist/services/users/limit-service.mjs';

// ─── checkDailyLimit ─────────────────────────────────────────────

test('checkDailyLimit: ضمن الحد', () => {
  const r = checkDailyLimit(3, 10);
  assert.equal(r.allowed, true);
  assert.equal(r.count, 3);
  assert.equal(r.limit, 10);
});

test('checkDailyLimit: عند الحد بالضبط', () => {
  const r = checkDailyLimit(10, 10);
  assert.equal(r.allowed, false);
});

test('checkDailyLimit: تجاوز الحد', () => {
  const r = checkDailyLimit(15, 10);
  assert.equal(r.allowed, false);
});

test('checkDailyLimit: Infinity limit', () => {
  const r = checkDailyLimit(999999, Infinity);
  assert.equal(r.allowed, true);
});

test('checkDailyLimit: صفر استخدامات', () => {
  const r = checkDailyLimit(0, 5);
  assert.equal(r.allowed, true);
});

// ─── formatLimit ─────────────────────────────────────────────────

test('formatLimit: رقم عادي', () => {
  assert.equal(formatLimit(10), '10');
  assert.equal(formatLimit(0), '0');
});

test('formatLimit: Infinity → ∞', () => {
  assert.equal(formatLimit(Infinity), '∞');
});

// ─── limitReachedMessage ─────────────────────────────────────────

test('limitReachedMessage: مع حد عادي', () => {
  const msg = limitReachedMessage(5, 5);
  assert.ok(msg.includes('5/5'));
  assert.ok(msg.startsWith('❌'));
});

test('limitReachedMessage: مع Infinity', () => {
  const msg = limitReachedMessage(100, Infinity);
  assert.ok(msg.includes('∞'));
});
