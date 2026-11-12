/**
 * WhatsApp group event and command handler for Group World.
 * Dependencies: the shared group-world service and a Baileys socket.
 * Exports: setGroupWorldDeps, handleGroupWorldMessage, handleGroupWorldParticipants.
 */

import { randomBytes } from "node:crypto";
import {
  groupWorldService as defaultGroupWorldService,
  groupWorldDayKey,
  groupWorldWeekKey,
  renderMessageTemplate,
} from "../services/groups/group-world-service.mjs";
import {
  createListMessage,
  createQuickReplyMessage,
  extractInteractiveSelection,
  prepareInteractiveImage,
  sendInteractiveMessage,
} from "../services/groups/group-world-interactive.mjs";
import { createGroupWorldActivityService } from "../services/groups/group-world-activity-service.mjs";
import { createGroupWorldRpgService } from "../services/groups/group-world-rpg-service.mjs";

let _deps = {};
const groupWorldService = new Proxy(defaultGroupWorldService, {
  get(target, property) {
    const source = _deps.groupWorldServiceOverride || target;
    const value = Reflect.get(source, property, source);
    return typeof value === "function" ? value.bind(source) : value;
  },
});
const activityService = createGroupWorldActivityService({ service: groupWorldService });
const rpgService = createGroupWorldRpgService({ service: groupWorldService });
const GROUP_ID_PATTERN = /^[A-Za-z0-9._:-]{3,128}@g\.us$/;
const MAX_REPLY_LENGTH = 3_500;
const commandEvents = new Map();
const participantEvents = new Map();

export function setGroupWorldDeps(deps = {}) {
  _deps = { ..._deps, ...deps };
}

export async function expireGroupWorldChallenges(groupId) {
  return activityService.expireChallenges(groupId);
}

function messageText(message) {
  let content = message?.message || {};
  for (let index = 0; index < 5; index += 1) {
    const wrapped =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message;
    if (!wrapped) break;
    content = wrapped;
  }
  return [
    content.conversation,
    content.extendedTextMessage?.text,
    content.imageMessage?.caption,
    content.videoMessage?.caption,
    content.documentMessage?.caption,
  ].filter(Boolean).join("\n").trim();
}

function participantId(message) {
  const key = message?.key || {};
  return key.participant || key.participantAlt || key.participantPn || message?.participant || "";
}

function normalizeWhatsAppAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  const separator = address.lastIndexOf("@");
  if (separator <= 0 || separator === address.length - 1) return address;
  const user = address.slice(0, separator).replace(/:\d+$/, "");
  const domain = address.slice(separator + 1) === "c.us"
    ? "s.whatsapp.net"
    : address.slice(separator + 1);
  return `${user}@${domain}`;
}

function phoneDigits(value) {
  const address = String(value || "").trim().toLowerCase();
  const separator = address.lastIndexOf("@");
  if (separator < 0) {
    return /^\+?[\d\s()-]+$/.test(address) ? address.replace(/\D/g, "") : "";
  }
  const domain = address.slice(separator + 1);
  if (!["s.whatsapp.net", "c.us"].includes(domain)) return "";
  const user = address.slice(0, separator).replace(/:\d+$/, "");
  return /^\+?\d+$/.test(user) ? user.replace(/\D/g, "") : "";
}

export function sameWhatsAppIdentity(left, right) {
  const a = normalizeWhatsAppAddress(left);
  const b = normalizeWhatsAppAddress(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const leftPhone = phoneDigits(left);
  const rightPhone = phoneDigits(right);
  return Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
}

function sameMember(left, right) {
  return sameWhatsAppIdentity(left, right);
}

function participantIdentityValues(participant) {
  if (!participant || typeof participant !== "object") return [];
  return [participant.id, participant.jid, participant.pn, participant.phoneNumber, participant.lid]
    .filter(Boolean)
    .map(String);
}

function socketIdentityValues(sock) {
  const user = sock?.user || {};
  return [user.id, user.jid, user.pn, user.lid, user.phoneNumber]
    .filter(Boolean)
    .map(String);
}

async function resolvedMessageSenderIds(message, memberId, sock) {
  const ids = messageSenderIds(message, memberId);
  const mapping = sock?.signalRepository?.lidMapping;
  if (typeof mapping?.getPNForLID !== "function") return ids;
  for (const id of ids) {
    if (!String(id).toLowerCase().endsWith("@lid")) continue;
    try {
      const phoneJid = await mapping.getPNForLID(id);
      if (phoneJid) ids.push(String(phoneJid));
    } catch {
      // The alternate participant JID remains usable when the local mapping is absent.
    }
  }
  return [...new Set(ids)];
}

function socketPhoneNumber(sock) {
  const user = sock?.user || {};
  return [
    phoneDigits(user.pn),
    phoneDigits(user.phoneNumber),
    phoneDigits(user.jid),
    phoneDigits(user.id),
  ].find(Boolean) || "";
}

async function isCurrentSocketOwnerMessage(groupId, sock, message) {
  const ownIds = socketIdentityValues(sock);
  if (message?.key?.fromMe !== true || !ownIds.length) return false;
  const senderIds = messageSenderIds(message, "");
  if (!senderIds.length) return true;
  const resolved = await resolvedMessageSenderIds(message, "", sock);
  if (resolved.some((sender) => ownIds.some((own) => sameWhatsAppIdentity(sender, own)))) return true;

  if (typeof sock?.groupMetadata !== "function") return false;
  try {
    const metadata = await sock.groupMetadata(groupId);
    return (metadata?.participants || []).some((participant) => {
      const identities = participantIdentityValues(participant);
      return identities.some((identity) => senderIds.some((sender) => sameWhatsAppIdentity(identity, sender))) &&
        identities.some((identity) => ownIds.some((own) => sameWhatsAppIdentity(identity, own)));
    });
  } catch {
    return false;
  }
}

async function ownerMemberId(groupId, sock, message) {
  const ownIds = socketIdentityValues(sock);
  const senderIds = await resolvedMessageSenderIds(message, "", sock);
  const primarySender = participantId(message);
  if (primarySender && senderIds.some((sender) => ownIds.some((own) => sameWhatsAppIdentity(sender, own)))) {
    return normalizeWhatsAppAddress(primarySender);
  }

  if (typeof sock?.groupMetadata === "function") {
    try {
      const metadata = await sock.groupMetadata(groupId);
      const participant = (metadata?.participants || []).find((entry) =>
        participantIdentityValues(entry).some((identity) =>
          ownIds.some((own) => sameWhatsAppIdentity(identity, own))
        )
      );
      const id = participant?.id || participant?.jid || participant?.pn || participant?.lid;
      if (id) return normalizeWhatsAppAddress(id);
    } catch {
      // Fall through to the linked socket identity so a metadata outage does not block commands.
    }
  }

  const linkedId = [sock?.user?.pn, sock?.user?.id, sock?.user?.jid, sock?.user?.lid]
    .find(Boolean);
  return normalizeWhatsAppAddress(linkedId);
}

async function isGroupWorldOwner(groupId, userId, sock) {
  const group = await groupWorldService.getGroup(groupId);
  if (group.ownerId && String(group.ownerId) === String(userId || "")) return true;
  const savedPhone = String(group.ownerPhoneNumber || "").replace(/\D/g, "");
  const linkedPhone = socketPhoneNumber(sock);
  return Boolean(savedPhone && linkedPhone && savedPhone === linkedPhone);
}

function groupAdmin(metadata, memberId) {
  const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const participant = participants.find((item) =>
    [item?.id, item?.jid, item?.pn, item?.phoneNumber, item?.lid].some((value) => sameMember(value, memberId))
  );
  return participant?.admin === "admin" || participant?.admin === "superadmin" || participant?.isAdmin === true;
}

function messageSenderIds(message, primaryId) {
  const key = message?.key || {};
  return [...new Set([
    primaryId,
    key.participant,
    key.participantAlt,
    key.participantPn,
    message?.participant,
  ].filter(Boolean).map(String))];
}

async function canManageFromChat(groupId, message, memberId, metadata, permission, sock, isBotOwner = false) {
  if (isBotOwner) return true;
  const candidates = await resolvedMessageSenderIds(message, memberId, sock);
  if (candidates.some((candidate) => groupAdmin(metadata, candidate))) return true;
  for (const candidate of candidates) {
    if (await groupWorldService.hasPermission(groupId, candidate, permission)) return true;
  }
  return false;
}

function ownAccountIsAdmin(sock, metadata) {
  const own = [sock?.user?.id, sock?.user?.jid, sock?.user?.pn, sock?.user?.lid].filter(Boolean);
  return own.some((id) => groupAdmin(metadata, id));
}

async function sendText(sock, groupId, text) {
  const content = String(text || "").trim();
  if (!content) return;
  let remaining = content;
  const chunks = [];
  while (remaining.length > MAX_REPLY_LENGTH && chunks.length < 19) {
    let cut = remaining.lastIndexOf("\n", MAX_REPLY_LENGTH);
    if (cut < Math.floor(MAX_REPLY_LENGTH * 0.55)) cut = MAX_REPLY_LENGTH;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, "");
  }
  if (remaining.length > MAX_REPLY_LENGTH) {
    remaining = `${remaining.slice(0, MAX_REPLY_LENGTH - 35)}\n… تم اختصار بقية النتائج.`;
  }
  if (remaining) chunks.push(remaining);
  for (const chunk of chunks) await sock.sendMessage(groupId, { text: chunk });
}

