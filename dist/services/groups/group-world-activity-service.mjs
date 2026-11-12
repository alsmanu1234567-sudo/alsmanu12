import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { groupWorldDayKey } from "./group-world-service.mjs";

const XO_WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const TYPE_NAMES = {
  general: "المعلومات العامة",
  math: "سرعة الرياضيات",
  riddle: "الألغاز",
  emoji: "تخمين الإيموجي",
  scramble: "الكلمات المبعثرة",
  memory: "الذاكرة",
  speed: "سرعة الإجابة",
  letters: "ترتيب الحروف",
  hidden: "اكتشاف الكلمة المخفية",
  streak: "الأسئلة المتتالية",
  geography: "المعرفة الجغرافية",
  english: "الكلمات الإنجليزية",
  cipher: "حل الشيفرات",
  logic: "التفكير المنطقي",
  sequence: "السلاسل والتتابعات",
};

const TREASURE_WORDS = [
  { answer: "مفتاح", hints: ["يفتح شيئًا مغلقًا", "غالبًا يكون من معدن", "يبدأ بحرف الميم"] },
  { answer: "نجمة", hints: ["تظهر في السماء ليلًا", "لها خمس زوايا في الرسم الشائع", "تبدأ بحرف النون"] },
  { answer: "كتاب", hints: ["يحمل صفحات", "قد يحتوي قصة أو معرفة", "تبدأ بحرف الكاف"] },
  { answer: "نخلة", hints: ["شجرة مشهورة في السودان", "تعطي ثمرًا حلوًا", "تبدأ بحرف النون"] },
];

const RECIPES = {
  potion: { name: "جرعة مغامرة", cost: { wood: 2, crystal: 1 }, item: "جرعة مغامرة" },
  shield: { name: "درع الفريق", cost: { wood: 4, crystal: 2 }, item: "درع الفريق" },
  compass: { name: "بوصلة نادرة", cost: { wood: 2, crystal: 4 }, item: "بوصلة نادرة" },
};

function clone(value) {
  return structuredClone(value);
}

