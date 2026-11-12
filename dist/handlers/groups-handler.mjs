// dist/handlers/groups-handler.mjs
// Domain: Groups — /groups + callbacks
import { randomUUID } from "node:crypto";
import { webappUrlFor } from "../webapp-auth.mjs";
import { findNextMawdoo3Article } from "../services/groups/mawdoo3-feed-service.mjs";
import { groupWorldDayKey, groupWorldWeekKey } from "../services/groups/group-world-service.mjs";
import {
  groupWorldService,
  handleGroupWorldMessage,
  handleGroupWorldParticipants,
  expireGroupWorldChallenges,
  sameWhatsAppIdentity,
  setGroupWorldDeps,
} from "./group-world-handler.mjs";

export const pluginManifest = {
  name: 'groups',
  version: '1.0.0',
  type: 'handler',
  description: 'إدارة المجموعات: /groups + callbacks',
  textOrder: 6,
  cbOrder: 5,
  enabled: true,
};

let _deps = null;
const _listeners = new WeakSet();
const _groupWorldMessageListeners = new WeakSet();
const _groupWorldParticipantListeners = new WeakSet();
const _warningTimes = new Map();
const _inviteCache = new Map();
let _listenerRecoveryTimer = null;
let _autoPostTimer = null;
let _worldGiftTimer = null;
let _autoPostSweepInFlight = false;
let _worldGiftSweepInFlight = false;
let _hasActiveGroupWorld = false;
let _groupWorldScanAt = 0;
let _groupWorldScanInFlight = false;
const _autoPostInFlight = new Set();
const AUTO_POST_TIME_ZONE = "Africa/Khartoum";
const MAX_AUTO_POSTS_PER_USER = 40;
const MAX_AUTO_POST_TIMES = 8;
const MAX_AUTO_POST_SEEN_URLS_PER_GROUP = 5_000;

export function setDeps(d) {
  _deps = { ...(_deps || {}), ...d };
  setGroupWorldDeps(_deps);
  if (!_listenerRecoveryTimer) {
    _listenerRecoveryTimer = setInterval(recoverGroupListeners, 10_000);
    _listenerRecoveryTimer.unref?.();
    recoverGroupListeners();
  }
  if (!_autoPostTimer) {
    _autoPostTimer = setInterval(runScheduledGroupAutoPosts, 30_000);
    _autoPostTimer.unref?.();
  }
  if (!_worldGiftTimer) {
    _worldGiftTimer = setInterval(runScheduledGroupWorldRewards, 30_000);
    _worldGiftTimer.unref?.();
    void runScheduledGroupWorldRewards();
  }
}

function autoPostItems(user) {
  return Array.isArray(user?.groupAutoPosts) ? user.groupAutoPosts : [];
}

function publicAutoPost(item) {
  return {
    id: String(item.id || ""),
    topic: String(item.topic || ""),
    times: Array.isArray(item.times) ? item.times.filter((time) => /^\d{2}:\d{2}$/.test(time)) : [],
    enabled: item.enabled === true,
    lastSentAt: item.lastSentAt || null,
    lastError: item.lastError ? String(item.lastError).slice(0, 220) : null,
  };
}

function parseAutoPostTimes(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\s،؛]+/);
  const times = [...new Set(values.map((time) => String(time).trim()).filter(Boolean))];
  if (!times.length || times.length > MAX_AUTO_POST_TIMES) {
    throw new Error(`اختر وقتاً واحداً إلى ${MAX_AUTO_POST_TIMES} أوقات لكل إعداد`);
  }
  if (times.some((time) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error("اكتب الأوقات بصيغة 24 ساعة مثل 08:30 أو 20:15");
  }
  return times.sort();
}

function assertAutoPostAdmin(sock, metadata) {
  if (ownAccountIsAdmin(sock, metadata) !== true) {
    throw new Error("إدارة النشر التلقائي متاحة عندما يكون رقم واتساب المرتبط مشرفاً في المجموعة");
  }
}

