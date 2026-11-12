/**
 * Group World domain service: economy, profiles, pets, leaderboards and admin data.
 * Dependencies: group-world-store.mjs.
 * Exports: createGroupWorldService and safe template helpers.
 */

import { createGroupWorldStore, normalizeGroupId } from "./group-world-store.mjs";
import { createHash } from "node:crypto";

const TIME_ZONE = "Africa/Khartoum";
const MAX_LEDGER = 30_000;
const MAX_EVENT_IDS = 30_000;
const MAX_AUDIT = 10_000;
const MAX_VIOLATIONS = 5_000;
const LAUGHING_EMOJI = /[😂🤣😹😆😄😁]/u;
const BUILTIN_COMMANDS = [
  ".نقاطي", ".نقاط الكل", ".هدية", ".هدية اسبوعية", ".صدارة", ".متجر",
  ".حيواني", ".حيواناتي", ".ترقية حيواني", ".مهامي", ".انجازاتي", ".ملفي",
  ".حقيبتي", ".كل الاكواد", ".شراء", ".تفعيل حيوان", ".فريقي", ".تحدي",
  ".قبول", ".رفض", ".تحدياتي", ".إلغاء التحدي", ".حسم", ".قائمة",
  ".الألعاب", ".العاب", ".اكس_او", ".مساعدة", ".قدرات الحيوان",
  ".تفعيل", ".تعطيل", ".نقابة", ".بطولة", ".صيد_الكلمات",
  ".عالمي", ".الفرق", ".مغامرة", ".كنز", ".زعيم", ".بطولتي",
  ".صيد_الكلمات", ".عجلة", ".صناعة", ".تحديث القائمة", ".تزويد",
];

export const DEFAULT_RANKS = [
  { id: "beginner", name: "مبتدئ", icon: "🌱", color: "#94a3b8", minPoints: 0 },
  { id: "active", name: "متفاعل", icon: "💬", color: "#38bdf8", minPoints: 500 },
  { id: "regular", name: "منتظم", icon: "⭐", color: "#22c55e", minPoints: 2_000 },
  { id: "adventurer", name: "مغامر", icon: "🧭", color: "#14b8a6", minPoints: 5_000 },
  { id: "expert", name: "خبير", icon: "🛡️", color: "#6366f1", minPoints: 10_000 },
  { id: "elite", name: "نخبة", icon: "💎", color: "#8b5cf6", minPoints: 20_000 },
  { id: "hero", name: "بطل", icon: "🏆", color: "#f59e0b", minPoints: 35_000 },
  { id: "legend", name: "أسطورة", icon: "🌠", color: "#ec4899", minPoints: 55_000 },
  { id: "king", name: "ملك", icon: "👑", color: "#f97316", minPoints: 80_000 },
  { id: "emperor", name: "الإمبراطور", icon: "♛", color: "#facc15", minPoints: 0 },
];

export const DEFAULT_PETS = [
  { id: "cat", name: "القط", icon: "🐈", price: 2_000, ability: "chat", value: 0.03 },
  { id: "dog", name: "الكلب", icon: "🐕", price: 3_000, ability: "gift", value: 0.04 },
  { id: "rabbit", name: "الأرنب", icon: "🐇", price: 4_000, ability: "tasks", value: 0.05 },
  { id: "fox", name: "الثعلب", icon: "🦊", price: 6_000, ability: "chat", value: 0.06 },
  { id: "wolf", name: "الذئب", icon: "🐺", price: 8_000, ability: "challenge", value: 0.07 },
  { id: "lion", name: "الأسد", icon: "🦁", price: 10_000, ability: "gift", value: 0.08 },
  { id: "tiger", name: "النمر", icon: "🐅", price: 12_000, ability: "chat", value: 0.09 },
  { id: "eagle", name: "النسر", icon: "🦅", price: 14_000, ability: "periodic", value: 20 },
  { id: "owl", name: "البومة", icon: "🦉", price: 16_000, ability: "tasks", value: 0.1 },
  { id: "horse", name: "الحصان", icon: "🐎", price: 18_000, ability: "activity", value: 0.1 },
  { id: "panda", name: "الباندا", icon: "🐼", price: 20_000, ability: "gift", value: 0.1 },
  { id: "dolphin", name: "الدلفين", icon: "🐬", price: 22_000, ability: "challenge", value: 0.12 },
  { id: "bear", name: "الدب", icon: "🐻", price: 25_000, ability: "chat", value: 0.12 },
  { id: "deer", name: "الغزال", icon: "🦌", price: 28_000, ability: "tasks", value: 0.13 },
  { id: "peacock", name: "الطاووس", icon: "🦚", price: 31_000, ability: "activity", value: 0.14 },
  { id: "falcon", name: "الصقر", icon: "🦅", price: 35_000, ability: "periodic", value: 35 },
  { id: "phoenix", name: "العنقاء", icon: "🔥", price: 40_000, ability: "gift", value: 0.16 },
  { id: "unicorn", name: "اليونيكورن", icon: "🦄", price: 46_000, ability: "challenge", value: 0.18 },
  { id: "dragon", name: "التنين", icon: "🐉", price: 53_000, ability: "chat", value: 0.2 },
  { id: "leviathan", name: "ليفياثان", icon: "🐲", price: 60_000, ability: "periodic", value: 60 },
].map((pet) => {
  const abilityDescription = {
    chat: "زيادة مكافآت نقاط الرسائل الطبيعية، وتتدرج قوتها مع مستوى الحيوان.",
    gift: "زيادة مكافآت الهدايا، وتتدرج قوتها مع مستوى الحيوان.",
    periodic: "مكافأة نقاط دورية عند حلول موعدها، وتتدرج مع مستوى الحيوان.",
    tasks: "زيادة مكافآت المهام المكتملة، وتتدرج قوتها مع مستوى الحيوان.",
    challenge: "زيادة مكافآت الفوز بالتحديات، وتتدرج قوتها مع مستوى الحيوان.",
    activity: "زيادة XP ومكافآت النشاط، وتتدرج قوتها مع مستوى الحيوان.",
  }[pet.ability] || "قدرة خاصة قابلة للتطوير.";
  return {
    ...pet,
    abilityDescription,
    description: abilityDescription,
    levels: Array.from({ length: 5 }, (_, index) => ({
      level: index + 1,
      value: Number((Number(pet.value) * (1 + index * 0.2)).toFixed(3)),
      upgradeCost: index === 0 ? 0 : Math.ceil(Number(pet.price) * 0.35 * index),
    })),
  };
});

export const DEFAULT_SHOP_ITEMS = [
  { id: "title-veteran", name: "لقب المخضرم", category: "title", icon: "🏅", price: 2_500, durationDays: 0 },
  { id: "frame-aurora", name: "إطار الشفق", category: "frame", icon: "🌌", price: 4_000, durationDays: 0 },
  { id: "badge-first", name: "شارة السبّاق", category: "badge", icon: "⚡", price: 3_000, durationDays: 0 },
  { id: "collectible-crystal", name: "بلورة نادرة", category: "collectible", icon: "🔮", price: 7_500, durationDays: 0 },
  { id: "power-chat", name: "دفعة نشاط", category: "power", icon: "🚀", price: 1_500, durationDays: 1, value: 0.15 },
  { id: "title-champion", name: "لقب البطل", category: "title", icon: "🥇", price: 10_000, durationDays: 0 },
];

const DEFAULT_MODULES = {
  economy: true,
  progression: true,
  antiSpam: true,
  pets: true,
  shops: true,
  tasks: true,
  achievements: true,
  challenges: true,
  teams: true,
  seasons: true,
  events: true,
  messageTemplates: true,
  customCommands: true,
  ticTacToe: true,
  automaticRewards: true,
  bossRaid: true,
  treasureHunt: true,
  guilds: true,
  crafting: true,
  dungeons: true,
  tournaments: true,
  wordHunt: true,
  luckyWheel: true,
};

const DEFAULT_CHALLENGE_BANK = [
  { id: "general-1", type: "general", difficulty: "easy", prompt: "ما الكوكب المعروف بالكوكب الأحمر؟", answer: "المريخ", aliases: ["mars"] },
  { id: "math-1", type: "math", difficulty: "easy", prompt: "احسب بسرعة: 17 × 6؟", answer: "102", aliases: [] },
  { id: "riddle-1", type: "riddle", difficulty: "easy", prompt: "ما الشيء الذي كلما أخذت منه كبر؟", answer: "الحفرة", aliases: ["حفرة"] },
  { id: "emoji-1", type: "emoji", difficulty: "easy", prompt: "خمن العبارة: 🌧️ + 🐈 + 🐕", answer: "تمطر بغزارة", aliases: ["تمطر قططا وكلابا", "تمطر قطط وكلاب"] },
  { id: "scramble-1", type: "scramble", difficulty: "easy", prompt: "رتب الحروف لتكوين كلمة: ب ت ك ا", answer: "كتاب", aliases: [] },
  { id: "memory-1", type: "memory", difficulty: "normal", prompt: "احفظ هذا التسلسل ثم اكتبه كما هو: 4 - 9 - 2 - 7", answer: "4927", aliases: ["4 9 2 7", "4-9-2-7"] },
  { id: "speed-1", type: "speed", difficulty: "easy", prompt: "أجب بكلمة واحدة: عكس كلمة (بارد)؟", answer: "حار", aliases: ["ساخن"] },
  { id: "letters-1", type: "letters", difficulty: "normal", prompt: "ما الكلمة الإنجليزية التي تتكون من الحروف: T A E R H؟", answer: "heart", aliases: ["earth"] },
  { id: "hidden-1", type: "hidden", difficulty: "normal", prompt: "اكتشف الكلمة المخفية بين الحروف: م س ت ك ت ب ة", answer: "مكتبة", aliases: [] },
  { id: "streak-1", type: "streak", difficulty: "normal", prompt: "أكمل السؤال: عاصمة اليابان هي؟", answer: "طوكيو", aliases: ["tokyo"] },
  { id: "geo-1", type: "geography", difficulty: "easy", prompt: "ما عاصمة السودان؟", answer: "الخرطوم", aliases: ["khartoum"] },
  { id: "english-1", type: "english", difficulty: "easy", prompt: "ترجم إلى الإنجليزية: شمس", answer: "sun", aliases: [] },
  { id: "cipher-1", type: "cipher", difficulty: "normal", prompt: "فك الشيفرة بنظام A=1 وB=2: 3-1-20.", answer: "cat", aliases: [] },
  { id: "logic-1", type: "logic", difficulty: "normal", prompt: "إذا كان كل الورود نباتات وبعض النباتات سامة، هل يلزم أن تكون كل الورود سامة؟ أجب بنعم أو لا.", answer: "لا", aliases: ["no"] },
  { id: "sequence-1", type: "sequence", difficulty: "normal", prompt: "أكمل السلسلة: 2، 4، 8، 16، ؟", answer: "32", aliases: [] },
];

const DEFAULT_GAME_SETTINGS = {
  ticTacToe: { pointsReward: 150, xpReward: 30 },
  challenges: { pointsReward: 250, xpReward: 40, durationSeconds: 120, difficulty: "normal" },
  bossRaid: { health: 5000, participantReward: 100, winnerReward: 500, xpReward: 40 },
  treasureHunt: { pointsReward: 300, xpReward: 35, durationSeconds: 300 },
  guilds: { creationCost: 500 },
  crafting: { commonCost: 3, rareCost: 8 },
  dungeons: { stageReward: 100, xpReward: 25 },
  tournaments: { entryReward: 250, xpReward: 50 },
  wordHunt: { pointsReward: 150, xpReward: 20, durationSeconds: 300 },
  luckyWheel: { dailyLimit: 1, rewards: [0, 25, 50, 100, 200] },
};

