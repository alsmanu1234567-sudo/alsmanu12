import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteWebGroupAutoPost,
  getKhartoumClock,
  getWebGroupDetails,
  previewWebGroupAutoPost,
  publishWebGroupAutoPostNow,
  runScheduledGroupAutoPosts,
  saveWebGroupAutoPost,
  setDeps,
  setWebGroupAutoPostEnabled,
  stopModerationListenerRecovery,
} from "../../dist/handlers/groups-handler.mjs";
import { clearMawdoo3Cache } from "../../dist/services/groups/mawdoo3-feed-service.mjs";

test("group auto-post validates, previews, publishes without repeats, and schedules in Khartoum time", async () => {
  const realFetch = globalThis.fetch;
  const groupId = "120363123456789012@g.us";
  const userId = "123";
  const user = { antiLinkGroups: [], inspectInviteGroups: [], groupAutoPosts: [] };
  const sent = [];
  let isAdmin = true;
  const html = `
    <a href="/قصة_حب_الأولى">قصة حب أولى</a>
    <a href="/قصة_حب_الثانية">قصة حب ثانية</a>
  `;
  globalThis.fetch = async () => new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  clearMawdoo3Cache();

  const sock = {
    user: { id: "249960506662@s.whatsapp.net" },
    groupMetadata: async (id) => ({
      id,
      subject: "مجموعة اختبار",
      participants: [{ id: "249960506662@s.whatsapp.net", admin: isAdmin ? "admin" : undefined }],
    }),
    sendMessage: async (jid, payload) => sent.push({ jid, payload }),
  };
  setDeps({
    inMemoryDB: {
      sessions: new Map([[userId, sock]]),
      users: new Map([[userId, user]]),
    },
    getUser: () => user,
    saveUser: (_id, patch) => Object.assign(user, patch),
  });

  try {
    await assert.rejects(
      saveWebGroupAutoPost(userId, groupId, "+249960506662", { topic: "قصص حب", times: "25:00" }),
      /24 ساعة/
    );

    const clock = getKhartoumClock(new Date("2026-11-10T00:30:00.000Z"));
    assert.deepEqual(clock, { date: "2026-11-10", time: "02:30" });

    const item = await saveWebGroupAutoPost(userId, groupId, "+249960506662", {
      topic: "قصص حب",
      times: getKhartoumClock().time,
    });
    assert.equal(item.enabled, false);
    assert.equal(item.topic, "قصص حب");

    const enabled = await setWebGroupAutoPostEnabled(
      userId, groupId, "+249960506662", item.id, true
    );
    assert.equal(enabled.enabled, true);

    const preview = await previewWebGroupAutoPost(
      userId, groupId, "+249960506662", item.id
    );
    assert.match(preview.title, /قصة حب/);
    assert.match(preview.url, /^https:\/\/mawdoo3\.com\//);
    assert.deepEqual(Object.keys(preview).sort(), ["title", "url"]);
    assert.equal(sent.length, 0, "preview must not send to the group");

    const manual = await publishWebGroupAutoPostNow(
      userId, groupId, "+249960506662", item.id
    );
    assert.equal(manual.ok, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].jid, groupId);
    assert.equal(
      sent[0].payload.text,
      `📖 ${manual.title}\n${manual.url}\nالمصدر: موضوع`
    );
    assert.match(sent[0].payload.text, /المصدر: موضوع/);
    assert.doesNotMatch(sent[0].payload.text, /مقتطف|ملخص/);

    await runScheduledGroupAutoPosts();
    await runScheduledGroupAutoPosts();
    assert.equal(sent.length, 2, "the same schedule slot must not publish twice");
    assert.notEqual(sent[0].payload.text, sent[1].payload.text);

    const detail = await getWebGroupDetails(userId, groupId, "+249960506662");
    assert.equal(detail.autoPosts.length, 1);
    assert.equal(detail.autoPosts[0].enabled, true);
    assert.equal("seenUrls" in detail.autoPosts[0], false);

    isAdmin = false;
    await assert.rejects(
      setWebGroupAutoPostEnabled(userId, groupId, "+249960506662", item.id, false),
      /مشرفاً/
    );
    isAdmin = true;

    await deleteWebGroupAutoPost(userId, groupId, "+249960506662", item.id);
    assert.deepEqual(user.groupAutoPosts, []);
    assert.equal(user.groupAutoPostHistory[0].urls.length, 2);
    const replacement = await saveWebGroupAutoPost(userId, groupId, "+249960506662", {
      topic: "قصص حب",
      times: "09:00",
    });
    await assert.rejects(
      previewWebGroupAutoPost(userId, groupId, "+249960506662", replacement.id),
      /غير مكرر/
    );
    await deleteWebGroupAutoPost(userId, groupId, "+249960506662", replacement.id);
  } finally {
    globalThis.fetch = realFetch;
    clearMawdoo3Cache();
    stopModerationListenerRecovery();
  }
});
