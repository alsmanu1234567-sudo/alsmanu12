import { randomInt } from "node:crypto";
import { groupWorldDayKey } from "./group-world-service.mjs";
import { awardActivityRewardInState } from "./group-world-activity-service.mjs";

const WORDS = ["قمر", "نهر", "شجرة", "كتاب", "نجمة", "مفتاح", "صقر", "مدينة"];
const DUNGEON_STAGES = 5;
const DEFAULT_RECIPES = {
  potion: { name: "جرعة مغامرة", cost: { wood: 2, crystal: 1 } },
  shield: { name: "درع الفريق", cost: { wood: 4, crystal: 2 } },
  compass: { name: "بوصلة نادرة", cost: { wood: 2, crystal: 4 } },
};

function clone(value) {
  return structuredClone(value);
}

function activityId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${randomInt(0x100000, 0xffffff).toString(36).toUpperCase()}`;
}

function requireModule(state, moduleName) {
  if (!state.enabled) throw new Error("عالم المجموعة غير مفعّل");
  if (!state.modules[moduleName]) throw new Error("هذه الوحدة متوقفة في إعدادات المجموعة");
}

function accountFor(state, memberId, moduleName = "") {
  const account = state.accounts[String(memberId)];
  if (!account) throw new Error("ملف العضو غير موجود في عالم المجموعة");
  if (account.enabled === false) throw new Error("حساب العضو معطّل");
  if (moduleName && account.bannedGames?.includes(moduleName)) throw new Error("تم حظرك من هذه اللعبة في هذه المجموعة");
  return account;
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function debit(state, account, amount, eventId, reason) {
  const cost = Math.max(0, Math.trunc(Number(amount) || 0));
  if (account.balance < cost) throw new Error("رصيدك لا يكفي لهذه العملية");
  account.balance -= cost;
  account.totalSpent += cost;
  state.transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    memberId: account.memberId,
    amount: -cost,
    kind: "rpg_purchase",
    reason: String(reason).slice(0, 300),
    actor: "member",
    eventId,
    timestamp: new Date().toISOString(),
  });
}

function selectQuestion(state, category = null) {
  const bank = state.settings.challengeBank.filter((item) => !category || item.type === category);
  if (!bank.length) throw new Error("لا توجد أسئلة متاحة");
  const question = clone(bank[randomInt(bank.length)]);
  return question;
}

function answerMatches(question, value) {
  const answer = normalizeAnswer(value);
  return [question.answer, ...(question.aliases || [])].some((candidate) => normalizeAnswer(candidate) === answer);
}

function activeItem(items) {
  return [...items].reverse().find((item) => item.status === "active") || null;
}

export function createGroupWorldRpgService({ service, now = () => new Date() }) {
  if (typeof service?.runGroupTransaction !== "function") throw new Error("Group World transaction support is required");

  async function startBoss(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "bossRaid");
      accountFor(state, memberId, "bossRaid");
      const active = activeItem(state.gameData.bossRaids);
      if (active) return clone(active);
      const config = state.settings.games.bossRaid;
      const raid = {
        id: activityId("boss"),
        level: Math.max(1, Math.floor(state.gameData.bossRaids.length / 3) + 1),
        maxHealth: Math.max(100, Number(config.health) || 5_000),
        health: Math.max(100, Number(config.health) || 5_000),
        status: "active",
        participants: [],
        createdAt: now().toISOString(),
        endedAt: null,
      };
      state.gameData.bossRaids.push(raid);
      return clone(raid);
    });
  }

  async function bossAction(groupId, memberId, action, bossId = "") {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "bossRaid");
      const raid = activeItem(state.gameData.bossRaids);
      if (!raid) throw new Error("لا يوجد زعيم نشط. ابدأ زعيمًا جديدًا أولًا.");
      if (bossId && raid.id !== bossId) throw new Error("هذا الزعيم انتهى أو تغيرت الغارة");
      const account = accountFor(state, memberId, "bossRaid");
      let participant = raid.participants.find((item) => item.memberId === memberId);
      if (!participant) {
        participant = { memberId, name: account.name || memberId.split("@")[0], damage: 0, joinedAt: now().toISOString() };
        raid.participants.push(participant);
      }
      if (action === "join") return { raid: clone(raid), joined: true };
      if (action !== "attack") throw new Error("إجراء الزعيم غير معروف");
      const damage = randomInt(100, 301);
      participant.damage += damage;
      raid.health = Math.max(0, raid.health - damage);
      let rewards = [];
      if (raid.health === 0) {
        raid.status = "defeated";
        raid.endedAt = now().toISOString();
        const config = state.settings.games.bossRaid;
        const strongest = [...raid.participants].sort((a, b) => b.damage - a.damage)[0];
        rewards = raid.participants.map((player) => ({
          memberId: player.memberId,
          ...awardActivityRewardInState(
            state,
            player.memberId,
            Number(config.participantReward) + (player.memberId === strongest?.memberId ? Number(config.winnerReward) : 0),
            Number(config.xpReward),
            "boss_raid_reward",
            raid.id,
            "مكافأة هزيمة زعيم المجموعة",
            now(),
          ),
        }));
      }
      return { raid: clone(raid), damage, rewards };
    });
  }

  async function getBoss(groupId) {
    const state = await service.getGroup(groupId);
    return clone(activeItem(state.gameData.bossRaids) || state.gameData.bossRaids.at(-1) || null);
  }

  async function startTreasure(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "treasureHunt");
      accountFor(state, memberId, "treasureHunt");
      const current = activeItem(state.gameData.treasureHunts);
      if (current && Date.parse(current.deadline) > now().getTime()) return clone(current);
      const puzzle = WORDS[randomInt(WORDS.length)];
      const treasure = {
        id: activityId("treasure"),
        answer: puzzle,
        hints: [`الكلمة من ${puzzle.length} أحرف`, `تلميح: ${puzzle.slice(0, 1)}…`, "اكتب إجابتك في المجموعة"],
        hintIndex: 0,
        status: "active",
        startedBy: memberId,
        startedAt: now().toISOString(),
        deadline: new Date(now().getTime() + 5 * 60_000).toISOString(),
        guesses: {},
      };
      state.gameData.treasureHunts.push(treasure);
      return clone(treasure);
    });
  }

  async function answerTreasure(groupId, memberId, text) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "treasureHunt");
      const treasure = activeItem(state.gameData.treasureHunts);
      if (!treasure) return { handled: false };
      if (Date.parse(treasure.deadline) <= now().getTime()) {
        treasure.status = "expired";
        treasure.endedAt = now().toISOString();
        return { handled: true, expired: true, treasure: clone(treasure) };
      }
      if (treasure.guesses[memberId]) return { handled: true, repeated: true };
      treasure.guesses[memberId] = String(text || "").slice(0, 100);
      if (normalizeAnswer(text) !== normalizeAnswer(treasure.answer)) return { handled: true, correct: false };
      treasure.status = "found";
      treasure.winnerId = memberId;
      treasure.endedAt = now().toISOString();
      const config = state.settings.games.treasureHunt;
      const prize = awardActivityRewardInState(state, memberId, config.pointsReward, config.xpReward, "treasure_reward", treasure.id, "العثور على كنز", now());
      return { handled: true, correct: true, winnerId: memberId, prize, treasure: clone(treasure) };
    });
  }

  async function revealTreasureHint(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "treasureHunt");
      accountFor(state, memberId, "treasureHunt");
      const treasure = activeItem(state.gameData.treasureHunts);
      if (!treasure) throw new Error("لا يوجد بحث عن كنز نشط");
      treasure.hintIndex = Math.min(treasure.hints.length - 1, treasure.hintIndex + 1);
      return { hint: treasure.hints[treasure.hintIndex], treasure: clone(treasure) };
    });
  }

  async function startWordHunt(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "wordHunt");
      accountFor(state, memberId, "wordHunt");
      const current = activeItem(state.gameData.wordHunts);
      if (current && Date.parse(current.deadline) > now().getTime()) return clone(current);
      const answer = WORDS[randomInt(WORDS.length)];
      const hunt = {
        id: activityId("word"),
        answer,
        pattern: answer[0] + "·".repeat(Math.max(1, answer.length - 1)),
        status: "active",
        startedBy: memberId,
        startedAt: now().toISOString(),
        deadline: new Date(now().getTime() + 5 * 60_000).toISOString(),
        guesses: {},
      };
      state.gameData.wordHunts.push(hunt);
      return clone(hunt);
    });
  }

  async function answerWordHunt(groupId, memberId, text) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "wordHunt");
      const hunt = activeItem(state.gameData.wordHunts);
      if (!hunt) return { handled: false };
      if (Date.parse(hunt.deadline) <= now().getTime()) {
        hunt.status = "expired";
        return { handled: true, expired: true };
      }
      if (hunt.guesses[memberId]) return { handled: true, repeated: true };
      hunt.guesses[memberId] = String(text || "").slice(0, 100);
      if (normalizeAnswer(text) !== normalizeAnswer(hunt.answer)) return { handled: true, correct: false };
      hunt.status = "found";
      hunt.winnerId = memberId;
      hunt.endedAt = now().toISOString();
      const config = state.settings.games.wordHunt;
      const prize = awardActivityRewardInState(state, memberId, config.pointsReward, config.xpReward, "word_hunt_reward", hunt.id, "صيد الكلمة السرية", now());
      return { handled: true, correct: true, winnerId: memberId, prize };
    });
  }

  async function startDungeon(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "dungeons");
      accountFor(state, memberId, "dungeons");
      let dungeon = [...state.gameData.dungeons].reverse().find((item) => item.memberId === memberId && item.status === "active");
      if (dungeon) return clone(dungeon);
      const question = selectQuestion(state);
      dungeon = {
        id: activityId("dungeon"),
        memberId,
        stage: 1,
        status: "active",
        startedAt: now().toISOString(),
        deadline: new Date(now().getTime() + 10 * 60_000).toISOString(),
        questionId: question.id,
        prompt: question.prompt,
        answer: question.answer,
        aliases: question.aliases || [],
        completedStages: [],
      };
      state.gameData.dungeons.push(dungeon);
      return clone(dungeon);
    });
  }

  async function answerDungeon(groupId, memberId, text) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "dungeons");
      const dungeon = [...state.gameData.dungeons].reverse().find((item) => item.memberId === memberId && item.status === "active");
      if (!dungeon) return { handled: false };
      if (Date.parse(dungeon.deadline) <= now().getTime()) {
        dungeon.status = "expired";
        return { handled: true, expired: true };
      }
      if (!answerMatches(dungeon, text)) return { handled: true, correct: false, dungeon: clone(dungeon) };
      const config = state.settings.games.dungeons;
      dungeon.completedStages.push({ stage: dungeon.stage, completedAt: now().toISOString() });
      const prize = awardActivityRewardInState(state, memberId, config.stageReward, config.xpReward, "dungeon_stage", `${dungeon.id}:${dungeon.stage}`, `اجتياز المرحلة ${dungeon.stage}`, now());
      if (dungeon.stage >= DUNGEON_STAGES) {
        dungeon.status = "completed";
        dungeon.completedAt = now().toISOString();
        const bonus = awardActivityRewardInState(state, memberId, config.stageReward * 2, config.xpReward * 2, "dungeon_complete", dungeon.id, "إكمال البرج المحصن", now());
        return { handled: true, correct: true, completed: true, prize, bonus, dungeon: clone(dungeon) };
      }
      dungeon.stage += 1;
      const next = selectQuestion(state);
      dungeon.questionId = next.id;
      dungeon.prompt = next.prompt;
      dungeon.answer = next.answer;
      dungeon.aliases = next.aliases || [];
      dungeon.deadline = new Date(now().getTime() + 10 * 60_000).toISOString();
      return { handled: true, correct: true, prize, dungeon: clone(dungeon) };
    });
  }

  async function createGuild(groupId, memberId, name, icon = "⚔️") {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "guilds");
      const account = accountFor(state, memberId, "guilds");
      const title = String(name || "").trim().slice(0, 32);
      if (title.length < 2) throw new Error("اسم النقابة يجب أن يحتوي على حرفين على الأقل");
      if (state.gameData.guilds.some((guild) => guild.name.toLowerCase() === title.toLowerCase())) {
        throw new Error("اسم النقابة مستخدم بالفعل");
      }
      if (account.guildId) throw new Error("أنت عضو في نقابة بالفعل");
      const guild = {
        id: activityId("guild"),
        name: title,
        icon: String(icon || "⚔️").slice(0, 8),
        leaderId: memberId,
        members: [memberId],
        level: 1,
        xp: 0,
        inventory: {},
        createdAt: now().toISOString(),
      };
      debit(state, account, state.settings.games.guilds.creationCost, `guild-create:${guild.id}`, `تأسيس نقابة ${title}`);
      account.guildId = guild.id;
      state.gameData.guilds.push(guild);
      return clone(guild);
    });
  }

  async function joinGuild(groupId, memberId, guildId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "guilds");
      const account = accountFor(state, memberId, "guilds");
      if (account.guildId) throw new Error("غادر نقابتك الحالية قبل الانضمام إلى أخرى");
      const guild = state.gameData.guilds.find((item) => item.id === guildId);
      if (!guild) throw new Error("النقابة غير موجودة");
      if (!guild.members.includes(memberId)) guild.members.push(memberId);
      account.guildId = guild.id;
      return clone(guild);
    });
  }

  async function getGuilds(groupId) {
    const state = await service.getGroup(groupId);
    return clone([...state.gameData.guilds].sort((a, b) => b.level - a.level || b.xp - a.xp));
  }

  async function getMemberGuild(groupId, memberId) {
    const state = await service.getGroup(groupId);
    const guild = state.gameData.guilds.find((item) => item.id === state.accounts?.[memberId]?.guildId);
    return guild ? clone(guild) : null;
  }

  async function craftItem(groupId, memberId, recipeId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "crafting");
      const account = accountFor(state, memberId, "crafting");
      const recipe = state.gameData.recipes?.[recipeId] || DEFAULT_RECIPES[recipeId];
      if (!recipe) throw new Error("الوصفة غير موجودة");
      account.resources ||= {};
      for (const [resource, count] of Object.entries(recipe.cost)) {
        if (Number(account.resources[resource] || 0) < count) throw new Error(`تحتاج إلى ${count} من ${resource}`);
      }
      for (const [resource, count] of Object.entries(recipe.cost)) account.resources[resource] -= count;
      account.inventory ||= [];
      account.inventory.push({ id: `${recipeId}-${Date.now()}`, name: recipe.name, category: "crafted", acquiredAt: now().toISOString() });
      const guild = state.gameData.guilds.find((item) => item.id === account.guildId);
      if (guild) {
        guild.xp += 1;
        guild.level = Math.max(1, Math.floor(Math.sqrt(guild.xp / 5)) + 1);
      }
      return { item: recipe.name, resources: clone(account.resources), inventory: clone(account.inventory) };
    });
  }

  async function getRecipes(groupId) {
    const state = await service.getGroup(groupId);
    return clone(state.gameData.recipes || DEFAULT_RECIPES);
  }

  async function spinWheel(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "luckyWheel");
      const account = accountFor(state, memberId, "luckyWheel");
      const day = groupWorldDayKey(now());
      account.wheelSpins ||= [];
      account.wheelSpins = account.wheelSpins.filter((spin) => spin.day === day);
      const limit = Math.max(0, Number(state.settings.games.luckyWheel.dailyLimit) || 0);
      if (account.wheelSpins.length >= limit) throw new Error("استخدمت عجلة الحظ المجانية لهذا اليوم");
      const prizes = state.settings.games.luckyWheel.rewards || [0, 25, 50, 100, 200];
      const prize = Math.max(0, Number(prizes[randomInt(prizes.length)]) || 0);
      const spinId = activityId("wheel");
      const credited = awardActivityRewardInState(state, memberId, prize, 1, "lucky_wheel", spinId, "جائزة عجلة الحظ المجانية", now());
      account.wheelSpins.push({ id: spinId, day, points: credited.points, createdAt: now().toISOString() });
      return { prize: credited.points, requestedPrize: prize, remaining: Math.max(0, limit - account.wheelSpins.length) };
    });
  }

  async function registerTournament(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "tournaments");
      accountFor(state, memberId, "tournaments");
      let tournament = [...state.gameData.tournaments].reverse().find((item) => item.status === "registration");
      if (!tournament) {
        tournament = {
          id: activityId("cup"),
          title: `دوري الأبطال ${state.gameData.tournaments.length + 1}`,
          status: "registration",
          participants: [],
          rounds: [],
          createdAt: now().toISOString(),
          championId: null,
        };
        state.gameData.tournaments.push(tournament);
      }
      if (tournament.participants.includes(memberId)) throw new Error("أنت مسجل في هذا الدوري بالفعل");
      if (tournament.participants.length >= 32) throw new Error("اكتمل عدد المشاركين في الدوري");
      tournament.participants.push(memberId);
      return clone(tournament);
    });
  }

  async function startTournament(groupId) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "tournaments");
      const tournament = [...state.gameData.tournaments].reverse().find((item) => item.status === "registration");
      if (!tournament) throw new Error("لا يوجد دوري مفتوح للتسجيل");
      if (tournament.participants.length < 4) throw new Error("يحتاج الدوري إلى أربعة لاعبين على الأقل");
      const winners = [...tournament.participants];
      const roundNumber = tournament.rounds.length + 1;
      const stage = winners.length >= 8 ? "qualifiers" : "semifinals";
      const round = {
        id: `${tournament.id}-round-${roundNumber}`,
        stage,
        startedAt: now().toISOString(),
        byeWinners: winners.length % 2 ? [winners[0]] : [],
        matches: [],
      };
      const matchPlayers = winners.length % 2 ? winners.slice(1) : winners;
      for (let index = 0; index < matchPlayers.length; index += 2) {
        const xPlayer = matchPlayers[index];
        const oPlayer = matchPlayers[index + 1];
        if (!oPlayer) {
          round.byeWinners.push(xPlayer);
          continue;
        }
        const game = {
          id: activityId("xo"),
          status: "active",
          xPlayer,
          oPlayer,
          currentPlayer: xPlayer,
          board: Array(9).fill(null),
          createdAt: now().toISOString(),
          updatedAt: now().toISOString(),
          winnerId: null,
          tournamentId: tournament.id,
          round: round.id,
        };
        state.gameData.ticTacToe.push(game);
        round.matches.push({ gameId: game.id, xPlayer, oPlayer, winnerId: null, status: "active" });
      }
      tournament.rounds.push(round);
      tournament.status = "active";
      tournament.startedAt = now().toISOString();
      return clone(tournament);
    });
  }

  async function getTournament(groupId, memberId = "") {
    const state = await service.getGroup(groupId);
    const tournament = [...state.gameData.tournaments].reverse().find((item) =>
      ["registration", "active"].includes(item.status) ||
      (memberId && (item.participants.includes(memberId) || item.championId === memberId))
    ) || null;
    return tournament ? clone(tournament) : null;
  }

  return {
    startBoss,
    bossAction,
    getBoss,
    startTreasure,
    answerTreasure,
    revealTreasureHint,
    startWordHunt,
    answerWordHunt,
    startDungeon,
    answerDungeon,
    createGuild,
    joinGuild,
    getGuilds,
    getMemberGuild,
    craftItem,
    getRecipes,
    spinWheel,
    registerTournament,
    startTournament,
    getTournament,
  };
}
