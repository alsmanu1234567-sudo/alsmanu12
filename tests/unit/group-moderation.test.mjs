import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  extractWhatsAppGroupInviteCode,
  formatGroupInviteReport,
  hasAnyUrl,
  applyWebGroupAction,
  getWebGroupDetails,
  getWebGroupInvite,
  handleCallback,
  handleText,
  setWebGroupSetting,
  setDeps,
  stopModerationListenerRecovery
} from "../../dist/handlers/groups-handler.mjs";

test("link detection recognizes URL, bare domain and IP links", () => {
  assert.equal(hasAnyUrl("https://example.com/path"), true);
  assert.equal(hasAnyUrl("example.org"), true);
  assert.equal(hasAnyUrl("192.0.2.1:8080"), true);
  assert.equal(hasAnyUrl("رسالة عادية بلا رابط"), false);
});

test("invite extraction accepts WhatsApp group invites only", () => {
  assert.equal(extractWhatsAppGroupInviteCode("https://chat.whatsapp.com/Abcdefgh123456"), "Abcdefgh123456");
  assert.equal(extractWhatsAppGroupInviteCode("https://example.com/Abcdefgh123456"), null);
});

test("invite report marks unavailable fields instead of inventing them", () => {
  const report = formatGroupInviteReport({ subject: "مجموعة تجريبية", size: 12 });
  assert.match(report, /مجموعة تجريبية/);
  assert.match(report, /الأعضاء: 12/);
  assert.match(report, /المشرفون: غير متاح/);
  assert.match(report, /لم ينضم البوت/);
});

test("group link moderation deletes a URL when the linked account is an admin", async () => {
  const groupId = "120363123456789012@g.us";
  const user = { antiLinkGroups: [], inspectInviteGroups: [] };
  const deleted = [];
  const sock = {
    user: { id: "249960506662@s.whatsapp.net" },
    ev: new EventEmitter(),
    groupMetadata: async () => ({ participants: [{ id: "249960506662@s.whatsapp.net", admin: "admin" }] }),
    sendMessage: async (jid, payload) => { if (payload.delete) deleted.push({ jid, key: payload.delete }); }
  };
  setDeps({
    inMemoryDB: { sessions: new Map([["123", sock]]), users: new Map([["123", user]]) },
    getUser: () => user,
    saveUser: (_id, patch) => Object.assign(user, patch),
    getState: () => null,
    setState: () => {},
    clearState: () => {}
  });
  await handleCallback({ sendMessage: async () => {} }, {
    data: `grp_custom_links_${groupId}`,
    message: { chat: { id: 1 } },
    from: { id: 123 }
  });
  const key = { remoteJid: groupId, id: "message-1", participant: "249000000000@s.whatsapp.net" };
  sock.ev.emit("messages.upsert", { messages: [{ key, message: { conversation: "https://example.com" } }] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].jid, groupId);
  assert.equal(deleted[0].key, key);
  stopModerationListenerRecovery();
});

test("group message uses the connected socket that belongs to the selected group", async () => {
  const groupId = "120363123456789012@g.us";
  const user = { antiLinkGroups: [], inspectInviteGroups: [] };
  const sent = [];
  let state = { state: "awaiting_custom_group_message", data: { groupId } };
  const otherSock = {
    groupMetadata: async () => { throw new Error("not a member"); },
    sendMessage: async () => assert.fail("wrong WhatsApp session was used")
  };
  const groupSock = {
    groupMetadata: async (jid) => ({ id: jid, participants: [] }),
    sendMessage: async (jid, payload) => sent.push({ jid, payload })
  };
  const bot = { sendMessage: async () => {} };
  setDeps({
    inMemoryDB: {
      sessions: new Map([["123_+111", otherSock], ["123_+222", groupSock]]),
      users: new Map([["123", user]])
    },
    getUser: () => user,
    getState: () => state,
    setState: (_id, nextState, data) => { state = { state: nextState, data }; },
    clearState: () => { state = null; },
    saveUser: (_id, patch) => Object.assign(user, patch)
  });

  await handleText(bot, { text: "رسالة تجريبية", chat: { id: 1 }, from: { id: 123 } });

  assert.deepEqual(sent, [{ jid: groupId, payload: { text: "رسالة تجريبية" } }]);
  assert.equal(state, null);
  stopModerationListenerRecovery();
});

