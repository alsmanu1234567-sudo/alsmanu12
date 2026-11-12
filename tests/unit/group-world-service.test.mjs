import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGroupWorldService,
  DEFAULT_PETS,
  groupWorldDayKey,
  parseMessageTemplate,
  renderMessageTemplate,
} from "../../dist/services/groups/group-world-service.mjs";
import { createGroupWorldStore } from "../../dist/services/groups/group-world-store.mjs";

const GROUP_A = "120363000000001-111111@g.us";
const GROUP_B = "120363000000002-222222@g.us";
const ALICE = "249000000001@s.whatsapp.net";
const BOB = "249000000002@s.whatsapp.net";

async function harness(t, initialTime = "2026-11-10T10:00:00.000Z") {
  const dataDir = await mkdtemp(join(tmpdir(), "group-world-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  let clock = new Date(initialTime);
  const makeService = () => createGroupWorldService({
    store: createGroupWorldStore({ dataDir }),
    now: () => new Date(clock),
  });
  return {
    dataDir,
    makeService,
    service: makeService(),
    setTime(value) { clock = new Date(value); },
  };
}

async function activate(service, groupId = GROUP_A, members = [{ memberId: ALICE, name: "Alice" }]) {
  return service.activateGroup({ groupId, ownerId: "web-owner", members });
}

test("activation seeds each member with 500 once, and survives a service restart", async (t) => {
  const h = await harness(t);
  await activate(h.service);

  const first = await h.service.processMessage({
    groupId: GROUP_A, memberId: ALICE, name: "Alice", text: "صباح الخير", messageId: "message-one",
  });
  assert.equal(first.rewarded, 2);
  assert.equal(first.balance, 502);

  const afterRestart = h.makeService();
  const profile = await afterRestart.getMemberProfile(GROUP_A, ALICE);
  assert.equal(profile.balance, 502);
  assert.equal(profile.totalEarned, 502);
  assert.equal((await afterRestart.getSlots(GROUP_A)).length, 1);

  const secondActivation = await afterRestart.activateGroup({
    groupId: GROUP_A, ownerId: "web-owner", members: [{ memberId: ALICE, name: "Alice" }],
  });
  assert.equal(secondActivation.seededMembers, 0);
  assert.equal((await afterRestart.getMemberProfile(GROUP_A, ALICE)).balance, 502);
});

test("message events are deduplicated and laugh messages grant exactly three points", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  const input = {
    groupId: GROUP_A, memberId: ALICE, text: "🤣🤣", messageId: "laugh-one",
  };
  const result = await h.service.processMessage(input);
  const duplicate = await h.service.processMessage(input);
  assert.equal(result.rewarded, 3);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).balance, 503);
});

test("daily and weekly gifts are one-time claims with group-local balances", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  await activate(h.service, GROUP_B, [{ memberId: ALICE, name: "Alice" }]);

  const daily = await h.service.claimGift(GROUP_A, ALICE, "daily");
  const weekly = await h.service.claimGift(GROUP_A, ALICE, "weekly");
  assert.equal(daily.amount, 200);
  assert.equal(weekly.amount, 1_000);
  assert.equal(weekly.balance, 1_700);
  await assert.rejects(h.service.claimGift(GROUP_A, ALICE, "daily"), /بالفعل/);
  await assert.rejects(h.service.claimGift(GROUP_A, ALICE, "weekly"), /بالفعل/);
  assert.equal((await h.service.getMemberProfile(GROUP_B, ALICE)).balance, 500);

  h.setTime("2026-11-11T10:00:00.000Z");
  const nextDay = await h.service.claimGift(GROUP_A, ALICE, "daily");
  assert.equal(nextDay.amount, 200);
  assert.equal(groupWorldDayKey(new Date("2026-11-11T10:00:00.000Z")), "2026-11-11");
});

