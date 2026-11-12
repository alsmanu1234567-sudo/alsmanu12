#!/usr/bin/env node
/**
 * patch-pipeline-fix.mjs
 * ─────────────────────────────────────────────────────────────────
 * يُطبّق ثلاثة إصلاحات جذرية لوقف تسونامي newsletter من إيقاف "رسالي":
 *
 *  1. forward.mjs — يستبدل loadRules()/loadChats() بكاش في الذاكرة
 *                   ويحذف console.log spam
 *  2. forward.mjs — يُطلق initRulesCache عند تحميل الوحدة
 *  3. index.mjs   — يستبدل المعالج المباشر بـ setupMsgPipeline
 *
 * يُطبَّق مرة واحدة فقط.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => { console.error(R + "❌ " + m + N); process.exit(1); };

const FORWARD = path.join(__dirname, "dist", "forward.mjs");
const INDEX   = path.join(__dirname, "dist", "index.mjs");

if (!fs.existsSync(FORWARD)) fail("dist/forward.mjs غير موجود!");
if (!fs.existsSync(INDEX))   fail("dist/index.mjs غير موجود!");

let fwd = fs.readFileSync(FORWARD, "utf8");
let idx = fs.readFileSync(INDEX,   "utf8");
let changes = 0;

// ── مساعد تطبيق patch ────────────────────────────────────────────
function patch(content, label, search, replace, idempotencyCheck = null) {
  const check = idempotencyCheck || replace.slice(0, 80);
  if (content.includes(check)) {
    wrn(`تخطي (مطبّق سابقاً): ${label}`);
    return content;
  }
  if (!content.includes(search)) {
    wrn(`⚠️  لم يُعثر على النمط: ${label}`);
    return content;
  }
  changes++;
  ok(label);
  return content.replace(search, replace);
}

// ════════════════════════════════════════════════════════════════════
// PATCH 1: forward.mjs — إضافة import للكاش + تهيئته عند بدء التشغيل
// ════════════════════════════════════════════════════════════════════
fwd = patch(fwd,
  "1) forward.mjs: import + init rules-cache",
  `import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RULES_FILE = join(DATA_DIR, "forward-rules.json");
const CHATS_FILE = join(DATA_DIR, "forward-chats.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });`,
  `import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// [PIPELINE-FIX] كاش في الذاكرة — يقضي على readFileSync لكل رسالة
import {
  getRules      as _cacheGetRules,
  getChats      as _cacheGetChats,
  invalidate    as _cacheInvalidate,
  initRulesCache,
} from "../engine/rules-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RULES_FILE = join(DATA_DIR, "forward-rules.json");
const CHATS_FILE = join(DATA_DIR, "forward-chats.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// تهيئة الكاش فوراً عند تحميل الوحدة
initRulesCache(RULES_FILE, CHATS_FILE);`
);

// ════════════════════════════════════════════════════════════════════
// PATCH 2: forward.mjs — saveRules يستدعي invalidate بعد الحفظ
// ════════════════════════════════════════════════════════════════════
fwd = patch(fwd,
  "2) forward.mjs: saveRules → invalidate cache",
  `function saveRules(rules) {
  writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
}`,
  `function saveRules(rules) {
  writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
  _cacheInvalidate(); // [PIPELINE-FIX] نُحدِّث الكاش فوراً بعد الحفظ
}`
);

// ════════════════════════════════════════════════════════════════════
// PATCH 3: forward.mjs — applyForwardRules يستخدم الكاش بدلاً من loadRules
// ════════════════════════════════════════════════════════════════════
fwd = patch(fwd,
  "3) forward.mjs: applyForwardRules ← getRules() من الكاش",
  `export async function applyForwardRules(sock, msg) {
  try {
    const rules = loadRules().filter((r) => r.enabled);
    const fromJid = msg.key?.remoteJid;
    const isNewsletter = fromJid?.endsWith("@newsletter");

    // [TRACE] تتبع كل استدعاء لـ applyForwardRules
    if (isNewsletter) {
      console.log(\`[FW-TRACE] applyForwardRules | from=\${fromJid} | rules=\${rules.length} | msgKeys=\${Object.keys(msg.message||{}).join(',')}\`);
    }

    if (!rules.length) { if (isNewsletter) console.log('[FW-TRACE] لا قواعد مفعّلة'); return; }
    if (!fromJid) return;

    if (isNewsletter) {
      const matched = rules.some((r) => r.sources.includes(fromJid));
      if (!matched) {
        console.log(\`[FW-TRACE] لا توجد قاعدة لهذه القناة: \${fromJid}\`);
        return;
      }
    }`,
  `export async function applyForwardRules(sock, msg) {
  try {
    // [PIPELINE-FIX] O(1) من الكاش — لا disk read لكل رسالة
    const rules = _cacheGetRules().filter((r) => r.enabled);
    const fromJid = msg.key?.remoteJid;
    const isNewsletter = fromJid?.endsWith("@newsletter");

    if (!rules.length || !fromJid) return;

    if (isNewsletter) {
      const matched = rules.some((r) => r.sources.includes(fromJid));
      if (!matched) return; // [PIPELINE-FIX] لا log spam لقنوات بلا قواعد
    }`
);

// ════════════════════════════════════════════════════════════════════
// PATCH 4: forward.mjs — loadChats() داخل الحلقة ← getChats() من الكاش
// ════════════════════════════════════════════════════════════════════
fwd = patch(fwd,
  "4) forward.mjs: loadChats() ← getChats() من الكاش",
  `        // [LOG] إشعار دقيق بالنتيجة الحقيقية
        const chats = loadChats();`,
  `        // [LOG] إشعار دقيق بالنتيجة الحقيقية — الكاش O(1)
        const chats = _cacheGetChats();`
);

// ════════════════════════════════════════════════════════════════════
// PATCH 5: index.mjs — استبدال المعالج المباشر بـ setupMsgPipeline
// ════════════════════════════════════════════════════════════════════

// نضيف import مرة واحدة في أعلى دالة registerMessageHandler
const PIPELINE_IMPORT_MARKER = "// [PIPELINE-FIX] pre-import مرة واحدة — لا await import لكل رسالة";
if (!idx.includes(PIPELINE_IMPORT_MARKER)) {
  // نُضيف الـ import في بداية registerMessageHandler
  const FN_SEARCH = `function registerMessageHandler(sock, userId) {`;
  if (idx.includes(FN_SEARCH)) {
    idx = idx.replace(
      FN_SEARCH,
      `// [PIPELINE-FIX] pre-import مرة واحدة — لا await import لكل رسالة
// setupMsgPipeline و applyForwardRules تُحمَّلان عند أول registerMessageHandler
let _pipelineSetup = null;
let _fwApplyFn     = null;
async function _ensurePipeline() {
  if (_pipelineSetup) return;
  const [pipelineMod, fwMod] = await Promise.all([
    import("../engine/msg-pipeline.mjs"),
    import("./forward.mjs"),
  ]);
  _pipelineSetup = pipelineMod.setupMsgPipeline;
  _fwApplyFn     = fwMod.applyForwardRules;
}

function registerMessageHandler(sock, userId) {`
    );
    changes++;
    ok("5a) index.mjs: إضافة _ensurePipeline قبل registerMessageHandler");
  } else {
    wrn("5a) لم يُعثر على registerMessageHandler!");
  }
}

// استبدال المعالجَين القديمَين بـ setupMsgPipeline
const OLD_HANDLERS = `  _registeredHandlerSocks.add(sock);
  // [FIX-APPEND-FLOOD] معالج append: O(1) dedup + بدون log spam
  sock.ev.on("messages.upsert", async ({ messages, type: _appendType }) => {
    if (_appendType !== "append") return;
    for (const _m of messages) {
      if (_m.key?.fromMe && _m.key?.id && _m.key?.remoteJid) {
        cacheSentMsg(\`\${userId}:\${_m.key.remoteJid}\`, _m.key);
      }
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // heartbeat فقط لرسائل حقيقية (notify) — لا append التاريخية
    if (type === "notify") {
      heartbeat();
      // [FIX-RETRY-RESET] أي notify = الاتصال يعمل → صفّر عداد retries حالاً
      const _curS = sessions.get(userId);
      if (_curS && _curS.retries > 0) { _curS.retries = 0; sessions.set(userId, _curS); }
    }
    // [NEWSLETTER-FIX] قنوات واتساب (@newsletter) ترسل رسائل بـ type='append' وليس 'notify'
    const _hasNewsletter = messages.some((m) => m.key?.remoteJid?.endsWith("@newsletter"));
    if (type !== "notify" && !(type === "append" && _hasNewsletter)) return;
    // PATCH_FORWARD_HOOK_V1 ── تطبيق قواعد التحويل ──
    try {
      // [FIX-08] initForward مُزالة — تُشغَّل مرة واحدة فقط عند التهيئة في index.mjs
      const { applyForwardRules, autoDetectSource, setForwardSock } = await import("./forward.mjs");
      const _fwSock = inMemoryDB.sessions.get(userId) || sock;
      setForwardSock(_fwSock);
      for (const _fwMsg of messages) {
        // [FIX-AUTO-CH-SAVE] أوقفت الحفظ التلقائي للقنوات بطلب المستخدم
        // autoDetectSource(_fwMsg);
        await applyForwardRules(_fwSock, _fwMsg);
      }
    } catch (_fwErr) { logger.error({ err: _fwErr?.message || String(_fwErr) }, "[FORWARD-ERR] خطأ في applyForwardRules"); }`;

const NEW_HANDLERS = `  _registeredHandlerSocks.add(sock);
  // [PIPELINE-FIX] dedup من append — نحتفظ به مستقلاً عن الـ pipeline
  sock.ev.on("messages.upsert", ({ messages, type: _appendType }) => {
    if (_appendType !== "append") return;
    for (const _m of messages) {
      if (_m.key?.fromMe && _m.key?.id && _m.key?.remoteJid) {
        cacheSentMsg(\`\${userId}:\${_m.key.remoteJid}\`, _m.key);
      }
    }
  });
  // [PIPELINE-FIX] تحميل الـ pipeline مرة واحدة ثم تسجيله
  _ensurePipeline().then(() => {
    setupMsgPipeline_registered.add(userId);
    _pipelineSetup(
      sock,
      userId,
      // applyForward wrapper — يستخدم _fwApplyFn من الكاش
      async (sk, msg) => {
        if (!_fwApplyFn) return;
        const _fwSock = inMemoryDB.sessions.get(userId) || sk;
        await _fwApplyFn(_fwSock, msg);
      },
      // mainHandler — المعالج الرئيسي الموجود أصلاً
      async (msg) => { await _dispatchIncomingMsg(sock, userId, msg); },
      {
        heartbeat,
        resetRetries: () => {
          const _curS = sessions.get(userId);
          if (_curS && _curS.retries > 0) { _curS.retries = 0; sessions.set(userId, _curS); }
        },
      }
    );
  }).catch(e => logger.error({ err: e?.message }, "[PIPELINE] فشل تحميل pipeline"));
  // [PIPELINE-FIX] تعريف دالة dispatch المنفصلة التي كانت inline
  async function _dispatchIncomingMsg(sock2, uid, msg) {`;

idx = patch(idx,
  "5b) index.mjs: استبدال المعالج القديم بـ setupMsgPipeline",
  OLD_HANDLERS,
  NEW_HANDLERS,
  "[PIPELINE-FIX] تحميل الـ pipeline مرة واحدة"
);

// نضيف Set لتتبع الـ users المسجّلة
const SETUP_REGISTERED_MARKER = "const setupMsgPipeline_registered = new Set();";
if (!idx.includes(SETUP_REGISTERED_MARKER)) {
  const SESSIONS_DECL = "const sessions = new Map();";
  if (idx.includes(SESSIONS_DECL)) {
    idx = idx.replace(
      SESSIONS_DECL,
      `${SESSIONS_DECL}\nconst setupMsgPipeline_registered = new Set(); // [PIPELINE-FIX]`
    );
    changes++;
    ok("5c) index.mjs: إضافة setupMsgPipeline_registered Set");
  }
}

// ── حفظ الملفات ──────────────────────────────────────────────────────
if (changes > 0) {
  fs.writeFileSync(FORWARD, fwd, "utf8");
  fs.writeFileSync(INDEX,   idx, "utf8");
  ok(`\n✅ تم تطبيق ${changes} patch بنجاح!`);
  console.log(`\n📋 ملخص:
  • forward.mjs: loadRules/loadChats → كاش O(1) في الذاكرة
  • forward.mjs: حذف console.log spam من hot path
  • index.mjs: await import() لكل رسالة → pre-import مرة واحدة
  • index.mjs: معالج مباشر → priority queue (COMMAND > NOTIFY > NEWSLETTER)
  
  🔒 Circuit Breaker: newsletter > 50 قيد انتظار = تجاهل الفيضان
  📊 LANE_COMMAND (أوامر رسالي): concurrency=3, priority=10
  📊 LANE_NOTIFY  (رسائل عادية): concurrency=5, priority=5
  📊 LANE_NEWSLETTER (قنوات):    concurrency=2, priority=1\n`);
} else {
  wrn("لا تغييرات جديدة — الـ patches مطبّقة مسبقاً.");
}
