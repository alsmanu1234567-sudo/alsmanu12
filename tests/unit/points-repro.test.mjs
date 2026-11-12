// tests/unit/points-repro.test.mjs
// تشخيص: مشكلة "قائمة شراء الميزات لا تظهر" و "الميزة لا تُفعَّل بعد الشراء"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as points from '../../dist/points.mjs';

function makeUsersStore() {
  const users = new Map();
  return {
    users,
    getUser(id) {
      if (!users.has(id)) {
        users.set(id, { telegramId: id, points: 0, tier: 'free', maxNumbers: 1 });
      }
      return users.get(id);
    },
    saveUser(id, data) {
      users.set(id, { ...(users.get(id) || {}), ...data });
    },
  };
}

function makeDeps(store) {
  return {
    getUser: store.getUser,
    saveUser: store.saveUser,
    addPoints(id, amount) {
      const u = store.getUser(id);
      u.points = (u.points || 0) + amount;
      store.saveUser(id, u);
      return u.points;
    },
    setState() {},
    getState() { return { data: {} }; },
    clearState() {},
    inMemoryDB: { pointsLog: [] },
    DEVELOPER_ID: '999',
    TIER_NAMES: { free: 'مجاني', pro: 'برو', promax: 'برو ماكس', khariq: 'خارق', khariqpro: 'خارق للرو', mizaj: 'ميزاج' },
    TIER_COSTS: { pro: 500000, promax: 1000000, khariq: 2000000, khariqpro: 5000000, mizaj: 10000000 },
    TIER_ORDER: ['free', 'pro', 'promax', 'khariq', 'khariqpro', 'mizaj'],
    TIER_MAX_NUMBERS: { free: 1, pro: 10, promax: 20, khariq: 50, khariqpro: 100, mizaj: 999999 },
    TIER_FEATURES: { pro: ['ميزة1'], promax: ['ميزة2'] },
    MULTI_TIER_DISCOUNTS: { 2: 10 },
    getDynamicPrice(key, def) { return def; },
    mainMenuKeyboard() { return { inline_keyboard: [] }; },
    pointsMenuKeyboard() { return { inline_keyboard: [] }; },
    featuresMenuKeyboard(tier, pts) {
      return { inline_keyboard: [[{ text: `${tier}/${pts}`, callback_data: 'x' }]] };
    },
    confirmKeyboard() { return { inline_keyboard: [] }; },
    cancelKeyboard() { return { inline_keyboard: [] }; },
    bundleKeyboard() { return { inline_keyboard: [] }; },
    bulkPointsKeyboard() { return { inline_keyboard: [] }; },
    BOT_USERNAME: 'testbot',
  };
}

function makeBot() {
  const sent = [];
  return {
    sent,
    sendMessage: async (chatId, text, opts) => { sent.push({ chatId, text, opts }); },
  };
}

test('showFeatures2: تعرض قائمة الشراء بدون رمي استثناء', async () => {
  const store = makeUsersStore();
  points.setDeps(makeDeps(store));
  const bot = makeBot();
  const user = store.getUser('1');
  await points.showFeatures2(bot, 111, '1', user);
  assert.equal(bot.sent.length, 1, 'يجب أن تُرسَل رسالة واحدة تحتوي على قائمة الشراء');
  assert.ok(bot.sent[0].opts?.reply_markup?.inline_keyboard?.length > 0, 'يجب أن تحتوي الرسالة على أزرار');
});

test('handleConfirmBuy: يرفع tier فعلياً بعد الدفع الناجح', async () => {
  const store = makeUsersStore();
  points.setDeps(makeDeps(store));
  const bot = makeBot();
  store.getUser('2');
  store.saveUser('2', { points: 600000 });

  await points.handleConfirmBuy(bot, 111, '2', 'pro');

  const fresh = store.getUser('2');
  assert.equal(fresh.tier, 'pro', 'يجب أن يتغيّر tier المستخدم إلى pro بعد الشراء الناجح');
  assert.equal(fresh.points, 100000, 'يجب خصم تكلفة الشراء من النقاط');
  assert.equal(fresh.maxNumbers, 10, 'يجب تحديث الحد الأقصى للأرقام حسب الفئة الجديدة');
});

test('handleConfirmBuy: يرفض الشراء عند نقاط غير كافية ولا يغيّر tier', async () => {
  const store = makeUsersStore();
  points.setDeps(makeDeps(store));
  const bot = makeBot();
  store.getUser('3');
  store.saveUser('3', { points: 100 });

  await points.handleConfirmBuy(bot, 111, '3', 'pro');

  const fresh = store.getUser('3');
  assert.equal(fresh.tier, 'free', 'لا يجب أن يتغيّر tier بدون نقاط كافية');
});

test('handlePointsCallback: menu_features / points_buy تستدعي showFeatures2', async () => {
  const store = makeUsersStore();
  points.setDeps(makeDeps(store));
  const bot = makeBot();
  store.getUser('4');
  await points.handlePointsCallback(bot, 111, '4', 'menu_features');
  assert.equal(bot.sent.length, 1);
  await points.handlePointsCallback(bot, 111, '4', 'points_buy');
  assert.equal(bot.sent.length, 2);
});
