// tests/unit/services/bulk-send-service.test.mjs
// Unit Tests — bulk-send-service

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkSendMessages,
  updateBulkStats,
} from '../../../dist/services/bridge/bulk-send-service.mjs';

// ─── bulkSendMessages ─────────────────────────────────────────────

test('bulkSendMessages: إرسال لقائمة', async () => {
  const sent_to = [];
  const sock = {
    sendMessage: async (jid, msg) => { sent_to.push(jid); }
  };
  const list = [{ number: '966501234567' }, { number: '966509876543' }];
  const r = await bulkSendMessages(sock, list, 'مرحبا', false);
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 0);
  assert.ok(sent_to[0].includes('966501234567'));
});

test('bulkSendMessages: تحمل أخطاء sendMessage', async () => {
  const sock = {
    sendMessage: async (jid) => {
      if (jid.includes('BAD')) throw new Error('fail');
    }
  };
  const list = [{ number: 'GOOD' }, { number: 'BAD' }];
  const r = await bulkSendMessages(sock, list, 'test', false);
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 1);
});

test('bulkSendMessages: قائمة فارغة', async () => {
  const r = await bulkSendMessages({ sendMessage: async () => {} }, [], 'test', false);
  assert.equal(r.sent, 0);
  assert.equal(r.failed, 0);
});

test('bulkSendMessages: sock بدون sendMessage (optional chaining → undefined)', async () => {
  // sock.sendMessage?.() مع optional chaining يرجع undefined ولا يرمي — sent++ يُستدعى
  // هذا السلوك متوقع من الـ service (no throw = success from JS perspective)
  const r = await bulkSendMessages({}, [{ number: '123' }], 'test', false);
  // إما sent=1 (optional chaining) أو failed=1 (يعتمد على التنفيذ)
  assert.equal(r.sent + r.failed, 1, 'يجب أن يعالج الرسالة الواحدة');
});

// ─── updateBulkStats ─────────────────────────────────────────────

test('updateBulkStats: تحديث إحصائيات جديدة', () => {
  const userData = {};
  const getUser = () => userData;
  const saveUser = (id, data) => { Object.assign(userData, data); };

  updateBulkStats('123', 5, 2, 7, getUser, saveUser);
  assert.equal(userData.bulkStats.sent, 5);
  assert.equal(userData.bulkStats.failed, 2);
  assert.equal(userData.bulkStats.total, 7);
});

test('updateBulkStats: إضافة لإحصائيات موجودة', () => {
  const userData = { bulkStats: { sent: 10, failed: 1, total: 11 } };
  const getUser = () => userData;
  const saveUser = (id, data) => { Object.assign(userData, data); };

  updateBulkStats('123', 5, 0, 5, getUser, saveUser);
  assert.equal(userData.bulkStats.sent, 15);
  assert.equal(userData.bulkStats.failed, 1);
  assert.equal(userData.bulkStats.total, 16);
});