async function getAutoPostGroupAccess(userId, groupId, phoneNumber) {
  userId = String(userId);
  groupId = String(groupId || "").trim();
  if (!groupId.endsWith("@g.us")) throw new Error("معرّف المجموعة غير صالح");
  if (!phoneNumber) throw new Error("اختر رقم واتساب المرتبط بالمجموعة");
  const sock = await findSocketForGroup(userId, groupId, phoneNumber);
  if (!sock) throw new Error("هذه المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(groupId);
  if (!metadata || (metadata.id && metadata.id !== groupId)) {
    throw new Error("تعذّر جلب تفاصيل هذه المجموعة");
  }
  assertAutoPostAdmin(sock, metadata);
  return { userId, groupId, phoneNumber: String(phoneNumber), sock, metadata };
}

function findAutoPost(user, groupId, autoPostId) {
  return autoPostItems(user).find((item) =>
    item?.groupId === groupId && String(item.id) === String(autoPostId)
  );
}

function seenAutoPostUrls(user, groupId) {
  const urls = new Set();
  for (const history of Array.isArray(user?.groupAutoPostHistory) ? user.groupAutoPostHistory : []) {
    if (history?.groupId !== groupId || !Array.isArray(history.urls)) continue;
    for (const url of history.urls) urls.add(String(url));
  }
  for (const item of autoPostItems(user)) {
    if (item?.groupId !== groupId || !Array.isArray(item.seenUrls)) continue;
    for (const url of item.seenUrls) urls.add(String(url));
  }
  return [...urls];
}

function reserveAutoPostUrl(userId, groupId, url) {
  const user = _deps?.getUser?.(String(userId));
  if (!user) throw new Error("تعذّر الوصول إلى سجل منع التكرار");
  const urls = seenAutoPostUrls(user, groupId);
  if (urls.includes(url)) throw new Error("هذا الرابط سبق نشره في المجموعة");
  if (urls.length >= MAX_AUTO_POST_SEEN_URLS_PER_GROUP) {
    throw new Error("وصل سجل منع التكرار إلى الحد الآمن؛ لم يُرسل محتوى جديد");
  }
  const histories = Array.isArray(user.groupAutoPostHistory) ? user.groupAutoPostHistory : [];
  const current = histories.find((entry) => entry?.groupId === groupId);
  const updatedHistory = current
    ? histories.map((entry) => entry === current ? { ...entry, urls: [...urls, url] } : entry)
    : [...histories, { groupId, urls: [...urls, url] }];
  if (typeof _deps?.saveUser !== "function") throw new Error("تعذّر حفظ سجل منع التكرار");
  _deps.saveUser(String(userId), { groupAutoPostHistory: updatedHistory });
}

function saveAutoPostList(userId, items) {
  if (typeof _deps?.saveUser !== "function") throw new Error("تعذّر حفظ إعدادات النشر التلقائي");
  _deps.saveUser(String(userId), { groupAutoPosts: items });
}

function saveAutoPostResult(userId, groupId, autoPostId, patch) {
  const user = _deps?.getUser?.(String(userId));
  if (!user) return;
  const items = autoPostItems(user);
  const updated = items.map((item) => {
    if (item?.groupId !== groupId || String(item.id) !== String(autoPostId)) return item;
    return { ...item, ...patch };
  });
  saveAutoPostList(userId, updated);
}

function postTextForArticle(article) {
  return `📖 ${article.title}\n${article.url}\nالمصدر: موضوع`;
}

export function getKhartoumClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: AUTO_POST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

async function publishScheduledItem(userId, item, day, time) {
  const groupId = String(item.groupId || "");
  const lock = `${userId}:${groupId}`;
  if (_autoPostInFlight.has(lock)) return;
  _autoPostInFlight.add(lock);
  try {
    const user = _deps?.getUser?.(String(userId));
    const current = findAutoPost(user, groupId, item.id);
    if (!current?.enabled) return;
    const attemptDates = {
      ...(current.attemptDates && typeof current.attemptDates === "object" ? current.attemptDates : {}),
      [time]: day,
    };
    saveAutoPostResult(userId, groupId, item.id, {
      attemptDates,
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
    });

    const access = await getAutoPostGroupAccess(userId, groupId, current.phoneNumber);
    const latestUser = _deps?.getUser?.(String(userId)) || user;
    const article = await findNextMawdoo3Article(current.topic, {
      seenUrls: seenAutoPostUrls(latestUser, groupId),
    });
    reserveAutoPostUrl(userId, groupId, article.url);
    await access.sock.sendMessage(groupId, { text: postTextForArticle(article) });
    saveAutoPostResult(userId, groupId, item.id, {
      lastSentAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (error) {
    saveAutoPostResult(userId, groupId, item.id, {
      lastError: String(error?.message || "تعذّر النشر").slice(0, 220),
      lastFailedAt: new Date().toISOString(),
    });
  } finally {
    _autoPostInFlight.delete(lock);
  }
}

export async function runScheduledGroupAutoPosts() {
  if (_autoPostSweepInFlight || !_deps) return;
  _autoPostSweepInFlight = true;
  try {
    const users = _deps?.inMemoryDB?.users;
    if (!(users instanceof Map)) return;
    const now = getKhartoumClock();
    for (const [userId, user] of users.entries()) {
      for (const item of autoPostItems(user)) {
        if (item?.enabled !== true || !String(item.groupId || "").endsWith("@g.us")) continue;
        const times = Array.isArray(item.times) ? item.times : [];
        for (const time of times) {
          if (time !== now.time || item.attemptDates?.[time] === now.date) continue;
          await publishScheduledItem(String(userId), item, now.date, time);
        }
      }
    }
  } catch {
    // A failed user's schedule must not stop the next scheduler sweep.
  } finally {
    _autoPostSweepInFlight = false;
  }
}

export async function saveWebGroupAutoPost(userId, groupId, phoneNumber, input = {}) {
  const access = await getAutoPostGroupAccess(userId, groupId, phoneNumber);
  const user = _deps?.getUser?.(access.userId);
  if (!user) throw new Error("تعذّر الوصول إلى إعدادات المستخدم");
  const topic = String(input.topic || "").trim().replace(/\s+/g, " ");
  if (topic.length < 2 || topic.length > 60) throw new Error("اكتب موضوعاً من حرفين إلى 60 حرفاً");
  const times = parseAutoPostTimes(input.times);
  const items = autoPostItems(user);
  let existing = null;
  if (input.id) {
    existing = findAutoPost(user, access.groupId, input.id);
    if (!existing) throw new Error("إعداد النشر التلقائي غير موجود في هذه المجموعة");
    if (existing.enabled) {
      await findNextMawdoo3Article(topic, {
        seenUrls: seenAutoPostUrls(user, access.groupId),
      });
    }
  } else if (items.length >= MAX_AUTO_POSTS_PER_USER) {
    throw new Error(`الحد الأقصى ${MAX_AUTO_POSTS_PER_USER} إعداد نشر تلقائي`);
  }
  const next = {
    ...(existing || {}),
    id: existing?.id || randomUUID(),
    groupId: access.groupId,
    phoneNumber: access.phoneNumber,
    topic,
    times,
    enabled: existing?.enabled === true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = existing
    ? items.map((item) => item.id === existing.id ? next : item)
    : [...items, next];
  saveAutoPostList(access.userId, updated);
  return publicAutoPost(next);
}

export async function setWebGroupAutoPostEnabled(userId, groupId, phoneNumber, autoPostId, enabled) {
  const access = await getAutoPostGroupAccess(userId, groupId, phoneNumber);
  if (typeof enabled !== "boolean") throw new Error("حالة النشر غير صالحة");
  const user = _deps?.getUser?.(access.userId);
  const item = findAutoPost(user, access.groupId, autoPostId);
  if (!item) throw new Error("إعداد النشر التلقائي غير موجود");
  if (enabled) {
    await findNextMawdoo3Article(item.topic, { seenUrls: seenAutoPostUrls(user, access.groupId) });
  }
  const updated = autoPostItems(user).map((entry) =>
    entry.id === item.id ? { ...entry, enabled, updatedAt: new Date().toISOString(), lastError: null } : entry
  );
  saveAutoPostList(access.userId, updated);
  return publicAutoPost({ ...item, enabled });
}

export async function deleteWebGroupAutoPost(userId, groupId, phoneNumber, autoPostId) {
  const access = await getAutoPostGroupAccess(userId, groupId, phoneNumber);
  const user = _deps?.getUser?.(access.userId);
  const item = findAutoPost(user, access.groupId, autoPostId);
  if (!item) throw new Error("إعداد النشر التلقائي غير موجود");
  saveAutoPostList(access.userId, autoPostItems(user).filter((entry) => entry.id !== item.id));
  return { ok: true };
}

export async function previewWebGroupAutoPost(userId, groupId, phoneNumber, autoPostId) {
  const access = await getAutoPostGroupAccess(userId, groupId, phoneNumber);
  const user = _deps?.getUser?.(access.userId);
  const item = findAutoPost(user, access.groupId, autoPostId);
  if (!item) throw new Error("إعداد النشر التلقائي غير موجود");
  const article = await findNextMawdoo3Article(item.topic, {
    seenUrls: seenAutoPostUrls(user, access.groupId),
  });
  return article;
}

export async function publishWebGroupAutoPostNow(userId, groupId, phoneNumber, autoPostId) {
  const access = await getAutoPostGroupAccess(userId, groupId, phoneNumber);
  const lock = `${access.userId}:${access.groupId}`;
  if (_autoPostInFlight.has(lock)) throw new Error("هناك عملية نشر جارية لهذه المجموعة؛ انتظر قليلاً");
  _autoPostInFlight.add(lock);
  try {
    const user = _deps?.getUser?.(access.userId);
    const item = findAutoPost(user, access.groupId, autoPostId);
    if (!item) throw new Error("إعداد النشر التلقائي غير موجود");
    const article = await findNextMawdoo3Article(item.topic, {
      seenUrls: seenAutoPostUrls(user, access.groupId),
    });
    reserveAutoPostUrl(access.userId, access.groupId, article.url);
    await access.sock.sendMessage(access.groupId, { text: postTextForArticle(article) });
    saveAutoPostResult(access.userId, access.groupId, item.id, {
      lastSentAt: new Date().toISOString(),
      lastError: null,
    });
    return { ok: true, title: article.title, url: article.url };
  } catch (error) {
    const currentUser = _deps?.getUser?.(access.userId);
    const currentItem = findAutoPost(currentUser, access.groupId, autoPostId);
    if (currentItem) {
      saveAutoPostResult(access.userId, access.groupId, autoPostId, {
        lastError: String(error?.message || "تعذّر النشر").slice(0, 220),
      });
    }
    throw error;
  } finally {
    _autoPostInFlight.delete(lock);
  }
}

function findSockets(userId) {
  const sessions = _deps?.inMemoryDB?.sessions;
  if (!sessions) return [];
  const sockets = [];
  const add = (value) => {
    const sock = value?.sock || value;
    if (sock?.sendMessage && !sockets.includes(sock)) sockets.push(sock);
  };
  add(sessions.get(String(userId)));
  add(sessions.get(`sess_${userId}`));
  for (const [key, value] of sessions.entries()) {
    const sessionKey = String(key);
    if (
      sessionKey === String(userId) ||
      sessionKey === `sess_${userId}` ||
      sessionKey.startsWith(`${userId}_`) ||
      sessionKey.startsWith(`sess_${userId}_`)
    ) add(value);
  }
  return sockets;
}

function findSocket(userId) {
  return findSockets(userId)[0] || null;
}

function phoneDigitsFromAddress(value, allowBare = false) {
  const address = String(value || "").trim().toLowerCase();
  const separator = address.lastIndexOf("@");
  if (separator < 0) {
    return allowBare && /^\+?[\d\s()-]+$/.test(address) ? address.replace(/\D/g, "") : "";
  }
  const domain = address.slice(separator + 1);
  if (!["s.whatsapp.net", "c.us"].includes(domain)) return "";
  const user = address.slice(0, separator).replace(/:\d+$/, "");
  return /^\+?\d+$/.test(user) ? user.replace(/\D/g, "") : "";
}

function socketMatchesPhone(sock, phoneNumber) {
  const wanted = String(phoneNumber || "").replace(/\D/g, "");
  if (!wanted) return true;
  const user = sock?.user || {};
  const actual = [
    phoneDigitsFromAddress(user.pn, true),
    phoneDigitsFromAddress(user.phoneNumber, true),
    phoneDigitsFromAddress(user.jid),
    phoneDigitsFromAddress(user.id),
  ].filter(Boolean);
  return actual.includes(wanted);
}

async function findSocketForGroup(userId, groupId, phoneNumber = null) {
  for (const sock of findSockets(userId)) {
    if (!socketMatchesPhone(sock, phoneNumber)) continue;
    if (typeof sock.groupMetadata !== "function") continue;
    try {
      const metadata = await sock.groupMetadata(groupId);
      if (metadata?.id === groupId || Array.isArray(metadata?.participants)) return sock;
    } catch {}
  }
  return null;
}

function connectedSocketPhone(sock) {
  const user = sock?.user || {};
  return [
    phoneDigitsFromAddress(user.pn, true),
    phoneDigitsFromAddress(user.phoneNumber, true),
    phoneDigitsFromAddress(user.jid),
    phoneDigitsFromAddress(user.id),
  ].find(Boolean) || "";
}

function localWorldSchedule(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Khartoum",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    time: `${values.hour}:${values.minute}`,
    weekday: weekdays[values.weekday],
  };
}

function giftReportMessage(report) {
  const weekly = report.type === "weekly";
  const ranking = (report.topMembers || []).map((member, index) =>
    `${index + 1}. ${member.name} — ${Number(member.balance).toLocaleString("ar")} نقطة`
  ).join("\n");
  const comparison = report.comparison
    ? `\nمقارنة بالفترة السابقة (${report.comparison.periodKey}): ${Number(report.comparison.totalPoints).toLocaleString("ar")} نقطة لـ${report.comparison.recipientsCount} عضو.`
    : "\nلا توجد فترة سابقة للمقارنة.";
  return [
    weekly ? "🏅 تقرير إنجازات الأسبوع" : "🌅 صباح الإنجازات!",
    `تم توزيع ${weekly ? "المكافآت الأسبوعية" : "مكافآت اليوم"} بنجاح.`,
    `إجمالي النقاط الموزعة: ${Number(report.totalPoints).toLocaleString("ar")}`,
    `عدد الأعضاء المستفيدين: ${report.recipientsCount}`,
    report.mostImproved ? `🚀 الأكثر تطورًا: ${report.mostImproved.name} (+${report.mostImproved.points} نقطة، +${report.mostImproved.xp} XP)` : "",
    report.largestRankJump ? `🔥 أكبر قفزة في الترتيب: ${report.largestRankJump.name} (+${report.largestRankJump.jump})` : "",
    report.highestBalance ? `💎 أعلى رصيد: ${report.highestBalance.name} — ${Number(report.highestBalance.balance).toLocaleString("ar")} نقطة` : "",
    report.mostActive ? `🏆 متصدر النشاط: ${report.mostActive.name} (+${report.mostActive.activity} رسالة)` : "",
    `📊 أفضل ${report.topMembers?.length || 0} أعضاء:\n${ranking || "لا توجد أرصدة مسجلة."}`,
    comparison,
  ].filter(Boolean).join("\n");
}

async function socketForWorldState(state) {
  const users = _deps?.inMemoryDB?.users;
  if (!(users instanceof Map)) return null;
  for (const [userId] of users.entries()) {
    const sock = await findSocketForGroup(String(userId), state.groupId, state.ownerPhoneNumber || null);
    if (sock) return sock;
  }
  return null;
}

async function runScheduledGroupWorldRewards() {
  if (_worldGiftSweepInFlight || !_deps) return;
  _worldGiftSweepInFlight = true;
  try {
    const now = new Date();
    const local = localWorldSchedule(now);
    const dayKey = groupWorldDayKey(now);
    const weekKey = groupWorldWeekKey(now);
    const groups = await groupWorldService.listGroups();
    for (const state of groups) {
      if (!state.enabled || !state.modules.automaticRewards || state.settings.automaticRewards.enabled === false) continue;

      if (local.time >= state.settings.automaticRewards.dailyTime) {
        await groupWorldService.distributeAutomaticGift(state.groupId, "daily", dayKey);
      }
      if (
        local.weekday === Number(state.settings.automaticRewards.weeklyDay) &&
        local.time >= state.settings.automaticRewards.weeklyTime
      ) {
        await groupWorldService.distributeAutomaticGift(state.groupId, "weekly", weekKey);
      }

      const expired = state.gameData.challengeMatches.some((challenge) =>
        challenge.status === "active" && Date.parse(challenge.deadline) <= now.getTime()
      ) ? await expireGroupWorldChallenges(state.groupId) : [];
      const pendingReports = await groupWorldService.getPendingGiftReports(state.groupId);
      if (!expired.length && !pendingReports.length) continue;
      const sock = await socketForWorldState(state);
      if (!sock || typeof sock.sendMessage !== "function") continue;
      for (const challenge of expired) {
        await sock.sendMessage(state.groupId, {
          text: `انتهى وقت ${challenge.challengeName} دون إجابة صحيحة؛ انتهى التحدي بالتعادل.`,
        });
      }
      for (const report of pendingReports) {
        try {
          await sock.sendMessage(state.groupId, {
            text: giftReportMessage(report),
          }, { messageId: report.reportId });
          await groupWorldService.markGiftReportSent(state.groupId, report.reportId);
        } catch (error) {
          _deps.logger?.warn?.({ groupId: state.groupId, reportId: report.reportId, err: String(error) }, "Group World scheduled report send failed");
        }
      }
    }
  } catch (error) {
    _deps?.logger?.warn?.({ err: String(error) }, "Group World scheduled rewards sweep failed");
  } finally {
    _worldGiftSweepInFlight = false;
  }
}

function ensureGroupWorldListeners(userId, sock) {
  if (!sock?.ev?.on) return;
  if (!_groupWorldMessageListeners.has(sock)) {
    sock.ev.on("messages.upsert", (event) => {
      for (const message of event?.messages || []) {
        void handleGroupWorldMessage(String(userId), sock, message, event?.type || "").catch(() => {});
      }
    });
    _groupWorldMessageListeners.add(sock);
  }
  if (!_groupWorldParticipantListeners.has(sock)) {
    sock.ev.on("group-participants.update", (event) => {
      void handleGroupWorldParticipants(String(userId), sock, event).catch(() => {});
    });
    _groupWorldParticipantListeners.add(sock);
  }
}

async function refreshGroupWorldListeners(force = false) {
  if (_groupWorldScanInFlight) return;
  if (!force && Date.now() - _groupWorldScanAt < 60_000) return;
  _groupWorldScanAt = Date.now();
  _groupWorldScanInFlight = true;
  try {
    const groups = await groupWorldService.listGroups();
    if (groups.some((group) => group.enabled)) _hasActiveGroupWorld = true;
    const users = _deps?.inMemoryDB?.users;
    if (!(users instanceof Map)) return;
    for (const userId of users.keys()) {
      for (const sock of findSockets(String(userId))) {
        ensureGroupWorldListeners(String(userId), sock);
      }
    }
  } catch (error) {
    _deps?.logger?.warn?.({ err: String(error) }, "Could not recover Group World listeners");
  } finally {
    _groupWorldScanInFlight = false;
  }
}

export async function getGroupWorldConnection(userId, groupId, phoneNumber = null, requireBotAdmin = false) {
  const uid = String(userId || "");
  const id = String(groupId || "").trim();
  if (!/^[A-Za-z0-9._:-]{3,128}@g\.us$/.test(id)) throw new Error("معرّف المجموعة غير صالح");
  const sock = await findSocketForGroup(uid, id, phoneNumber);
  if (!sock) throw new Error("المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(id);
  if (!metadata || (metadata.id && metadata.id !== id)) throw new Error("تعذّر جلب تفاصيل المجموعة");
  if (requireBotAdmin && ownAccountIsAdmin(sock, metadata) !== true) {
    throw new Error("يجب أن يكون رقم واتساب المرتبط مشرفاً في المجموعة");
  }
  return { sock, metadata, phoneNumber: connectedSocketPhone(sock) };
}

export async function activateGroupWorldForWeb(userId, groupId, phoneNumber) {
  const uid = String(userId);
  const { sock, metadata, phoneNumber: ownerPhoneNumber } =
    await getGroupWorldConnection(uid, groupId, phoneNumber, false);
  const members = (metadata.participants || []).map((participant) => ({
    memberId: participant.id || participant.jid || participant.pn || participant.lid,
    name: participant.notify || participant.name || "",
  })).filter((participant) => participant.memberId);
  const result = await groupWorldService.activateGroup({
    groupId,
    ownerId: uid,
    ownerPhoneNumber,
    members,
    actor: uid,
  });
  _hasActiveGroupWorld = true;
  _groupWorldScanAt = Date.now();
  ensureGroupWorldListeners(uid, sock);
  return {
    ...result,
    groupId,
    groupName: String(metadata.subject || metadata.name || groupId),
    memberCount: members.length,
    phoneNumber: ownerPhoneNumber,
  };
}

export async function getGroupWorldLiveInfo(userId, groupId, phoneNumber) {
  const { sock, metadata, phoneNumber: selectedPhone } =
    await getGroupWorldConnection(userId, groupId, phoneNumber, false);
  return {
    groupId,
    groupName: String(metadata.subject || metadata.name || groupId),
    memberCount: Array.isArray(metadata.participants) ? metadata.participants.length : Number(metadata.size) || 0,
    botIsAdmin: ownAccountIsAdmin(sock, metadata) === true,
    phoneNumber: selectedPhone,
  };
}

export async function refreshGroupWorldSlotsForWeb(userId, groupId, phoneNumber) {
  const uid = String(userId);
  const { metadata } = await getGroupWorldConnection(uid, groupId, phoneNumber, false);
  const members = (metadata.participants || []).map((participant) => ({
    memberId: participant.id || participant.jid || participant.pn || participant.lid,
    name: participant.notify || participant.name || "",
  })).filter((participant) => participant.memberId);
  return groupWorldService.refreshSlots(groupId, members, uid);
}

export async function sendGroupWorldAnnouncement(userId, groupId, phoneNumber, text) {
  const message = String(text || "").trim();
  if (!message || message.length > 3_500) throw new Error("اكتب إعلانًا من 1 إلى 3500 حرف");
  const { sock } = await getGroupWorldConnection(userId, groupId, phoneNumber, false);
  if (typeof sock.sendMessage !== "function") throw new Error("إرسال الرسائل غير متاح على هذا الاتصال");
  await sock.sendMessage(groupId, { text: message });
  await groupWorldService.audit(groupId, String(userId), "event_publish", groupId, "نشر إعلان في المجموعة", {
    characters: message.length,
  });
  return { ok: true, sent: true };
}

export async function adjustGroupWorldSlotForWeb(userId, groupId, phoneNumber, slotNumber, amount, reason) {
  const uid = String(userId);
  const { metadata } = await getGroupWorldConnection(uid, groupId, phoneNumber, false);
  const target = await groupWorldService.getSlotMember(groupId, slotNumber);
  const comparableId = (value) => {
    const canonical = String(value || "").split(":")[0].toLowerCase();
    return {
      canonical,
      digits: canonical.split("@")[0].replace(/\D/g, ""),
    };
  };
  const targetKey = comparableId(target.memberId);
  const stillMember = (metadata.participants || []).some((participant) =>
    [participant.id, participant.jid, participant.pn, participant.phoneNumber, participant.lid]
      .some((value) => {
        const candidate = comparableId(value);
        return candidate.canonical === targetKey.canonical ||
          (candidate.digits && targetKey.digits && candidate.digits === targetKey.digits);
      })
  );
  if (!stillMember) {
    await groupWorldService.markMemberLeft(groupId, target.memberId);
    throw new Error("الخانة أصبحت فارغة لأن صاحبها غادر المجموعة");
  }
  return groupWorldService.adjustSlot(groupId, slotNumber, amount, uid, reason);
}

export function resolveGroupWorldAdminUser(phoneNumber) {
  const wanted = String(phoneNumber || "").replace(/\D/g, "");
  const users = _deps?.inMemoryDB?.users;
  if (!wanted || !(users instanceof Map)) return null;
  for (const userId of users.keys()) {
    if (findSockets(String(userId)).some((sock) => connectedSocketPhone(sock) === wanted)) {
      return String(userId);
    }
  }
  return null;
}

function getGroupMessageText(message) {
  let content = message?.message || {};
  for (let i = 0; i < 4; i++) {
    const wrapped = content.ephemeralMessage?.message || content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message || content.documentWithCaptionMessage?.message;
    if (!wrapped) break;
    content = wrapped;
  }
  return [
    content.conversation,
    content.extendedTextMessage?.text,
    content.imageMessage?.caption,
    content.videoMessage?.caption,
    content.documentMessage?.caption,
    content.buttonsResponseMessage?.selectedDisplayText,
    content.listResponseMessage?.title
  ].filter(Boolean).join("\n");
}

export function hasAnyUrl(text) {
  return /(?:https?:\/\/|www\.)\S+|(?:^|\s)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#]\S*)?/iu.test(String(text || ""));
}

export function extractWhatsAppGroupInviteCode(text) {
  return String(text || "").match(/\b(?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/([A-Za-z0-9_-]{8,})/i)?.[1] || null;
}

export function formatGroupInviteReport(metadata = {}) {
  const participants = Array.isArray(metadata.participants) ? metadata.participants : null;
  const memberCount = metadata.size != null && metadata.size !== "" && Number.isFinite(Number(metadata.size))
    ? Number(metadata.size) : participants?.length;
  const adminCount = participants
    ? participants.filter((p) => p?.admin === "admin" || p?.admin === "superadmin" || p?.isAdmin === true).length
    : null;
  const createdAt = Number(metadata.creation);
  const createdText = Number.isFinite(createdAt) && createdAt > 0
    ? new Date(createdAt < 1e12 ? createdAt * 1000 : createdAt).toLocaleDateString("ar")
    : "غير متاح من معاينة الرابط";
  return [
    "🔎 معلومات متاحة من معاينة رابط مجموعة واتساب",
    `👥 الاسم: ${metadata.subject || metadata.name || "غير متاح"}`,
    `👤 الأعضاء: ${memberCount ?? "غير متاح من معاينة الرابط"}`,
    `🛡️ المشرفون: ${adminCount ?? "غير متاح من معاينة الرابط"}`,
    `📝 الوصف: ${metadata.desc || "غير متاح من معاينة الرابط"}`,
    `📅 تاريخ الإنشاء: ${createdText}`,
    "ℹ️ لم ينضم البوت إلى المجموعة؛ التفاصيل التي لا تعرضها واتساب في المعاينة تبقى غير متاحة."
  ].join("\n");
}

function messageHasLink(text) {
  return hasAnyUrl(text);
}

function asciiDigits(value) {
  return String(value).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function ownAccountIsAdmin(sock, metadata) {
  const ownValues = [sock?.user?.id, sock?.user?.jid, sock?.user?.lid, sock?.user?.pn]
    .filter(Boolean).map(String);
  const participants = metadata?.participants;
  if (!ownValues.length || !Array.isArray(participants)) return null;
  const matched = participants.find((participant) => {
    const values = [participant?.id, participant?.jid, participant?.pn, participant?.phoneNumber, participant?.lid]
      .filter(Boolean).map(String);
    return values.some((value) => ownValues.some((own) => sameWhatsAppIdentity(value, own)));
  });
  if (!matched) return null;
  return matched.admin === "admin" || matched.admin === "superadmin" || matched.isAdmin === true;
}

async function fetchInvitePhoto(sock, groupJid) {
  if (!groupJid || typeof sock?.profilePictureUrl !== "function") return null;
  try {
    const url = await sock.profilePictureUrl(groupJid, "image");
    if (!url) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 5 * 1024 * 1024) return null;
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body || []) {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) return null;
      chunks.push(chunk);
    }
    return size > 0 ? Buffer.concat(chunks, size) : null;
  } catch {
    return null;
  }
}

async function inspectInviteLink(sock, groupJid, code) {
  const now = Date.now();
  let cached = _inviteCache.get(code);
  if (!cached || cached.expiresAt <= now) {
    if (typeof sock.groupGetInviteInfo !== "function") {
      await sock.sendMessage(groupJid, { text: "تعذر فحص الرابط: مكتبة واتساب الحالية لا توفر معاينة معلومات الدعوة." });
      return;
    }
    const metadata = await sock.groupGetInviteInfo(code);
    cached = { metadata, expiresAt: now + 10 * 60_000 };
    _inviteCache.set(code, cached);
    if (_inviteCache.size > 200) _inviteCache.delete(_inviteCache.keys().next().value);
  }
  const metadata = cached.metadata || {};
  const report = formatGroupInviteReport(metadata);
  const picture = await fetchInvitePhoto(sock, metadata.id || metadata.jid);
  if (picture) await sock.sendMessage(groupJid, { image: picture, caption: report });
  else await sock.sendMessage(groupJid, { text: report });
}

async function handleModeratedMessage(userId, sock, message) {
  const key = message?.key;
  const groupJid = key?.remoteJid;
  if (!groupJid?.endsWith("@g.us") || key.fromMe) return;
  const text = getGroupMessageText(message);
  if (!text) return;
  const user = _deps.getUser(userId);
  const antiLinkEnabled = (user.antiLinkGroups || []).includes(groupJid);
  const inspectEnabled = (user.inspectInviteGroups || []).includes(groupJid);
  if (!antiLinkEnabled && !inspectEnabled) return;

  const inviteCode = extractWhatsAppGroupInviteCode(text);
  if (inspectEnabled && inviteCode) {
    try { await inspectInviteLink(sock, groupJid, inviteCode); } catch {
      await sock.sendMessage(groupJid, { text: "تعذر جلب معاينة الرابط. قد يكون الرابط منتهياً أو غير صالح." }).catch(() => {});
    }
  }
  if (!antiLinkEnabled || !messageHasLink(text)) return;

  let admin = null;
  try {
    if (typeof sock.groupMetadata === "function") {
      const metadata = await sock.groupMetadata(groupJid);
      admin = ownAccountIsAdmin(sock, metadata);
    }
  } catch {}
  if (admin !== true) {
    const warningKey = `${userId}:${groupJid}`;
    const lastWarning = _warningTimes.get(warningKey) || 0;
    if (Date.now() - lastWarning < 60_000) return;
    _warningTimes.set(warningKey, Date.now());
    if (_warningTimes.size > 500) _warningTimes.delete(_warningTimes.keys().next().value);
    await sock.sendMessage(groupJid, {
      text: admin === false
        ? "⚠️ تم تفعيل حذف الروابط، لكن رقم واتساب المرتبط غير مشرف في هذه المجموعة، لذلك لم تُحذف الرسالة. عيّنه مشرفاً مع صلاحية حذف الرسائل."
        : "⚠️ تعذر التحقق من صلاحية المشرف الآن، لذلك لم تُحذف رسالة الرابط. تحقق من اتصال واتساب وصلاحية الرقم المرتبط."
    }).catch(() => {});
    return;
  }
  try {
    await sock.sendMessage(groupJid, { delete: key });
  } catch {
    const warningKey = `${userId}:${groupJid}`;
    const lastWarning = _warningTimes.get(warningKey) || 0;
    if (Date.now() - lastWarning >= 60_000) {
      _warningTimes.set(warningKey, Date.now());
      await sock.sendMessage(groupJid, { text: "⚠️ تعذر حذف الرابط. تحقق من صلاحيات المشرف لحساب واتساب المرتبط." }).catch(() => {});
    }
  }
}

function ensureModerationListener(userId, sock = findSocket(userId)) {
  if (!sock?.ev?.on || _listeners.has(sock)) return;
  const listener = (event) => {
    for (const message of event?.messages || []) {
      void handleModeratedMessage(String(userId), sock, message).catch(() => {});
    }
  };
  sock.ev.on("messages.upsert", listener);
  _listeners.add(sock);
}

function maskedGroupMember(participant) {
  const raw = participant?.id || participant?.jid || participant?.phoneNumber || "";
  const digits = String(raw).split(":")[0].split("@")[0].replace(/\D/g, "");
  const role = participant?.admin === "superadmin"
    ? "المؤسس"
    : participant?.admin === "admin" || participant?.isAdmin === true
      ? "مشرف"
      : "عضو";
  return {
    label: digits ? `••••${digits.slice(-4)}` : "عضو",
    role,
  };
}

export async function getWebGroupDetails(userId, groupId, phoneNumber) {
  userId = String(userId);
  groupId = String(groupId || "").trim();
  if (!groupId.endsWith("@g.us")) throw new Error("معرّف المجموعة غير صالح");
  if (!phoneNumber) throw new Error("حدّث قائمة المجموعات واختر رقم واتساب");

  const sock = await findSocketForGroup(userId, groupId, phoneNumber);
  if (!sock) throw new Error("هذه المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(groupId);
  if (!metadata || (metadata.id && metadata.id !== groupId)) {
    throw new Error("تعذّر جلب تفاصيل هذه المجموعة");
  }

  const participants = Array.isArray(metadata.participants) ? metadata.participants : [];
  const user = _deps?.getUser?.(userId) || {};
  const creation = Number(metadata.creation);
  const createdAt = Number.isFinite(creation) && creation > 0
    ? new Date(creation < 1e12 ? creation * 1000 : creation).toISOString()
    : null;

  return {
    id: groupId,
    name: String(metadata.subject || metadata.name || groupId),
    description: String(metadata.desc || ""),
    memberCount: Number(metadata.size) || participants.length,
    adminCount: participants.filter((participant) =>
      participant?.admin === "admin" || participant?.admin === "superadmin" || participant?.isAdmin === true
    ).length,
    createdAt,
    isAdmin: ownAccountIsAdmin(sock, metadata) === true,
    locked: metadata.announce === true,
    members: participants.slice(0, 500).map(maskedGroupMember),
    membersTruncated: participants.length > 500,
    antiLinkEnabled: (user.antiLinkGroups || []).includes(groupId),
    inspectInviteEnabled: (user.inspectInviteGroups || []).includes(groupId),
    autoPosts: autoPostItems(user)
      .filter((item) => item?.groupId === groupId)
      .map(publicAutoPost),
  };
}

export async function getWebGroupInvite(userId, groupId, phoneNumber) {
  userId = String(userId);
  groupId = String(groupId || "").trim();
  if (!groupId.endsWith("@g.us")) throw new Error("معرّف المجموعة غير صالح");
  const sock = await findSocketForGroup(userId, groupId, phoneNumber);
  if (!sock) throw new Error("هذه المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(groupId);
  if (ownAccountIsAdmin(sock, metadata) !== true) {
    throw new Error("رابط الدعوة متاح فقط عندما يكون رقم واتساب مشرفاً");
  }
  const code = await sock.groupInviteCode?.(groupId);
  if (!code) throw new Error("تعذّر جلب رابط الدعوة");
  return { link: `https://chat.whatsapp.com/${code}` };
}

export async function setWebGroupSetting(userId, groupId, phoneNumber, setting, enabled) {
  userId = String(userId);
  groupId = String(groupId || "").trim();
  if (!groupId.endsWith("@g.us")) throw new Error("معرّف المجموعة غير صالح");
  if (!["antiLink", "inspectInvite"].includes(setting)) throw new Error("إعداد المجموعة غير صالح");
  if (typeof enabled !== "boolean") throw new Error("حالة الإعداد غير صالحة");

  const sock = await findSocketForGroup(userId, groupId, phoneNumber);
  if (!sock) throw new Error("هذه المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(groupId);
  if (ownAccountIsAdmin(sock, metadata) !== true) {
    throw new Error("يجب أن يكون رقم واتساب مشرفاً لتغيير إعدادات حماية المجموعة");
  }

  const user = _deps?.getUser?.(userId);
  if (!user || typeof _deps?.saveUser !== "function") {
    throw new Error("تعذّر الوصول إلى إعدادات المستخدم");
  }
  const key = setting === "antiLink" ? "antiLinkGroups" : "inspectInviteGroups";
  const current = Array.isArray(user[key]) ? user[key] : [];
  const updated = enabled
    ? (current.includes(groupId) ? current : [...current, groupId])
    : current.filter((id) => id !== groupId);
  _deps.saveUser(userId, { [key]: updated });
  ensureModerationListener(userId, sock);

  return {
    antiLinkEnabled: setting === "antiLink" ? enabled : updated.includes(groupId),
    inspectInviteEnabled: setting === "inspectInvite" ? enabled : (user.inspectInviteGroups || []).includes(groupId),
  };
}

export async function applyWebGroupAction(userId, groupId, phoneNumber, action, value) {
  userId = String(userId);
  groupId = String(groupId || "").trim();
  if (!groupId.endsWith("@g.us")) throw new Error("معرّف المجموعة غير صالح");
  if (!["rename", "description", "lock", "unlock"].includes(action)) {
    throw new Error("إجراء المجموعة غير صالح");
  }

  const sock = await findSocketForGroup(userId, groupId, phoneNumber);
  if (!sock) throw new Error("هذه المجموعة غير متاحة على رقم واتساب المختار");
  const metadata = await sock.groupMetadata(groupId);
  if (ownAccountIsAdmin(sock, metadata) !== true) {
    throw new Error("يجب أن يكون رقم واتساب مشرفاً لتعديل المجموعة");
  }

  if (action === "rename") {
    const subject = String(value || "").trim();
    if (!subject || subject.length > 25) throw new Error("اسم المجموعة مطلوب وبحد أقصى 25 حرفاً");
    if (typeof sock.groupUpdateSubject !== "function") throw new Error("تغيير اسم المجموعة غير متاح حالياً");
    await sock.groupUpdateSubject(groupId, subject);
  } else if (action === "description") {
    const description = String(value || "").trim();
    if (description.length > 512) throw new Error("الوصف يتجاوز الحد المسموح");
    if (typeof sock.groupUpdateDescription !== "function") throw new Error("تغيير وصف المجموعة غير متاح حالياً");
    await sock.groupUpdateDescription(groupId, description);
  } else {
    if (typeof sock.groupSettingUpdate !== "function") throw new Error("تغيير صلاحية الإرسال غير متاح حالياً");
    await sock.groupSettingUpdate(groupId, action === "lock" ? "announcement" : "not_announcement");
  }

  return { ok: true };
}

function attachConfiguredListeners(userId) {
  const user = _deps?.getUser?.(String(userId));
  if ((user?.antiLinkGroups?.length || user?.inspectInviteGroups?.length) && userId) {
    ensureModerationListener(String(userId));
  }
}

function recoverGroupListeners() {
  void refreshGroupWorldListeners();
  const users = _deps?.inMemoryDB?.users;
  if (!(users instanceof Map)) return;
  for (const [userId, user] of users.entries()) {
    if (user?.antiLinkGroups?.length || user?.inspectInviteGroups?.length) {
      ensureModerationListener(String(userId));
    }
  }
}

export function stopModerationListenerRecovery() {
  if (_listenerRecoveryTimer) clearInterval(_listenerRecoveryTimer);
  _listenerRecoveryTimer = null;
  if (_autoPostTimer) clearInterval(_autoPostTimer);
  _autoPostTimer = null;
  if (_worldGiftTimer) clearInterval(_worldGiftTimer);
  _worldGiftTimer = null;
  _autoPostInFlight.clear();
  _autoPostSweepInFlight = false;
  _worldGiftSweepInFlight = false;
}

function controlsKeyboard(userId, groupId) {
  const user = _deps.getUser(userId);
  const links = (user.antiLinkGroups || []).includes(groupId);
  const inspect = (user.inspectInviteGroups || []).includes(groupId);
  return {
    inline_keyboard: [
      [{ text: "📨 إرسال رسالة للمجموعة", callback_data: `grp_custom_send_${groupId}` }],
      [{ text: "🔁 إرسال مكرر (حد أقصى 5)", callback_data: `grp_custom_repeat_${groupId}` }],
      [{ text: `${links ? "🟢" : "⚪"} حذف الروابط: ${links ? "مفعّل" : "متوقف"}`, callback_data: `grp_custom_links_${groupId}` }],
      [{ text: `${inspect ? "🟢" : "⚪"} فحص روابط الدعوة: ${inspect ? "مفعّل" : "متوقف"}`, callback_data: `grp_custom_inspect_${groupId}` }]
    ]
  };
}

function groupsWebAppMarkup(markup, chatId, userId) {
  if (String(chatId) !== String(userId)) return markup;
  const baseUrl = webappUrlFor(userId);
  if (!baseUrl) return markup;
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}section=groups`;
  const rows = Array.isArray(markup?.inline_keyboard) ? markup.inline_keyboard.map((row) => [...row]) : [];
  rows.push([{ text: "🌐 فتح واجهة المجموعات", web_app: { url } }]);
  return { ...markup, inline_keyboard: rows };
}

async function sendGroupsWebApp(bot, chatId, userId) {
  if (String(chatId) !== String(userId)) {
    await bot.sendMessage(chatId, "افتح المحادثة الخاصة مع البوت واكتب /wep g لفتح واجهة المجموعات.");
    return;
  }
  const baseUrl = webappUrlFor(userId);
  if (!baseUrl) {
    await bot.sendMessage(chatId, "رابط الواجهة غير جاهز حالياً. جرّب مرة أخرى بعد تشغيل رابط الموقع.");
    return;
  }
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}section=groups`;
  await bot.sendMessage(chatId, "افتح واجهة إدارة المجموعات:", {
    reply_markup: {
      inline_keyboard: [[{ text: "🌐 فتح واجهة المجموعات", web_app: { url } }]]
    }
  });
}

async function sendRepeatedGroupMessage(bot, chatId, sock, groupId, message, count) {
  for (let i = 0; i < count; i++) {
    try { await bot.sendChatAction?.(chatId, "typing"); } catch {}
    await sock.sendMessage(groupId, { text: message });
    if (i + 1 < count) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id || "");
  attachConfiguredListeners(userId);

  if (/^\/(?:wep|web)(?:@\w+)?\s+g$/i.test(text.trim())) {
    const pending = _deps.getState?.(userId);
    if (["awaiting_custom_group_message", "awaiting_custom_group_repeat_message", "awaiting_custom_group_repeat_count"].includes(pending?.state)) {
      _deps.clearState?.(userId);
    }
    await sendGroupsWebApp(bot, chatId, userId);
    return true;
  }

  if (text === "إلغاء" || text === "/cancel") {
    const state = _deps.getState?.(userId);
    if (["awaiting_custom_group_message", "awaiting_custom_group_repeat_message", "awaiting_custom_group_repeat_count"].includes(state?.state)) {
      _deps.clearState?.(userId);
      await bot.sendMessage(chatId, "✅ تم الإلغاء.");
      return true;
    }
  }

  const state = _deps.getState?.(userId);
  if (state?.state === "awaiting_custom_group_message") {
    const groupId = String(state.data?.groupId || "");
    const sock = await findSocketForGroup(userId, groupId);
    if (!sock || !groupId.endsWith("@g.us")) {
      _deps.clearState?.(userId);
      await bot.sendMessage(chatId, "❌ تعذر الإرسال: لم أجد اتصال واتساب عضواً في هذه المجموعة.");
      return true;
    }
    if (!text.trim() || text.length > 3500) {
      await bot.sendMessage(chatId, "❌ أرسل رسالة غير فارغة وبحد أقصى 3500 حرف.");
      return true;
    }
    try {
      await sock.sendMessage(groupId, { text });
      _deps.clearState?.(userId);
      await bot.sendMessage(chatId, "✅ تم إرسال الرسالة إلى المجموعة.");
    } catch (error) {
      _deps.clearState?.(userId);
      const reason = String(error?.message || "خطأ غير معروف").slice(0, 240);
      await bot.sendMessage(chatId, `❌ فشل الإرسال: ${reason}`);
    }
    return true;
  }

  if (state?.state === "awaiting_custom_group_repeat_message") {
    if (!text.trim() || text.length > 3500) {
      await bot.sendMessage(chatId, "❌ أرسل رسالة غير فارغة وبحد أقصى 3500 حرف.");
      return true;
    }
    const trailingCount = text.match(/^(.+?)\s+([1-5٠-٥۰-۵])$/u);
    if (trailingCount) {
      const groupId = String(state.data?.groupId || "");
      const sock = await findSocketForGroup(userId, groupId);
      if (!sock || !groupId.endsWith("@g.us")) {
        _deps.clearState?.(userId);
        await bot.sendMessage(chatId, "❌ تعذر الإرسال: لم أجد اتصال واتساب عضواً في هذه المجموعة.");
        return true;
      }
      _deps.clearState?.(userId);
      try {
        await sendRepeatedGroupMessage(bot, chatId, sock, groupId, trailingCount[1].trim(), Number(asciiDigits(trailingCount[2])));
        await bot.sendMessage(chatId, `✅ اكتمل الإرسال: ${trailingCount[2]} رسالة.`);
      } catch {
        await bot.sendMessage(chatId, "⚠️ توقف الإرسال عند أول خطأ من واتساب؛ لم أعد إرسال الرسالة تلقائياً.");
      }
      return true;
    }
    _deps.setState(userId, "awaiting_custom_group_repeat_count", {
      ...(state.data || {}),
      message: text
    });
    await bot.sendMessage(chatId, "كم مرة؟ أرسل رقماً من 1 إلى 5. ويمكنك بدلاً من ذلك كتابة الرسالة والعدد معاً، مثل: `هلا 5`.");
    return true;
  }

  if (state?.state === "awaiting_custom_group_repeat_count") {
    const count = Number(asciiDigits(text));
    const groupId = String(state.data?.groupId || "");
    const message = String(state.data?.message || "");
    const sock = await findSocketForGroup(userId, groupId);
    if (!Number.isInteger(count) || count < 1 || count > 5) {
      await bot.sendMessage(chatId, "❌ العدد المسموح من 1 إلى 5 فقط.");
      return true;
    }
    if (!sock || !groupId.endsWith("@g.us") || !message) {
      _deps.clearState?.(userId);
      await bot.sendMessage(chatId, "❌ تعذر الإرسال: لا يوجد اتصال واتساب مؤكد لهذه المجموعة أو بيانات الرسالة غير متاحة.");
      return true;
    }
    _deps.clearState?.(userId);
    try {
      await sendRepeatedGroupMessage(bot, chatId, sock, groupId, message, count);
      await bot.sendMessage(chatId, `✅ اكتمل الإرسال: ${count} رسالة. تم الإرسال بفاصل زمني لتقليل التكرار المزعج.`);
    } catch {
      await bot.sendMessage(chatId, "⚠️ توقف الإرسال عند أول خطأ من واتساب؛ لم أعد إرسال الرسالة تلقائياً.");
    }
    return true;
  }

  if (text === '/groups') {
    attachConfiguredListeners(userId);
    const { groupsMenuKeyboardV2 } = await _deps._mod_groups_handler();
    await bot.sendMessage(chatId, '\u{1F465} \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A', {
      reply_markup: groupsWebAppMarkup(groupsMenuKeyboardV2(), chatId, userId)
    });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);
  attachConfiguredListeners(userId);

  if (data === "menu_groups" || data.startsWith("grpv2_") || data.startsWith("grp_custom_") || data.startsWith("grp_") || data.startsWith("groups_")) {
    try { await bot.answerCallbackQuery?.(query.id); } catch {}
  }

  if (data.startsWith("grp_custom_")) {
    const match = data.match(/^grp_custom_(send|repeat|links|inspect)_(.+)$/);
    if (!match) return false;
    const [, action, groupId] = match;
    if (!groupId.endsWith("@g.us")) {
      await bot.sendMessage(chatId, "❌ معرّف المجموعة غير صالح.");
      return true;
    }
    const sock = action === "send" || action === "repeat"
      ? await findSocketForGroup(userId, groupId)
      : findSocket(userId);
    if (!sock) {
      await bot.sendMessage(chatId, action === "send" || action === "repeat"
        ? "❌ لم أجد اتصال واتساب عضواً في هذه المجموعة."
        : "❌ اربط واتساب أولاً.");
      return true;
    }
    if (action === "send") {
      _deps.setState(userId, "awaiting_custom_group_message", { groupId });
      await bot.sendMessage(chatId, "اكتب الرسالة التي تريد إرسالها للمجموعة:", { reply_markup: _deps.cancelKeyboard?.() });
      return true;
    }
    if (action === "repeat") {
      _deps.setState(userId, "awaiting_custom_group_repeat_message", { groupId });
      await bot.sendMessage(chatId, "اكتب الرسالة. بعد ذلك اختر عدد الإرسالات من 1 إلى 5:", { reply_markup: _deps.cancelKeyboard?.() });
      return true;
    }
    const user = _deps.getUser(userId);
    const key = action === "links" ? "antiLinkGroups" : "inspectInviteGroups";
    const existing = Array.isArray(user[key]) ? user[key] : [];
    const enabled = !existing.includes(groupId);
    const updated = enabled ? [...existing, groupId] : existing.filter((id) => id !== groupId);
    _deps.saveUser(userId, { [key]: updated });
    ensureModerationListener(userId, sock);
    const label = action === "links" ? "حذف الروابط" : "فحص روابط الدعوة";
    await bot.sendMessage(chatId, `${enabled ? "✅ تم التفعيل" : "⏸️ تم الإيقاف"}: ${label}.\n${action === "links" ? "الحذف يحتاج أن يكون رقم واتساب المرتبط مشرفاً وله صلاحية حذف الرسائل." : "يفحص روابط دعوة واتساب فقط، ولا ينضم إلى المجموعات."}`, {
      reply_markup: controlsKeyboard(userId, groupId)
    });
    return true;
  }

  if (data === 'menu_groups' || data.startsWith('grpv2_')) {
    try {
      await _deps.handleGroupsV2(bot, chatId, userId, data);
      if (data === "menu_groups") await sendGroupsWebApp(bot, chatId, userId);
      if (data.startsWith("grpv2_info_")) {
        const groupId = data.slice("grpv2_info_".length);
        if (groupId.endsWith("@g.us")) {
          await bot.sendMessage(chatId, "إجراءات إضافية للمجموعة:", { reply_markup: controlsKeyboard(userId, groupId) });
        }
      }
    } catch (error) {
      await bot.sendMessage(chatId, `تعذر فتح قسم المجموعات: ${error?.message || 'خطأ غير معروف'}`);
    }
    return true;
  }

  if (data.startsWith('grp_') || data.startsWith('groups_')) {
    try {
      const handled = await _deps.handleGroupsCallback(bot, chatId, userId, data);
      if (!handled) await _deps.handleGroupsV2(bot, chatId, userId, data);
    } catch (error) {
      await bot.sendMessage(chatId, `تعذر تنفيذ عملية المجموعات: ${error?.message || 'خطأ غير معروف'}`);
    }
    return true;
  }

  if (
    data.startsWith('group_') ||
    data.startsWith('groupinfo_') ||
    data.startsWith('expfmt_') ||
    data.startsWith('kickall_confirm_')
  ) {
    await _deps.handleGroupsV2(bot, chatId, userId, data);
    return true;
  }

  return false;
}
