#!/usr/bin/env node
/**
 * patch-fixes.mjs — إصلاحات شاملة لأربع مشاكل
 * 1. /cod WA: إعادة كتابة startCodSession مع جلسة مستمرة + إلغاء القديمة + إرسال الكود فقط
 * 2. Telegram mymsgs: إضافة cod كميزة كاملة (تشغيل/إيقاف/تغيير الأمر)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);
const err = m => { console.error(R + "❌ " + m + N); process.exit(1); };

if (!fs.existsSync(FILE)) err("dist/index.mjs غير موجود");

let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

// ── Guard: تخطّ إذا كانت إصلاحات cod مُطبَّقة مسبقاً ────────────
const FIXES_GUARD = "// \u2500\u2500 startCodSession / _connectCodSession \u2500\u2500";
if (code.includes(FIXES_GUARD)) {
  console.log(Y + "\u26A0\uFE0F  patch-fixes: \u0645\u064F\u0637\u0628\u064E\u0651\u0642 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u062A\u062E\u0637\u0651\u064A" + N);
  process.exit(0);
}

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

// ══════════════════════════════════════════════════════════════════
// PATCH 1: تغيير زر mymsgs_link_code إلى mymsgs_show_cod
// ══════════════════════════════════════════════════════════════════
patch(
  `callback_data: "mymsgs_link_code" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"`,
  `callback_data: "mymsgs_show_cod" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"`,
  "تغيير زر الربط إلى mymsgs_show_cod"
);

// ══════════════════════════════════════════════════════════════════
// PATCH 2: إضافة cod إلى myMsgsFeatureSubMenu map (بعد news)
// ══════════════════════════════════════════════════════════════════
patch(
  `news:     { en: s.newsEnabled ?? false,      cmd: s.newsCmd ?? "!news",name: "\uD83D\uDCF0 \u0623\u062E\u0628\u0627\u0631",             tog: "mymsgs_toggle_news",      edit: "mymsgs_edit_news_cmd" },`,
  `news:     { en: s.newsEnabled ?? false,      cmd: s.newsCmd ?? "!news",name: "\uD83D\uDCF0 \u0623\u062E\u0628\u0627\u0631",             tog: "mymsgs_toggle_news",      edit: "mymsgs_edit_news_cmd" },
    cod:      { en: s.codEnabled !== false,      cmd: s.codCmd ?? "/cod",  name: "\uD83D\uDD17 \u0631\u0628\u0637 \u0631\u0642\u0645",                tog: "mymsgs_toggle_cod",       edit: "mymsgs_edit_cod_cmd" },`,
  "إضافة cod إلى myMsgsFeatureSubMenu"
);

// ══════════════════════════════════════════════════════════════════
// PATCH 3: إضافة mymsgs_edit_cod_cmd إلى editMap (بعد news)
// ══════════════════════════════════════════════════════════════════
patch(
  `mymsgs_edit_news_cmd:     { field: "newsCmd",     label: "\u0623\u062E\u0628\u0627\u0631",             example: "!news" }\n  };`,
  `mymsgs_edit_news_cmd:     { field: "newsCmd",     label: "\u0623\u062E\u0628\u0627\u0631",             example: "!news" },
    mymsgs_edit_cod_cmd:      { field: "codCmd",      label: "\u0631\u0628\u0637 \u0631\u0642\u0645 \u0648\u0627\u062A\u0633\u0622\u0628",      example: "/cod \u0623\u0648 cod" }
  };`,
  "إضافة mymsgs_edit_cod_cmd إلى editMap"
);

// ══════════════════════════════════════════════════════════════════
// PATCH 4: إضافة handler لـ mymsgs_show_cod و mymsgs_toggle_cod
//          قبل if (data === "mymsgs_link_code")
// ══════════════════════════════════════════════════════════════════
const COD_TG_HANDLERS = `if (data === "mymsgs_show_cod") {
    const sub = myMsgsFeatureSubMenu(s, "cod");
    if (sub) {
      await bot2.sendMessage(chatId, sub.text, { parse_mode: "Markdown", reply_markup: sub.keyboard });
    }
    return;
  }
  if (data === "mymsgs_toggle_cod") {
    const ns = saveMyMsgsSettings(userId, { codEnabled: !(s.codEnabled !== false) });
    const codActive = ns.codEnabled !== false;
    await bot2.sendMessage(
      chatId,
      codActive
        ? \`\u2705 \u0623\u0645\u0631 *\${ns.codCmd || "/cod"}* \u0645\u064F\u0641\u0639\u064E\u0651\u0644 \u2014 \u0627\u0643\u062A\u0628 \u0645\u0646 \u0648\u0627\u062A\u0633\u0622\u0628: \${ns.codCmd || "/cod"} 249XXXXXXXXX\`
        : \`\u274C \u0623\u0645\u0631 \u0631\u0628\u0637 \u0627\u0644\u0631\u0642\u0645 \u0645\u064F\u0639\u0637\u064E\u0651\u0644\`,
      { parse_mode: "Markdown", reply_markup: (() => { try { const sub = myMsgsFeatureSubMenu(ns, "cod"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })() }
    );
    return;
  }
  `;

patch(
  `if (data === "mymsgs_link_code") {`,
  COD_TG_HANDLERS + `if (data === "mymsgs_link_code") {`,
  "إضافة handlers mymsgs_show_cod و mymsgs_toggle_cod"
);

// ══════════════════════════════════════════════════════════════════
// PATCH 5: إعادة كتابة startCodSession + _connectCodSession
//          تعمل تماماً مثل _connectPairing: جلسة مستمرة + إعادة اتصال
//          + تلغي الجلسة القديمة إذا نُودي بها مرة ثانية
//          + ترسل الكود فقط (بدون نص إضافي)
// ══════════════════════════════════════════════════════════════════
const OLD_COD_BLOCK_START = `// \u2500\u2500 startCodSession: \u0631\u0628\u0637 \u0631\u0642\u0645 \u062C\u062F\u064A\u062F \u0645\u0646 \u0648\u0627\u062A\u0633\u0627\u0628 (/cod) \u2500\u2500`;

const NEW_COD_BLOCK = `// \u2500\u2500 startCodSession / _connectCodSession \u2500\u2500
const _codSessions = new Map();
async function startCodSession(userId, waSock, waJid, phone) {
  const cleanPhone = phone.replace(/\\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    try { await waSock.sendMessage(waJid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: /cod 249960506662" }); } catch {}
    return;
  }
  const key = userId + "_" + cleanPhone;
  const existing = _codSessions.get(key);
  if (existing) {
    existing.cancelled = true;
    try { existing.sock?.ws?.close?.(); } catch {}
    _codSessions.delete(key);
  }
  const authDir2 = path3.join(WA_SESSIONS_ROOT, userId + "_cod_" + cleanPhone);
  const sd = { sock: null, cancelled: false, retries: 0, authDir: authDir2 };
  _codSessions.set(key, sd);
  try { await waSock.sendMessage(waJid, { text: "\\u23F3 \\u062C\\u0627\\u0631\\u064D \\u0625\\u0646\\u0634\\u0627\\u0621 \\u062C\\u0644\\u0633\\u0629 \\u0631\\u0628\\u0637..." }); } catch {}
  _connectCodSession(userId, waSock, waJid, cleanPhone, key, true).catch((e) => logger.warn({ e }, "[/cod] connect error"));
}
async function _connectCodSession(userId, waSock, waJid, cleanPhone, key, isFirstTime) {
  const sd = _codSessions.get(key);
  if (!sd || sd.cancelled) return;
  try {
    const { useMultiFileAuthState: umfa2 } = await Promise.resolve().then(() => (init_lib6(), lib_exports4));
    fs6.mkdirSync(sd.authDir, { recursive: true });
    const { state: authState2, saveCreds: saveCreds2 } = await umfa2(sd.authDir);
    const tmpSock = makeBaileysSocket(authState2);
    sd.sock = tmpSock;
    tmpSock.ev.on("creds.update", saveCreds2);
    tmpSock.ev.on("connection.update", async (upd) => {
      const { connection: conn2, lastDisconnect: ld2 } = upd;
      const cur = _codSessions.get(key);
      if (!cur || cur.cancelled) { tmpSock.ws?.close?.(); return; }
      if (conn2 === "open") {
        _codSessions.delete(key);
        const numFull = "+" + (tmpSock.user?.id?.split(":")[0] || cleanPhone);
        addNumber(userId, numFull, userId);
        const u2 = getUser(userId);
        const nums2 = u2.whatsappNumbers || [];
        if (!nums2.find((n) => n.number === numFull)) {
          nums2.push({ number: numFull, status: "active", sessionId: userId, connectedAt: new Date().toISOString() });
          saveUser(userId, { whatsappNumbers: nums2 });
        }
        try { await waSock.sendMessage(waJid, { text: "\\u2705 *+" + cleanPhone + "* \\u062A\\u0645 \\u0631\\u0628\\u0637\\u0647 \\u0628\\u0646\\u062C\\u0627\\u062D!" }); } catch {}
        if (botRef) { try { await botRef.sendMessage(Number(userId), "\\u2705 \\u062A\\u0645 \\u0631\\u0628\\u0637 *+" + cleanPhone + "* \\u0628\\u0646\\u062C\\u0627\\u062D", { parse_mode: "Markdown" }); } catch {} }
        return;
      }
      if (conn2 === "close") {
        const statusCode = ld2?.error?.output?.statusCode;
        if (statusCode === 401 || statusCode === 403) {
          _codSessions.delete(key);
          try { fs6.rmSync(sd.authDir, { recursive: true, force: true }); } catch {}
          try { await waSock.sendMessage(waJid, { text: "\\u274C \\u0627\\u0646\\u062A\\u0647\\u062A \\u0635\\u0644\\u0627\\u062D\\u064A\\u0629 \\u0627\\u0644\\u0643\\u0648\\u062F. \\u0627\\u0633\\u062A\\u062E\\u062F\\u0645 /cod \\u0645\\u0631\\u0629 \\u0623\\u062E\\u0631\\u0649." }); } catch {}
          return;
        }
        if (cur.retries < 6) {
          cur.retries++;
          const delay2 = Math.min(cur.retries * 3e3, 18e3);
          setTimeout(() => _connectCodSession(userId, waSock, waJid, cleanPhone, key, false), delay2);
        } else {
          _codSessions.delete(key);
          try { await waSock.sendMessage(waJid, { text: "\\u274C \\u0641\\u0634\\u0644 \\u0627\\u0644\\u0631\\u0628\\u0637 \\u0628\\u0639\\u062F \\u0639\\u062F\\u0629 \\u0645\\u062D\\u0627\\u0648\\u0644\\u0627\\u062A. \\u062C\\u0631\\u0628 /cod \\u0645\\u0631\\u0629 \\u0623\\u062E\\u0631\\u0649." }); } catch {}
        }
      }
    });
    if (isFirstTime && !authState2.creds.registered) {
      await new Promise((r) => setTimeout(r, 2e3));
      const cur = _codSessions.get(key);
      if (!cur || cur.cancelled) return;
      try {
        const pairCode = await tmpSock.requestPairingCode(cleanPhone);
        const formatted = pairCode.match(/.{1,4}/g)?.join("-") || pairCode;
        try { await waSock.sendMessage(waJid, { text: formatted }); } catch {}
        if (botRef) { try { await botRef.sendMessage(Number(userId), "\\uD83D\\uDD17 \\u0643\\u0648\\u062F \\u0631\\u0628\\u0637 *+" + cleanPhone + "*\\n\`\`\`\\n" + formatted + "\\n\`\`\`", { parse_mode: "Markdown" }); } catch {} }
      } catch (pe) {
        const cur2 = _codSessions.get(key);
        if (!cur2 || cur2.cancelled) return;
        const isTimeout = pe.message?.includes("timed out") || pe.message?.includes("408") || pe.message?.includes("timeout");
        if (isTimeout && cur2.retries < 3) {
          cur2.retries++;
          try { tmpSock.ws?.close?.(); } catch {}
          setTimeout(() => _connectCodSession(userId, waSock, waJid, cleanPhone, key, true), 4e3);
          try { await waSock.sendMessage(waJid, { text: "\\u23F3 \\u0645\\u0647\\u0644\\u0629 \\u0627\\u0646\\u062A\\u0647\\u062A\\u060C \\u062C\\u0627\\u0631\\u064D \\u0625\\u0639\\u0627\\u062F\\u0629 \\u0627\\u0644\\u0645\\u062D\\u0627\\u0648\\u0644\\u0629..." }); } catch {}
          return;
        }
        _codSessions.delete(key);
        try { fs6.rmSync(sd.authDir, { recursive: true, force: true }); } catch {}
        try { await waSock.sendMessage(waJid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u0627\\u0644\\u062D\\u0635\\u0648\\u0644 \\u0639\\u0644\\u0649 \\u0643\\u0648\\u062F \\u0627\\u0644\\u0631\\u0628\\u0637: " + pe.message }); } catch {}
      }
    }
  } catch (err2) {
    const cur = _codSessions.get(key);
    if (!cur || cur.cancelled) return;
    if (cur.retries < 4) {
      cur.retries++;
      setTimeout(() => _connectCodSession(userId, waSock, waJid, cleanPhone, key, false), 5e3);
    } else {
      _codSessions.delete(key);
      try { await waSock.sendMessage(waJid, { text: "\\u26A0\\uFE0F \\u062E\\u0637\\u0623 \\u063A\\u064A\\u0631 \\u0645\\u062A\\u0648\\u0642\\u0639 \\u0641\\u064A \\u0625\\u0646\\u0634\\u0627\\u0621 \\u062C\\u0644\\u0633\\u0629 \\u0627\\u0644\\u0631\\u0628\\u0637." }); } catch {}
    }
  }
}`;

if (code.includes(OLD_COD_BLOCK_START)) {
  const lines = code.split("\n");
  let startIdx = -1, endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("\u2500\u2500 startCodSession: \u0631\u0628\u0637 \u0631\u0642\u0645") || lines[i].includes("startCodSession: \u0631\u0628\u0637 \u0631\u0642\u0645 \u062C\u062F\u064A\u062F")) {
      startIdx = i;
    }
    if (startIdx >= 0 && i > startIdx && lines[i].match(/^\/\/ \u2500{40,}$/)) {
      endIdx = i;
      break;
    }
  }
  if (startIdx >= 0 && endIdx >= 0) {
    const newLines = [...lines.slice(0, startIdx), ...NEW_COD_BLOCK.split("\n"), ...lines.slice(endIdx + 1)];
    code = newLines.join("\n");
    patches++;
    ok("إعادة كتابة startCodSession + _connectCodSession");
  } else {
    wrn("لم يُعثر على حدود دقيقة للدالة — تخطّي");
  }
} else {
  wrn("لم يُجد: بلوك startCodSession");
}

// ══════════════════════════════════════════════════════════════════
// حفظ الملف
// ══════════════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "✅ تم حفظ " + patches + " تعديل على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي تعديل" + N + "\n");
}
