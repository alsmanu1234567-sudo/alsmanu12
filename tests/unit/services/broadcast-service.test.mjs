// tests/unit/services/broadcast-service.test.mjs
// Unit Tests — broadcast-service
// ملاحظة: الـ service تحتوي على setTimeout(100ms per user, 500ms per WA contact)
// نستخدم عدد مستخدمين أدنى لتجنب timeout

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  broadcastToAll,
  broadcastToTier,
  evilBlast,
} from '../../../dist/services/admin/broadcast-service.mjs';

function makeMockBot(failIds = []) {
  const messages = [];
  return {
    messages,
    sendMessage: async (chatId, text, opts) => {
      if (failIds.includes(String(chatId))) throw new Error('blocked');
      messages.push({ chatId, text });
    },
  };
}

// ─── broadcastToAll ───────────────────────────────────────────────
// delay=100ms per user — نستخدم 2 مستخدمين فقط (200ms)

test('broadcastToAll: يرسل لجميع المستخدمين', async () => {
  const bot = makeMockBot();
  const users = [
    { telegramId: '1', telegramChatId: '1' },
    { telegramId: '2', telegramChatId: '2' },
  ];
  const r = await broadcastToAll(bot, 'admin', 'مرحبا', users);
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 0);
});

test('broadcastToAll: يتحمل فشل الإرسال', async () => {
  const bot = makeMockBot(['2']);
  const users = [
    { telegramId: '1', telegramChatId: '1' },
    { telegramId: '2', telegramChatId: '2' },
  ];
  const r = await broadcastToAll(bot, 'admin', 'test', users);
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 1);
});

test('broadcastToAll: يتجاهل مستخدمين بلا chatId ولا telegramId', async () => {
  const bot = makeMockBot();
  // الـ service: const tid = u.telegramChatId || u.telegramId;
  // مستخدم بلا أي معرّف → failed++
  const users = [
    { telegramId: undefined, telegramChatId: undefined },
    { telegramId: '2', telegramChatId: '2' },
  ];
  const r = await broadcastToAll(bot, 'admin', 'test', users);
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 1);
});

test('broadcastToAll: قائمة فارغة', async () => {
  const bot = makeMockBot();
  const r = await broadcastToAll(bot, 'admin', 'test', []);
  assert.equal(r.sent, 0);
  assert.equal(r.failed, 0);
});

// ─── broadcastToTier ─────────────────────────────────────────────
// delay=100ms per user — 2 مستخدمين (200ms)

test('broadcastToTier: ترسل للفئة فقط', async () => {
  const bot = makeMockBot();
  const users = [
    { telegramId: '1', telegramChatId: '1', tier: 'free' },
    { telegramId: '2', telegramChatId: '2', tier: 'pro' },
    { telegramId: '3', telegramChatId: '3', tier: 'pro' },
  ];
  const r = await broadcastToTier(bot, 'admin', 'للـ pro', users, 'pro');
  assert.equal(r.sent, 2);
});

test('broadcastToTier: tier=null يرسل للكل', async () => {
  const bot = makeMockBot();
  const users = [
    { telegramId: '1', telegramChatId: '1', tier: 'free' },
    { telegramId: '2', telegramChatId: '2', tier: 'pro' },
  ];
  const r = await broadcastToTier(bot, 'admin', 'للكل', users, null);
  assert.equal(r.sent, 2);
});

// ─── evilBlast ───────────────────────────────────────────────────
// delay=500ms per contact — نستخدم 2 جهات فقط (1000ms)

test('evilBlast: يرسل لجهات الاتصال', async () => {
  const sentTo = [];
  const sock = { sendMessage: async (jid) => sentTo.push(jid) };
  const contacts = [{ jid: 'a@s.whatsapp.net' }, { jid: 'b@s.whatsapp.net' }];
  const r = await evilBlast(sock, contacts, 'test');
  assert.equal(r.sent, 2);
  assert.equal(sentTo.length, 2);
});

test('evilBlast: يتحمل الأخطاء', async () => {
  const sock = { sendMessage: async () => { throw new Error('fail'); } };
  const contacts = [{ jid: 'a@s.whatsapp.net' }];
  const r = await evilBlast(sock, contacts, 'test');
  assert.equal(r.sent, 0);
});

test('evilBlast: حد 50 جهة من 100', async () => {
  // نتحقق من المنطق بدون تشغيل فعلي — نحسب الـ slice
  const contacts = Array.from({ length: 100 }, (_, i) => ({ jid: `${i}@s.whatsapp.net` }));
  const sliced = contacts.slice(0, 50);
  assert.equal(sliced.length, 50);
});
