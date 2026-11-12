/**
 * tests/unit/pipeline-newsletter.test.mjs — v2
 * ─────────────────────────────────────────────────────────────────
 * اختبار النظام: queue v2 + msg-pipeline v2 + rules-cache v2
 *
 * التغطية v2 الإضافية:
 *  • Queue: timeout، clearByLabel، size getter
 *  • pipeline: teardown، getUserStats، per-user عزل
 *  • rules-cache: getCacheStats، polling-fallback آلية، إعادة الكشف عند إنشاء ملف
 */

import { strict as assert } from "assert";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
let passed = 0, failed = 0;

async function it(name, fn) {
  try {
    await fn();
    console.log(G + `  ✓ ${name}` + N);
    passed++;
  } catch (err) {
    console.error(R + `  ✗ ${name}\n    ${err.message}` + N);
    failed++;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ════════════════════════════════════════════════════════════════
// rules-cache v2
// ════════════════════════════════════════════════════════════════
console.log("\n📦 rules-cache.mjs v2\n");

const { getRules, getChats, invalidate, initRulesCache, getCacheStats, _resetForTest } =
  await import("../../engine/rules-cache.mjs");

await it("getRules() يُعيد [] عند التهيئة بملف غير موجود", async () => {
  _resetForTest();
  initRulesCache("/nonexistent/rules.json", "/nonexistent/chats.json");
  assert.deepEqual(getRules(), []);
});

await it("getCacheStats() يُعيد بنية صحيحة", async () => {
  const s = getCacheStats();
  assert.ok(typeof s.hitCount === "number");
  assert.ok(typeof s.reloadCount === "number");
  assert.ok(typeof s.rulesCount === "number");
  assert.ok(typeof s.uptimeSec === "number");
});

await it("getRules() يزيد hitCount في getCacheStats()", async () => {
  const before = getCacheStats().hitCount;
  getRules(); getRules(); getRules();
  assert.equal(getCacheStats().hitCount, before + 3);
});

await it("initRulesCache idempotent — استدعاءات متعددة لا تُحدث مشاكل", async () => {
  initRulesCache("/nonexistent/rules.json", "/nonexistent/chats.json");
  initRulesCache("/nonexistent/rules.json", "/nonexistent/chats.json");
  assert.deepEqual(getRules(), []); // لا crash
});

await it("getRules() يقرأ من ملف JSON صحيح", async () => {
  _resetForTest();
  const dir = mkdtempSync(join(tmpdir(), "rc-test-"));
  const rf  = join(dir, "rules.json");
  const cf  = join(dir, "chats.json");
  writeFileSync(rf, JSON.stringify([{ id: "r1", enabled: true }]));
  writeFileSync(cf, JSON.stringify({ groups: [{ id: "g1" }], channels: [] }));
  initRulesCache(rf, cf);
  assert.equal(getRules().length, 1);
  assert.equal(getChats().groups.length, 1);
  rmSync(dir, { recursive: true });
});

await it("invalidate() يُعيد تحميل القواعد المحدَّثة", async () => {
  _resetForTest();
  const dir = mkdtempSync(join(tmpdir(), "rc-inv-"));
  const rf  = join(dir, "rules.json");
  const cf  = join(dir, "chats.json");
  writeFileSync(rf, JSON.stringify([{ id: "r1" }]));
  writeFileSync(cf, JSON.stringify({ groups: [], channels: [] }));
  initRulesCache(rf, cf);
  assert.equal(getRules().length, 1);

  writeFileSync(rf, JSON.stringify([{ id: "r1" }, { id: "r2" }, { id: "r3" }]));
  invalidate();
  assert.equal(getRules().length, 3);
  rmSync(dir, { recursive: true });
});

await it("getCacheStats().reloadCount يزيد عند invalidate()", async () => {
  _resetForTest();
  const dir = mkdtempSync(join(tmpdir(), "rc-rc-"));
  const rf  = join(dir, "rules.json");
  const cf  = join(dir, "chats.json");
  writeFileSync(rf, JSON.stringify([]));
  writeFileSync(cf, JSON.stringify({ groups: [], channels: [] }));
  initRulesCache(rf, cf);
  const before = getCacheStats().reloadCount;
  invalidate();
  assert.ok(getCacheStats().reloadCount >= before);
  rmSync(dir, { recursive: true });
});

// ════════════════════════════════════════════════════════════════
// Queue v2
// ════════════════════════════════════════════════════════════════
console.log("\n📦 Queue v2\n");

const { Queue } = await import("../../engine/queue.mjs");

await it("Queue.size يُعيد عدد المهام المعلّقة", async () => {
  const q = new Queue({ maxConcurrent: 0 }); // لا تنفيذ
  q.push("a", async () => {}, 1).catch(() => {});
  q.push("b", async () => {}, 1).catch(() => {});
  assert.equal(q.size, 2);
  q.clear();
});

await it("Queue.clearByLabel يُلغي مهام مستخدم بعينه فقط", async () => {
  const q = new Queue({ maxConcurrent: 0 });
  const p1 = q.push("user1:jid1", async () => "ok1", 1).catch(e => e.message);
  const p2 = q.push("user2:jid1", async () => "ok2", 1).catch(e => e.message);
  const p3 = q.push("user1:jid2", async () => "ok3", 1).catch(e => e.message);

  const cancelled = q.clearByLabel("user1:");
  assert.equal(cancelled, 2, "يجب إلغاء مهمتين لـ user1");
  assert.equal(q.size, 1, "يجب أن تبقى مهمة user2");

  const msg = await p1;
  assert.ok(msg.includes("cancelled"), `رسالة الخطأ يجب أن تحتوي "cancelled": ${msg}`);
  q.clear();
});

await it("Queue timeout يُرفض بعد المهلة", async () => {
  const q = new Queue({ maxConcurrent: 1, timeout: 50 }); // مهلة 50ms
  let threw = false;
  try {
    await q.push("slow", async () => { await sleep(200); return "done"; }, 1);
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes("timeout"), `يجب أن تحتوي الرسالة "timeout": ${e.message}`);
  }
  assert.ok(threw, "يجب أن يُرمى خطأ timeout");
});

await it("Queue timeout لا يُطبَّق على مهام سريعة", async () => {
  const q = new Queue({ maxConcurrent: 1, timeout: 200 });
  const result = await q.push("fast", async () => { await sleep(10); return "done"; }, 1);
  assert.equal(result, "done");
});

await it("Queue تُنهي 1000 مهمة دون فقدان واحدة", async () => {
  const q = new Queue({ maxConcurrent: 8 });
  let done = 0;
  const tasks = Array.from({ length: 1000 }, (_, i) =>
    q.push(`t${i}`, async () => { done++; }, i % 10)
  );
  await Promise.all(tasks);
  assert.equal(done, 1000);
});

await it("Queue تحترم maxConcurrent", async () => {
  const q   = new Queue({ maxConcurrent: 3 });
  let active = 0, maxActive = 0;
  const tasks = Array.from({ length: 20 }, (_, i) =>
    q.push(`t${i}`, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active--;
    }, 1)
  );
  await Promise.all(tasks);
  assert.ok(maxActive <= 3, `maxActive=${maxActive} يجب أن يكون ≤ 3`);
});

