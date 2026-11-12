/**
 * Persistent, group-scoped storage for the Group World feature.
 * Dependencies: Node.js filesystem and crypto modules.
 * Exports: createGroupWorldStore, createEmptyGroupWorld.
 */

import { open, mkdir, readFile, readdir, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = resolve(MODULE_DIR, "../../../bot-data/group-world");
const MAX_GROUP_ID_LENGTH = 160;

export function normalizeGroupId(value) {
  const groupId = String(value || "").trim();
  if (
    groupId.length > MAX_GROUP_ID_LENGTH ||
    !/^[A-Za-z0-9._:-]{3,128}@g\.us$/.test(groupId)
  ) {
    throw new Error("معرّف مجموعة واتساب غير صالح");
  }
  return groupId;
}

export function createEmptyGroupWorld(groupId) {
  return {
    schemaVersion: 1,
    groupId: normalizeGroupId(groupId),
    enabled: false,
    ownerId: null,
    activatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modules: {
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
    },
    settings: {},
    catalogs: {},
    commands: [],
    administrators: [],
    accounts: {},
    slots: [],
    inviteRewards: [],
    processedMessages: [],
    transactions: [],
    auditLog: [],
    violations: [],
    teams: [],
    challenges: [],
    events: [],
    gameData: {},
    season: null,
  };
}

function clone(value) {
  return structuredClone(value);
}

function encodedGroupId(groupId) {
  return Buffer.from(normalizeGroupId(groupId)).toString("base64url");
}

export function createGroupWorldStore(options = {}) {
  const dataDir = resolve(options.dataDir || DEFAULT_DATA_DIR);
  const cache = new Map();
  const queues = new Map();

  function fileFor(groupId) {
    return join(dataDir, `${encodedGroupId(groupId)}.json`);
  }

  async function loadGroup(groupId) {
    const normalized = normalizeGroupId(groupId);
    const cached = cache.get(normalized);
    if (cached) return clone(cached);

    let state;
    try {
      state = JSON.parse(await readFile(fileFor(normalized), "utf8"));
      if (!state || state.groupId !== normalized || state.schemaVersion !== 1) {
        throw new Error("نسخة بيانات عالم المجموعة غير مدعومة");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      state = createEmptyGroupWorld(normalized);
    }

    cache.set(normalized, state);
    return clone(state);
  }

  async function persistGroup(state) {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const destination = fileFor(state.groupId);
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    let handle;

    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(state)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, destination);

      try {
        const directory = await open(dirname(destination), "r");
        await directory.sync();
        await directory.close();
      } catch {
        // Some filesystems do not support syncing directories; the file is already atomic.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }

  async function updateGroup(groupId, updater) {
    const normalized = normalizeGroupId(groupId);
    const previous = queues.get(normalized) || Promise.resolve();
    let release;
    const current = new Promise((resolveQueue) => {
      release = resolveQueue;
    });
    const tail = previous.then(() => current);
    queues.set(normalized, tail);
    await previous;

    try {
      const draft = await loadGroup(normalized);
      const result = await updater(draft);
      draft.updatedAt = new Date().toISOString();
      await persistGroup(draft);
      cache.set(normalized, draft);
      return result;
    } finally {
      release();
      if (queues.get(normalized) === tail) queues.delete(normalized);
    }
  }

  async function listGroups() {
    let names;
    try {
      names = await readdir(dataDir);
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const groups = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const state = JSON.parse(await readFile(join(dataDir, name), "utf8"));
        if (state?.schemaVersion === 1 && typeof state.groupId === "string") {
          groups.push(clone(state));
          cache.set(state.groupId, state);
        }
      } catch {
        // A malformed group file is skipped; it is never overwritten by a read.
      }
    }
    return groups;
  }

  return {
    dataDir,
    loadGroup,
    updateGroup,
    listGroups,
  };
}