test("invite reward is issued once per invited member in each group", async (t) => {
  const h = await harness(t);
  await activate(h.service, GROUP_A, [{ memberId: ALICE }, { memberId: BOB }]);
  const first = await h.service.rewardInvite({ groupId: GROUP_A, inviterId: ALICE, invitedId: BOB });
  const duplicate = await h.service.rewardInvite({ groupId: GROUP_A, inviterId: ALICE, invitedId: BOB });
  assert.equal(first.rewarded, 100);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).balance, 600);
});

test("anti-spam penalizes confirmed repetition but not varied natural chat", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  const natural = [
    "كيف حالكم اليوم؟", "صباح الخير يا جماعة", "من حضر المباراة؟",
    "الجو جميل اليوم", "أرسلوا الرابط هنا", "شكرًا لكم",
  ];
  for (let index = 0; index < natural.length; index += 1) {
    const result = await h.service.processMessage({
      groupId: GROUP_A, memberId: ALICE, text: natural[index], messageId: `natural-${index}`,
    });
    assert.equal(result.spam, undefined);
  }

  let result;
  for (let index = 0; index < 5; index += 1) {
    result = await h.service.processMessage({
      groupId: GROUP_A,
      memberId: BOB,
      text: "نص مكرر جدًا",
      messageId: `spam-${index}`,
    });
  }
  assert.equal(result.spam, true);
  assert.equal(result.penalty, 200);
  assert.equal((await h.service.getMemberProfile(GROUP_A, BOB)).balance, 308);
  assert.equal((await h.service.getLogs(GROUP_A, "violations")).length, 1);
});

test("stable slots leave gaps on exit and only renumber on explicit refresh", async (t) => {
  const h = await harness(t);
  await activate(h.service, GROUP_A, [{ memberId: ALICE, name: "Alice" }, { memberId: BOB, name: "Bob" }]);
  await h.service.markMemberLeft(GROUP_A, ALICE);
  let slots = await h.service.getSlots(GROUP_A);
  assert.equal(slots[0].memberId, null);
  assert.equal(slots[1].memberId, BOB);

  await h.service.markMemberJoined(GROUP_A, { memberId: "249000000003@s.whatsapp.net", name: "Cara" });
  slots = await h.service.getSlots(GROUP_A);
  assert.equal(slots[1].memberId, BOB);
  assert.equal(slots[2].slot, 3);

  await h.service.refreshSlots(GROUP_A, [{ memberId: BOB }, { memberId: ALICE }], "web-owner");
  slots = await h.service.getSlots(GROUP_A);
  assert.equal(slots[0].memberId, BOB);
  assert.equal(slots[1].memberId, ALICE);
});

test("slot payouts validate membership and reject negative balances", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  await assert.rejects(
    h.service.adjustBalance(GROUP_A, ALICE, -501, "web-owner", "خصم إداري"),
    /سالبًا/,
  );
  await h.service.adjustSlot(GROUP_A, 1, 100, "web-owner", "مكافأة إدارية");
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).balance, 600);
  await h.service.markMemberLeft(GROUP_A, ALICE);
  await assert.rejects(h.service.adjustSlot(GROUP_A, 1, 50, "web-owner", "تعديل"), /فارغة/);
});

test("custom commands are safe text, and template buttons are parsed rather than faked", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  const command = await h.service.addCustomCommand(
    GROUP_A,
    { name: ".ترحيب", response: "أهلًا _neam، رصيدك _cone _boton_عرض الرصيد_رصيدك _cone" },
    "web-owner",
  );
  assert.equal(command.ok, true);
  const response = await h.service.runCustomCommand(GROUP_A, ".ترحيب", { name: "علي", points: 500 });
  assert.match(response.text, /أهلًا علي، رصيدك 500/);
  assert.equal(response.buttons.length, 1);
  assert.equal(response.buttons[0].label, "عرض الرصيد");
  assert.equal(parseMessageTemplate("نص _boton_زر_رد").buttons.length, 1);
  assert.equal(renderMessageTemplate("النقاط _cone", { points: 10 }).text, "النقاط 10");
  await assert.rejects(
    h.service.addCustomCommand(GROUP_A, { name: ".خطر", response: "<script>alert(1)</script>" }, "web-owner"),
    /نصوصًا فقط/,
  );
});

