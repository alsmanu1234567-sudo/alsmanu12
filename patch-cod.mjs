#!/usr/bin/env node
/**
 * patch-cod.mjs
 * يضيف أمر /cod لربط رقم واتساب جديد من داخل المحادثة
 * استخدام: node patch-cod.mjs
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

// ── Guard: تخطّ إذا كان مُطبَّقاً مسبقاً ──────────────────────
if (code.includes("const _codSessions = new Map()")) {
  console.log(Y + "\u26A0\uFE0F  patch-cod: \u0645\u064F\u0637\u0628\u064E\u0651\u0642 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u062A\u062E\u0637\u0651\u064A" + N);
  process.exit(0);
}

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

// ════════════════════════════════════════════════════════
// PATCH 1: إضافة codCmd و codEnabled إلى DEFAULTS
// ════════════════════════════════════════════════════════
patch(
  `statusCopyCmd: "/\u062D\u0627\u0644\u0629",`,
  `statusCopyCmd: "/\u062D\u0627\u0644\u0629",\n      codCmd: "/cod",`,
  "إضافة codCmd إلى DEFAULTS"
);

patch(
  `statusCopyEnabled: true\n    };`,
  `statusCopyEnabled: true,\n      codEnabled: true\n    };`,
  "إضافة codEnabled إلى DEFAULTS"
);

// ════════════════════════════════════════════════════════
// PATCH 2: إضافة دالة startCodSession قبل _connectPairing
// ════════════════════════════════════════════════════════
const COD_FUNCTION = `
// ── startCodSession: ربط رقم جديد من واتساب (/cod) ──
const _codSessions = new Map();
async function startCodSession(userId, waSock, waJid, phone) {
  const cleanPhone = phone.replace(/\\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    try { await waSock.sendMessage(waJid, { text: "\u26A0\uFE0F \u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" }); } catch {}
    return;
  }
  // منع التشغيل المزدوج
  if (_codSessions.has(userId + "_" + cleanPhone)) {
    try { await waSock.sendMessage(waJid, { text: "\u23F3 \u062C\u0644\u0633\u0629 \u0631\u0628\u0637 \u0644\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u062C\u0627\u0631\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644..." }); } catch {}
    return;
  }
  _codSessions.set(userId + "_" + cleanPhone, true);
  try { await waSock.sendMessage(waJid, { text: "\u{1F517} \u062C\u0627\u0631\u064A \u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629 \u0644\u0640 +" + cleanPhone + " \u2014 \u0627\u0646\u062A\u0638\u0631..." }); } catch {}
  try {
    const authDir2 = path3.join(WA_SESSIONS_ROOT, userId + "_cod_" + cleanPhone);
    fs6.mkdirSync(authDir2, { recursive: true });
    const { useMultiFileAuthState: umfa2 } = await Promise.resolve().then(() => (init_lib6(), lib_exports4));
    const { state: authState2, saveCreds: saveCreds2 } = await umfa2(authDir2);
    const tmpSock = makeBaileysSocket(authState2);
    tmpSock.ev.on("creds.update", saveCreds2);
    // انتظار الاستعداد ثم طلب الكود
    await new Promise((r) => setTimeout(r, 2500));
    let pairCode;
    try {
      pairCode = await tmpSock.requestPairingCode(cleanPhone);
    } catch (pe) {
      _codSessions.delete(userId + "_" + cleanPhone);
      try { await waSock.sendMessage(waJid, { text: "\u274C \u062A\u0639\u0630\u0651\u0631 \u0625\u0646\u0634\u0627\u0621 \u0643\u0648\u062F \u0627\u0644\u0631\u0628\u0637: " + pe.message }); } catch {}
      return;
    }
    const formatted = (pairCode.match(/.{1,4}/g) || [pairCode]).join("-");
    // إرسال الكود عبر واتساب
    try {
      await waSock.sendMessage(waJid, {
        text:
          "\u{1F522} *\u0643\u0648\u062F \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0622\u0628*\n\n\`\`\`\n" + formatted + "\n\`\`\`\n\n" +
          "\u{1F4F1} *\u0627\u0644\u0631\u0642\u0645:* +" + cleanPhone + "\n\n" +
          "*\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u0631\u0628\u0637:*\n" +
          "1\uFE0F\u20E3 \u0627\u0641\u062A\u062D \u0648\u0627\u062A\u0633\u0622\u0628 \u0639\u0644\u0649 \u0627\u0644\u0647\u0627\u062A\u0641\n" +
          "2\uFE0F\u20E3 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629\n" +
          "3\uFE0F\u20E3 \u0631\u0628\u0637 \u0628\u0627\u0644\u0631\u0645\u0632 \u2192 \u0623\u062F\u062E\u0644 \u0627\u0644\u0643\u0648\u062F"
      });
    } catch {}
    // إشعار تيليغرام
    if (botRef) {
      try {
        await botRef.sendMessage(Number(userId),
          "\u{1F517} \u0643\u0648\u062F \u0631\u0628\u0637 \u0644\u0640 *+" + cleanPhone + "*\n\`\`\`\n" + formatted + "\n\`\`\`\n\u0627\u062F\u062E\u0644\u0647 \u0641\u064A \u0648\u0627\u062A\u0633\u0622\u0628 \u0644\u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0631\u0628\u0637",
          { parse_mode: "Markdown" }
        );
      } catch {}
    }
    // مراقبة الاتصال
    tmpSock.ev.on("connection.update", async (upd) => {
      const { connection: conn2, lastDisconnect: ld2 } = upd;
      if (conn2 === "open") {
        _codSessions.delete(userId + "_" + cleanPhone);
        const numFull = "+" + (tmpSock.user?.id?.split(":")[0] || cleanPhone);
        addNumber(userId, numFull, userId);
        const u2 = getUser(userId);
        const nums2 = u2.whatsappNumbers || [];
        if (!nums2.find((n) => n.number === numFull)) {
          nums2.push({ number: numFull, status: "active", sessionId: userId, connectedAt: new Date().toISOString() });
          saveUser(userId, { whatsappNumbers: nums2 });
        }
        try { await waSock.sendMessage(waJid, { text: "\u2705 \u062A\u0645 \u0631\u0628\u0637 *+" + cleanPhone + "* \u0628\u0646\u062C\u0627\u062D! \u0631\u0642\u0645\u0643 \u0627\u0644\u062C\u062F\u064A\u062F \u0646\u0634\u0637." }); } catch {}
        if (botRef) {
          try {
            await botRef.sendMessage(Number(userId),
              "\u2705 \u062A\u0645 \u0631\u0628\u0637 *+" + cleanPhone + "* \u0628\u0646\u062C\u0627\u062D \u2014 \u064A\u0638\u0647\u0631 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629",
              { parse_mode: "Markdown" }
            );
          } catch {}
        }
      } else if (conn2 === "close") {
        const shouldReconnect = ld2?.error?.output?.statusCode !== 401;
        if (!shouldReconnect) {
          _codSessions.delete(userId + "_" + cleanPhone);
          try { await waSock.sendMessage(waJid, { text: "\u274C \u062A\u0645 \u0631\u0641\u0636 \u0643\u0648\u062F \u0627\u0644\u0631\u0628\u0637. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." }); } catch {}
        }
      }
    });
  } catch (e) {
    _codSessions.delete(userId + "_" + cleanPhone);
    logger.warn({ e }, "[/cod] startCodSession failed");
    try { await waSock.sendMessage(waJid, { text: "\u26A0\uFE0F \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629 \u0627\u0644\u0631\u0628\u0637" }); } catch {}
  }
}
// ────────────────────────────────────────────────────────
`;

patch(
  `async function _connectPairing(userId, chatId, cleanPhone, isFirstTime) {`,
  COD_FUNCTION + `async function _connectPairing(userId, chatId, cleanPhone, isFirstTime) {`,
  "إضافة دالة startCodSession"
);

// ════════════════════════════════════════════════════════
// PATCH 3: إضافة handler /cod في loop رسائل واتساب
// يُضاف قبل handler /vid مباشرة
// ════════════════════════════════════════════════════════
const COD_WA_HANDLER = `if (myS.codEnabled !== false && trimmed.startsWith((myS.codCmd || "/cod") + " ")) {
          const codArg = trimmed.slice((myS.codCmd || "/cod").length).trim();
          if (!codArg || codArg.replace(/\\D/g, "").length < 7) {
            try { await activeSock.sendMessage(jid, { text: "\u26A0\uFE0F \u0645\u062B\u0627\u0644: " + (myS.codCmd || "/cod") + " 249960506662" }); } catch {}
          } else {
            startCodSession(userId, activeSock, jid, codArg).catch((e) => logger.warn({ e }, "[/cod] error"));
          }
          continue;
        }
        `;

patch(
  `if (myS.vidEnabled && trimmed.startsWith(myS.vidCmd + " ")) {`,
  COD_WA_HANDLER + `if (myS.vidEnabled && trimmed.startsWith(myS.vidCmd + " ")) {`,
  "إضافة handler /cod في loop واتساب"
);

// ════════════════════════════════════════════════════════
// حفظ الملف
// ════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n✅ تم حفظ " + patches + " تعديل على dist/index.mjs\n");
} else {
  console.log("\n⚠️  لم يُطبَّق أي تعديل (ربما مطبَّق من قبل)\n");
}