test("web group details mask member numbers and allow admin-only link controls", async () => {
  const groupId = "120363123456789012@g.us";
  const user = { antiLinkGroups: [], inspectInviteGroups: [] };
  const adminActions = [];
  const sock = {
    user: { id: "249960506662:1@s.whatsapp.net" },
    sendMessage: async () => {},
    groupMetadata: async (jid) => ({
      id: jid,
      subject: "اختبار",
      desc: "وصف المجموعة",
      creation: 1700000000,
      announce: true,
      participants: [
        { id: "249960506662@s.whatsapp.net", admin: "admin" },
        { id: "249123456789@s.whatsapp.net" }
      ]
    }),
    groupInviteCode: async () => "InviteCode123456",
    groupUpdateSubject: async (_jid, subject) => adminActions.push(["rename", subject]),
    groupUpdateDescription: async (_jid, description) => adminActions.push(["description", description]),
    groupSettingUpdate: async (_jid, setting) => adminActions.push(["setting", setting])
  };
  setDeps({
    inMemoryDB: { sessions: new Map([["123", sock]]), users: new Map([["123", user]]) },
    getUser: () => user,
    saveUser: (_id, patch) => Object.assign(user, patch)
  });

  const detail = await getWebGroupDetails("123", groupId, "+249960506662");
  assert.equal(detail.name, "اختبار");
  assert.equal(detail.memberCount, 2);
  assert.equal(detail.adminCount, 1);
  assert.equal(detail.isAdmin, true);
  assert.equal(detail.locked, true);
  assert.equal(detail.members[0].label, "••••6662");
  assert.equal(JSON.stringify(detail).includes("249960506662"), false);
  await assert.rejects(getWebGroupDetails("123", groupId, "+249111111111"), /غير متاحة/);

  const invite = await getWebGroupInvite("123", groupId, "+249960506662");
  assert.equal(invite.link, "https://chat.whatsapp.com/InviteCode123456");
  const antiLink = await setWebGroupSetting("123", groupId, "+249960506662", "antiLink", true);
  assert.equal(antiLink.antiLinkEnabled, true);
  assert.deepEqual(user.antiLinkGroups, [groupId]);
  const inspectInvite = await setWebGroupSetting("123", groupId, "+249960506662", "inspectInvite", true);
  assert.equal(inspectInvite.inspectInviteEnabled, true);
  assert.deepEqual(user.inspectInviteGroups, [groupId]);
  await applyWebGroupAction("123", groupId, "+249960506662", "rename", "اسم جديد");
  await applyWebGroupAction("123", groupId, "+249960506662", "description", "وصف جديد");
  await applyWebGroupAction("123", groupId, "+249960506662", "unlock");
  assert.deepEqual(adminActions, [
    ["rename", "اسم جديد"],
    ["description", "وصف جديد"],
    ["setting", "not_announcement"]
  ]);
  await assert.rejects(applyWebGroupAction("123", groupId, "+249960506662", "rename", "x".repeat(26)), /25/);
  stopModerationListenerRecovery();
});

test("group repeat accepts a trailing count and sends at most five times", async () => {
  const groupId = "120363123456789012@g.us";
  const user = { antiLinkGroups: [], inspectInviteGroups: [] };
  const sent = [];
  let state = { state: "awaiting_custom_group_repeat_message", data: { groupId } };
  const sock = {
    groupMetadata: async (jid) => ({ id: jid, participants: [] }),
    sendMessage: async (jid, payload) => sent.push({ jid, payload })
  };
  const bot = { sendChatAction: async () => {}, sendMessage: async () => {} };
  setDeps({
    inMemoryDB: { sessions: new Map([["123", sock]]), users: new Map([["123", user]]) },
    getUser: () => user,
    getState: () => state,
    setState: (_id, nextState, data) => { state = { state: nextState, data }; },
    clearState: () => { state = null; },
    saveUser: (_id, patch) => Object.assign(user, patch)
  });
  await handleText(bot, { text: "هلا ٣", chat: { id: 1 }, from: { id: 123 } });
  assert.equal(sent.length, 3);
  assert.deepEqual(sent.map((entry) => entry.payload.text), ["هلا", "هلا", "هلا"]);
  assert.equal(state, null);
  stopModerationListenerRecovery();
});
