import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatScheduleTime,
  nextScheduleOccurrence,
  parseScheduleTime,
  processDueSchedules,
  setDeps
} from "../../dist/schedule.mjs";

const KHARTOUM = "Africa/Khartoum";
const FIXED_NOW = Date.parse("2026-11-09T06:00:00.000Z"); // 08:00 in Khartoum

test("relative minute/day inputs are measured from the submitted moment", () => {
  assert.equal(parseScheduleTime("1 دقيقة", { now: FIXED_NOW, timeZone: KHARTOUM }), FIXED_NOW + 60_000);
  assert.equal(parseScheduleTime("١ دقيقة", { now: FIXED_NOW, timeZone: KHARTOUM }), FIXED_NOW + 60_000);
  assert.equal(parseScheduleTime("بعد يوم", { now: FIXED_NOW, timeZone: KHARTOUM }), FIXED_NOW + 86_400_000);
});

test("HH:mm schedules the next local occurrence, including today when still ahead", () => {
  assert.equal(parseScheduleTime("08:22", { now: FIXED_NOW, timeZone: KHARTOUM }), Date.parse("2026-11-09T06:22:00.000Z"));
  assert.equal(parseScheduleTime("07:59", { now: FIXED_NOW, timeZone: KHARTOUM }), Date.parse("2026-11-10T05:59:00.000Z"));
});

test("local display uses the chosen time zone", () => {
  assert.match(formatScheduleTime(FIXED_NOW, KHARTOUM), /08:00/);
});

test("monthly recurrence clamps Jan 31 to the last day of February", () => {
  const previous = Date.parse("2025-01-31T06:22:00.000Z"); // 08:22 in Khartoum
  const next = nextScheduleOccurrence({
    recurringType: "monthly",
    timeZone: KHARTOUM,
    localHour: 8,
    localMinute: 22,
    localDay: 31
  }, previous, previous);
  assert.equal(next, Date.parse("2025-02-28T06:22:00.000Z"));
  assert.equal(nextScheduleOccurrence({
    recurringType: "monthly",
    timeZone: KHARTOUM,
    localHour: 8,
    localMinute: 22,
    localDay: 31
  }, next, next), Date.parse("2025-03-31T06:22:00.000Z"));
});

test("due scheduler resolves the user's telegramId, not the array index", async () => {
  const sent = [];
  const users = new Map([["telegram-42", {
    telegramId: "telegram-42",
    telegramChatId: null,
    scheduledMessages: [{
      id: "due-1",
      jid: "249960506662@s.whatsapp.net",
      message: "hello",
      sendAt: FIXED_NOW - 1,
      status: "pending"
    }]
  }]]);
  const socket = {
    sendMessage: async (jid, payload) => { sent.push({ jid, payload }); }
  };
  const sessions = new Map([["telegram-42_+249960506662", socket]]);
  const saved = [];
  setDeps({
    getAllUsers: () => [...users.values()],
    getUser: (id) => users.get(String(id)),
    saveUser: (id, patch) => {
      saved.push(String(id));
      users.set(String(id), { ...users.get(String(id)), ...patch });
    },
    inMemoryDB: { sessions }
  });

  await processDueSchedules({ sendMessage: async () => {} }, FIXED_NOW);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].jid, "249960506662@s.whatsapp.net");
  assert.deepEqual(saved, ["telegram-42"]);
  assert.equal(users.get("telegram-42").scheduledMessages[0].status, "sent");
});

test("retrying a partial multi-recipient send skips recipients already delivered", async () => {
  const first = "249960506662@s.whatsapp.net";
  const second = "249123456789@s.whatsapp.net";
  const item = {
    id: "multi-1",
    jid: first,
    recipients: [first, second],
    message: "hello",
    sendAt: FIXED_NOW - 1,
    status: "pending"
  };
  const user = { telegramId: "telegram-multi", scheduledMessages: [item] };
  const users = new Map([[user.telegramId, user]]);
  const attempts = [];
  let failSecond = true;
  const socket = {
    sendMessage: async (jid) => {
      attempts.push(jid);
      if (jid === second && failSecond) {
        failSecond = false;
        throw new Error("temporary failure");
      }
    }
  };
  setDeps({
    getAllUsers: () => [...users.values()],
    getUser: (id) => users.get(String(id)),
    saveUser: (id, patch) => Object.assign(users.get(String(id)), patch),
    inMemoryDB: { sessions: new Map([["telegram-multi", socket]]) }
  });

  await processDueSchedules({ sendMessage: async () => {} }, FIXED_NOW);
  assert.equal(item.status, "failed");
  assert.deepEqual(item.deliveredRecipients, [first]);

  item.status = "pending";
  item.sendAt = FIXED_NOW;
  await processDueSchedules({ sendMessage: async () => {} }, FIXED_NOW);
  assert.equal(item.status, "sent");
  assert.deepEqual(attempts, [first, second, second]);
});