async function sendTestList(sock, groupId) {
  return sendInteractiveMessage(
    sock,
    groupId,
    createListMessage({
      title: "قائمة الاختبار",
      description: "اختر خيارًا تفاعليًا. سيعرض البوت معرّف الخيار الذي وصل إليه.",
      buttonText: "فتح الخيارات",
      footer: "عالم المجموعة",
      sections: [{
        title: "خيارات الاختبار",
        rows: [
          { id: "gw:v1:menu:choice:points", title: "عرض النقاط", description: "يعرض رصيدك الحالي" },
          { id: "gw:v1:menu:choice:profile", title: "عرض الملف", description: "يعرض بيانات ملفك" },
          { id: "gw:v1:menu:choice:games", title: "قائمة الألعاب", description: "يعرض الألعاب المتاحة" },
          { id: "gw:v1:menu:choice:echo", title: "اختبار المعرّف", description: "يعرض المعرّف المستلم للاختيار" },
        ],
      }],
    }),
  );
}

async function handleInteractiveSelection(sock, groupId, memberId, selection, message, userId) {
  const id = String(selection?.id || "");
  if (id === "gw:v1:menu:open") {
    await sendTestList(sock, groupId);
    return { handled: true, action: "menu_open" };
  }
  if (id.startsWith("gw:v1:menu:choice:")) {
    const choiceId = id.slice("gw:v1:menu:choice:".length);
    const profile = await groupWorldService.getMemberProfile(groupId, memberId);
    if (choiceId === "points") {
      await sendText(sock, groupId, `اختيارك: ${id}\nرصيدك: ${Number(profile?.balance || 0).toLocaleString("ar")} نقطة.`);
    } else if (choiceId === "profile") {
      await sendText(sock, groupId, `اختيارك: ${id}\n${profile?.name || memberId.split("@")[0]} · المستوى ${profile?.level || 1} · XP ${profile?.xp || 0}.`);
    } else if (choiceId === "games") {
      await sendText(sock, groupId, `اختيارك: ${id}\nالألعاب المتاحة: XO، التحديات، صيد الكلمات، العجلة المجانية.`);
    } else {
      await sendText(sock, groupId, `تم استلام معرّف الاختيار:\n${id}`);
    }
    return { handled: true, action: "menu_choice", choiceId };
  }
  const xoMove = id.match(/^gw:v1:xo:move:([A-Za-z0-9_-]{3,80}):([0-8])$/);
  if (xoMove) {
    const result = await activityService.moveXo(groupId, xoMove[1], memberId, Number(xoMove[2]));
    await sendXoBoard(sock, groupId, result.game);
    return { handled: true, action: "xo_move", game: result.game };
  }
  const xoCancel = id.match(/^gw:v1:xo:cancel:([A-Za-z0-9_-]{3,80})$/);
  if (xoCancel) {
    const game = await activityService.cancelXo(groupId, xoCancel[1], memberId);
    await sendText(sock, groupId, `أُلغيت مباراة XO ${game.id}.`);
    return { handled: true, action: "xo_cancel" };
  }
  const xoReplay = id.match(/^gw:v1:xo:rematch:([A-Za-z0-9_-]{3,80})$/);
  if (xoReplay) {
    const game = await activityService.rematchXo(groupId, xoReplay[1], memberId);
    await sendXoBoard(sock, groupId, game);
    return { handled: true, action: "xo_rematch", game };
  }
  const bossAction = id.match(/^gw:v1:boss:(start|join|attack):([A-Za-z0-9_-]{3,80})$/);
  if (bossAction) {
    if (bossAction[1] === "start") await rpgService.startBoss(groupId, memberId);
    else await rpgService.bossAction(groupId, memberId, bossAction[1], bossAction[2]);
    return sendBossBoard(sock, groupId);
  }
  if (id === "gw:v1:games:treasure") {
    const treasure = await rpgService.startTreasure(groupId, memberId);
    await sendTreasureBoard(sock, groupId, treasure);
    return { handled: true, action: "treasure_start" };
  }
  if (id === "gw:v1:games:boss") {
    await rpgService.startBoss(groupId, memberId);
    return sendBossBoard(sock, groupId);
  }
  if (id === "gw:v1:games:wordhunt") {
    const hunt = await rpgService.startWordHunt(groupId, memberId);
    await sendText(sock, groupId, `بدأ صيد الكلمات! تلميح البداية: ${hunt.pattern}\nاكتب تخمينك في المجموعة قبل انتهاء المؤقت.`);
    return { handled: true, action: "word_hunt_start" };
  }
  if (id === "gw:v1:games:dungeon") {
    const dungeon = await rpgService.startDungeon(groupId, memberId);
    await sendText(sock, groupId, `بدأت المغامرة — المرحلة ${dungeon.stage}/${5}\n${dungeon.prompt}\nأرسل إجابتك في المجموعة.`);
    return { handled: true, action: "dungeon_start" };
  }
  if (id === "gw:v1:games:wheel") {
    const spin = await rpgService.spinWheel(groupId, memberId);
    await sendText(sock, groupId, `نتيجة عجلة الحظ المجانية: ${spin.prize} نقطة. المحاولات المتبقية اليوم: ${spin.remaining}.`);
    return { handled: true, action: "wheel_spin" };
  }
  if (id === "gw:v1:games:tournament") {
    const tournament = await rpgService.registerTournament(groupId, memberId);
    await sendText(sock, groupId, `تم تسجيلك في ${tournament.title}. عدد المشاركين: ${tournament.participants.length}.`);
    return { handled: true, action: "tournament_register" };
  }
  if (id === "gw:v1:games:xo") {
    await sendText(sock, groupId, "لبدء مباراة، اكتب: .اكس_او @الخصم");
    return { handled: true, action: "xo_help" };
  }
  if (id === "gw:v1:games:challenge") {
    await sendText(sock, groupId, "لبدء تحدٍ، اكتب: .تحدي @الخصم");
    return { handled: true, action: "challenge_help" };
  }
  const treasureHint = id.match(/^gw:v1:treasure:hint:[A-Za-z0-9_-]{3,80}$/);
  if (treasureHint) {
    const hint = await rpgService.revealTreasureHint(groupId, memberId);
    await sendText(sock, groupId, `تلميح الكنز: ${hint.hint}`);
    return { handled: true, action: "treasure_hint" };
  }
  const templateAction = id.match(/^gw:v1:template:(template-[a-f0-9]{16})$/);
  if (templateAction) {
    const stored = await groupWorldService.runGroupTransaction(groupId, (state) => {
      const actions = state.gameData.interactionActions || [];
      const index = actions.findIndex((item) => item.id === templateAction[1] && item.expiresAt > Date.now());
      if (index < 0) return null;
      return actions.splice(index, 1)[0];
    });
    if (!stored) return sendText(sock, groupId, "انتهت صلاحية هذا الزر. أرسل الأمر مرة أخرى.");
    const response = String(stored.response || "").trim();
    if (response.startsWith(".")) {
      return commandReply(
        sock,
        groupId,
        memberId,
        { ...message, key: { ...message?.key, fromMe: message?.key?.fromMe === true } },
        response,
        false,
        userId,
      );
    }
    await sendText(sock, groupId, response || "تم تنفيذ الاختيار.");
    return { handled: true, action: "template_button" };
  }
  if (id.startsWith("gw:v1:help:")) {
    const section = id.slice("gw:v1:help:".length);
    return sendHelpSection(sock, groupId, section);
  }
  return null;
}

