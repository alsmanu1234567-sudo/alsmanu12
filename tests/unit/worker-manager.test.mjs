// tests/unit/worker-manager.test.mjs
// Unit Tests — Worker Manager (API الحقيقي)
// API الفعلي: createWorker, getWorker, getOrCreateWorker, setWorkerStatus,
//              setWhatsAppConnected, addError, stopWorker, restartWorker,
//              getAllWorkers, getStats, registerReconnect, unregisterReconnect,
//              pingWorker, scheduleRestart

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkerManager, setDeps } from '../../dist/worker-manager.mjs';

// تهيئة logger صامت
setDeps({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  inMemoryDB: { workerStatus: new Map() },
});

// ─── createWorker ─────────────────────────────────────────────────

test('createWorker: ينشئ worker جديد بالحقول الصحيحة', () => {
  const wm = new WorkerManager();
  const worker = wm.createWorker('user1');
  assert.ok(worker);
  assert.equal(worker.userId, 'user1');
  assert.equal(worker.status, 'connecting');
  assert.equal(worker.whatsappConnected, false);
  assert.equal(worker.restartCount, 0);
  assert.ok(Array.isArray(worker.errors));
  assert.equal(worker.errors.length, 0);
});

test('createWorker: يُخزَّن في الـ Map', () => {
  const wm = new WorkerManager();
  wm.createWorker('user2');
  assert.ok(wm.getWorker('user2'));
});

// ─── getWorker / getOrCreateWorker ────────────────────────────────

test('getWorker: يرجع worker موجود', () => {
  const wm = new WorkerManager();
  wm.createWorker('user3');
  assert.ok(wm.getWorker('user3'));
});

test('getWorker: worker غير موجود → undefined', () => {
  const wm = new WorkerManager();
  assert.equal(wm.getWorker('nonexistent___xyz'), undefined);
});

test('getOrCreateWorker: يُنشئ إذا لم يوجد', () => {
  const wm = new WorkerManager();
  const w = wm.getOrCreateWorker('newuser_oc');
  assert.ok(w);
  assert.equal(w.userId, 'newuser_oc');
});

test('getOrCreateWorker: يرجع موجود إذا وُجد', () => {
  const wm = new WorkerManager();
  const w1 = wm.createWorker('same_user');
  const w2 = wm.getOrCreateWorker('same_user');
  assert.equal(w1, w2);
});

// ─── setWorkerStatus ──────────────────────────────────────────────

test('setWorkerStatus: يُحدِّث الحالة', () => {
  const wm = new WorkerManager();
  wm.createWorker('status-user');
  wm.setWorkerStatus('status-user', 'running');
  assert.equal(wm.getWorker('status-user').status, 'running');
});

// ─── setWhatsAppConnected ─────────────────────────────────────────

test('setWhatsAppConnected: true → running', () => {
  const wm = new WorkerManager();
  wm.createWorker('wa-user');
  wm.setWhatsAppConnected('wa-user', true);
  const w = wm.getWorker('wa-user');
  assert.equal(w.whatsappConnected, true);
  assert.equal(w.status, 'running');
});

test('setWhatsAppConnected: false → stopped', () => {
  const wm = new WorkerManager();
  wm.createWorker('wa-user2');
  wm.setWhatsAppConnected('wa-user2', false);
  assert.equal(wm.getWorker('wa-user2').status, 'stopped');
});

// ─── addError ─────────────────────────────────────────────────────

test('addError: يُسجَّل الخطأ في errors array', () => {
  const wm = new WorkerManager();
  wm.createWorker('err-user');
  wm.addError('err-user', 'خطأ اختباري');
  const w = wm.getWorker('err-user');
  assert.ok(w.errors.length > 0);
  assert.ok(w.errors[0].includes('خطأ اختباري'));
  // تنظيف timers
  const timer = wm.restartTimers.get('err-user');
  if (timer) clearTimeout(timer);
  wm.restartTimers.delete('err-user');
});

test('addError: يُغيِّر status إلى stopped', () => {
  const wm = new WorkerManager();
  wm.createWorker('err-user2');
  wm.setWorkerStatus('err-user2', 'running');
  wm.addError('err-user2', 'crash');
  assert.equal(wm.getWorker('err-user2').status, 'stopped');
  const timer = wm.restartTimers.get('err-user2');
  if (timer) clearTimeout(timer);
  wm.restartTimers.delete('err-user2');
});

// ─── stopWorker ───────────────────────────────────────────────────

test('stopWorker: يوقف الـ worker', () => {
  const wm = new WorkerManager();
  wm.createWorker('stop-user');
  wm.setWhatsAppConnected('stop-user', true);
  wm.stopWorker('stop-user');
  const w = wm.getWorker('stop-user');
  assert.equal(w.status, 'stopped');
  assert.equal(w.whatsappConnected, false);
});

// ─── pingWorker ───────────────────────────────────────────────────

test('pingWorker: يُحدِّث lastPing', () => {
  const wm = new WorkerManager();
  wm.createWorker('ping-user');
  const before = wm.getWorker('ping-user').lastPing;
  wm.pingWorker('ping-user');
  const after = wm.getWorker('ping-user').lastPing;
  assert.ok(after >= before);
});

// ─── getAllWorkers ────────────────────────────────────────────────

test('getAllWorkers: يرجع مصفوفة', () => {
  const wm = new WorkerManager();
  wm.createWorker('ga-1');
  wm.createWorker('ga-2');
  const all = wm.getAllWorkers();
  assert.ok(Array.isArray(all));
  assert.ok(all.length >= 2);
});

// ─── getStats ────────────────────────────────────────────────────

test('getStats: يرجع إحصائيات صحيحة', () => {
  const wm = new WorkerManager();
  wm.createWorker('gs-1'); // connecting
  wm.createWorker('gs-2');
  wm.setWhatsAppConnected('gs-2', true); // running
  const stats = wm.getStats();
  assert.ok(typeof stats.total === 'number');
  assert.ok(typeof stats.running === 'number');
  assert.ok(typeof stats.stopped === 'number');
  assert.ok(stats.total >= 2);
  assert.ok(stats.running >= 1);
});

// ─── Reconnect Callbacks ──────────────────────────────────────────

test('registerReconnect/unregisterReconnect', () => {
  const wm = new WorkerManager();
  const cb = () => {};
  wm.registerReconnect('r-user', cb);
  assert.equal(wm.reconnectCallbacks.get('r-user'), cb);
  wm.unregisterReconnect('r-user');
  assert.equal(wm.reconnectCallbacks.get('r-user'), undefined);
});

test('setGlobalReconnect: يُسجَّل', () => {
  const wm = new WorkerManager();
  const globalCb = () => {};
  wm.setGlobalReconnect(globalCb);
  assert.equal(wm.globalReconnect, globalCb);
});