const DEFAULT_SETTINGS = {
  rewards: {
    startingBalance: 500,
    dailyGift: 200,
    weeklyGift: 1_000,
    inviteReward: 100,
    messageReward: 2,
    laughReward: 3,
    dailyEarnCap: 1_500,
  },
  antiSpam: {
    enabled: true,
    repeatThreshold: 5,
    windowSeconds: 30,
    floodThreshold: 18,
    floodDuplicateRatio: 0.65,
    penaltyPoints: 200,
    penaltyCooldownSeconds: 60,
    warningEvery: 3,
    kickAfterSpamMessages: 51,
  },
  ranks: DEFAULT_RANKS,
  dailyTasks: [
    { id: "chat-15", name: "شارك في الحديث", target: 15, reward: 50, kind: "messages" },
    { id: "chat-30", name: "كن حاضرًا اليوم", target: 30, reward: 100, kind: "messages" },
  ],
  weeklyTasks: [
    { id: "week-chat-100", name: "نشاط الأسبوع", target: 100, reward: 400, kind: "messages" },
  ],
  achievementRules: [
    { id: "first-message", name: "أول رسالة", kind: "messages", target: 1, badge: "💬" },
    { id: "messages-100", name: "مئة رسالة", kind: "messages", target: 100, badge: "💯" },
    { id: "messages-1000", name: "ألف رسالة", kind: "messages", target: 1_000, badge: "🏅" },
    { id: "streak-7", name: "سلسلة أسبوع", kind: "streak", target: 7, badge: "🔥" },
    { id: "pet-owner", name: "أول حيوان", kind: "pets", target: 1, badge: "🐾" },
  ],
  season: null,
  messageTemplates: {},
  automaticRewards: {
    enabled: true,
    dailyTime: "08:00",
    dailyAmount: 200,
    weeklyTime: "08:00",
    weeklyDay: 1,
    weeklyAmount: 1_000,
  },
  games: DEFAULT_GAME_SETTINGS,
  challengeBank: DEFAULT_CHALLENGE_BANK,
};

function deepClone(value) {
  return structuredClone(value);
}