async function sendGamesList(sock, groupId) {
  const group = await groupWorldService.getGroup(groupId);
  const allOptions = [
    ["xo", "لعبة XO", "مباراة 3×3 ضد عضو آخر", group.modules.ticTacToe],
    ["challenge", "تحديات الأعضاء", "15 نوعًا من التحديات الآلية", group.modules.challenges],
    ["boss", "زعيم المجموعة", "تعاونوا لهزيمة الوحش", group.modules.bossRaid],
    ["treasure", "البحث عن الكنز", "ألغاز وتلميحات ومكافأة للفائز", group.modules.treasureHunt],
    ["dungeon", "الأبراج المحصنة", "خمس مراحل متصاعدة من الأسئلة", group.modules.dungeons],
    ["tournament", "دوري الأبطال", "سجّل ونافس في مباريات الإقصاء", group.modules.tournaments],
    ["wordhunt", "صيد الكلمات", "اكتشف الكلمة السرية من التلميح", group.modules.wordHunt],
    ["wheel", "عجلة الحظ المجانية", "محاولة مجانية ومكافآت افتراضية", group.modules.luckyWheel],
  ].filter(([, , , enabled]) => enabled);
  return sendInteractiveMessage(
    sock,
    groupId,
    createListMessage({
      title: "ألعاب عالم المجموعة",
      description: "اختر لعبة لبدئها أو لمعرفة طريقة اللعب.",
      buttonText: "عرض الألعاب",
      footer: "تُحفظ النتائج لكل مجموعة",
      sections: [{
        title: "الألعاب المتاحة",
        rows: allOptions.map(([key, title, description]) => ({
          id: `gw:v1:games:${key}`,
          title,
          description,
        })),
      }],
    }),
  );
}

async function sendHelpMenu(sock, groupId) {
  return sendInteractiveMessage(
    sock,
    groupId,
    createListMessage({
      title: "مساعدة عالم المجموعة",
      description: "اختر قسمًا لعرض أوامره المتاحة.",
      buttonText: "أقسام المساعدة",
      footer: "قائمة تفاعلية",
      sections: [{
        title: "الأقسام",
        rows: [
          { id: "gw:v1:help:points", title: "النقاط والهدايا", description: "الرصيد والصدارة والمكافآت" },
          { id: "gw:v1:help:pets", title: "الحيوانات والمتجر", description: "القدرات والاقتناء والترقية" },
          { id: "gw:v1:help:games", title: "الألعاب والمغامرات", description: "XO والكنز والزعيم والدوري" },
          { id: "gw:v1:help:challenges", title: "التحديات", description: "إنشاء التحديات وقبولها" },
          { id: "gw:v1:help:profile", title: "الملف والفرق", description: "معلومات اللاعب والنقابات" },
          { id: "gw:v1:help:admin", title: "إدارة العالم", description: "التفعيل والأوامر الإدارية" },
        ],
      }],
    }),
  );
}

async function sendTemplate(sock, groupId, template, values) {
  const rendered = renderMessageTemplate(template, values);
  if (rendered.buttons.length) {
    const actions = rendered.buttons.slice(0, 20);
    const buttons = [];
    for (const [index, button] of actions.entries()) {
      const token = `template-${randomBytes(8).toString("hex")}`;
      await groupWorldService.runGroupTransaction(groupId, (state) => {
        state.gameData.interactionActions ||= [];
        state.gameData.interactionActions.push({
          id: token,
          response: String(button.response || "").slice(0, 2_000),
          expiresAt: Date.now() + 7 * 24 * 60 * 60_000,
        });
        if (state.gameData.interactionActions.length > 500) {
          state.gameData.interactionActions.splice(0, state.gameData.interactionActions.length - 500);
        }
      });
      buttons.push({ id: `gw:v1:template:${token}`, label: button.label || `اختيار ${index + 1}` });
    }
    const imageMessage = rendered.image ? await prepareInteractiveImage(sock, rendered.image) : null;
    await sendInteractiveMessage(
      sock,
      groupId,
      createQuickReplyMessage(rendered.text, buttons, "عالم المجموعة", imageMessage),
    );
  } else if (rendered.image) {
    await sock.sendMessage(groupId, {
      image: { url: rendered.image },
      caption: String(rendered.text || "").slice(0, MAX_REPLY_LENGTH),
    });
  } else {
    await sendText(sock, groupId, rendered.text);
  }
  return true;
}

function boardText(game) {
  const symbol = (index) => game.board[index] || String(index + 1);
  return [
    `لعبة XO · ${game.id}`,
    `${game.xPlayer.split("@")[0]} (X) ضد ${game.oPlayer.split("@")[0]} (O)`,
    `${symbol(0)} │ ${symbol(1)} │ ${symbol(2)}`,
    "───┼───┼───",
    `${symbol(3)} │ ${symbol(4)} │ ${symbol(5)}`,
    "───┼───┼───",
    `${symbol(6)} │ ${symbol(7)} │ ${symbol(8)}`,
    game.status === "active"
      ? `الدور الآن: ${game.currentPlayer === game.xPlayer ? "X" : "O"}`
      : game.status === "draw"
        ? "انتهت المباراة بالتعادل."
        : game.status === "won"
          ? `الفائز: ${game.winnerId === game.xPlayer ? "X" : "O"}`
          : "انتهت المباراة.",
  ].join("\n");
}

async function sendXoBoard(sock, groupId, game) {
  const buttons = [];
  if (game.status === "active") {
    for (const index of game.board.keys()) {
      if (!game.board[index]) buttons.push({ id: `gw:v1:xo:move:${game.id}:${index}`, label: `الخانة ${index + 1}` });
    }
    if (!game.tournamentId) buttons.push({ id: `gw:v1:xo:cancel:${game.id}`, label: "إلغاء المباراة" });
  } else if (["won", "draw", "cancelled"].includes(game.status)) {
    buttons.push({ id: `gw:v1:xo:rematch:${game.id}`, label: "إعادة اللعب" });
  }
  if (buttons.length) {
    await sendInteractiveMessage(sock, groupId, createQuickReplyMessage(boardText(game), buttons, "اضغط خانة للعب"));
  } else {
    await sendText(sock, groupId, boardText(game));
  }
}

async function sendBossBoard(sock, groupId) {
  const boss = await rpgService.getBoss(groupId);
  if (!boss) return sendText(sock, groupId, "لا يوجد زعيم للمجموعة حاليًا.");
  const buttons = boss.status === "active"
    ? [
      { id: `gw:v1:boss:join:${boss.id}`, label: "انضم للغارة" },
      { id: `gw:v1:boss:attack:${boss.id}`, label: "هاجم الزعيم" },
    ]
    : [];
  const content = `زعيم المجموعة — المستوى ${boss.level}\nالصحة: ${boss.health}/${boss.maxHealth}\nالمشاركون: ${boss.participants.length}`;
  if (buttons.length) {
    await sendInteractiveMessage(sock, groupId, createQuickReplyMessage(content, buttons, "كل هجوم يساهم في إسقاطه"));
  } else {
    await sendText(sock, groupId, `${content}\nالحالة: ${boss.status === "defeated" ? "تمت هزيمته" : boss.status}`);
  }
}

async function sendTreasureBoard(sock, groupId, treasure) {
  const buttons = [{ id: `gw:v1:treasure:hint:${treasure.id}`, label: "تلميح جديد" }];
  await sendInteractiveMessage(
    sock,
    groupId,
    createQuickReplyMessage(
      `بدأ البحث عن الكنز!\n${treasure.hints[treasure.hintIndex]}\nاكتب إجابتك في المجموعة قبل انتهاء المؤقت.`,
      buttons,
      "أول إجابة صحيحة تفوز",
    ),
  );
}