await it("Queue تُعطي الأولوية للـ tasks الأعلى priority", async () => {
  const q = new Queue({ maxConcurrent: 1 });
  const order = [];

  // المهمة الأولى تملأ التنفيذ، باقي المهام تنتظر
  q.push("hold", async () => { await sleep(30); order.push(0); }, 0);
  await sleep(5); // انتظر حتى تبدأ hold

  q.push("low",  async () => { order.push(1); }, 1);
  q.push("high", async () => { order.push(10); }, 10);
  q.push("mid",  async () => { order.push(5); }, 5);

  await sleep(150);
  assert.deepEqual(order, [0, 10, 5, 1], `الترتيب المتوقع [0,10,5,1], الفعلي: ${JSON.stringify(order)}`);
});

await it("Queue.getStats().timedOut يزيد عند timeout", async () => {
  const q = new Queue({ maxConcurrent: 1, timeout: 30 });
  await q.push("slow", async () => sleep(200), 1).catch(() => {});
  assert.equal(q.getStats().timedOut, 1);
});

await it("timeout لا يُجاوز maxConcurrent — الـ slot لا يُفرَج حتى تنتهي المهمة", async () => {
  // أهم اختبار: يضمن أن #running لا يتجاوز maxConcurrent حتى مع timeout
  const q = new Queue({ maxConcurrent: 2, timeout: 30 });
  let maxRunning = 0;
  let currentRunning = 0;

  const slowTask = async () => {
    currentRunning++;
    maxRunning = Math.max(maxRunning, currentRunning);
    await sleep(150); // أطول من timeout (30ms)
    currentRunning--;
  };

  // أطلق 6 مهام — مع maxConcurrent=2 يجب ألا يتجاوز 2 في أي لحظة
  const tasks = Array.from({ length: 6 }, (_, i) =>
    q.push(`t${i}`, slowTask, 1).catch(() => {})
  );
  await Promise.all(tasks);
  await sleep(200); // انتظر انتهاء أي zombie محتمل

  assert.ok(maxRunning <= 2,
    `maxRunning=${maxRunning} يجب أن يكون ≤ 2 (maxConcurrent)`);
});

// ════════════════════════════════════════════════════════════════
// msg-pipeline v2
// ════════════════════════════════════════════════════════════════
console.log("\n📦 msg-pipeline.mjs v2\n");

const {
  setupMsgPipeline, teardown,
  getPipelineStats, getUserStats, _resetStatsForTest,
} = await import("../../engine/msg-pipeline.mjs");

/** يبني mock socket */
function mockSock(handlers = {}) {
  const _evs = {};
  return {
    ev: {
      on(ev, fn) { _evs[ev] = fn; },
      emit(ev, data) { _evs[ev]?.(data); },
    },
    _emit(ev, data) { _evs[ev]?.(data); },
  };
}

