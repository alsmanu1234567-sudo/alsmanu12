// tests/unit/services/bulk-points-service.test.mjs
// Unit Tests — bulk-points-service

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distributeBulkPoints } from '../../../dist/services/points/bulk-points-service.mjs';

test('distributeBulkPoints: توزيع على الجميع', async () => {
  const users = [
    { telegramId: '1', tier: 'free' },
    { telegramId: '2', tier: 'pro' },
    { telegramId: '3', tier: 'promax' },
  ];
  const received = [];
  const addPoints = (id, amount, reason) => { received.push({ id, amount, reason }); };

  const r = await distributeBulkPoints(users, 50, 'هدية', null, addPoints);
  assert.equal(r.count, 3);
  assert.equal(received.length, 3);
  assert.equal(received[0].amount, 50);
});

test('distributeBulkPoints: توزيع على فئة محددة', async () => {
  const users = [
    { telegramId: '1', tier: 'free' },
    { telegramId: '2', tier: 'pro' },
    { telegramId: '3', tier: 'pro' },
  ];
  const received = [];
  const addPoints = (id) => { received.push(id); };

  const r = await distributeBulkPoints(users, 100, 'مكافأة', 'pro', addPoints);
  assert.equal(r.count, 2);
  assert.equal(received.length, 2);
});

test('distributeBulkPoints: لا مستخدمين في الفئة', async () => {
  const users = [{ telegramId: '1', tier: 'free' }];
  const addPoints = () => {};
  const r = await distributeBulkPoints(users, 10, '', 'mizaj', addPoints);
  assert.equal(r.count, 0);
});

test('distributeBulkPoints: قائمة فارغة', async () => {
  const r = await distributeBulkPoints([], 100, '', null, () => {});
  assert.equal(r.count, 0);
});

test('distributeBulkPoints: سبب افتراضي عند فراغه', async () => {
  const users = [{ telegramId: '1', tier: 'free' }];
  const reasons = [];
  const addPoints = (id, amount, reason) => reasons.push(reason);
  await distributeBulkPoints(users, 10, '', null, addPoints);
  assert.ok(reasons[0].length > 0);
});

test('distributeBulkPoints: تجاهل الأخطاء في addPoints', async () => {
  const users = [
    { telegramId: '1', tier: 'free' },
    { telegramId: '2', tier: 'free' },
  ];
  let call = 0;
  const addPoints = () => {
    call++;
    if (call === 1) throw new Error('db error');
  };
  const r = await distributeBulkPoints(users, 10, '', null, addPoints);
  assert.equal(r.count, 1);
});