async function sendHelpSection(sock, groupId, section) {
  const commands = await groupWorldService.getPublicCommands(groupId);
  const groups = {
    points: [".نقاطي", ".نقاط الكل", ".صدارة", ".هدية", ".هدية اسبوعية"],
    pets: [".حيواني", ".حيواناتي", ".قدرات الحيوان", ".متجر", ".شراء", ".ترقية حيواني"],
    games: [".الألعاب", ".اكس_او @الخصم", ".مغامرة", ".كنز", ".زعيم", ".بطولتي", ".صيد_الكلمات", ".عجلة"],
    challenges: [".تحدي @الشخص", ".قبول @المتحدي اسم_التحدي", ".رفض @المتحدي", ".تحدياتي", ".إلغاء التحدي"],
    admin: [".تفعيل العالم", ".تعطيل العالم", ".تحديث القائمة", ".تزويد"],
    profile: [".عالمي", ".ملفي", ".فريقي", ".الفرق", ".مساعدة"],
  };
  const labels = {
    points: "النقاط والهدايا",
    pets: "الحيوانات والمتجر",
    games: "الألعاب والمغامرات",
    challenges: "التحديات",
    admin: "إدارة العالم",
    profile: "الملف والفرق",
  };
  const listed = (groups[section] || []).filter((command) => commands.includes(command.split(" ")[0]));
  await sendText(sock, groupId, `${labels[section] || "مساعدة"}:\n${listed.length ? listed.join("\n") : "لا توجد أوامر مفعلة في هذا القسم."}`);
  return { handled: true, action: "help", section };
}

function mentionedMemberId(message, text = "") {
  const content = message?.message?.extendedTextMessage?.contextInfo;
  const mention = content?.mentionedJid?.[0];
  if (mention) return String(mention);
  const digits = String(text || "").match(/@(\d{5,20})/);
  return digits ? `${digits[1]}@s.whatsapp.net` : "";
}

function accountIdFromMessage(message) {
  return participantId(message);
}