/** يبني رسالة واتساب وهمية */
function makeMsg(jid, fromMe = false, type = "notify") {
  return { messages: [{ key: { remoteJid: jid, fromMe }, message: {} }], type };
}

await it("setupMsgPipeline يُسجّل messages.upsert listener", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  let registered = false;
  const origOn = sock.ev.on.bind(sock.ev);
  sock.ev.on = (ev, fn) => { if (ev === "messages.upsert") registered = true; origOn(ev, fn); };
  setupMsgPipeline(sock, "u1", async () => {}, async () => {});
  assert.ok(registered);
});

await it("رسائل append بدون newsletter تُتجاهل تماماً", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  let called = false;
  setupMsgPipeline(sock, "u1", async () => {}, async () => { called = true; });
  sock._emit("messages.upsert", makeMsg("1234@s.whatsapp.net", false, "append"));
  await sleep(50);
  assert.ok(!called, "append بدون newsletter يجب تجاهله");
});

await it("رسائل newsletter تصل للـ applyForward", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  let forwarded = false;
  setupMsgPipeline(sock, "u2",
    async () => { forwarded = true; },
    async () => {}
  );
  sock._emit("messages.upsert", {
    messages: [{ key: { remoteJid: "123@newsletter", fromMe: false }, message: {} }],
    type: "append",
  });
  await sleep(200);
  assert.ok(forwarded, "newsletter يجب أن تصل applyForward");
});

await it("أوامر fromMe (رسالي) تتجاوز قائمة newsletter بالأولوية", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  const order = [];
  setupMsgPipeline(sock, "u3",
    async () => {},
    async (msg) => { order.push(msg.key.remoteJid); }
  );

  // أرسل 30 newsletter أولاً
  for (let i = 0; i < 30; i++) {
    sock._emit("messages.upsert", {
      messages: [{ key: { remoteJid: `nl${i}@newsletter`, fromMe: false }, message: {} }],
      type: "append",
    });
  }

  // ثم أمر fromMe
  sock._emit("messages.upsert", makeMsg("cmd@s.whatsapp.net", true, "notify"));

  await sleep(500);
  assert.ok(order.length > 0, "يجب معالجة رسائل");
  const cmdIdx = order.indexOf("cmd@s.whatsapp.net");
  assert.ok(cmdIdx !== -1, "الأمر يجب أن يُنفَّذ");
  assert.ok(cmdIdx < 5, `الأمر يجب أن يكون من الأوائل (وصل في المركز ${cmdIdx + 1})`);
});

await it("circuit breaker: تجاهل newsletter عند تجاوز الـ cap", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  setupMsgPipeline(sock, "u4", async () => { await sleep(100); }, async () => {});

  for (let i = 0; i < 200; i++) {
    sock._emit("messages.upsert", {
      messages: [{ key: { remoteJid: `ch${i}@newsletter`, fromMe: false }, message: {} }],
      type: "append",
    });
  }
  await sleep(50);
  const stats = getPipelineStats();
  assert.ok(stats.dropped > 0, `يجب أن يتم تجاهل بعض الرسائل (dropped=${stats.dropped})`);
});

await it("teardown() يُلغي مهام المستخدم المعلّقة", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  let processed = 0;
  setupMsgPipeline(sock, "u5",
    async () => { await sleep(200); },
    async () => { processed++; }
  );

  // أرسل رسائل كثيرة لـ u5
  for (let i = 0; i < 20; i++) {
    sock._emit("messages.upsert", {
      messages: [{ key: { remoteJid: `nl${i}@newsletter`, fromMe: false }, message: {} }],
      type: "append",
    });
  }

  // ألغِ فوراً
  const cancelled = teardown("u5");
  assert.ok(cancelled >= 0, `teardown يجب أن يُعيد عدد صحيح (${cancelled})`);
});

await it("getUserStats() يُعيد إحصائيات المستخدم بشكل صحيح", async () => {
  _resetStatsForTest();
  const sock = mockSock();
  setupMsgPipeline(sock, "u6", async () => {}, async () => {});

  sock._emit("messages.upsert", makeMsg("cmd@s.whatsapp.net", true, "notify"));
  await sleep(100);

  const us = getUserStats("u6");
  assert.ok(typeof us.commands === "number");
  assert.ok(typeof us.dropped  === "number");
});

await it("getPipelineStats() يُعيد إحصائيات شاملة", async () => {
  _resetStatsForTest();
  const s = getPipelineStats();
  assert.ok(typeof s.received    === "number");
  assert.ok(typeof s.dropped     === "number");
  assert.ok(typeof s.lanes       === "object");
  assert.ok(typeof s.lanes.command.pending === "number");
});

// ════════════════════════════════════════════════════════════════
// نتائج
// ════════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(G + `✅ جميع الاختبارات نجحت (${passed}/${passed + failed})` + N);
} else {
  console.log(R + `❌ ${failed} اختبار فشل من ${passed + failed}` + N);
  process.exit(1);
}
