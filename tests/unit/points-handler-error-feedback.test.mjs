// tests/unit/points-handler-error-feedback.test.mjs
// تحقق من إصلاح: عندما يفشل handlePointsCallback/handleConfirmBuy لا يجب أن يختفي الخطأ
// بصمت — يجب أن يصل للمستخدم رد واضح دائماً (كان سابقاً catch{} فاضي / fallback للقائمة الخطأ).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pointsHandler from '../../dist/handlers/points-handler.mjs';

function makeBot() {
  const sent = [];
  return {
    sent,
    sendMessage: async (chatId, text, opts) => { sent.push({ chatId, text, opts }); return {}; },
  };
}

function makeQuery(data) {
  return { data, message: { chat: { id: 111 } }, from: { id: 42 } };
}

test('confirm_buy_: عند رمي handleConfirmBuy استثناء، يصل للمستخدم رسالة خطأ وليس صمت', async () => {
  pointsHandler.setDeps({
    handleConfirmBuy: async () => { throw new Error('boom'); },
  });
  const bot = makeBot();
  const result = await pointsHandler.handleCallback(bot, makeQuery('confirm_buy_pro'));

  assert.equal(result, true);
  assert.equal(bot.sent.length, 1, 'يجب إرسال رسالة خطأ واحدة للمستخدم بدل الصمت الكامل');
  assert.match(bot.sent[0].text, /خطأ/, 'يجب أن تشرح الرسالة أن هناك خطأ حدث');
});

test('menu_features: عند فشل handlePointsCallback، لا يتم استبدال القائمة بصمت بقائمة النقاط العامة', async () => {
  pointsHandler.setDeps({
    handlePointsCallback: async () => { throw new Error('render failed'); },
    getUser: (id) => ({ points: 0, tier: 'free' }),
    inMemoryDB: { pointsLog: [] },
  });
  const bot = makeBot();
  const result = await pointsHandler.handleCallback(bot, makeQuery('menu_features'));

  assert.equal(result, true);
  assert.equal(bot.sent.length, 1, 'يجب إرسال رسالة واحدة توضح الخطأ');
  assert.match(bot.sent[0].text, /قائمة الميزات|خطأ/, 'يجب أن توضح الرسالة أن قائمة الميزات فشلت، لا رسالة نقاط عامة صامتة');
});

test('menu_points: عند فشل handlePointsCallback لغير طلب الميزات، يستخدم fallback القائمة العامة', async () => {
  pointsHandler.setDeps({
    handlePointsCallback: async () => { throw new Error('render failed'); },
    getUser: (id) => ({ points: 10, tier: 'free' }),
    inMemoryDB: { pointsLog: [] },
  });
  const bot = makeBot();
  const result = await pointsHandler.handleCallback(bot, makeQuery('menu_points'));

  assert.equal(result, true);
  assert.equal(bot.sent.length, 1, 'يجب إرسال رسالة fallback واحدة على الأقل');
});