test("the catalog contains twenty pets and buying/upgrading writes ledger entries", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  const group = await h.service.getGroup(GROUP_A);
  assert.equal(group.catalogs.pets.length, 20);
  assert.equal(Math.min(...DEFAULT_PETS.map((pet) => pet.price)), 2_000);
  assert.equal(Math.max(...DEFAULT_PETS.map((pet) => pet.price)), 60_000);

  await h.service.adjustBalance(GROUP_A, ALICE, 2_000, "web-owner", "تمويل اختبار");
  await h.service.purchasePet(GROUP_A, ALICE, "cat");
  await h.service.adjustBalance(GROUP_A, ALICE, 1_000, "web-owner", "تمويل ترقية");
  const upgraded = await h.service.upgradePet(GROUP_A, ALICE, "cat");
  assert.equal(upgraded.pet.level, 2);
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).activePetId, "cat");
});

test("challenge stakes are charged once and paid only to the chosen winner", async (t) => {
  const h = await harness(t);
  await activate(h.service, GROUP_A, [{ memberId: ALICE }, { memberId: BOB }]);
  const challenge = await h.service.createChallenge(GROUP_A, ALICE, BOB, 100, ALICE);
  await assert.rejects(h.service.acceptChallenge(GROUP_A, challenge.id, ALICE), /موجّه/);
  await h.service.acceptChallenge(GROUP_A, challenge.id, BOB);
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).balance, 400);
  const result = await h.service.settleChallenge(GROUP_A, challenge.id, ALICE, "web-owner");
  assert.equal(result.challenge.status, "settled");
  assert.equal((await h.service.getMemberProfile(GROUP_A, ALICE)).balance, 600);
  assert.equal((await h.service.getMemberProfile(GROUP_A, BOB)).balance, 400);
  await assert.rejects(h.service.settleChallenge(GROUP_A, challenge.id, ALICE, "web-owner"), /غير مفتوح/);
});

test("XP continues independently when the points economy is disabled", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  await h.service.setModule(GROUP_A, "economy", false, "web-owner");
  const result = await h.service.processMessage({
    groupId: GROUP_A, memberId: ALICE, text: "رسالة تقدم", messageId: "progress-one",
  });
  assert.equal(result.rewarded, 0);
  const profile = await h.service.getMemberProfile(GROUP_A, ALICE);
  assert.equal(profile.balance, 500);
  assert.equal(profile.xp, 1);
  assert.equal(profile.messages, 1);
});

test("daily earning caps apply to gifts without making spending balances negative", async (t) => {
  const h = await harness(t);
  await activate(h.service);
  await h.service.updateSettings(GROUP_A, { rewards: { dailyEarnCap: 10 } }, "web-owner");
  const gift = await h.service.claimGift(GROUP_A, ALICE, "daily");
  assert.equal(gift.amount, 10);
  assert.equal(gift.balance, 510);
  await assert.rejects(h.service.adjustBalance(GROUP_A, ALICE, -511, "web-owner", "خصم غير ممكن"), /سالبًا/);
});

test("owner phone permissions do not treat a LID with matching digits as a phone JID", async (t) => {
  const h = await harness(t);
  await h.service.activateGroup({
    groupId: GROUP_A,
    ownerId: "web-owner",
    ownerPhoneNumber: "249000000001",
    members: [{ memberId: ALICE, name: "Alice" }],
  });

  assert.equal(await h.service.hasPermission(GROUP_A, "web-owner", "settings"), true);
  assert.equal(await h.service.hasPermission(GROUP_A, "249000000001@s.whatsapp.net", "points"), true);
  assert.equal(await h.service.hasPermission(GROUP_A, "249000000001@lid", "points"), false);
  assert.equal(await h.service.hasPermission(GROUP_A, "249000000001", "points"), false);
});