function cleanMemberId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 180 || !/^[A-Za-z0-9._:-]+@[A-Za-z0-9.-]+$/.test(id)) {
    throw new Error("معرّف عضو واتساب غير صالح");
  }
  return id;
}

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function groupWorldDayKey(date = new Date()) {
  const p = localDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function groupWorldWeekKey(date = new Date()) {
  const p = localDateParts(date);
  const day = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((day - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function groupWorldMonthKey(date = new Date()) {
  const p = localDateParts(date);
  return `${p.year}-${p.month}`;
}

function ensureDefaults(state) {
  state.modules = { ...DEFAULT_MODULES, ...(state.modules || {}) };
  state.settings = {
    ...deepClone(DEFAULT_SETTINGS),
    ...(state.settings || {}),
    rewards: {
      ...DEFAULT_SETTINGS.rewards,
      ...(state.settings?.rewards || {}),
    },
    antiSpam: {
      ...DEFAULT_SETTINGS.antiSpam,
      ...(state.settings?.antiSpam || {}),
    },
    ranks: Array.isArray(state.settings?.ranks)
      ? state.settings.ranks
      : deepClone(DEFAULT_RANKS),
    dailyTasks: Array.isArray(state.settings?.dailyTasks)
      ? state.settings.dailyTasks
      : deepClone(DEFAULT_SETTINGS.dailyTasks),
    weeklyTasks: Array.isArray(state.settings?.weeklyTasks)
      ? state.settings.weeklyTasks
      : deepClone(DEFAULT_SETTINGS.weeklyTasks),
    achievementRules: Array.isArray(state.settings?.achievementRules)
      ? state.settings.achievementRules
      : deepClone(DEFAULT_SETTINGS.achievementRules),
    messageTemplates: state.settings?.messageTemplates || {},
    automaticRewards: {
      ...DEFAULT_SETTINGS.automaticRewards,
      ...(state.settings?.automaticRewards || {}),
    },
    games: Object.fromEntries(Object.entries(DEFAULT_GAME_SETTINGS).map(([key, defaults]) => [
      key,
      { ...defaults, ...(state.settings?.games?.[key] || {}) },
    ])),
    challengeBank: Array.isArray(state.settings?.challengeBank)
      ? state.settings.challengeBank
      : deepClone(DEFAULT_CHALLENGE_BANK),
  };
  state.catalogs = {
    pets: Array.isArray(state.catalogs?.pets) ? state.catalogs.pets : deepClone(DEFAULT_PETS),
    items: Array.isArray(state.catalogs?.items) ? state.catalogs.items : deepClone(DEFAULT_SHOP_ITEMS),
  };
  for (const key of [
    "commands", "administrators", "slots", "inviteRewards", "processedMessages",
    "transactions", "auditLog", "violations", "teams", "challenges", "events",
  ]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (!state.accounts || typeof state.accounts !== "object") state.accounts = {};
  for (const account of Object.values(state.accounts)) {
    if (!Array.isArray(account.bannedGames)) account.bannedGames = [];
  }
  if (!state.gameData || typeof state.gameData !== "object") state.gameData = {};
  for (const key of ["ticTacToe", "challengeMatches", "rewardReports", "bossRaids", "treasureHunts", "guilds", "dungeons", "tournaments", "wordHunts", "wheelSpins"]) {
    if (!Array.isArray(state.gameData[key])) state.gameData[key] = [];
  }
  return state;
}

function ensureAccount(state, memberId, name = "") {
  const id = cleanMemberId(memberId);
  let account = state.accounts[id];
  if (!account) {
    account = state.accounts[id] = {
      memberId: id,
      name: String(name || "").slice(0, 80),
      enabled: true,
      initialized: false,
      balance: 0,
      rankOverrideId: null,
      totalEarned: 0,
      totalSpent: 0,
      xp: 0,
      level: 1,
      messages: 0,
      activePetId: null,
      pets: [],
      inventory: [],
      achievements: [],
      streak: 0,
      lastActiveDay: null,
      lastDailyGiftDay: null,
      lastWeeklyGiftWeek: null,
      taskProgress: {},
      spamMessages: 0,
      lastSpamPenaltyAt: null,
      lastSpamWarningAt: null,
      teamId: null,
      bannedGames: [],
      titleItemId: null,
      frameItemId: null,
      createdAt: new Date().toISOString(),
    };
  } else if (name) {
    account.name = String(name).slice(0, 80);
  }
  return account;
}

function addAudit(state, actor, action, target, reason, details = {}) {
  state.auditLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    actor: String(actor || "system").slice(0, 180),
    action: String(action).slice(0, 80),
    target: String(target || "").slice(0, 180),
    reason: String(reason || "").slice(0, 300),
    details: deepClone(details),
    timestamp: new Date().toISOString(),
  });
  if (state.auditLog.length > MAX_AUDIT) state.auditLog.splice(0, state.auditLog.length - MAX_AUDIT);
}

function appendTransaction(state, account, amount, kind, reason, actor = "system", eventId = null, timestamp = new Date()) {
  const delta = Math.trunc(Number(amount));
  if (!Number.isSafeInteger(delta) || delta === 0) return null;
  if (account.balance + delta < 0) throw new Error("الرصيد لا يكفي لهذه العملية");
  account.balance += delta;
  if (delta > 0) account.totalEarned += delta;
  else account.totalSpent += Math.abs(delta);
  const transaction = {
    id: `${timestamp.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    memberId: account.memberId,
    amount: delta,
    kind: String(kind).slice(0, 48),
    reason: String(reason || "").slice(0, 300),
    actor: String(actor || "system").slice(0, 180),
    eventId: eventId ? String(eventId).slice(0, 180) : null,
    timestamp: timestamp.toISOString(),
  };
  state.transactions.push(transaction);
  if (state.transactions.length > MAX_LEDGER) {
    state.transactions.splice(0, state.transactions.length - MAX_LEDGER);
  }
  return transaction;
}

function initializeAccount(state, account, timestamp = new Date()) {
  if (account.initialized) return false;
  account.initialized = true;
  account.balance = 0;
  appendTransaction(
    state,
    account,
    Number(state.settings.rewards.startingBalance),
    "starting_balance",
    "رصيد بداية العضو",
    "system",
    `start:${state.groupId}:${account.memberId}`,
    timestamp,
  );
  return true;
}

function clampInt(value, min, max, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${field} خارج الحدود المسموح بها`);
  }
  return number;
}

function petFor(state, petId) {
  return state.catalogs.pets.find((pet) => pet.id === petId && pet.enabled !== false) || null;
}

function activePet(state, account) {
  if (!state.modules.pets || !account.activePetId) return null;
  return account.pets.find((pet) => pet.id === account.activePetId) || null;
}

function petMultiplier(state, account, ability) {
  const owned = activePet(state, account);
  if (!owned) return 1;
  const pet = petFor(state, owned.petId);
  if (!pet || pet.ability !== ability) return 1;
  return Math.min(2, 1 + Number(pet.value || 0) * (1 + (owned.level - 1) * 0.2));
}

function temporaryPowerMultiplier(state, account, timestamp = new Date()) {
  let multiplier = 1;
  for (const owned of account.inventory || []) {
    if (owned.expiresAt && Date.parse(owned.expiresAt) <= timestamp.getTime()) continue;
    const item = state.catalogs.items.find((candidate) => candidate.id === owned.itemId);
    if (item?.category === "power" && item.enabled !== false) {
      multiplier *= 1 + Math.min(0.5, Math.max(0, Number(item.value) || 0.15));
    }
  }
  return Math.min(2, multiplier);
}

function memberRank(state, memberId) {
  const accounts = Object.values(state.accounts).filter((account) => account.enabled !== false);
  const sorted = [...accounts].sort((a, b) => b.balance - a.balance || a.memberId.localeCompare(b.memberId));
  const position = sorted.findIndex((account) => account.memberId === memberId) + 1;
  const rankDefs = [...state.settings.ranks].sort((a, b) => a.minPoints - b.minPoints);
  if (position === 1 && sorted.length > 0) {
    return { rank: rankDefs.find((rank) => rank.id === "emperor") || DEFAULT_RANKS.at(-1), position, nextPoints: 0 };
  }
  const account = state.accounts[memberId];
  const override = rankDefs.find((rank) => rank.id === account?.rankOverrideId && rank.id !== "emperor");
  if (override) return { rank: override, position: position || null, nextPoints: 0 };
  const eligible = rankDefs.filter((rank) => rank.id !== "emperor" && rank.minPoints <= (account?.balance || 0));
  const rank = eligible.at(-1) || rankDefs[0];
  const next = rankDefs.find((item) => item.id !== "emperor" && item.minPoints > (account?.balance || 0));
  return {
    rank,
    position: position || null,
    nextPoints: next ? Math.max(0, next.minPoints - (account?.balance || 0)) : 0,
  };
}

function grantCappedReward(state, account, requested, kind, reason, actor, eventId, timestamp) {
  const dayKey = groupWorldDayKey(timestamp);
  account.dailyEarned ||= {};
  const earnedToday = Number(account.dailyEarned[dayKey] || 0);
  const dailyCap = Math.max(0, Number(state.settings.rewards.dailyEarnCap) || 0);
  const amount = Math.max(0, Math.min(Math.trunc(requested), dailyCap - earnedToday));
  if (amount > 0) {
    appendTransaction(state, account, amount, kind, reason, actor, eventId, timestamp);
    account.dailyEarned[dayKey] = earnedToday + amount;
  }
  for (const oldDay of Object.keys(account.dailyEarned)) {
    if (oldDay < groupWorldDayKey(new Date(timestamp.getTime() - 8 * 86_400_000))) delete account.dailyEarned[oldDay];
  }
  return amount;
}

function unlockAchievements(state, account, timestamp) {
  if (!state.modules.achievements) return [];
  const unlocked = [];
  for (const rule of state.settings.achievementRules || []) {
    const value = rule.kind === "messages"
      ? account.messages
      : rule.kind === "streak"
        ? account.streak
        : rule.kind === "pets"
          ? account.pets.length
          : rule.kind === "level"
            ? account.level
            : rule.kind === "earned"
              ? account.totalEarned
              : rule.kind === "spent"
                ? account.totalSpent
                : 0;
    if (value < Number(rule.target) || account.achievements.includes(rule.id)) continue;
    account.achievements.push(rule.id);
    unlocked.push(String(rule.name || rule.id));
  }
  return unlocked;
}

function updateTasks(state, account, timestamp) {
  if (!state.modules.tasks) return [];
  const completed = [];
  const dailyKey = groupWorldDayKey(timestamp);
  const weekKey = groupWorldWeekKey(timestamp);
  account.taskProgress ||= {};
  const lists = [
    { scope: "daily", key: dailyKey, tasks: state.settings.dailyTasks || [] },
    { scope: "weekly", key: weekKey, tasks: state.settings.weeklyTasks || [] },
  ];
  for (const list of lists) {
    account.taskProgress[list.scope] ||= {};
    const scoped = account.taskProgress[list.scope];
    if (!scoped[list.key]) scoped[list.key] = {};
    for (const task of list.tasks) {
      const progress = scoped[list.key][task.id] || { count: 0, claimed: false };
      if (task.kind === "messages") progress.count += 1;
      if (!progress.claimed && progress.count >= Number(task.target) && state.modules.economy) {
        progress.claimed = true;
        const reward = clampInt(task.reward, 0, 100_000, "مكافأة المهمة");
        const boostedReward = Math.round(
          reward * petMultiplier(state, account, "tasks") * temporaryPowerMultiplier(state, account, timestamp),
        );
        grantCappedReward(state, account, boostedReward, "task", `مهمة: ${task.name}`, "system", null, timestamp);
        completed.push(String(task.name));
      }
      scoped[list.key][task.id] = progress;
    }
  }
  return completed;
}

function normalizeSpamText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
}

function spamSignature(text) {
  return normalizeSpamText(text)
    .replace(/(?:https?:\/\/|www\.)\S+/giu, "_url_")
    .replace(/(?:\+?\d[\d\s().-]{5,}\d)/gu, "_number_")
    .replace(/@\d{5,}/gu, "@_member_")
    .trim();
}

function detectSpam(state, memberId, text, timestamp) {
  const settings = state.settings.antiSpam;
  if (!state.modules.antiSpam || settings.enabled === false) return null;
  const normalized = normalizeSpamText(text);
  if (normalized.length < 2) return null;
  const signature = spamSignature(normalized);
  const windowMs = clampInt(settings.windowSeconds, 10, 300, "نافذة السبام") * 1_000;
  const windows = state.spamWindows ||= {};
  const recent = (windows[memberId] || []).filter((item) => timestamp.getTime() - item.time <= windowMs);
  recent.push({ text: normalized, signature, time: timestamp.getTime() });
  if (recent.length > 100) recent.splice(0, recent.length - 100);
  windows[memberId] = recent;

  const repeated = recent.filter((item) => item.signature === signature).length;
  const counts = new Map();
  for (const item of recent) counts.set(item.signature, (counts.get(item.signature) || 0) + 1);
  const duplicateRatio = recent.length ? Math.max(...counts.values()) / recent.length : 0;
  const repeatThreshold = clampInt(settings.repeatThreshold, 3, 30, "حد التكرار");
  const floodThreshold = clampInt(settings.floodThreshold, 8, 100, "حد الإرسال المكثف");
  if (repeated >= repeatThreshold) return { kind: "repeated", repeated, count: recent.length };
  if (recent.length >= floodThreshold && duplicateRatio >= Number(settings.floodDuplicateRatio || 0.65)) {
    return { kind: "flood", repeated, count: recent.length };
  }
  return null;
}

function safeCommand(command) {
  const name = String(command?.name || "").trim();
  if (!/^\.[\p{L}\p{N}_-]{1,32}$/u.test(name)) {
    throw new Error("الأمر يجب أن يبدأ بنقطة ويحتوي حتى 32 حرفًا");
  }
  const normalized = name.toLowerCase();
  if (BUILTIN_COMMANDS.includes(normalized)) throw new Error("لا يمكن استبدال أمر أساسي");
  const response = String(command?.response || "");
  if (!response.trim() || response.length > 2_000) throw new Error("نص الرد مطلوب وبحد أقصى 2000 حرف");
  if (/<script\b|javascript:|data:text\/html/i.test(response)) {
    throw new Error("الأوامر تقبل نصوصًا فقط ولا تقبل شيفرة");
  }
  return {
    id: String(command.id || name.slice(1)).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || name.slice(1),
    name,
    response,
    enabled: command.enabled !== false,
    createdAt: command.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function parseMessageTemplate(template) {
  const source = String(template || "");
  const buttons = [];
  const parts = source.split("_boton_");
  const textParts = [parts[0]];
  for (let index = 1; index < parts.length; index += 1) {
    const item = parts[index];
    const separator = item.indexOf("_");
    if (separator <= 0) {
      textParts.push("_boton_", item);
      continue;
    }
    const label = item.slice(0, separator).trim();
    const rest = item.slice(separator + 1);
    if (!label || !rest.trim()) {
      textParts.push("_boton_", item);
      continue;
    }
    buttons.push({ label: label.slice(0, 40), response: rest.trim().slice(0, 300) });
  }
  return { text: textParts.join("").trim(), buttons };
}

export function renderMessageTemplate(template, values = {}) {
  const source = String(template || "");
  const aliases = {
    _cone: values.points,
    _neam: values.name,
    _time: values.time,
    _img: "",
    _allcon: values.allMembers,
    _rank: values.rank,
    _position: values.position,
    _earned: values.earned,
    _spent: values.spent,
    _pet: values.pet,
    _next: values.nextPoints,
  };
  const parsed = parseMessageTemplate(source);
  let text = parsed.text;
  for (const [key, value] of Object.entries(aliases)) {
    text = text.split(key).join(value == null ? "" : String(value));
  }
  const buttons = parsed.buttons.map((button) => ({
    label: button.label,
    response: Object.entries(aliases).reduce(
      (result, [key, value]) => result.split(key).join(value == null ? "" : String(value)),
      button.response,
    ),
  }));
  return {
    text,
    buttons,
    image: values.image || null,
    includesImage: source.includes("_img"),
  };
}

function serializedMember(state, account) {
  const rank = memberRank(state, account.memberId);
  return {
    memberId: account.memberId,
    name: account.name || account.memberId.split("@")[0],
    enabled: account.enabled !== false,
    balance: account.balance,
    xp: account.xp,
    level: account.level,
    messages: account.messages,
    totalEarned: account.totalEarned,
    totalSpent: account.totalSpent,
    rank: rank.rank,
    position: rank.position,
    nextPoints: rank.nextPoints,
    rankOverrideId: account.rankOverrideId || null,
    activePetId: account.activePetId,
    petCount: account.pets.length,
    achievements: account.achievements.length,
    streak: account.streak,
    spamMessages: account.spamMessages,
    teamId: account.teamId,
  };
}

export function createGroupWorldService(options = {}) {
  const store = options.store || createGroupWorldStore(options);
  const now = options.now || (() => new Date());

  async function getGroup(groupId) {
    return ensureDefaults(await store.loadGroup(normalizeGroupId(groupId)));
  }

  async function transact(groupId, operation) {
    return store.updateGroup(normalizeGroupId(groupId), async (raw) => {
      const state = ensureDefaults(raw);
      return operation(state);
    });
  }

  async function audit(groupId, actor, action, target, reason, details) {
    return transact(groupId, (state) => {
      addAudit(state, actor, action, target, reason, details);
      return { ok: true };
    });
  }

  async function activateGroup({ groupId, ownerId, ownerPhoneNumber = "", members = [], actor = ownerId }) {
    const owner = String(ownerId || "").trim();
    if (!owner) throw new Error("تعذّر تحديد مالك تفعيل النظام");
    return transact(groupId, (state) => {
      if (state.enabled && state.ownerId && state.ownerId !== owner) {
        throw new Error("هذه المجموعة مفعّلة بواسطة مالك آخر");
      }
      const firstActivation = !state.enabled;
      state.enabled = true;
      state.ownerId ||= owner;
      state.ownerPhoneNumber ||= String(ownerPhoneNumber || "").replace(/\D/g, "") || null;
      state.activatedAt ||= now().toISOString();
      const seeded = [];
      for (const member of members) {
        const account = ensureAccount(state, member.memberId || member.id, member.name || member.notify);
        if (!account.initialized) {
          initializeAccount(state, account, now());
          seeded.push(account.memberId);
        }
      }
      if (firstActivation && state.slots.length === 0) {
        state.slots = members.map((member, index) => ({
          slot: index + 1,
          memberId: cleanMemberId(member.memberId || member.id),
          name: String(member.name || member.notify || "").slice(0, 80),
          active: true,
        }));
      }
      if (firstActivation) addAudit(state, actor, "activate", state.groupId, "تفعيل عالم المجموعة", { seeded: seeded.length });
      return { ok: true, enabled: true, seededMembers: seeded.length, modules: deepClone(state.modules) };
    });
  }

  async function setEnabled(groupId, enabled, actor, reason = "") {
    if (typeof enabled !== "boolean") throw new Error("حالة التفعيل غير صالحة");
    return transact(groupId, (state) => {
      state.enabled = enabled;
      addAudit(state, actor, enabled ? "enable" : "disable", groupId, reason || "تغيير حالة المجموعة");
      return { ok: true, enabled };
    });
  }

  async function setModule(groupId, moduleName, enabled, actor) {
    if (!(moduleName in DEFAULT_MODULES) || typeof enabled !== "boolean") {
      throw new Error("وحدة النظام غير صالحة");
    }
    return transact(groupId, (state) => {
      state.modules[moduleName] = enabled;
      addAudit(state, actor, "module_toggle", moduleName, enabled ? "تفعيل الوحدة" : "إيقاف الوحدة", { enabled });
      return { ok: true, modules: deepClone(state.modules) };
    });
  }

  async function processMessage({
    groupId,
    memberId,
    name = "",
    text = "",
    messageId,
    timestamp = now(),
    fromMe = false,
  }) {
    const normalizedGroupId = normalizeGroupId(groupId);
    const normalizedMemberId = cleanMemberId(memberId);
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const eventId = String(messageId || "");
    if (!eventId || eventId.length > 180) return { ignored: true, reason: "missing_message_id" };
    if (fromMe) return { ignored: true, reason: "from_me" };

    return transact(normalizedGroupId, (state) => {
      if (state.processedMessages.includes(eventId)) return { duplicate: true };
      state.processedMessages.push(eventId);
      if (state.processedMessages.length > MAX_EVENT_IDS) {
        state.processedMessages.splice(0, state.processedMessages.length - MAX_EVENT_IDS);
      }
      if (!state.enabled) return { ignored: true, reason: "disabled" };

      const account = ensureAccount(state, normalizedMemberId, name);
      if (account.enabled === false) return { ignored: true, reason: "member_disabled" };
      if (state.modules.economy) initializeAccount(state, account, date);

      const content = String(text || "").trim();
      if (!content || content.startsWith(".")) return { ignored: true, reason: "command_or_empty" };

      const spam = detectSpam(state, normalizedMemberId, content, date);
      if (spam) {
        account.spamMessages += 1;
        const spamSettings = state.settings.antiSpam;
        const lastPenalty = account.lastSpamPenaltyAt ? Date.parse(account.lastSpamPenaltyAt) : 0;
        const penaltyReady = date.getTime() - lastPenalty >= Number(spamSettings.penaltyCooldownSeconds) * 1_000;
        let penalty = 0;
        if (penaltyReady && account.balance > 0) {
          penalty = Math.min(account.balance, Number(spamSettings.penaltyPoints));
          if (penalty > 0) {
            appendTransaction(state, account, -penalty, "spam_penalty", "خصم بسبب سبام مؤكد", "system", eventId, date);
            account.lastSpamPenaltyAt = date.toISOString();
          }
        }
        const shouldWarn = account.spamMessages === 1 ||
          account.spamMessages % Math.max(1, Number(spamSettings.warningEvery)) === 0;
        const warningCooldown = date.getTime() - Date.parse(account.lastSpamWarningAt || "1970-01-01") > 30_000;
        if (shouldWarn && warningCooldown) account.lastSpamWarningAt = date.toISOString();
        state.violations.push({
          id: eventId,
          memberId: normalizedMemberId,
          kind: spam.kind,
          messageCount: spam.count,
          confirmedTotal: account.spamMessages,
          penalty,
          timestamp: date.toISOString(),
        });
        if (state.violations.length > MAX_VIOLATIONS) {
          state.violations.splice(0, state.violations.length - MAX_VIOLATIONS);
        }
        const shouldKick = account.spamMessages >= Number(spamSettings.kickAfterSpamMessages) &&
          !account.spamKickAttempted;
        if (shouldKick) account.spamKickAttempted = true;
        return {
          spam: true,
          kind: spam.kind,
          penalty,
          confirmedSpamMessages: account.spamMessages,
          shouldWarn: shouldWarn && warningCooldown,
          shouldKick,
          balance: account.balance,
        };
      }

      if (!state.modules.economy && !state.modules.progression) {
        return { ignored: true, reason: "economy_and_progression_disabled" };
      }

      const trackActivity = state.modules.progression || state.modules.economy;
      if (trackActivity) {
        const previousDay = account.lastActiveDay;
        const today = groupWorldDayKey(date);
        if (previousDay !== today) {
          const yesterday = groupWorldDayKey(new Date(date.getTime() - 86_400_000));
          account.streak = previousDay === yesterday ? account.streak + 1 : 1;
          account.lastActiveDay = today;
        }
        account.messages += 1;
        if (state.modules.progression) {
          account.xp += 1 + Math.floor((petMultiplier(state, account, "activity") - 1) * 10);
          account.level = Math.max(1, Math.floor(Math.sqrt(account.xp / 10)) + 1);
        }
      }
      let credited = 0;
      if (state.modules.economy) {
        const baseReward = LAUGHING_EMOJI.test(content)
          ? Number(state.settings.rewards.laughReward)
          : Number(state.settings.rewards.messageReward);
        const chatMultiplier = petMultiplier(state, account, "chat") * temporaryPowerMultiplier(state, account, date);
        const periodicPet = activePet(state, account);
        const periodicSpec = periodicPet && petFor(state, periodicPet.petId);
        const periodicDue = periodicSpec?.ability === "periodic" &&
          date.getTime() - Date.parse(periodicPet.lastPeriodicAt || "1970-01-01") >= 24 * 60 * 60 * 1_000;
        let reward = Math.max(0, Math.round(baseReward * chatMultiplier));
        if (periodicDue) {
          reward += Math.max(0, Math.trunc(Number(periodicSpec.value)));
          periodicPet.lastPeriodicAt = date.toISOString();
        }
        credited = grantCappedReward(state, account, reward, "message", "مكافأة رسالة طبيعية", "system", eventId, date);
      }
      const completedTasks = updateTasks(state, account, date);
      const unlocked = unlockAchievements(state, account, date);
      return { rewarded: credited, balance: account.balance, xp: account.xp, level: account.level, completedTasks, unlocked };
    });
  }

  async function rewardInvite({ groupId, inviterId, invitedId, inviterName = "", eventId = null }) {
    const inviter = cleanMemberId(inviterId);
    const invited = cleanMemberId(invitedId);
    return transact(groupId, (state) => {
      if (!state.enabled || !state.modules.economy) return { ignored: true };
      if (state.inviteRewards.includes(invited)) return { duplicate: true };
      state.inviteRewards.push(invited);
      if (state.inviteRewards.length > 50_000) state.inviteRewards.shift();
      const account = ensureAccount(state, inviter, inviterName);
      initializeAccount(state, account, now());
      const amount = grantCappedReward(
        state,
        account,
        Number(state.settings.rewards.inviteReward),
        "invite_reward",
        "مكافأة دعوة عضو جديد",
        "system",
        eventId,
        now(),
      );
      return { rewarded: amount, inviter, invited };
    });
  }

  async function claimGift(groupId, memberId, type, name = "") {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.enabled || !state.modules.economy) throw new Error("نظام النقاط غير مفعّل لهذه المجموعة");
      const account = ensureAccount(state, id, name);
      initializeAccount(state, account, now());
      if (account.enabled === false) throw new Error("حسابك معطّل في نظام النقاط");
      const date = now();
      let amount;
      let kind;
      if (type === "daily") {
        const key = groupWorldDayKey(date);
        if (account.lastDailyGiftDay === key) throw new Error("استلمت هديتك اليومية بالفعل");
        account.lastDailyGiftDay = key;
        amount = Number(state.settings.rewards.dailyGift) * petMultiplier(state, account, "gift");
        kind = "daily_gift";
      } else if (type === "weekly") {
        const key = groupWorldWeekKey(date);
        if (account.lastWeeklyGiftWeek === key) throw new Error("استلمت هديتك الأسبوعية بالفعل");
        account.lastWeeklyGiftWeek = key;
        amount = Number(state.settings.rewards.weeklyGift) * petMultiplier(state, account, "gift");
        kind = "weekly_gift";
      } else {
        throw new Error("نوع الهدية غير صالح");
      }
      const credited = grantCappedReward(state, account, amount, kind, type === "daily" ? "الهدية اليومية" : "الهدية الأسبوعية", "system", `${kind}:${id}:${type === "daily" ? groupWorldDayKey(date) : groupWorldWeekKey(date)}`, date);
      return { amount: credited, balance: account.balance, type };
    });
  }

  async function getLeaderboard(groupId, period = "all", limit = 10) {
    const state = await getGroup(groupId);
    const count = clampInt(limit, 1, 100, "عدد أعضاء الصدارة");
    const nowDate = now();
    const day = groupWorldDayKey(nowDate);
    const week = groupWorldWeekKey(nowDate);
    const month = groupWorldMonthKey(nowDate);
    const values = new Map();
    if (period === "all") {
      for (const account of Object.values(state.accounts)) {
        if (account.enabled !== false) values.set(account.memberId, account.balance);
      }
    } else {
      for (const entry of state.transactions) {
        const date = new Date(entry.timestamp);
        const matches = period === "daily"
          ? groupWorldDayKey(date) === day
          : period === "weekly"
            ? groupWorldWeekKey(date) === week
            : period === "monthly"
              ? groupWorldMonthKey(date) === month
              : false;
        if (matches && entry.amount > 0) values.set(entry.memberId, (values.get(entry.memberId) || 0) + entry.amount);
      }
      if (!["daily", "weekly", "monthly"].includes(period)) throw new Error("فترة الصدارة غير صالحة");
    }
    return [...values.entries()]
      .map(([memberId, score]) => {
        const account = state.accounts[memberId];
        return { ...serializedMember(state, account), score };
      })
      .sort((a, b) => b.score - a.score || a.memberId.localeCompare(b.memberId))
      .slice(0, count);
  }

  async function getMemberProfile(groupId, memberId) {
    const state = await getGroup(groupId);
    const id = cleanMemberId(memberId);
    const account = state.accounts[id];
    if (!account) return null;
    const rank = memberRank(state, id);
    const pet = activePet(state, account);
    return {
      ...serializedMember(state, account),
      activePet: pet ? { ...pet, catalog: petFor(state, pet.petId) } : null,
      pets: account.pets.map((owned) => ({ ...owned, catalog: petFor(state, owned.petId) })),
      inventory: deepClone(account.inventory),
      achievements: deepClone(account.achievements),
      taskProgress: deepClone(account.taskProgress),
      rank: rank.rank,
      nextPoints: rank.nextPoints,
      lastActiveDay: account.lastActiveDay,
    };
  }

  async function ensureMember(groupId, memberId, name = "") {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.enabled) throw new Error("عالم المجموعة غير مفعّل");
      const account = ensureAccount(state, id, name);
      if (!account.initialized && state.modules.economy) initializeAccount(state, account, now());
      return serializedMember(state, account);
    });
  }

  async function getMembers(groupId, search = "") {
    const state = await getGroup(groupId);
    const query = String(search || "").trim().toLowerCase();
    return Object.values(state.accounts)
      .filter((account) => !query || `${account.name} ${account.memberId}`.toLowerCase().includes(query))
      .map((account) => serializedMember(state, account))
      .sort((a, b) => b.balance - a.balance || a.memberId.localeCompare(b.memberId));
  }

  async function adjustBalance(groupId, memberId, amount, actor, reason) {
    const id = cleanMemberId(memberId);
    const delta = clampInt(amount, -1_000_000, 1_000_000, "مقدار النقاط");
    if (!delta) throw new Error("أدخل مبلغًا غير صفري");
    const why = String(reason || "").trim();
    if (why.length < 3) throw new Error("اكتب سببًا واضحًا للعملية");
    return transact(groupId, (state) => {
      const account = ensureAccount(state, id);
      initializeAccount(state, account, now());
      if (account.balance + delta < 0) throw new Error("لا يمكن أن يصبح الرصيد سالبًا");
      const transaction = appendTransaction(state, account, delta, "admin_adjustment", why, actor, null, now());
      addAudit(state, actor, "balance_adjust", id, why, { amount: delta, transactionId: transaction.id });
      return { ok: true, member: serializedMember(state, account), transaction };
    });
  }

  async function setMemberEnabled(groupId, memberId, enabled, actor, reason = "") {
    const id = cleanMemberId(memberId);
    if (typeof enabled !== "boolean") throw new Error("حالة العضو غير صالحة");
    return transact(groupId, (state) => {
      const account = ensureAccount(state, id);
      account.enabled = enabled;
      addAudit(state, actor, enabled ? "member_enable" : "member_disable", id, reason || "تغيير حالة العضو");
      return { ok: true, member: serializedMember(state, account) };
    });
  }

  async function adminUpdateMember(groupId, memberId, patch, actor, reason) {
    const id = cleanMemberId(memberId);
    const why = String(reason || "").trim();
    if (why.length < 3) throw new Error("اكتب سببًا واضحًا للتعديل");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("بيانات التعديل غير صالحة");
    return transact(groupId, (state) => {
      const account = ensureAccount(state, id);
      const changed = [];
      if (patch.xp !== undefined) {
        account.xp = clampInt(patch.xp, 0, 1_000_000_000, "XP");
        changed.push("xp");
      }
      if (patch.level !== undefined) {
        account.level = clampInt(patch.level, 1, 1_000_000, "المستوى");
        changed.push("level");
      }
      if (patch.rankOverrideId !== undefined) {
        const rankId = patch.rankOverrideId ? String(patch.rankOverrideId) : null;
        if (rankId && !state.settings.ranks.some((rank) => rank.id === rankId)) {
          throw new Error("الرتبة المختارة غير موجودة");
        }
        if (rankId === "emperor") {
          const sorted = Object.values(state.accounts)
            .filter((candidate) => candidate.enabled !== false)
            .sort((a, b) => b.balance - a.balance || a.memberId.localeCompare(b.memberId));
          if (sorted[0]?.memberId !== id) throw new Error("رتبة الإمبراطور محفوظة لصاحب أعلى رصيد");
        }
        account.rankOverrideId = rankId;
        changed.push("rank");
      }
      if (patch.activePetId !== undefined) {
        const petId = patch.activePetId ? String(patch.activePetId) : null;
        if (petId && !account.pets.some((pet) => pet.petId === petId)) {
          throw new Error("لا يمكن تفعيل حيوان لا يملكه العضو");
        }
        account.activePetId = petId;
        changed.push("pet");
      }
      if (patch.enabled !== undefined) {
        if (typeof patch.enabled !== "boolean") throw new Error("حالة العضو غير صالحة");
        account.enabled = patch.enabled;
        changed.push("enabled");
      }
      if (patch.bannedGames !== undefined) {
        const allowedGames = new Set(Object.keys(DEFAULT_GAME_SETTINGS));
        if (!Array.isArray(patch.bannedGames) || patch.bannedGames.length > allowedGames.size) {
          throw new Error("قائمة حظر الألعاب غير صالحة");
        }
        const banned = [...new Set(patch.bannedGames.map(String))];
        if (banned.some((game) => !allowedGames.has(game))) throw new Error("يوجد اسم لعبة غير معروف في الحظر");
        account.bannedGames = banned;
        changed.push("bannedGames");
      }
      if (!changed.length) throw new Error("لم يتم تحديد أي حقل للتعديل");
      addAudit(state, actor, "member_profile_update", id, why, { fields: changed });
      return { ok: true, member: serializedMember(state, account) };
    });
  }

  async function purchasePet(groupId, memberId, petId, name = "") {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.enabled || !state.modules.pets || !state.modules.shops) throw new Error("متجر الحيوانات غير مفعّل");
      const pet = petFor(state, String(petId));
      if (!pet) throw new Error("الحيوان غير موجود في المتجر");
      const account = ensureAccount(state, id, name);
      initializeAccount(state, account, now());
      if (account.enabled === false) throw new Error("حسابك معطّل في نظام النقاط");
      if (account.pets.some((owned) => owned.petId === pet.id)) throw new Error("هذا الحيوان موجود في حقيبتك بالفعل");
      if (account.balance < pet.price) throw new Error("رصيدك لا يكفي لشراء هذا الحيوان");
      appendTransaction(state, account, -Number(pet.price), "pet_purchase", `شراء ${pet.name}`, "member", null, now());
      account.pets.push({ id: pet.id, petId: pet.id, level: 1, acquiredAt: now().toISOString() });
      if (!account.activePetId) account.activePetId = pet.id;
      unlockAchievements(state, account, now());
      return { ok: true, pet, balance: account.balance };
    });
  }

  async function activatePet(groupId, memberId, petId) {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      const account = ensureAccount(state, id);
      if (!account.pets.some((owned) => owned.petId === petId)) throw new Error("لا تملك هذا الحيوان");
      account.activePetId = petId;
      return { ok: true, activePetId: petId };
    });
  }

  async function upgradePet(groupId, memberId, petId = null) {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      const account = ensureAccount(state, id);
      const selectedId = petId || account.activePetId;
      const owned = account.pets.find((pet) => pet.petId === selectedId);
      if (!owned) throw new Error("اختر حيوانًا تملكه للترقية");
      if (owned.level >= 5) throw new Error("وصل الحيوان إلى أعلى مستوى");
      const catalog = petFor(state, owned.petId);
      const cost = Math.ceil(Number(catalog.price) * 0.35 * owned.level);
      if (account.balance < cost) throw new Error("رصيدك لا يكفي للترقية");
      appendTransaction(state, account, -cost, "pet_upgrade", `ترقية ${catalog.name} إلى المستوى ${owned.level + 1}`, "member", null, now());
      owned.level += 1;
      return { ok: true, pet: owned, cost, balance: account.balance };
    });
  }

  async function purchaseItem(groupId, memberId, itemId) {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.modules.shops) throw new Error("المتجر غير مفعّل");
      const item = state.catalogs.items.find((candidate) => candidate.id === itemId && candidate.enabled !== false);
      if (!item) throw new Error("العنصر غير موجود");
      const account = ensureAccount(state, id);
      initializeAccount(state, account, now());
      if (account.balance < Number(item.price)) throw new Error("رصيدك لا يكفي لهذا العنصر");
      appendTransaction(state, account, -Number(item.price), "item_purchase", `شراء ${item.name}`, "member", null, now());
      const existing = account.inventory.find((owned) => owned.itemId === itemId);
      if (existing && !item.durationDays) existing.quantity += 1;
      else account.inventory.push({
        itemId,
        quantity: 1,
        purchasedAt: now().toISOString(),
        expiresAt: item.durationDays ? new Date(now().getTime() + Number(item.durationDays) * 86_400_000).toISOString() : null,
      });
      if (item.category === "title") account.titleItemId = itemId;
      if (item.category === "frame") account.frameItemId = itemId;
      return { ok: true, item, balance: account.balance };
    });
  }

  async function claimDailyBonusIfReady(state, account, eventId, timestamp) {
    const pet = activePet(state, account);
    const catalog = pet && petFor(state, pet.petId);
    if (catalog?.ability !== "periodic") return 0;
    if (timestamp.getTime() - Date.parse(pet.lastPeriodicAt || "1970-01-01") < 24 * 60 * 60 * 1_000) return 0;
    pet.lastPeriodicAt = timestamp.toISOString();
    return grantCappedReward(state, account, Number(catalog.value), "pet_periodic", "مكافأة الحيوان الدورية", "system", eventId, timestamp);
  }

  async function claimGiftForMember(groupId, memberId, type, name) {
    return claimGift(groupId, memberId, type, name);
  }

  async function updateSettings(groupId, patch, actor) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("الإعدادات غير صالحة");
    return transact(groupId, (state) => {
      if (patch.rewards) {
        for (const key of Object.keys(DEFAULT_SETTINGS.rewards)) {
          if (patch.rewards[key] === undefined) continue;
          state.settings.rewards[key] = clampInt(patch.rewards[key], 0, 100_000, `إعداد ${key}`);
        }
      }
      if (patch.antiSpam) {
        const ranges = {
          repeatThreshold: [3, 30],
          windowSeconds: [10, 300],
          floodThreshold: [8, 100],
          penaltyPoints: [0, 10_000],
          penaltyCooldownSeconds: [10, 3_600],
          warningEvery: [1, 100],
          kickAfterSpamMessages: [0, 10_000],
        };
        for (const [key, value] of Object.entries(patch.antiSpam)) {
          if (key === "enabled") {
            if (typeof value !== "boolean") throw new Error("حالة مكافحة السبام غير صالحة");
            state.settings.antiSpam.enabled = value;
            continue;
          }
          if (key === "floodDuplicateRatio") {
            const ratio = Number(value);
            if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 1) throw new Error("نسبة التكرار غير صالحة");
            state.settings.antiSpam[key] = ratio;
            continue;
          }
          if (!ranges[key]) throw new Error("إعداد مكافحة السبام غير معروف");
          state.settings.antiSpam[key] = clampInt(value, ...ranges[key], key);
        }
      }
      if (patch.ranks !== undefined) {
        if (!Array.isArray(patch.ranks) || patch.ranks.length < 2 || patch.ranks.length > 20) {
          throw new Error("يجب ضبط رتبتين إلى 20 رتبة");
        }
        const ids = new Set();
        state.settings.ranks = patch.ranks.map((rank) => {
          const id = String(rank.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
          const name = String(rank.name || "").trim().slice(0, 40);
          if (!id || !name || ids.has(id)) throw new Error("بيانات الرتب غير صالحة أو مكررة");
          ids.add(id);
          return {
            id,
            name,
            icon: String(rank.icon || "⭐").slice(0, 8),
            color: /^#[0-9a-f]{6}$/i.test(rank.color) ? rank.color : "#64748b",
            minPoints: clampInt(rank.minPoints ?? 0, 0, 1_000_000_000, "حد الرتبة"),
          };
        });
        if (!ids.has("emperor")) throw new Error("يجب إبقاء رتبة الإمبراطور");
      }
      if (patch.dailyTasks !== undefined || patch.weeklyTasks !== undefined) {
        for (const [key, list] of [["dailyTasks", patch.dailyTasks], ["weeklyTasks", patch.weeklyTasks]]) {
          if (list === undefined) continue;
          if (!Array.isArray(list) || list.length > 20) throw new Error("قائمة المهام غير صالحة");
          state.settings[key] = list.map((task, index) => {
            const id = String(task.id || `task-${index + 1}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
            const name = String(task.name || "").trim().slice(0, 80);
            if (!id || !name) throw new Error("اسم المهمة مطلوب");
            return {
              id,
              name,
              kind: task.kind === "messages" ? "messages" : "messages",
              target: clampInt(task.target, 1, 100_000, "هدف المهمة"),
              reward: clampInt(task.reward, 0, 100_000, "مكافأة المهمة"),
            };
          });
        }
      }
      if (patch.achievementRules !== undefined) {
        if (!Array.isArray(patch.achievementRules) || patch.achievementRules.length > 100) {
          throw new Error("قائمة الإنجازات غير صالحة");
        }
        const ids = new Set();
        state.settings.achievementRules = patch.achievementRules.map((rule, index) => {
          const id = String(rule.id || `achievement-${index + 1}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
          const name = String(rule.name || "").trim().slice(0, 80);
          const kind = ["messages", "streak", "pets", "level", "earned", "spent"].includes(rule.kind)
            ? rule.kind
            : "messages";
          if (!id || !name || ids.has(id)) throw new Error("بيانات الإنجاز غير صالحة أو مكررة");
          ids.add(id);
          return {
            id,
            name,
            kind,
            target: clampInt(rule.target, 1, 1_000_000_000, "هدف الإنجاز"),
            badge: String(rule.badge || "🏅").slice(0, 8),
          };
        });
      }
      if (patch.messageTemplates !== undefined) {
        if (!patch.messageTemplates || typeof patch.messageTemplates !== "object" || Array.isArray(patch.messageTemplates)) {
          throw new Error("قوالب الرسائل غير صالحة");
        }
        const next = {};
        for (const [key, value] of Object.entries(patch.messageTemplates)) {
          if (!/^[a-z0-9_-]{1,50}$/i.test(key) || typeof value !== "string" || value.length > 2_000) {
            throw new Error("قالب الرسالة غير صالح");
          }
          next[key] = value;
        }
        state.settings.messageTemplates = next;
      }
      if (patch.automaticRewards !== undefined) {
        const updates = patch.automaticRewards;
        if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
          throw new Error("إعدادات التوزيع التلقائي غير صالحة");
        }
        const timeKeys = ["dailyTime", "weeklyTime"];
        for (const key of timeKeys) {
          if (updates[key] === undefined) continue;
          if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(updates[key]))) {
            throw new Error("وقت التوزيع يجب أن يكون بصيغة 24 ساعة مثل 08:00");
          }
          state.settings.automaticRewards[key] = String(updates[key]);
        }
        if (updates.enabled !== undefined) {
          if (typeof updates.enabled !== "boolean") throw new Error("حالة التوزيع التلقائي غير صالحة");
          state.settings.automaticRewards.enabled = updates.enabled;
        }
        if (updates.weeklyDay !== undefined) {
          state.settings.automaticRewards.weeklyDay = clampInt(updates.weeklyDay, 0, 6, "يوم التوزيع الأسبوعي");
        }
        for (const key of ["dailyAmount", "weeklyAmount"]) {
          if (updates[key] !== undefined) {
            state.settings.automaticRewards[key] = clampInt(updates[key], 0, 1_000_000, key);
          }
        }
      }
      if (patch.games !== undefined) {
        if (!patch.games || typeof patch.games !== "object" || Array.isArray(patch.games)) {
          throw new Error("إعدادات الألعاب غير صالحة");
        }
        const allowed = new Set(Object.keys(DEFAULT_GAME_SETTINGS));
        for (const [gameId, updates] of Object.entries(patch.games)) {
          if (!allowed.has(gameId) || !updates || typeof updates !== "object" || Array.isArray(updates)) {
            throw new Error("إعداد لعبة غير معروف");
          }
          const target = state.settings.games[gameId];
          for (const [key, value] of Object.entries(updates)) {
            if (key === "difficulty") {
              if (!["easy", "normal", "hard"].includes(String(value))) throw new Error("مستوى الصعوبة غير صالح");
              target[key] = String(value);
            } else if (key === "rewards") {
              if (!Array.isArray(value) || value.length < 2 || value.length > 20) throw new Error("جدول مكافآت العجلة غير صالح");
              target[key] = value.map((reward) => clampInt(reward, 0, 10_000, "مكافأة العجلة"));
            } else {
              if (!(key in target)) throw new Error("إعداد لعبة غير معروف");
              target[key] = clampInt(value, key === "dailyLimit" ? 0 : 0, 1_000_000, key);
            }
          }
        }
      }
      if (patch.challengeBank !== undefined) {
        if (!Array.isArray(patch.challengeBank) || patch.challengeBank.length < 1 || patch.challengeBank.length > 500) {
          throw new Error("قاعدة أسئلة التحديات يجب أن تحتوي من سؤال إلى 500 سؤال");
        }
        const ids = new Set();
        const types = new Set(["general", "math", "riddle", "emoji", "scramble", "memory", "speed", "letters", "hidden", "streak", "geography", "english", "cipher", "logic", "sequence"]);
        state.settings.challengeBank = patch.challengeBank.map((item, index) => {
          const id = String(item?.id || `question-${index + 1}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 60);
          const prompt = String(item?.prompt || "").trim().slice(0, 500);
          const answer = String(item?.answer || "").trim().slice(0, 100);
          const type = String(item?.type || "general");
          if (!id || ids.has(id) || !types.has(type) || !prompt || !answer) {
            throw new Error("يوجد سؤال ناقص أو معرّف مكرر أو نوع غير صالح");
          }
          ids.add(id);
          return {
            id,
            type,
            difficulty: ["easy", "normal", "hard"].includes(item.difficulty) ? item.difficulty : "normal",
            prompt,
            answer,
            aliases: Array.isArray(item.aliases)
              ? item.aliases.slice(0, 12).map((alias) => String(alias).trim().slice(0, 100)).filter(Boolean)
              : [],
          };
        });
      }
      if (patch.season !== undefined) {
        if (patch.season === null || patch.season.enabled === false) {
          state.season = null;
        } else {
          const title = String(patch.season.title || "").trim().slice(0, 80);
          if (!title) throw new Error("اسم الموسم مطلوب");
          const startsAt = patch.season.startsAt ? new Date(patch.season.startsAt).toISOString() : null;
          const endsAt = patch.season.endsAt ? new Date(patch.season.endsAt).toISOString() : null;
          if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
            throw new Error("تاريخ نهاية الموسم يجب أن يأتي بعد بدايته");
          }
          state.season = {
            id: String(patch.season.id || `season-${groupWorldDayKey(now())}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 50),
            title,
            startsAt: startsAt || now().toISOString(),
            endsAt,
            reward: clampInt(patch.season.reward ?? 0, 0, 1_000_000, "جائزة الموسم"),
            enabled: true,
            createdAt: now().toISOString(),
          };
        }
      }
      addAudit(state, actor, "settings_update", groupId, "تحديث إعدادات عالم المجموعة", { keys: Object.keys(patch) });
      return { ok: true, settings: deepClone(state.settings), modules: deepClone(state.modules) };
    });
  }

  async function upsertCatalogItem(groupId, collection, item, actor) {
    if (!["pets", "items"].includes(collection)) throw new Error("نوع المتجر غير صالح");
    if (!item || typeof item !== "object") throw new Error("بيانات العنصر غير صالحة");
    const id = String(item.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    const name = String(item.name || "").trim().slice(0, 60);
    const price = clampInt(item.price, 1, 10_000_000, "السعر");
    if (!id || !name) throw new Error("معرّف العنصر واسمه مطلوبان");
    return transact(groupId, (state) => {
      const list = state.catalogs[collection];
      const existingIndex = list.findIndex((entry) => entry.id === id);
      const existing = existingIndex >= 0 ? list[existingIndex] : null;
      const normalized = collection === "pets"
        ? {
            id,
            name,
            icon: String(item.icon || "🐾").slice(0, 8),
            price,
            ability: ["chat", "gift", "periodic", "tasks", "challenge", "activity"].includes(item.ability) ? item.ability : "activity",
            value: Math.max(0, Math.min(item.ability === "periodic" ? 1_000 : 1, Number(item.value) || 0)),
            abilityDescription: String(item.abilityDescription || item.description || existing?.abilityDescription || "قدرة خاصة قابلة للتطوير.").trim().slice(0, 500),
            description: String(item.description || item.abilityDescription || existing?.description || "قدرة خاصة قابلة للتطوير.").trim().slice(0, 500),
            levels: Array.isArray(item.levels) && item.levels.length
              ? item.levels.slice(0, 5).map((level, index) => ({
                level: clampInt(level.level ?? index + 1, 1, 5, "مستوى الحيوان"),
                value: Math.max(0, Math.min(item.ability === "periodic" ? 1_000 : 1, Number(level.value) || 0)),
                upgradeCost: clampInt(level.upgradeCost ?? 0, 0, 10_000_000, "تكلفة الترقية"),
              }))
              : existing?.levels || Array.from({ length: 5 }, (_, index) => ({
                level: index + 1,
                value: Number(((Number(item.value) || 0) * (1 + index * 0.2)).toFixed(3)),
                upgradeCost: index === 0 ? 0 : Math.ceil(price * 0.35 * index),
              })),
            enabled: item.enabled !== false,
          }
        : {
            id,
            name,
            icon: String(item.icon || "🎁").slice(0, 8),
            price,
            category: ["title", "frame", "item", "collectible", "badge", "power"].includes(item.category) ? item.category : "item",
            durationDays: clampInt(item.durationDays ?? 0, 0, 365, "مدة العنصر"),
            value: Math.max(0, Math.min(0.5, Number(item.value) || 0)),
            enabled: item.enabled !== false,
          };
      if (existingIndex >= 0) list[existingIndex] = normalized;
      else if (list.length < 200) list.push(normalized);
      else throw new Error("وصل المتجر إلى الحد الأقصى للعناصر");
      addAudit(state, actor, existingIndex >= 0 ? "catalog_update" : "catalog_add", id, "تعديل عنصر المتجر", { collection });
      return { ok: true, item: normalized, catalog: deepClone(state.catalogs[collection]) };
    });
  }

  async function deleteCatalogItem(groupId, collection, itemId, actor) {
    if (!["pets", "items"].includes(collection)) throw new Error("نوع المتجر غير صالح");
    return transact(groupId, (state) => {
      const item = state.catalogs[collection].find((entry) => entry.id === itemId);
      if (!item) throw new Error("العنصر غير موجود");
      item.enabled = false;
      addAudit(state, actor, "catalog_disable", itemId, "إخفاء العنصر من المتجر", { collection });
      return { ok: true };
    });
  }

  async function addCustomCommand(groupId, command, actor) {
    const normalized = safeCommand(command);
    return transact(groupId, (state) => {
      if (state.commands.some((item) => item.name.toLowerCase() === normalized.name.toLowerCase())) {
        throw new Error("هذا الأمر موجود بالفعل");
      }
      state.commands.push(normalized);
      addAudit(state, actor, "command_add", normalized.name, "إضافة أمر نصي");
      return { ok: true, command: normalized };
    });
  }

  async function updateCustomCommand(groupId, commandId, patch, actor) {
    return transact(groupId, (state) => {
      const index = state.commands.findIndex((item) => item.id === commandId);
      if (index < 0) throw new Error("الأمر غير موجود");
      const next = safeCommand({ ...state.commands[index], ...patch, id: commandId });
      if (state.commands.some((item, itemIndex) =>
        itemIndex !== index && item.name.toLowerCase() === next.name.toLowerCase()
      )) throw new Error("اسم الأمر مستخدم بالفعل");
      state.commands[index] = next;
      addAudit(state, actor, "command_update", commandId, "تعديل أمر نصي");
      return { ok: true, command: next };
    });
  }

  async function deleteCustomCommand(groupId, commandId, actor) {
    return transact(groupId, (state) => {
      const command = state.commands.find((item) => item.id === commandId);
      if (!command) throw new Error("الأمر غير موجود");
      command.enabled = false;
      addAudit(state, actor, "command_disable", commandId, "تعطيل أمر نصي");
      return { ok: true };
    });
  }

  async function runCustomCommand(groupId, commandName, values) {
    const state = await getGroup(groupId);
    if (!state.enabled || !state.modules.customCommands) return null;
    const command = state.commands.find((item) =>
      item.enabled && item.name.toLowerCase() === String(commandName).toLowerCase()
    );
    if (!command) return null;
    return renderMessageTemplate(command.response, values);
  }

  async function addAdministrator(groupId, phoneNumber, permissions, actor, linkedUserId = null) {
    const phone = String(phoneNumber || "").replace(/\D/g, "");
    if (phone.length < 6 || phone.length > 20) throw new Error("رقم واتساب غير صالح");
    const allowed = new Set(["view", "points", "members", "catalog", "messages", "commands", "logs", "settings"]);
    const selected = [...new Set((Array.isArray(permissions) ? permissions : []).filter((item) => allowed.has(item)))];
    if (!selected.length) throw new Error("اختر صلاحية واحدة على الأقل");
    return transact(groupId, (state) => {
      const entry = {
        phoneNumber: phone,
        linkedUserId: linkedUserId ? String(linkedUserId) : null,
        permissions: selected,
        enabled: true,
        addedBy: String(actor),
        addedAt: now().toISOString(),
      };
      const index = state.administrators.findIndex((admin) => admin.phoneNumber === phone);
      if (index >= 0) state.administrators[index] = entry;
      else state.administrators.push(entry);
      addAudit(state, actor, "administrator_add", phone, "إضافة مشرف", { permissions: selected });
      return { ok: true, administrator: entry };
    });
  }

  async function removeAdministrator(groupId, phoneNumber, actor) {
    const phone = String(phoneNumber || "").replace(/\D/g, "");
    return transact(groupId, (state) => {
      const administrator = state.administrators.find((item) => item.phoneNumber === phone);
      if (!administrator) throw new Error("المشرف غير موجود");
      administrator.enabled = false;
      addAudit(state, actor, "administrator_disable", phone, "تعطيل مشرف");
      return { ok: true };
    });
  }

  async function hasPermission(groupId, actor, permission) {
    const state = await getGroup(groupId);
    const id = String(actor || "");
    if (state.ownerId === id) return true;
    const separator = id.lastIndexOf("@");
    const domain = separator < 0 ? "" : id.slice(separator + 1).toLowerCase();
    const local = separator < 0 ? "" : id.slice(0, separator).replace(/:\d+$/, "");
    const normalizedPhone = ["s.whatsapp.net", "c.us"].includes(domain) && /^\+?\d+$/.test(local)
      ? local.replace(/\D/g, "")
      : "";
    if (normalizedPhone && normalizedPhone === String(state.ownerPhoneNumber || "")) return true;
    return state.administrators.some((admin) =>
      admin.enabled &&
      (admin.linkedUserId === id || admin.phoneNumber === normalizedPhone) &&
      admin.permissions.includes(permission)
    );
  }

  async function getSlots(groupId) {
    const state = await getGroup(groupId);
    return deepClone(state.slots);
  }

  async function refreshSlots(groupId, members, actor) {
    return transact(groupId, (state) => {
      state.slots = members.map((member, index) => ({
        slot: index + 1,
        memberId: cleanMemberId(member.memberId || member.id),
        name: String(member.name || member.notify || "").slice(0, 80),
        active: true,
      }));
      addAudit(state, actor, "slots_refresh", groupId, "إعادة ترتيب قائمة الأعضاء", { count: state.slots.length });
      return { ok: true, slots: deepClone(state.slots) };
    });
  }

  async function markMemberLeft(groupId, memberId) {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      state.slots = state.slots.map((slot) =>
        slot.memberId === id ? { ...slot, memberId: null, name: "", active: false } : slot
      );
      return { ok: true };
    });
  }

  async function getSlotMember(groupId, slotNumber) {
    const state = await getGroup(groupId);
    const number = clampInt(slotNumber, 1, 10_000, "رقم الخانة");
    const slot = state.slots.find((item) => item.slot === number);
    if (!slot?.memberId || slot.active === false) throw new Error("الخانة فارغة أو لم تعد مرتبطة بعضو");
    const account = state.accounts[slot.memberId];
    if (!account || account.enabled === false) throw new Error("حساب صاحب الخانة غير نشط");
    return { ...slot, member: serializedMember(state, account) };
  }

  async function adjustSlot(groupId, slotNumber, amount, actor, reason) {
    const delta = clampInt(amount, -1_000_000, 1_000_000, "مقدار النقاط");
    if (!delta) throw new Error("أدخل مبلغًا غير صفري");
    const why = String(reason || "تعديل من قائمة الأعضاء").trim();
    return transact(groupId, (state) => {
      const number = clampInt(slotNumber, 1, 10_000, "رقم الخانة");
      const slot = state.slots.find((item) => item.slot === number);
      if (!slot?.memberId || slot.active === false) throw new Error("الخانة فارغة");
      const account = state.accounts[slot.memberId];
      if (!account || account.enabled === false) throw new Error("حساب صاحب الخانة غير نشط");
      if (account.balance + delta < 0) throw new Error("لا يمكن أن يصبح الرصيد سالبًا");
      appendTransaction(state, account, delta, "slot_adjustment", why, actor, null, now());
      addAudit(state, actor, "slot_adjust", slot.memberId, why, { slot: number, amount: delta });
      return { ok: true, slot: number, member: serializedMember(state, account), amount: delta };
    });
  }

  async function updateGroupData(groupId, collection, data, actor) {
    const allowed = new Set(["events", "teams", "challenges"]);
    if (!allowed.has(collection) || !Array.isArray(data) || data.length > 500) {
      throw new Error("بيانات النظام الإضافي غير صالحة");
    }
    return transact(groupId, (state) => {
      state[collection] = data.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("عنصر غير صالح");
        const title = String(item.title || item.name || "").trim().slice(0, 100);
        const id = String(item.id || `${collection}-${index + 1}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 50);
        if (!title || !id) throw new Error("المعرّف والاسم مطلوبان");
        return {
          id,
          title,
          description: String(item.description || "").slice(0, 500),
          enabled: item.enabled !== false,
          startsAt: item.startsAt ? String(item.startsAt) : null,
          endsAt: item.endsAt ? String(item.endsAt) : null,
          reward: clampInt(item.reward ?? 0, 0, 1_000_000, "المكافأة"),
        };
      });
      addAudit(state, actor, `${collection}_update`, groupId, `تحديث ${collection}`);
      return { ok: true, [collection]: deepClone(state[collection]) };
    });
  }

  async function assignMemberToTeam(groupId, memberId, teamId, actor) {
    const id = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.modules.teams) throw new Error("الفرق غير مفعّلة");
      const team = state.teams.find((item) => item.id === teamId && item.enabled !== false);
      if (!team) throw new Error("الفريق غير موجود أو متوقف");
      const account = ensureAccount(state, id);
      account.teamId = team.id;
      addAudit(state, actor, "team_assign", id, "تعيين عضو إلى فريق", { teamId: team.id });
      return { ok: true, member: serializedMember(state, account), team };
    });
  }

  async function getReport(groupId, days = 14) {
    const state = await getGroup(groupId);
    const count = clampInt(days, 7, 90, "عدد أيام التقرير");
    const end = now();
    const dailyMap = new Map();
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(end.getTime() - offset * 86_400_000);
      const key = groupWorldDayKey(date);
      if (!dailyMap.has(key)) dailyMap.set(key, { day: key, earned: 0, spent: 0, messages: 0 });
    }
    for (const transaction of state.transactions) {
      const day = groupWorldDayKey(new Date(transaction.timestamp));
      const entry = dailyMap.get(day);
      if (!entry) continue;
      if (transaction.amount > 0) entry.earned += transaction.amount;
      else entry.spent += Math.abs(transaction.amount);
      if (transaction.kind === "message") entry.messages += 1;
    }
    const daily = [...dailyMap.values()];
    return {
      days: count,
      daily,
      totals: {
        earned: daily.reduce((sum, entry) => sum + entry.earned, 0),
        spent: daily.reduce((sum, entry) => sum + entry.spent, 0),
        messages: daily.reduce((sum, entry) => sum + entry.messages, 0),
      },
    };
  }

  async function settleSeason(groupId, actor) {
    return transact(groupId, (state) => {
      const season = state.season;
      if (!season?.enabled) throw new Error("لا يوجد موسم نشط");
      if (season.settledAt) throw new Error("تم توزيع جوائز هذا الموسم بالفعل");
      const startsAt = Date.parse(season.startsAt || season.createdAt || "1970-01-01");
      const endsAt = season.endsAt ? Date.parse(season.endsAt) : now().getTime();
      if (endsAt > now().getTime()) throw new Error("لا يمكن توزيع الجوائز قبل نهاية الموسم");
      const scores = new Map();
      for (const transaction of state.transactions) {
        const at = Date.parse(transaction.timestamp);
        if (
          transaction.amount > 0 &&
          transaction.kind !== "starting_balance" &&
          at >= startsAt &&
          at <= endsAt
        ) {
          scores.set(transaction.memberId, (scores.get(transaction.memberId) || 0) + transaction.amount);
        }
      }
      const winners = [...scores.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([memberId, score], index) => ({
          memberId,
          score,
          place: index + 1,
          share: [0.6, 0.25, 0.15][index],
        }));
      if (!winners.length) throw new Error("لا توجد نقاط مكتسبة في فترة الموسم");
      const reward = clampInt(season.reward, 0, 1_000_000, "جائزة الموسم");
      const awarded = [];
      for (const winner of winners) {
        const account = state.accounts[winner.memberId];
        if (!account) continue;
        const requested = winner.place === winners.length
          ? reward - awarded.reduce((sum, entry) => sum + entry.requested, 0)
          : Math.floor(reward * winner.share);
        const credited = grantCappedReward(
          state,
          account,
          requested,
          "season_reward",
          `جائزة الموسم — المركز ${winner.place}`,
          actor,
          `${season.id}:${winner.memberId}`,
          now(),
        );
        awarded.push({ ...winner, requested, credited });
      }
      season.settledAt = now().toISOString();
      season.winners = awarded;
      addAudit(state, actor, "season_settle", season.id, "توزيع جوائز الموسم", { winners: awarded });
      return { ok: true, season: deepClone(season), winners: awarded };
    });
  }

  async function getOverview(groupId) {
    const state = await getGroup(groupId);
    const members = Object.values(state.accounts).filter((account) => account.enabled !== false);
    const totalBalance = members.reduce((sum, account) => sum + account.balance, 0);
    const totalMessages = members.reduce((sum, account) => sum + account.messages, 0);
    const top = [...members].sort((a, b) => b.balance - a.balance).slice(0, 5);
    const recent = state.transactions.slice(-8).reverse();
    return {
      groupId: state.groupId,
      enabled: state.enabled,
      ownerId: state.ownerId,
      activatedAt: state.activatedAt,
      modules: deepClone(state.modules),
      members: members.length,
      totalBalance,
      totalMessages,
      totalEarned: members.reduce((sum, account) => sum + account.totalEarned, 0),
      totalSpent: members.reduce((sum, account) => sum + account.totalSpent, 0),
      spamViolations: state.violations.length,
      pets: state.catalogs.pets.filter((pet) => pet.enabled !== false).length,
      shopItems: state.catalogs.items.filter((item) => item.enabled !== false).length,
      topMembers: top.map((account) => serializedMember(state, account)),
      mostActiveMembers: [...members].sort((a, b) => b.messages - a.messages).slice(0, 5).map((account) => serializedMember(state, account)),
      topEarners: [...members].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5).map((account) => serializedMember(state, account)),
      topSpenders: [...members].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5).map((account) => serializedMember(state, account)),
      recentTransactions: recent,
      settings: deepClone(state.settings),
      catalogs: deepClone(state.catalogs),
      commands: deepClone(state.commands),
      administrators: deepClone(state.administrators),
      slotsCount: state.slots.length,
      teams: state.teams.map((team) => ({
        ...deepClone(team),
        balance: members
          .filter((account) => account.teamId === team.id)
          .reduce((sum, account) => sum + account.balance, 0),
        members: members.filter((account) => account.teamId === team.id).length,
      })),
      challenges: deepClone(state.challenges),
      gameData: deepClone(state.gameData),
      events: deepClone(state.events),
      season: deepClone(state.season),
    };
  }

  async function runGroupTransaction(groupId, operation) {
    if (typeof operation !== "function") throw new Error("معالجة بيانات اللعبة غير صالحة");
    return transact(groupId, operation);
  }

  async function distributeAutomaticGift(groupId, type, periodKey) {
    if (!["daily", "weekly"].includes(type)) throw new Error("نوع توزيع المكافأة غير صالح");
    const key = String(periodKey || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) && !/^\d{4}-W\d{2}$/.test(key)) {
      throw new Error("معرّف فترة التوزيع غير صالح");
    }
    return transact(groupId, (state) => {
      if (!state.enabled || !state.modules.automaticRewards || state.settings.automaticRewards.enabled === false) {
        return { skipped: true, reason: "disabled" };
      }
      const id = `${state.groupId}:${type}:${key}`;
      const existing = state.gameData.rewardReports.find((report) => report.id === id);
      if (existing) return { duplicate: true, report: deepClone(existing) };
      const amount = Number(type === "daily"
        ? state.settings.automaticRewards.dailyAmount
        : state.settings.automaticRewards.weeklyAmount);
      const periodField = type === "daily" ? "lastDailyGiftDay" : "lastWeeklyGiftWeek";
      const recipients = [];
      let totalPoints = 0;
      for (const account of Object.values(state.accounts)) {
        if (account.enabled === false || !account.initialized || account[periodField] === key) continue;
        account[periodField] = key;
        const credited = state.modules.economy
          ? grantCappedReward(
            state,
            account,
            amount,
            type === "daily" ? "automatic_daily_gift" : "automatic_weekly_gift",
            type === "daily" ? "المكافأة اليومية التلقائية" : "المكافأة الأسبوعية التلقائية",
            "system",
            `automatic-gift:${id}:${account.memberId}`,
            now(),
          )
          : 0;
        if (credited > 0) {
          recipients.push({ memberId: account.memberId, name: account.name || account.memberId.split("@")[0], points: credited });
          totalPoints += credited;
        }
      }

      const enabledAccounts = Object.values(state.accounts).filter((account) => account.enabled !== false);
      const sorted = [...enabledAccounts].sort((a, b) => b.balance - a.balance || a.memberId.localeCompare(b.memberId));
      const previous = [...state.gameData.rewardReports]
        .filter((report) => report.type === type && report.status === "sent")
        .sort((a, b) => String(b.periodKey).localeCompare(String(a.periodKey)))[0];
      const priorById = new Map((previous?.snapshot || []).map((item) => [item.memberId, item]));
      const snapshot = sorted.map((account, index) => ({
        memberId: account.memberId,
        name: account.name || account.memberId.split("@")[0],
        balance: account.balance,
        xp: account.xp,
        messages: account.messages,
        position: index + 1,
      }));
      const recipientById = new Map(recipients.map((recipient) => [recipient.memberId, recipient]));
      const mostImproved = [...enabledAccounts]
        .map((account) => ({
          account,
          increase: recipientById.get(account.memberId)?.points || 0,
          xpIncrease: Math.max(0, Number(account.xp || 0) - Number(priorById.get(account.memberId)?.xp || 0)),
        }))
        .sort((a, b) => b.increase - a.increase || b.xpIncrease - a.xpIncrease)[0];
      const largestRankJump = [...snapshot]
        .map((item) => ({
          ...item,
          jump: priorById.has(item.memberId) ? Number(priorById.get(item.memberId).position) - item.position : 0,
        }))
        .sort((a, b) => b.jump - a.jump)[0];
      const mostActive = [...snapshot]
        .map((item) => ({
          ...item,
          activity: Math.max(0, item.messages - Number(priorById.get(item.memberId)?.messages || 0)),
        }))
        .sort((a, b) => b.activity - a.activity)[0];
      const reportId = `GW${createHash("sha256").update(id).digest("hex").slice(0, 16).toUpperCase()}`;
      const report = {
        id,
        reportId,
        type,
        periodKey: key,
        status: "pending",
        createdAt: now().toISOString(),
        totalPoints,
        recipientsCount: recipients.length,
        recipients,
        highestBalance: sorted[0] ? { memberId: sorted[0].memberId, name: sorted[0].name || sorted[0].memberId.split("@")[0], balance: sorted[0].balance } : null,
        mostImproved: mostImproved?.account ? {
          memberId: mostImproved.account.memberId,
          name: mostImproved.account.name || mostImproved.account.memberId.split("@")[0],
          points: mostImproved.increase,
          xp: mostImproved.xpIncrease,
        } : null,
        largestRankJump: largestRankJump && largestRankJump.jump > 0 ? largestRankJump : null,
        mostActive: mostActive && mostActive.activity > 0 ? mostActive : null,
        topMembers: snapshot.slice(0, 10),
        comparison: previous ? {
          periodKey: previous.periodKey,
          totalPoints: previous.totalPoints,
          recipientsCount: previous.recipientsCount,
        } : null,
        snapshot,
      };
      state.gameData.rewardReports.push(report);
      if (state.gameData.rewardReports.length > 100) state.gameData.rewardReports.splice(0, state.gameData.rewardReports.length - 100);
      addAudit(state, "system", "automatic_gift", id, `توزيع مكافأة ${type}`, {
        totalPoints,
        recipients: recipients.length,
      });
      return { ok: true, report: deepClone(report) };
    });
  }

  async function getPendingGiftReports(groupId) {
    const state = await getGroup(groupId);
    return deepClone(state.gameData.rewardReports.filter((report) => report.status !== "sent"));
  }

  async function markGiftReportSent(groupId, reportId) {
    return transact(groupId, (state) => {
      const report = state.gameData.rewardReports.find((item) => item.reportId === String(reportId));
      if (!report) throw new Error("تقرير التوزيع غير موجود");
      if (report.status !== "sent") {
        report.status = "sent";
        report.sentAt = now().toISOString();
      }
      return { ok: true, report: deepClone(report) };
    });
  }

  async function getLogs(groupId, kind = "all", limit = 100) {
    const state = await getGroup(groupId);
    const count = clampInt(limit, 1, 500, "عدد السجلات");
    const entries = kind === "audit"
      ? state.auditLog
      : kind === "violations"
        ? state.violations
        : state.transactions;
    return entries.slice(-count).reverse();
  }

  async function markMemberJoined(groupId, member) {
    const id = cleanMemberId(member.memberId || member.id);
    return transact(groupId, (state) => {
      if (!state.enabled) return { ignored: true };
      const account = ensureAccount(state, id, member.name || member.notify);
      if (state.modules.economy) initializeAccount(state, account, now());
      if (!state.slots.some((slot) => slot.memberId === id && slot.active !== false)) {
        const slot = state.slots.length + 1;
        state.slots.push({ slot, memberId: id, name: account.name, active: true });
      }
      return { ok: true };
    });
  }

  async function canKickAfterSpam(groupId) {
    const state = await getGroup(groupId);
    return Number(state.settings.antiSpam.kickAfterSpamMessages) > 0;
  }

  async function getPublicCommands(groupId) {
    const state = await getGroup(groupId);
    const custom = state.commands.filter((item) => item.enabled).map((item) => item.name);
    return [...new Set([...BUILTIN_COMMANDS, ...custom])];
  }

  async function createChallenge(groupId, memberId, opponentId, stake, actor) {
    const challenger = cleanMemberId(memberId);
    const opponent = cleanMemberId(opponentId);
    const amount = clampInt(stake, 1, 100_000, "مبلغ التحدي");
    return transact(groupId, (state) => {
      if (!state.modules.challenges) throw new Error("التحديات غير مفعّلة");
      const a = ensureAccount(state, challenger);
      const b = ensureAccount(state, opponent);
      if (a.balance < amount || b.balance < amount) throw new Error("لا يملك أحد الطرفين رصيدًا كافيًا");
      const challenge = {
        id: `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        challenger,
        opponent,
        stake: amount,
        status: "open",
        createdAt: now().toISOString(),
        createdBy: String(actor || challenger),
      };
      state.challenges.push(challenge);
      addAudit(state, actor, "challenge_create", challenge.id, "إنشاء تحدٍ", { challenger, opponent, stake: amount });
      return deepClone(challenge);
    });
  }

  async function acceptChallenge(groupId, challengeId, memberId) {
    const acceptingMember = cleanMemberId(memberId);
    return transact(groupId, (state) => {
      if (!state.modules.challenges) throw new Error("التحديات غير مفعّلة");
      const challenge = state.challenges.find((item) => item.id === challengeId);
      if (!challenge || challenge.status !== "open") throw new Error("التحدي غير متاح للقبول");
      if (challenge.opponent !== acceptingMember) throw new Error("هذا التحدي موجّه إلى عضو آخر");
      const challenger = ensureAccount(state, challenge.challenger);
      const opponent = ensureAccount(state, challenge.opponent);
      initializeAccount(state, challenger, now());
      initializeAccount(state, opponent, now());
      const stake = clampInt(challenge.stake, 1, 100_000, "رهان التحدي");
      if (challenger.balance < stake || opponent.balance < stake) {
        throw new Error("رصيد أحد الطرفين لم يعد كافيًا");
      }
      appendTransaction(state, challenger, -stake, "challenge_stake", "حجز رهان التحدي", acceptingMember, null, now());
      appendTransaction(state, opponent, -stake, "challenge_stake", "حجز رهان التحدي", acceptingMember, null, now());
      challenge.status = "accepted";
      challenge.acceptedAt = now().toISOString();
      addAudit(state, acceptingMember, "challenge_accept", challenge.id, "قبول تحدٍ", { stake });
      return deepClone(challenge);
    });
  }

  async function settleChallenge(groupId, challengeId, winnerId, actor) {
    const winner = cleanMemberId(winnerId);
    return transact(groupId, (state) => {
      const challenge = state.challenges.find((item) => item.id === challengeId);
      if (!challenge || challenge.status === "settled" || challenge.status === "cancelled") {
        throw new Error("التحدي غير مفتوح");
      }
      if (![challenge.challenger, challenge.opponent].includes(winner)) throw new Error("الفائز ليس طرفًا في التحدي");
      const loser = winner === challenge.challenger ? challenge.opponent : challenge.challenger;
      const winnerAccount = ensureAccount(state, winner);
      const stake = clampInt(challenge.stake, 1, 100_000, "رهان التحدي");
      if (challenge.status !== "accepted") throw new Error("يجب قبول التحدي قبل تسويته");
      const prize = stake * 2;
      appendTransaction(state, winnerAccount, prize, "challenge_win", "الفوز برهان التحدي", actor, null, now());
      const bonus = Math.round(prize * (petMultiplier(state, winnerAccount, "challenge") - 1));
      if (bonus > 0) {
        grantCappedReward(state, winnerAccount, bonus, "pet_challenge_bonus", "زيادة الحيوان على جائزة التحدي", actor, null, now());
      }
      challenge.status = "settled";
      challenge.winnerId = winner;
      challenge.settledAt = now().toISOString();
      addAudit(state, actor, "challenge_settle", challenge.id, "تسوية تحدٍ", { winner, loser, stake });
      return { ok: true, challenge: deepClone(challenge) };
    });
  }

  return {
    store,
    getGroup,
    listGroups: () => store.listGroups().then((groups) => groups.map(ensureDefaults)),
    runGroupTransaction,
    distributeAutomaticGift,
    getPendingGiftReports,
    markGiftReportSent,
    activateGroup,
    setEnabled,
    setModule,
    processMessage,
    rewardInvite,
    claimGift,
    claimGiftForMember,
    getLeaderboard,
    getMemberProfile,
    ensureMember,
    getMembers,
    adjustBalance,
    setMemberEnabled,
    adminUpdateMember,
    purchasePet,
    activatePet,
    upgradePet,
    purchaseItem,
    updateSettings,
    upsertCatalogItem,
    deleteCatalogItem,
    addCustomCommand,
    updateCustomCommand,
    deleteCustomCommand,
    runCustomCommand,
    addAdministrator,
    removeAdministrator,
    hasPermission,
    getSlots,
    refreshSlots,
    markMemberLeft,
    markMemberJoined,
    getSlotMember,
    adjustSlot,
    updateGroupData,
    assignMemberToTeam,
    getOverview,
    getReport,
    settleSeason,
    getLogs,
    canKickAfterSpam,
    getPublicCommands,
    createChallenge,
    acceptChallenge,
    settleChallenge,
    audit,
  };
}

export const groupWorldService = createGroupWorldService();