function id(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function answerKey(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/[ى]/gu, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function accountFor(state, memberId, moduleName = "") {
  const account = state.accounts?.[String(memberId)];
  if (!account) throw new Error("ملف العضو غير موجود في عالم المجموعة");
  if (account.enabled === false) throw new Error("حساب هذا العضو معطّل في عالم المجموعة");
  if (moduleName && account.bannedGames?.includes(moduleName)) throw new Error("تم حظرك من هذه اللعبة في هذه المجموعة");
  return account;
}

function requireModule(state, moduleName) {
  if (!state.enabled) throw new Error("عالم المجموعة غير مفعّل");
  if (!state.modules[moduleName]) throw new Error("هذه اللعبة متوقفة في إعدادات المجموعة");
}

function reward(state, memberId, points, xp, kind, eventKey, reason, timestamp) {
  const account = accountFor(state, memberId);
  let credited = 0;
  const requested = Math.max(0, Math.trunc(Number(points) || 0));
  if (requested > 0 && state.modules.economy) {
    const eventId = `${kind}:${eventKey}:${memberId}`;
    const duplicate = state.transactions.some((entry) => entry.eventId === eventId);
    if (!duplicate) {
      const today = groupWorldDayKey(timestamp);
      const earnedToday = state.transactions.reduce((sum, entry) => {
        if (
          entry.memberId === memberId &&
          entry.amount > 0 &&
          entry.kind !== "starting_balance" &&
          groupWorldDayKey(new Date(entry.timestamp)) === today
        ) return sum + entry.amount;
        return sum;
      }, 0);
      const cap = Math.max(0, Number(state.settings.rewards.dailyEarnCap) || 0);
      credited = Math.min(requested, Math.max(0, cap - earnedToday));
      if (credited > 0) {
        account.balance += credited;
        account.totalEarned += credited;
        state.transactions.push({
          id: `${timestamp.getTime()}-${randomBytes(4).toString("hex")}`,
          memberId,
          amount: credited,
          kind,
          reason: String(reason || "").slice(0, 300),
          actor: "system",
          eventId,
          timestamp: timestamp.toISOString(),
        });
        if (state.transactions.length > 30_000) state.transactions.splice(0, state.transactions.length - 30_000);
      }
    }
  }
  const gainedXp = Math.max(0, Math.trunc(Number(xp) || 0));
  if (gainedXp && state.modules.progression) {
    account.xp = Number(account.xp || 0) + gainedXp;
    account.level = Math.max(1, Math.floor(Math.sqrt(account.xp / 10)) + 1);
  }
  return { points: credited, xp: state.modules.progression ? gainedXp : 0 };
}

export function awardActivityRewardInState(state, memberId, points, xp, kind, eventKey, reason, timestamp = new Date()) {
  return reward(state, memberId, points, xp, kind, eventKey, reason, timestamp);
}

function updateStats(state, bucket, memberId, key) {
  state.gameData[bucket] ||= {};
  state.gameData[bucket][memberId] ||= { wins: 0, losses: 0, draws: 0 };
  state.gameData[bucket][memberId][key] += 1;
}

function activePairMatch(matches, first, second) {
  return matches.find((match) =>
    ["open", "active"].includes(match.status) &&
    ((match.challenger === first && match.opponent === second) ||
      (match.challenger === second && match.opponent === first))
  );
}

function newXoMatch(state, xPlayer, oPlayer, tournamentId = null, round = null, timestamp = new Date()) {
  const game = {
    id: id("xo"),
    status: "active",
    xPlayer,
    oPlayer,
    currentPlayer: xPlayer,
    board: Array(9).fill(null),
    createdAt: timestamp.toISOString(),
    updatedAt: timestamp.toISOString(),
    winnerId: null,
    tournamentId,
    round,
  };
  state.gameData.ticTacToe.push(game);
  if (state.gameData.ticTacToe.length > 300) state.gameData.ticTacToe.splice(0, state.gameData.ticTacToe.length - 300);
  return game;
}

function startTournamentRound(state, tournament, winners, timestamp) {
  const roundNumber = tournament.rounds.length + 1;
  const stage = winners.length === 2
    ? "final"
    : winners.length === 4
      ? "semifinals"
      : winners.length >= 8
        ? "qualifiers"
        : "playoffs";
  const round = {
    id: `${tournament.id}-round-${roundNumber}`,
    stage,
    startedAt: timestamp.toISOString(),
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
    const game = newXoMatch(state, xPlayer, oPlayer, tournament.id, round.id, timestamp);
    round.matches.push({ gameId: game.id, xPlayer, oPlayer, winnerId: null, status: "active" });
  }
  tournament.rounds.push(round);
  tournament.status = "active";
}

function advanceTournament(state, game, timestamp) {
  if (!game.tournamentId || !game.round) return;
  const tournament = state.gameData.tournaments.find((item) => item.id === game.tournamentId && item.status === "active");
  const round = tournament?.rounds.find((item) => item.id === game.round);
  const match = round?.matches.find((item) => item.gameId === game.id);
  if (!tournament || !round || !match) return;
  match.status = game.status;
  match.winnerId = game.winnerId || null;
  if (!round.matches.every((item) => item.status === "won" || item.status === "draw")) return;
  if (round.matches.some((item) => item.status === "draw")) return;
  const winners = [...round.byeWinners, ...round.matches.map((item) => item.winnerId).filter(Boolean)];
  if (winners.length === 1) {
    tournament.status = "completed";
    tournament.championId = winners[0];
    tournament.completedAt = timestamp.toISOString();
    const config = state.settings.games.tournaments;
    reward(state, winners[0], config.entryReward, config.xpReward, "tournament_champion", tournament.id, "الفوز بدوري الأبطال", timestamp);
    return;
  }
  startTournamentRound(state, tournament, winners, timestamp);
}

function finishXo(state, game, winnerId, timestamp) {
  game.status = winnerId ? "won" : "draw";
  game.winnerId = winnerId || null;
  game.updatedAt = timestamp.toISOString();
  const players = [game.xPlayer, game.oPlayer];
  const settings = state.settings.games.ticTacToe;
  if (winnerId) {
    const loserId = players.find((player) => player !== winnerId);
    updateStats(state, "xoStats", winnerId, "wins");
    updateStats(state, "xoStats", loserId, "losses");
    reward(state, winnerId, settings.pointsReward, settings.xpReward, "xo_win", game.id, "الفوز في لعبة XO", timestamp);
  } else {
    for (const memberId of players) {
      updateStats(state, "xoStats", memberId, "draws");
      reward(state, memberId, 0, Math.floor(settings.xpReward / 2), "xo_draw", game.id, "تعادل في لعبة XO", timestamp);
    }
  }
  advanceTournament(state, game, timestamp);
}

function pickQuestion(state, preferredType = null) {
  const bank = state.settings.challengeBank.filter((question) =>
    !preferredType || question.type === preferredType
  );
  if (!bank.length) throw new Error("لا توجد أسئلة مناسبة في قاعدة الأسئلة");
  const used = new Set(state.gameData.usedQuestionIds || []);
  const fresh = bank.filter((question) => !used.has(question.id));
  const options = fresh.length ? fresh : bank;
  const question = clone(options[randomInt(options.length)]);
  state.gameData.usedQuestionIds ||= [];
  state.gameData.usedQuestionIds.push(question.id);
  if (state.gameData.usedQuestionIds.length > 500) state.gameData.usedQuestionIds.splice(0, state.gameData.usedQuestionIds.length - 500);
  return question;
}

function challengeMatchesAnswer(question, answer) {
  const submitted = answerKey(answer);
  return [question.answer, ...(question.aliases || [])].some((candidate) => answerKey(candidate) === submitted);
}

function settleChallenge(state, challenge, winnerId, timestamp, draw = false) {
  challenge.status = draw ? "draw" : "completed";
  challenge.winnerId = winnerId || null;
  challenge.completedAt = timestamp.toISOString();
  challenge.result = draw ? "تعادل" : "فوز";
  const settings = state.settings.games.challenges;
  if (draw) {
    for (const player of [challenge.challenger, challenge.opponent]) {
      updateStats(state, "challengeStats", player, "draws");
      reward(state, player, 0, Math.floor(settings.xpReward / 2), "challenge_draw", challenge.id, "تعادل في تحدٍ", timestamp);
    }
    return;
  }
  const loserId = winnerId === challenge.challenger ? challenge.opponent : challenge.challenger;
  updateStats(state, "challengeStats", winnerId, "wins");
  updateStats(state, "challengeStats", loserId, "losses");
  reward(state, winnerId, settings.pointsReward, settings.xpReward, "challenge_win", challenge.id, "الفوز في تحدٍ آلي", timestamp);
  reward(state, loserId, 0, Math.floor(settings.xpReward / 3), "challenge_participation", challenge.id, "المشاركة في تحدٍ آلي", timestamp);
  const winner = state.accounts[winnerId];
  winner.resources ||= {};
  winner.resources.wood = Number(winner.resources.wood || 0) + 1;
  if (randomInt(4) === 0) winner.resources.crystal = Number(winner.resources.crystal || 0) + 1;
}

function nameForType(type) {
  return String(type || "general").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function createGroupWorldActivityService({ service, now = () => new Date() }) {
  if (typeof service?.runGroupTransaction !== "function") {
    throw new Error("Group World service must provide transactional storage");
  }

  async function startXo(groupId, xPlayer, oPlayer) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "ticTacToe");
      const x = accountFor(state, xPlayer, "ticTacToe");
      const o = accountFor(state, oPlayer, "ticTacToe");
      if (x.memberId === o.memberId) throw new Error("اختر خصمًا آخر للعب");
      const existing = state.gameData.ticTacToe.find((game) =>
        game.status === "active" &&
        [game.xPlayer, game.oPlayer].includes(xPlayer) &&
        [game.xPlayer, game.oPlayer].includes(oPlayer)
      );
      if (existing) throw new Error("لديكما مباراة XO مفتوحة بالفعل");
      return clone(newXoMatch(state, xPlayer, oPlayer, null, null, now()));
    });
  }

  async function getXoGame(groupId, gameId) {
    const state = await service.getGroup(groupId);
    const game = state.gameData.ticTacToe.find((item) => item.id === gameId);
    return game ? clone(game) : null;
  }

  async function moveXo(groupId, gameId, memberId, position) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "ticTacToe");
      const game = state.gameData.ticTacToe.find((item) => item.id === gameId);
      if (!game || game.status !== "active") throw new Error("هذه المباراة انتهت أو غير موجودة");
      if (![game.xPlayer, game.oPlayer].includes(memberId)) throw new Error("أنت لست لاعبًا في هذه المباراة");
      accountFor(state, memberId, "ticTacToe");
      if (game.currentPlayer !== memberId) throw new Error("ليس دورك الآن");
      const cell = Number(position);
      if (!Number.isInteger(cell) || cell < 0 || cell > 8 || game.board[cell]) throw new Error("هذه الخانة غير صالحة أو مستخدمة");
      game.board[cell] = memberId === game.xPlayer ? "X" : "O";
      game.updatedAt = now().toISOString();
      const line = XO_WINS.find(([a, b, c]) => game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]);
      if (line) finishXo(state, game, memberId, now());
      else if (game.board.every(Boolean)) finishXo(state, game, null, now());
      else game.currentPlayer = memberId === game.xPlayer ? game.oPlayer : game.xPlayer;
      return { game: clone(game), winnerId: game.winnerId, draw: game.status === "draw" };
    });
  }

  async function cancelXo(groupId, gameId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      const game = state.gameData.ticTacToe.find((item) => item.id === gameId);
      if (!game || game.status !== "active") throw new Error("المباراة غير مفتوحة");
      if (![game.xPlayer, game.oPlayer].includes(memberId)) throw new Error("لا تملك صلاحية إلغاء هذه المباراة");
      game.status = "cancelled";
      game.updatedAt = now().toISOString();
      return clone(game);
    });
  }

  async function rematchXo(groupId, gameId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      const previous = state.gameData.ticTacToe.find((item) => item.id === gameId);
      if (!previous || !["won", "draw", "cancelled"].includes(previous.status)) throw new Error("يمكن إعادة اللعب بعد انتهاء المباراة فقط");
      if (![previous.xPlayer, previous.oPlayer].includes(memberId)) throw new Error("لا تملك صلاحية إعادة هذه المباراة");
      const existing = state.gameData.ticTacToe.find((game) =>
        game.status === "active" &&
        [game.xPlayer, game.oPlayer].includes(previous.xPlayer) &&
        [game.xPlayer, game.oPlayer].includes(previous.oPlayer)
      );
      if (existing) throw new Error("لديكما مباراة مفتوحة بالفعل");
      const replay = newXoMatch(state, previous.xPlayer, previous.oPlayer, previous.tournamentId, previous.round, now());
      if (previous.tournamentId && previous.round) {
        const tournament = state.gameData.tournaments.find((item) => item.id === previous.tournamentId);
        const round = tournament?.rounds.find((item) => item.id === previous.round);
        const match = round?.matches.find((item) => item.gameId === previous.id);
        if (match) {
          match.gameId = replay.id;
          match.status = "active";
          match.winnerId = null;
        }
      }
      return clone(replay);
    });
  }

  async function createChallenge(groupId, challenger, opponent) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "challenges");
      accountFor(state, challenger, "challenges");
      accountFor(state, opponent, "challenges");
      if (challenger === opponent) throw new Error("لا يمكن تحدي نفسك");
      if (activePairMatch(state.gameData.challengeMatches, challenger, opponent)) {
        throw new Error("لديكما تحدٍ مفتوح أو جارٍ بالفعل");
      }
      const bank = state.settings.challengeBank;
      const questionType = [...new Set(bank.map((question) => question.type))][randomInt(new Set(bank.map((question) => question.type)).size)];
      const taken = new Set(state.gameData.challengeMatches.map((match) => match.challengeName));
      let challengeName;
      do {
        challengeName = `THE_LEGENDARY_${nameForType(questionType)}_BATTLE_${now().getFullYear()}_${randomBytes(4).toString("hex").toUpperCase()}`;
      } while (taken.has(challengeName));
      const challenge = {
        id: id("challenge"),
        challengeName,
        type: questionType,
        typeName: TYPE_NAMES[questionType] || questionType,
        challenger,
        opponent,
        status: "open",
        createdAt: now().toISOString(),
        difficulty: state.settings.games.challenges.difficulty,
        deadline: null,
        questionId: null,
        prompt: null,
        answers: {},
      };
      state.gameData.challengeMatches.push(challenge);
      if (state.gameData.challengeMatches.length > 500) state.gameData.challengeMatches.splice(0, state.gameData.challengeMatches.length - 500);
      return clone(challenge);
    });
  }

  async function acceptChallenge(groupId, memberId, challenger, challengeName) {
    return service.runGroupTransaction(groupId, (state) => {
      requireModule(state, "challenges");
      const challenge = state.gameData.challengeMatches.find((item) =>
        item.challengeName === String(challengeName || "").trim() &&
        item.challenger === challenger &&
        item.opponent === memberId &&
        item.status === "open"
      );
      if (!challenge) throw new Error("التحدي غير موجود أو الاسم لا يطابق التحدي الموجّه إليك");
      accountFor(state, memberId, "challenges");
      const question = pickQuestion(state, challenge.type);
      challenge.questionId = question.id;
      challenge.prompt = question.prompt;
      challenge.answer = question.answer;
      challenge.aliases = question.aliases || [];
      challenge.status = "active";
      challenge.startedAt = now().toISOString();
      const seconds = Math.max(10, Math.min(3_600, Number(state.settings.games.challenges.durationSeconds) || 120));
      challenge.deadline = new Date(now().getTime() + seconds * 1_000).toISOString();
      challenge.answers = {};
      return clone(challenge);
    });
  }

  async function rejectChallenge(groupId, memberId, challenger) {
    return service.runGroupTransaction(groupId, (state) => {
      const challenge = [...state.gameData.challengeMatches].reverse().find((item) =>
        item.challenger === challenger && item.opponent === memberId && item.status === "open"
      );
      if (!challenge) throw new Error("لا يوجد تحدٍ مفتوح من هذا العضو");
      challenge.status = "rejected";
      challenge.completedAt = now().toISOString();
      return clone(challenge);
    });
  }

  async function cancelChallenge(groupId, memberId) {
    return service.runGroupTransaction(groupId, (state) => {
      const challenge = [...state.gameData.challengeMatches].reverse().find((item) =>
        ["open", "active"].includes(item.status) &&
        [item.challenger, item.opponent].includes(memberId)
      );
      if (!challenge) throw new Error("لا توجد لديك تحديات مفتوحة لإلغائها");
      challenge.status = "cancelled";
      challenge.completedAt = now().toISOString();
      challenge.cancelledBy = memberId;
      return clone(challenge);
    });
  }

  async function listChallenges(groupId, memberId) {
    const state = await service.getGroup(groupId);
    return clone(state.gameData.challengeMatches.filter((item) =>
      [item.challenger, item.opponent].includes(memberId) &&
      ["open", "active"].includes(item.status)
    ));
  }

  async function submitChallengeAnswer(groupId, memberId, answer) {
    return service.runGroupTransaction(groupId, (state) => {
      const challenge = [...state.gameData.challengeMatches].reverse().find((item) =>
        item.status === "active" && [item.challenger, item.opponent].includes(memberId)
      );
      if (!challenge) return { handled: false };
      accountFor(state, memberId, "challenges");
      if (Date.parse(challenge.deadline) <= now().getTime()) {
        settleChallenge(state, challenge, null, now(), true);
        return { handled: true, expired: true, challenge: clone(challenge) };
      }
      if (challenge.answers[memberId]) return { handled: true, duplicate: true, challenge: clone(challenge) };
      const correct = challengeMatchesAnswer(challenge, answer);
      challenge.answers[memberId] = {
        answer: String(answer || "").slice(0, 120),
        correct,
        submittedAt: now().toISOString(),
      };
      if (correct) {
        settleChallenge(state, challenge, memberId, now(), false);
        return { handled: true, correct: true, winnerId: memberId, challenge: clone(challenge) };
      }
      if ([challenge.challenger, challenge.opponent].every((player) => challenge.answers[player])) {
        settleChallenge(state, challenge, null, now(), true);
        return { handled: true, correct: false, draw: true, challenge: clone(challenge) };
      }
      return { handled: true, correct: false, challenge: clone(challenge) };
    });
  }

  async function expireChallenges(groupId) {
    return service.runGroupTransaction(groupId, (state) => {
      const expired = [];
      for (const challenge of state.gameData.challengeMatches) {
        if (challenge.status === "active" && Date.parse(challenge.deadline) <= now().getTime()) {
          settleChallenge(state, challenge, null, now(), true);
          expired.push(clone(challenge));
        }
      }
      return expired;
    });
  }

  return {
    startXo,
    getXoGame,
    moveXo,
    cancelXo,
    rematchXo,
    createChallenge,
    acceptChallenge,
    rejectChallenge,
    cancelChallenge,
    listChallenges,
    submitChallengeAnswer,
    expireChallenges,
  };
}