async function getTemplateValues(sock, groupId, memberId, profile, includeImage = false) {
  const safeProfile = profile || {
    balance: 0,
    name: memberId.split("@")[0],
    rank: { name: "مبتدئ" },
    position: null,
    totalEarned: 0,
    totalSpent: 0,
    activePet: null,
    nextPoints: 0,
  };
  const all = await groupWorldService.getMembers(groupId);
  let image = null;
  if (includeImage && typeof sock?.profilePictureUrl === "function") {
    try {
      image = await sock.profilePictureUrl(memberId, "image");
    } catch {
      image = null;
    }
  }
  return {
    points: safeProfile.balance,
    name: safeProfile.name || memberId.split("@")[0],
    time: new Intl.DateTimeFormat("ar", {
      timeZone: "Africa/Khartoum",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
    image,
    allMembers: all.map((entry, index) => `${index + 1}. ${entry.name}: ${entry.balance}`).join("\n"),
    rank: safeProfile.rank?.name || "مبتدئ",
    position: safeProfile.position || "—",
    earned: safeProfile.totalEarned,
    spent: safeProfile.totalSpent,
    pet: safeProfile.activePet?.catalog?.name || "لا يوجد",
    nextPoints: safeProfile.nextPoints || 0,
  };
}

function formatMemberLine(member, index) {
  const name = String(member.name || member.memberId.split("@")[0]).slice(0, 32);
  return `${index + 1}. ${name} — ${Number(member.balance).toLocaleString("ar")} نقطة · ${member.rank?.name || "مبتدئ"}`;
}

async function commandReply(sock, groupId, memberId, message, text, isBotOwner = false, userId = "") {
  const commandToken = text.trim().split(/\s+/)[0];
  const args = text.trim().slice(commandToken.length).trim();
  const name = message?.pushName || "";
  if (commandToken === ".تفعيل" && args === "العالم") {
    const permitted = isBotOwner ||
      message?.key?.fromMe === true ||
      await groupWorldService.hasPermission(groupId, memberId, "settings");
    if (!permitted) return sendText(sock, groupId, "تفعيل العالم متاح لمالك النظام أو للمستخدم المخوّل بإدارته فقط.");
    const metadata = await sock.groupMetadata(groupId);
    const members = (metadata?.participants || []).map((participant) => ({
      memberId: participant.id || participant.jid || participant.pn || participant.lid,
      name: participant.notify || participant.name || "",
    })).filter((participant) => participant.memberId);
    const result = await groupWorldService.activateGroup({
      groupId,
      ownerId: String(userId || memberId),
      ownerPhoneNumber: socketPhoneNumber(sock),
      members,
      actor: memberId,
    });
    return sendText(sock, groupId, `تم تفعيل عالم المجموعة دون اشتراط إشراف البوت. تمت تهيئة ${result.seededMembers} عضوًا.`);
  }

  if (commandToken === ".تعطيل" && args === "العالم") {
    const permitted = isBotOwner ||
      message?.key?.fromMe === true ||
      await groupWorldService.hasPermission(groupId, memberId, "settings");
    if (!permitted) return sendText(sock, groupId, "تعطيل العالم متاح لمالك النظام أو للمستخدم المخوّل بإدارته فقط.");
    await groupWorldService.setEnabled(groupId, false, memberId, "تعطيل بأمر WhatsApp");
    return sendText(sock, groupId, "تم تعطيل عالم هذه المجموعة. بقيت الأرصدة والبيانات محفوظة.");
  }

  await groupWorldService.ensureMember(groupId, memberId, name);
  const profile = await groupWorldService.getMemberProfile(groupId, memberId);
  const argsList = args.split(/\s+/).filter(Boolean);

  if (commandToken === ".الألعاب" || commandToken === ".العاب") {
    return sendGamesList(sock, groupId);
  }

  if (commandToken === ".مساعدة") {
    return sendHelpMenu(sock, groupId);
  }

  if (commandToken === ".اكس_او") {
    const opponentId = mentionedMemberId(message, args);
    if (!opponentId) return sendText(sock, groupId, "استخدم منشن الخصم: .اكس_او @الخصم");
    const metadata = await sock.groupMetadata(groupId);
    const opponent = (metadata.participants || []).find((item) =>
      [item.id, item.jid, item.pn, item.lid].some((value) => sameMember(value, opponentId))
    );
    if (!opponent) return sendText(sock, groupId, "يجب أن يكون الخصم عضوًا حاليًا في المجموعة.");
    const resolvedOpponent = opponent.id || opponent.jid || opponent.pn || opponent.lid;
    await groupWorldService.ensureMember(groupId, resolvedOpponent, opponent.notify || opponent.name || "");
    const game = await activityService.startXo(groupId, memberId, resolvedOpponent);
    await sock.sendMessage(groupId, {
      text: `بدأت مباراة XO بين @${memberId.split("@")[0]} و@${resolvedOpponent.split("@")[0]}.`,
      mentions: [memberId, resolvedOpponent],
    });
    await sendXoBoard(sock, groupId, game);
    return { started: true, game };
  }

  if (commandToken === ".قدرات" && argsList[0] === "الحيوان") {
    const group = await groupWorldService.getGroup(groupId);
    const requested = argsList.slice(1).join(" ").trim();
    const ownedPet = !requested
      ? profile.activePet
      : null;
    const petId = ownedPet?.petId || (requested
      ? group.catalogs.pets.find((item) =>
        item.id.toLowerCase() === requested.toLowerCase() ||
        item.name.toLowerCase() === requested.toLowerCase()
      )?.id
      : null);
    const pet = group.catalogs.pets.find((item) => item.id === petId);
    if (!pet) {
      return sendText(sock, groupId, requested
        ? "الحيوان غير موجود في متجر هذه المجموعة."
        : "لا تملك حيوانًا نشطًا. استخدم .قدرات الحيوان التنين لعرض قدراته قبل الشراء.");
    }
    const owned = profile.pets.find((item) => item.petId === pet.id);
    const level = owned?.level || 1;
    const levelInfo = Array.isArray(pet.levels) ? pet.levels.find((item) => Number(item.level) === level) : null;
    const nextCost = owned && level < 5
      ? Math.ceil(Number(pet.price) * 0.35 * level)
      : null;
    return sendText(sock, groupId, [
      `${pet.icon || "🐾"} ${pet.name}`,
      pet.abilityDescription || pet.description || `القدرة: ${pet.ability || "غير محددة"}`,
      `قيمة القدرة: ${levelInfo?.value ?? pet.value ?? 0}`,
      `السعر: ${Number(pet.price || 0).toLocaleString("ar")} نقطة`,
      `المستوى: ${owned ? `${level}/5` : "قبل الشراء"}`,
      nextCost ? `تكلفة الترقية التالية: ${nextCost.toLocaleString("ar")} نقطة` : "أعلى مستوى متاح أو لم يتم اقتناء الحيوان.",
    ].join("\n"));
  }

  if (commandToken === ".عالمي") {
    return sendText(sock, groupId, [
      `العالم: ${profile.name || name || "لاعب"}`,
      `النقاط: ${Number(profile.balance).toLocaleString("ar")} · XP: ${profile.xp} · المستوى ${profile.level}`,
      `الرتبة: ${profile.rank?.icon || "⭐"} ${profile.rank?.name || "مبتدئ"} · المركز ${profile.position || "—"}`,
      `الرسائل: ${profile.messages} · السلسلة: ${profile.streak} يوم`,
      `الحيوان: ${profile.activePet?.catalog?.name || "لا يوجد"} · الإنجازات: ${profile.achievements.length}`,
    ].join("\n"));
  }

  if (commandToken === ".نقاطي") {
    return sendText(sock, groupId, [
      `${profile.name || name || "عضو"}`,
      `الرصيد: ${profile.balance.toLocaleString("ar")} نقطة`,
      `الرتبة: ${profile.rank?.icon || "⭐"} ${profile.rank?.name || "مبتدئ"}`,
      `الترتيب: ${profile.position || "—"} · التالي بعد ${profile.nextPoints || 0} نقطة`,
      `المستوى: ${profile.level} · XP: ${profile.xp}`,
    ].join("\n"));
  }

  if (commandToken === ".نقاط" && args === "الكل") {
    const members = await groupWorldService.getMembers(groupId);
    return sendText(sock, groupId, members.length
      ? `نقاط أعضاء المجموعة:\n${members.map(formatMemberLine).join("\n")}`
      : "لا توجد أرصدة مسجّلة بعد.");
  }

  if (commandToken === ".هدية" && !args) {
    const gift = await groupWorldService.claimGiftForMember(groupId, memberId, "daily", name);
    return sendText(sock, groupId, `استلمت ${gift.amount.toLocaleString("ar")} نقطة. رصيدك الآن ${gift.balance.toLocaleString("ar")}.`);
  }

  if (commandToken === ".هدية" && ["اسبوعية", "أسبوعية"].includes(args)) {
    const gift = await groupWorldService.claimGiftForMember(groupId, memberId, "weekly", name);
    return sendText(sock, groupId, `استلمت ${gift.amount.toLocaleString("ar")} نقطة أسبوعية. رصيدك الآن ${gift.balance.toLocaleString("ar")}.`);
  }

  if (commandToken === ".صدارة") {
    const period = /شهر/i.test(args) ? "monthly" : /اسبوع|أسبوع/i.test(args) ? "weekly" : /يوم/i.test(args) ? "daily" : "all";
    const title = { daily: "اليومية", weekly: "الأسبوعية", monthly: "الشهرية", all: "العامة" }[period];
    const leaders = await groupWorldService.getLeaderboard(groupId, period, 10);
    return sendText(sock, groupId, leaders.length
      ? `الصدارة ${title}:\n${leaders.map((entry, index) => `${index + 1}. ${entry.name} — ${Number(entry.score).toLocaleString("ar")}`).join("\n")}`
      : `لا توجد نتائج للصدارة ${title} بعد.`);
  }

  if (commandToken === ".متجر") {
    const group = await groupWorldService.getGroup(groupId);
    const pets = group.catalogs.pets.filter((pet) => pet.enabled !== false);
    const items = group.catalogs.items.filter((item) => item.enabled !== false).slice(0, 10);
    return sendText(sock, groupId, [
      "متجر عالم المجموعة",
      "الحيوانات — للشراء اكتب .شراء <معرّف>",
      ...pets.map((pet) => `${pet.icon} ${pet.name} — ${Number(pet.price).toLocaleString("ar")} · ${pet.id}`),
      "العناصر",
      ...items.map((item) => `${item.icon} ${item.name} — ${Number(item.price).toLocaleString("ar")} · ${item.id}`),
    ].join("\n"));
  }

  if (commandToken === ".شراء" && args) {
    const pet = profile.pets.find((item) => item.petId === args);
    if (pet) return sendText(sock, groupId, "تملك هذا الحيوان بالفعل.");
    const group = await groupWorldService.getGroup(groupId);
    if (group.catalogs.pets.some((item) => item.id === args && item.enabled !== false)) {
      const result = await groupWorldService.purchasePet(groupId, memberId, args, name);
      return sendText(sock, groupId, `تم شراء ${result.pet.name}. رصيدك ${result.balance.toLocaleString("ar")}.`);
    }
    const result = await groupWorldService.purchaseItem(groupId, memberId, args);
    return sendText(sock, groupId, `تم شراء ${result.item.name}. رصيدك ${result.balance.toLocaleString("ar")}.`);
  }

  if (commandToken === ".حيواني") {
    const pet = profile.activePet;
    return sendText(sock, groupId, pet
      ? `${pet.catalog?.icon || "🐾"} ${pet.catalog?.name || pet.petId} · المستوى ${pet.level}\nالقدرة: ${pet.catalog?.ability || "نشاط"}`
      : "ليس لديك حيوان نشط. استخدم .متجر لعرض الحيوانات.");
  }

  if (commandToken === ".حيواناتي") {
    return sendText(sock, groupId, profile.pets.length
      ? `حيواناتك:\n${profile.pets.map((pet) => `${pet.catalog?.icon || "🐾"} ${pet.catalog?.name || pet.petId} · مستوى ${pet.level}${profile.activePetId === pet.petId ? " (نشط)" : ""}`).join("\n")}`
      : "لا تملك حيوانات بعد.");
  }

  if (commandToken === ".تفعيل" && argsList[0] === "حيوان" && argsList[1]) {
    const result = await groupWorldService.activatePet(groupId, memberId, argsList[1]);
    return sendText(sock, groupId, `تم تغيير حيوانك النشط إلى ${result.activePetId}.`);
  }

  if (commandToken === ".ترقية" && ["حيواني", "حيوان"].includes(args)) {
    const result = await groupWorldService.upgradePet(groupId, memberId);
    return sendText(sock, groupId, `تمت الترقية إلى المستوى ${result.pet.level} مقابل ${result.cost.toLocaleString("ar")} نقطة.`);
  }

  if (commandToken === ".مهامي") {
    const group = await groupWorldService.getGroup(groupId);
    const dayKey = groupWorldDayKey(new Date());
    const weekKey = groupWorldWeekKey(new Date());
    const daily = group.settings.dailyTasks.map((task) => {
      const progress = profile.taskProgress?.daily?.[dayKey]?.[task.id]?.count || 0;
      return `• ${task.name}: ${Math.min(progress, task.target)}/${task.target} · ${task.reward} نقطة`;
    });
    const weekly = group.settings.weeklyTasks.map((task) => {
      const progress = profile.taskProgress?.weekly?.[weekKey]?.[task.id]?.count || 0;
      return `• ${task.name}: ${Math.min(progress, task.target)}/${task.target} · ${task.reward} نقطة`;
    });
    return sendText(sock, groupId, ["مهام اليوم:", ...daily, "مهام الأسبوع:", ...weekly].join("\n"));
  }

  if (commandToken === ".انجازاتي") {
    const names = {
      "first-message": "أول رسالة",
      "messages-100": "مئة رسالة",
      "messages-1000": "ألف رسالة",
      "streak-7": "سلسلة أسبوع",
      "pet-owner": "أول حيوان",
    };
    return sendText(sock, groupId, profile.achievements.length
      ? `إنجازاتك:\n${profile.achievements.map((item) => `🏅 ${names[item] || item}`).join("\n")}`
      : "لم تحصل على إنجازات بعد.");
  }

  if (commandToken === ".ملفي") {
    return sendText(sock, groupId, [
      `الملف الشخصي: ${profile.name || name || "عضو"}`,
      `${profile.rank?.icon || "⭐"} ${profile.rank?.name || "مبتدئ"} · المركز ${profile.position || "—"}`,
      `النقاط ${profile.balance} · XP ${profile.xp} · المستوى ${profile.level}`,
      `الرسائل ${profile.messages} · السلسلة ${profile.streak} يوم`,
      `المكتسب ${profile.totalEarned} · المصروف ${profile.totalSpent}`,
      `الحيوان ${profile.activePet?.catalog?.name || "لا يوجد"} · الإنجازات ${profile.achievements.length}`,
    ].join("\n"));
  }

  if (commandToken === ".حقيبتي") {
    const items = profile.inventory.map((item) => `${item.itemId} ×${item.quantity}`);
    const pets = profile.pets.map((pet) => `${pet.catalog?.icon || "🐾"} ${pet.catalog?.name || pet.petId}`);
    return sendText(sock, groupId, [
      "حقيبتك:",
      `الحيوانات: ${pets.length ? pets.join("، ") : "لا يوجد"}`,
      `المقتنيات: ${items.length ? items.join("، ") : "لا يوجد"}`,
      `اللقب: ${profile.titleItemId || "لا يوجد"} · الإطار: ${profile.frameItemId || "لا يوجد"}`,
    ].join("\n"));
  }

  if (commandToken === ".فريقي") {
    const guild = await rpgService.getMemberGuild(groupId, memberId);
    if (guild) {
      return sendText(sock, groupId, `${guild.icon} ${guild.name} · المستوى ${guild.level}\nالأعضاء: ${guild.members.length}\nالمخزون الجماعي: ${JSON.stringify(guild.inventory || {})}`);
    }
    const team = (await groupWorldService.getGroup(groupId)).teams.find((item) => item.id === profile.teamId);
    return sendText(sock, groupId, team ? `فريقك: ${team.title}` : "لست ضمن فريق حاليًا.");
  }

  if (commandToken === ".تحدي") {
    const opponentId = mentionedMemberId(message, args);
    if (!opponentId) return sendText(sock, groupId, "استخدم منشن الخصم: .تحدي @الشخص");
    const metadata = await sock.groupMetadata(groupId);
    const opponent = (metadata.participants || []).find((item) =>
      [item.id, item.jid, item.pn, item.lid].some((value) => sameMember(value, opponentId))
    );
    if (!opponent) return sendText(sock, groupId, "يجب أن يكون الخصم عضوًا حاليًا في المجموعة.");
    const resolvedOpponent = opponent.id || opponent.jid || opponent.pn || opponent.lid;
    await groupWorldService.ensureMember(groupId, resolvedOpponent, opponent.notify || opponent.name || "");
    const challenge = await activityService.createChallenge(groupId, memberId, resolvedOpponent);
    await sock.sendMessage(groupId, {
      text: `⚔️ تحدٍ جديد: ${challenge.typeName}\nالاسم الفريد: ${challenge.challengeName}\n@${memberId.split("@")[0]} تحدّى @${opponentId.split("@")[0]}.\nعلى الخصم القبول بكتابة:\n.قبول @المتحدي ${challenge.challengeName}`,
      mentions: [memberId, opponentId],
    });
    return challenge;
  }

  if (commandToken === ".قبول" && args) {
    const challengeName = argsList.find((item) => item.startsWith("THE_LEGENDARY_"));
    if (challengeName) {
      const challenger = mentionedMemberId(message, args);
      if (!challenger) return sendText(sock, groupId, "اذكر المتحدي واكتب الاسم الكامل للتحدي.");
      const challenge = await activityService.acceptChallenge(groupId, memberId, challenger, challengeName);
      await sock.sendMessage(groupId, {
        text: `بدأ ${challenge.challengeName} — ${challenge.typeName}\n${challenge.prompt}\nلديكما ${Math.max(10, Math.round((Date.parse(challenge.deadline) - Date.now()) / 1000))} ثانية.`,
        mentions: [challenge.challenger, challenge.opponent],
      });
      return challenge;
    }
    const challenge = await groupWorldService.acceptChallenge(groupId, args, memberId);
    return sendText(sock, groupId, `قُبل التحدي ${challenge.id}. يستطيع مشرف المجموعة تسويته بعد انتهائه.`);
  }

  if (commandToken === ".رفض") {
    const challenger = mentionedMemberId(message, args);
    if (!challenger) return sendText(sock, groupId, "استخدم: .رفض @المتحدي");
    const challenge = await activityService.rejectChallenge(groupId, memberId, challenger);
    return sendText(sock, groupId, `تم رفض التحدي ${challenge.challengeName}.`);
  }

  if (commandToken === ".تحدياتي") {
    const challenges = await activityService.listChallenges(groupId, memberId);
    return sendText(sock, groupId, challenges.length
      ? `تحدياتك الحالية:\n${challenges.map((item) => `${item.challengeName} · ${item.typeName} · ${item.status}`).join("\n")}`
      : "ليس لديك تحديات مفتوحة.");
  }

  if (commandToken === ".إلغاء" && args === "التحدي") {
    const challenge = await activityService.cancelChallenge(groupId, memberId);
    return sendText(sock, groupId, `تم إلغاء التحدي ${challenge.challengeName}.`);
  }

  if (commandToken === ".الفرق") {
    const guilds = await rpgService.getGuilds(groupId);
    return sendText(sock, groupId, guilds.length
      ? `ترتيب النقابات:\n${guilds.slice(0, 10).map((guild, index) => `${index + 1}. ${guild.icon} ${guild.name} · مستوى ${guild.level} · ${guild.members.length} عضو`).join("\n")}`
      : "لا توجد نقابات بعد. أنشئ نقابتك بالأمر .نقابة إنشاء <الاسم>.");
  }

  if (commandToken === ".نقابة") {
    if (argsList[0] === "إنشاء" || argsList[0] === "انشاء") {
      const guild = await rpgService.createGuild(groupId, memberId, argsList.slice(1).join(" "));
      return sendText(sock, groupId, `تأسست النقابة ${guild.icon} ${guild.name}. معرّف الانضمام: ${guild.id}`);
    }
    if (argsList[0] === "انضمام" && argsList[1]) {
      const guild = await rpgService.joinGuild(groupId, memberId, argsList[1]);
      return sendText(sock, groupId, `انضممت إلى النقابة ${guild.icon} ${guild.name}.`);
    }
    return sendText(sock, groupId, "استخدم .نقابة إنشاء <الاسم> أو .نقابة انضمام <المعرّف>.");
  }

  if (commandToken === ".مغامرة") {
    const dungeon = await rpgService.startDungeon(groupId, memberId);
    return sendText(sock, groupId, `الأبراج المحصنة — المرحلة ${dungeon.stage}/${5}\n${dungeon.prompt}\nأرسل إجابتك في المجموعة قبل انتهاء المهلة.`);
  }

  if (commandToken === ".كنز") {
    const treasure = await rpgService.startTreasure(groupId, memberId);
    return sendTreasureBoard(sock, groupId, treasure);
  }

  if (commandToken === ".زعيم") {
    const current = await rpgService.getBoss(groupId);
    if (!current || current.status !== "active") await rpgService.startBoss(groupId, memberId);
    return sendBossBoard(sock, groupId);
  }

  if (commandToken === ".بطولتي") {
    const tournament = await rpgService.getTournament(groupId, memberId);
    if (!tournament) return sendText(sock, groupId, "لا توجد بطولة نشطة أو سجل بطولة مرتبط بك. اكتب .بطولة تسجيل للانضمام.");
    const round = tournament.rounds?.at(-1);
    return sendText(sock, groupId, [
      `${tournament.title} · الحالة ${tournament.status}`,
      `المشاركون: ${tournament.participants.length}`,
      round ? `المرحلة الحالية: ${round.stage} · المباريات ${round.matches.length}` : "التسجيل مفتوح.",
      tournament.championId ? `البطل: ${tournament.championId}` : "",
    ].filter(Boolean).join("\n"));
  }

  if (commandToken === ".بطولة") {
    if (args === "تسجيل") {
      const tournament = await rpgService.registerTournament(groupId, memberId);
      return sendText(sock, groupId, `تم تسجيلك في ${tournament.title}. المشاركون: ${tournament.participants.length}.`);
    }
    if (args === "بدء") {
      const permitted = isBotOwner || await groupWorldService.hasPermission(groupId, memberId, "settings");
      if (!permitted) return sendText(sock, groupId, "بدء البطولة متاح لمالك العالم أو المشرف المخوّل فقط.");
      const tournament = await rpgService.startTournament(groupId);
      const games = tournament.rounds.at(-1)?.matches || [];
      await sendText(sock, groupId, `بدأت ${tournament.title} — ${tournament.rounds.at(-1)?.stage}. افتحوا .بطولتي لمتابعة الجدول.`);
      for (const match of games) {
        const game = await activityService.getXoGame(groupId, match.gameId);
        if (game) await sendXoBoard(sock, groupId, game);
      }
      return tournament;
    }
    return sendText(sock, groupId, "استخدم .بطولة تسجيل للمشاركة، ويستطيع مخوّل العالم تشغيلها بـ .بطولة بدء.");
  }

  if (commandToken === ".صيد_الكلمات") {
    const hunt = await rpgService.startWordHunt(groupId, memberId);
    return sendText(sock, groupId, `بدأ صيد الكلمات! التلميح: ${hunt.pattern}\nاكتب تخمينك في المجموعة قبل انتهاء المؤقت.`);
  }

  if (commandToken === ".عجلة") {
    const spin = await rpgService.spinWheel(groupId, memberId);
    return sendText(sock, groupId, `نتيجة عجلة الحظ المجانية: ${spin.prize} نقطة. المحاولات المتبقية اليوم: ${spin.remaining}.`);
  }

  if (commandToken === ".صناعة") {
    if (args) {
      const recipe = await rpgService.getRecipes(groupId);
      const recipeId = Object.keys(recipe).find((key) => key === args || recipe[key].name === args);
      if (!recipeId) return sendText(sock, groupId, "الوصفة غير موجودة. اكتب .صناعة لعرض الوصفات.");
      const result = await rpgService.craftItem(groupId, memberId, recipeId);
      return sendText(sock, groupId, `صنعت ${result.item}. مواردك الحالية: ${JSON.stringify(result.resources)}.`);
    }
    const recipes = await rpgService.getRecipes(groupId);
    return sendText(sock, groupId, `وصفات الصناعة:\n${Object.entries(recipes).map(([key, recipe]) => `${key}: ${recipe.name} — ${JSON.stringify(recipe.cost)}`).join("\n")}\nاستخدم .صناعة <معرّف الوصفة>.`);
  }
  if (commandToken === ".حسم" && args) {
    const mentioned = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) return sendText(sock, groupId, "استخدم منشن الفائز، مثل: .حسم <معرّف التحدي> @الفائز");
    const metadata = await sock.groupMetadata(groupId);
    if (!(await canManageFromChat(groupId, message, memberId, metadata, "points", sock, isBotOwner))) {
      return sendText(sock, groupId, "تسوية التحدي متاحة لمشرفي المجموعة أو المشرفين المخوّلين فقط.");
    }
    const challengeId = argsList.find((item) => item.startsWith("challenge-"));
    if (!challengeId) return sendText(sock, groupId, "أضف معرّف التحدي قبل منشن الفائز.");
    const settled = await groupWorldService.settleChallenge(groupId, challengeId, mentioned[0], memberId);
    return sendText(sock, groupId, `تمت تسوية ${settled.challenge.id} لصالح الفائز.`);
  }

  if (commandToken === ".قائمة") {
    return sendInteractiveMessage(
      sock,
      groupId,
      createQuickReplyMessage("اختبار القائمة التفاعلية", [
        { id: "gw:v1:menu:open", label: "📋 فتح القائمة" },
      ], "اختر الزر لعرض قائمة WhatsApp"),
    );
  }

  if (commandToken === ".تحديث" && args === "القائمة") {
    const metadata = await sock.groupMetadata(groupId);
    if (!(await canManageFromChat(groupId, message, memberId, metadata, "members", sock, isBotOwner))) {
      return sendText(sock, groupId, "هذا الأمر متاح لمشرفي المجموعة فقط.");
    }
    const members = (metadata.participants || []).map((item) => ({
      memberId: item.id || item.jid || item.pn || item.lid,
      name: item.notify || item.name || "",
    })).filter((item) => item.memberId);
    const result = await groupWorldService.refreshSlots(groupId, members, memberId);
    return sendText(sock, groupId, `تم تحديث القائمة وإعادة ترقيم ${result.slots.length} عضوًا.`);
  }

  if (commandToken === ".تزويد") {
    const [slotNumber, rawAmount, ...reasonParts] = argsList;
    const amount = Number(rawAmount);
    if (!/^\d+$/.test(slotNumber || "") || !Number.isInteger(amount) || amount === 0) {
      return sendText(sock, groupId, "استخدم: .تزويد <رقم الخانة> <المبلغ>، ويمكن أن يكون المبلغ سالبًا للخصم.");
    }
    const metadata = await sock.groupMetadata(groupId);
    const permitted = await canManageFromChat(groupId, message, memberId, metadata, "points", sock, isBotOwner);
    if (!permitted) return sendText(sock, groupId, "هذا الأمر متاح لمشرفي المجموعة أو المشرفين المخوّلين فقط.");
    const target = await groupWorldService.getSlotMember(groupId, Number(slotNumber));
    const current = (metadata.participants || []).some((item) =>
      [item.id, item.jid, item.pn, item.phoneNumber, item.lid].some((value) => sameMember(value, target.memberId))
    );
    if (!current) {
      await groupWorldService.markMemberLeft(groupId, target.memberId);
      return sendText(sock, groupId, "الخانة فارغة لأن صاحبها غادر المجموعة؛ لم تُنفّذ العملية.");
    }
    const result = await groupWorldService.adjustSlot(
      groupId,
      Number(slotNumber),
      amount,
      memberId,
      reasonParts.join(" ") || "تعديل عبر أمر القائمة",
    );
    return sendText(sock, groupId, `${amount > 0 ? "أُضيفت" : "خُصمت"} ${Math.abs(amount)} نقطة من الخانة ${slotNumber}. الرصيد ${result.member.balance}.`);
  }

  if (commandToken === ".كل" && args === "الاكواد") {
    const commands = await groupWorldService.getPublicCommands(groupId);
    return sendText(sock, groupId, `الأوامر:\n${commands.join(" · ")}`);
  }

  const group = await groupWorldService.getGroup(groupId);
  const customDefinition = group.commands.find((item) =>
    item.enabled && item.name.toLowerCase() === commandToken.toLowerCase()
  );
  const custom = await groupWorldService.runCustomCommand(
    groupId,
    commandToken,
    await getTemplateValues(
      sock,
      groupId,
      memberId,
      profile,
      Boolean(customDefinition?.response?.includes("_img")),
    ),
  );
  if (custom) {
    if (custom.buttons.length) {
      return sendText(sock, groupId, "لم يُرسل الرد: الأزرار التفاعلية غير مدعومة في إصدار Baileys الحالي. لم يتم تحويلها إلى نصوص شكلية.");
    }
    if (custom.image) {
      await sock.sendMessage(groupId, {
        image: { url: custom.image },
        caption: String(custom.text || "").slice(0, MAX_REPLY_LENGTH),
      });
      return { sent: true, image: true };
    }
    return sendText(sock, groupId, custom.text);
  }
  return null;
}

export async function handleGroupWorldMessage(userId, sock, message, eventType = "") {
  const groupId = String(message?.key?.remoteJid || "");
  if (!GROUP_ID_PATTERN.test(groupId)) return null;
  const text = messageText(message);
  const selection = extractInteractiveSelection(message);
  const fromMe = message?.key?.fromMe === true;
  if (fromMe && (eventType !== "notify" || (!text.startsWith(".") && !selection))) return null;
  if (fromMe && !(await isCurrentSocketOwnerMessage(groupId, sock, message))) return null;
  const memberId = fromMe
    ? await ownerMemberId(groupId, sock, message)
    : accountIdFromMessage(message);
  if (!memberId || (!text && !selection)) return null;

  try {
    const currentGroup = await groupWorldService.getGroup(groupId);
    if (!currentGroup.enabled && text !== ".تفعيل العالم") return null;
    if (selection) {
      const eventId = String(message?.key?.id || "");
      const dedupeKey = `${groupId}:${eventId}`;
      if (eventId && commandEvents.has(dedupeKey)) return { duplicate: true };
      if (eventId) commandEvents.set(dedupeKey, Date.now());
      return await handleInteractiveSelection(sock, groupId, memberId, selection, message, userId);
    }
    if (text.startsWith(".")) {
      const eventId = String(message?.key?.id || "");
      const dedupeKey = `${groupId}:${eventId}`;
      if (eventId && commandEvents.has(dedupeKey)) return { duplicate: true };
      if (eventId) {
        commandEvents.set(dedupeKey, Date.now());
        if (commandEvents.size > 10_000) {
          const cutoff = Date.now() - 10 * 60_000;
          for (const [key, at] of commandEvents) {
            if (at < cutoff) commandEvents.delete(key);
          }
          while (commandEvents.size > 10_000) commandEvents.delete(commandEvents.keys().next().value);
        }
      }
      const botOwner = fromMe && await isGroupWorldOwner(groupId, userId, sock);
      return await commandReply(sock, groupId, memberId, message, text, botOwner, userId);
    }
    if (text && !fromMe) {
      const challengeActive = currentGroup.gameData.challengeMatches.some((item) =>
        item.status === "active" && [item.challenger, item.opponent].includes(memberId)
      );
      if (challengeActive) {
        const result = await activityService.submitChallengeAnswer(groupId, memberId, text);
        if (result.handled) {
          if (result.correct) {
            await sendText(sock, groupId, `🏆 إجابة صحيحة! الفائز في ${result.challenge.challengeName}: ${message?.pushName || memberId.split("@")[0]}.`);
          } else if (result.expired || result.draw) {
            await sendText(sock, groupId, `انتهى التحدي ${result.challenge.challengeName} بالتعادل.`);
          } else if (result.duplicate) {
            await sendText(sock, groupId, "سجّلت إجابتك من قبل؛ لا يمكن إرسال إجابة ثانية في هذا التحدي.");
          } else {
            await sendText(sock, groupId, "إجابة غير صحيحة. لا يزال الطرف الآخر يملك فرصة الإجابة.");
          }
          return result;
        }
      }

      const activeDungeon = currentGroup.gameData.dungeons.find((item) =>
        item.memberId === memberId && item.status === "active"
      );
      if (activeDungeon) {
        const result = await rpgService.answerDungeon(groupId, memberId, text);
        if (result.handled) {
          if (result.expired) await sendText(sock, groupId, "انتهت مهلة المغامرة. اكتب .مغامرة لبدء مغامرة جديدة.");
          else if (!result.correct) await sendText(sock, groupId, "الإجابة غير صحيحة. حاول مرة أخرى.");
          else if (result.completed) await sendText(sock, groupId, "🏆 أكملت الأبراج المحصنة وحصلت على مكافأة الإكمال!");
          else await sendText(sock, groupId, `اجتزت المرحلة! المرحلة ${result.dungeon.stage}/${5}:\n${result.dungeon.prompt}`);
          return result;
        }
      }

      const shortGuess = text.trim().length <= 24 && !/\s/u.test(text.trim());
      const treasureActive = currentGroup.gameData.treasureHunts.some((item) => item.status === "active");
      if (shortGuess && treasureActive) {
        const result = await rpgService.answerTreasure(groupId, memberId, text);
        if (result.handled) {
          if (result.correct) await sendText(sock, groupId, `💎 وجد ${message?.pushName || memberId.split("@")[0]} الكنز وحصل على ${result.prize.points} نقطة!`);
          else if (result.repeated) await sendText(sock, groupId, "لقد سجلت تخمينًا واحدًا بالفعل في هذا البحث.");
          else if (result.expired) await sendText(sock, groupId, "انتهى وقت البحث عن الكنز.");
          return result;
        }
      }

      const wordHuntActive = currentGroup.gameData.wordHunts.some((item) => item.status === "active");
      if (shortGuess && wordHuntActive) {
        const result = await rpgService.answerWordHunt(groupId, memberId, text);
        if (result.handled) {
          if (result.correct) await sendText(sock, groupId, `🔎 اكتشف ${message?.pushName || memberId.split("@")[0]} الكلمة السرية وحصل على ${result.prize.points} نقطة!`);
          else if (result.repeated) await sendText(sock, groupId, "لقد سجلت تخمينًا واحدًا بالفعل في صيد الكلمات.");
          else if (result.expired) await sendText(sock, groupId, "انتهى وقت صيد الكلمات.");
          return result;
        }
      }
    }
    const result = await groupWorldService.processMessage({
      groupId,
      memberId,
      name: message?.pushName || "",
      text,
      messageId: message?.key?.id,
      timestamp: message?.messageTimestamp
        ? new Date(Number(message.messageTimestamp) * 1_000)
        : new Date(),
      fromMe: false,
    });
    if (result?.shouldWarn) {
      const group = await groupWorldService.getGroup(groupId);
      const template = group.settings.messageTemplates?.spamWarning;
      if (template) {
        const profile = await groupWorldService.getMemberProfile(groupId, memberId);
        await sendTemplate(
          sock,
          groupId,
          template,
          await getTemplateValues(sock, groupId, memberId, profile, template.includes("_img")),
        );
      } else {
        await sendText(sock, groupId, `تنبيه: تكرار رسائل غير طبيعي. تم تسجيل المخالفة وخصم ${result.penalty} نقطة.`);
      }
    }
    if (result?.shouldKick && typeof sock.groupParticipantsUpdate === "function") {
      try {
        const metadata = await sock.groupMetadata(groupId);
        if (ownAccountIsAdmin(sock, metadata)) {
          await sock.groupParticipantsUpdate(groupId, [memberId], "remove");
          await sendText(sock, groupId, "تمت محاولة إزالة عضو بعد تجاوز حد مخالفات السبام.");
        }
      } catch {
        // Do not stop message processing when the current account lacks group moderation rights.
      }
    }
    return result;
  } catch (error) {
    if (text.startsWith(".")) {
      await sendText(sock, groupId, error?.message || "تعذّر تنفيذ الأمر.");
    }
    _deps.logger?.warn?.({ err: String(error), userId, groupId }, "Group World message failed");
    return null;
  }
}

export async function handleGroupWorldParticipants(userId, sock, event) {
  const groupId = String(event?.id || "");
  if (!GROUP_ID_PATTERN.test(groupId)) return;
  const action = String(event?.action || "");
  const participants = Array.isArray(event?.participants) ? event.participants : [];
  try {
    if (action === "add") {
      const author = event?.author || event?.participant || null;
      for (const participant of participants) {
        const memberId = typeof participant === "string"
          ? participant
          : participant?.id || participant?.jid || participant?.pn || participant?.lid;
        if (!memberId) continue;
        const dedupeKey = `${groupId}:${action}:${memberId}:${author || ""}`;
        const previous = participantEvents.get(dedupeKey);
        if (previous && Date.now() - previous < 60_000) continue;
        participantEvents.set(dedupeKey, Date.now());
        if (participantEvents.size > 10_000) {
          const cutoff = Date.now() - 60_000;
          for (const [key, at] of participantEvents) if (at < cutoff) participantEvents.delete(key);
          while (participantEvents.size > 10_000) participantEvents.delete(participantEvents.keys().next().value);
        }
        await groupWorldService.markMemberJoined(groupId, {
          memberId,
          name: typeof participant === "object" ? participant.notify || participant.name || "" : "",
        });
        if (author && !sameMember(author, memberId)) {
          await groupWorldService.rewardInvite({
            groupId,
            inviterId: author,
            invitedId: memberId,
            eventId: event?.id ? `${event.id}:${memberId}` : null,
          });
        }
        const group = await groupWorldService.getGroup(groupId);
        const welcome = group.settings.messageTemplates?.welcome;
        if (group.enabled && group.modules.messageTemplates && welcome) {
          await groupWorldService.ensureMember(groupId, memberId, typeof participant === "object" ? participant.notify || participant.name || "" : "");
          const profile = await groupWorldService.getMemberProfile(groupId, memberId);
          await sendTemplate(
            sock,
            groupId,
            welcome,
            await getTemplateValues(sock, groupId, memberId, profile, welcome.includes("_img")),
          );
        }
      }
    } else if (action === "remove" || action === "leave") {
      for (const participant of participants) {
        const memberId = typeof participant === "string"
          ? participant
          : participant?.id || participant?.jid || participant?.pn || participant?.lid;
        if (memberId) {
          const dedupeKey = `${groupId}:${action}:${memberId}`;
          const previous = participantEvents.get(dedupeKey);
          if (previous && Date.now() - previous < 60_000) continue;
          participantEvents.set(dedupeKey, Date.now());
          if (participantEvents.size > 10_000) {
            const cutoff = Date.now() - 60_000;
            for (const [key, at] of participantEvents) if (at < cutoff) participantEvents.delete(key);
            while (participantEvents.size > 10_000) participantEvents.delete(participantEvents.keys().next().value);
          }
          await groupWorldService.markMemberLeft(groupId, memberId);
        }
      }
    }
  } catch (error) {
    _deps.logger?.warn?.({ err: String(error), userId, groupId, action }, "Group World participant update failed");
  }
}

export { groupWorldService };
