#!/usr/bin/env node
/**
 * patch-mymsgs.mjs — إضافة الميزات المفقودة في قسم "رسائلي":
 *  - !sp   (سبام/فلود)
 *  - !w    (طقس)
 *  - !tr   (ترجمة)
 *  - !news (أخبار)
 *  - !joke (نكتة)
 *  - !fortune (حظ اليوم)
 *  - !wiki  (ويكيبيديا)
 *  - !prayer (مواقيت الصلاة)
 *  - !cur  (تحويل عملة)
 *  - !sticker (تحويل صورة → ستيكر)
 *  - !tag / @all (تاق كل الأعضاء)
 *  - تحسين /film (بحث مرن، يعرض العنوان قبل التحميل)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G="\x1b[32m", Y="\x1b[33m", N="\x1b[0m";
const ok  = m => console.log(G+"✅ "+m+N);
const wrn = m => console.log(Y+"⚠️  "+m+N);

if (!fs.existsSync(FILE)) { console.error("dist/index.mjs غير موجود"); process.exit(1); }
let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

function removeRetiredMyMsgsHandlers() {
  const ranges = [
    ["        // ─── طقس", "        // ─── ترجمة v3"],
    ["        // ─── أخبار", "        // ─── نكتة"],
    ["        // ─── حظ اليوم", "        // ─── ويكيبيديا"],
    ["        // ─── مواقيت الصلاة", "        // ─── تحويل عملة"],
    ["        // ─── تحويل عملة", "        // ─── ستيكر"],
  ];
  let changed = false;
  for (const [startMarker, endMarker] of ranges) {
    const start = code.indexOf(startMarker);
    if (start === -1) continue;
    if (code.indexOf(startMarker, start + startMarker.length) !== -1) {
      throw new Error(`توجد أكثر من كتلة مطابقة: ${startMarker}`);
    }
    const end = code.indexOf(endMarker, start);
    if (end === -1) throw new Error(`تعذّر تحديد نهاية الكتلة: ${startMarker}`);
    code = code.slice(0, start) + code.slice(end);
    changed = true;
  }

  const malformedMgArgs = 'replace(/\\s+me$/i, "").replace(//[';
  if (code.includes(malformedMgArgs)) {
    code = code.replace(malformedMgArgs, 'replace(/\\s+me$/i, "").replace(/[');
    changed = true;
  }

  if (!code.includes('replace(/\\s+me$/i,')) {
    const withMeSuffix = code.replace(
      'const _mgArgsClean = _mgArgs.replace(/',
      'const _mgArgsClean = _mgArgs.replace(/\\s+me$/i, "").replace(/'
    );
    if (withMeSuffix !== code) {
      code = withMeSuffix;
      changed = true;
    }
  }
  return changed;
}

function addMyMsgsCommandControlHook() {
  const marker = "// PATCH_MYMSGS_COMMAND_MANAGER_V1";
  if (code.includes(marker)) return false;
  const anchor = `        const myS = _mmMod.getMyMsgsSettingsForNumber ? _mmMod.getMyMsgsSettingsForNumber(user22, _selfNumForSettings) : getMyMsgsSettings(user22);
        const trimmed = text2.trim();`;
  if (!code.includes(anchor)) {
    throw new Error("تعذّر العثور على موضع إعدادات رسائلي لإضافة مدير الأكواد");
  }
  if (code.indexOf(anchor) !== code.lastIndexOf(anchor)) {
    throw new Error("توجد أكثر من نقطة إدراج لمدير أكواد رسائلي");
  }

  const replacement = `${anchor}
        ${marker}
        if (msg.key?.fromMe && typeof _mmMod.handleMyMsgsCommandControl === "function") {
          let _myMsgsControlReply = null;
          try {
            _myMsgsControlReply = _mmMod.handleMyMsgsCommandControl(userId, _selfNumForSettings, trimmed, myS);
          } catch (_myMsgsControlError) {
            logger.warn({ _myMsgsControlError }, "[MyMsgs] command control failed");
            _myMsgsControlReply = "تعذر تنفيذ أمر الإدارة؛ أعد المحاولة.";
          }
          if (_myMsgsControlReply) {
            try { await activeSock.sendMessage(jid, { text: _myMsgsControlReply }); } catch {}
            return;
          }
        }`;
  code = code.replace(anchor, replacement);
  return true;
}

function repairMyMsgsCommandControlHook() {
  const oldBlock = `          if (_myMsgsControlReply) {
            try { await activeSock.sendMessage(jid, { text: _myMsgsControlReply }); } catch {}
            continue;
          }`;
  if (!code.includes(oldBlock)) return false;
  if (code.indexOf(oldBlock) !== code.lastIndexOf(oldBlock)) {
    throw new Error("توجد أكثر من نقطة لإصلاح مدير أكواد رسائلي");
  }
  code = code.replace(oldBlock, oldBlock.replace("continue;", "return;"));
  return true;
}

// This migration runs before the regular guard so it also repairs an already-patched bundle.
if (removeRetiredMyMsgsHandlers()) {
  fs.writeFileSync(FILE, code, "utf-8");
  ok("إزالة الطقس والأخبار والحظ ومواقيت الصلاة وتحويل العملة من معالجات رسائلي");
  ok("دعم /mg مع رقم الهاتف متبوعاً بـ me");
}

if (addMyMsgsCommandControlHook()) {
  fs.writeFileSync(FILE, code, "utf-8");
  ok("إضافة إدارة أكواد رسائلي وحالاتها إلى رسائل واتساب");
}

if (repairMyMsgsCommandControlHook()) {
  fs.writeFileSync(FILE, code, "utf-8");
  ok("إصلاح خروج معالج أوامر رسائلي");
}

// ── Guard ──────────────────────────────────────────────────────
const GUARD = "// PATCH_MYMSGS_APPLIED_v2";
if (code.includes(GUARD)) {
  ok("patch-mymsgs: مُطبَّق سابقاً — تخطّي");
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════
// PATCH 1: إضافة الميزات المفقودة في messages.upsert
// ══════════════════════════════════════════════════════════════
const ANCHOR = `        continue;
      }
      cachePush(cacheKey, msg);
      const senderName = msg.pushName || jid.split("@")[0];`;

const NEW_HANDLERS = `        // PATCH_MYMSGS_APPLIED_v2
        // ─── سبام/فلود ────────────────────────────────────────
        if (myS.spamEnabled && trimmed.startsWith((myS.spamCmd || "!sp") + " ")) {
          const spRest = trimmed.slice((myS.spamCmd || "!sp").length).trim();
          const spParts = spRest.split(" ");
          const spCount = /^\\d+$/.test(spParts[0]) ? Math.min(parseInt(spParts[0]), 50) : 1;
          const spText = /^\\d+$/.test(spParts[0]) ? spParts.slice(1).join(" ") : spRest;
          if (!spText) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: " + (myS.spamCmd || "!sp") + " 5 \\u0645\\u0631\\u062D\\u0628\\u0627" }); } catch {}
          } else {
            for (let si = 0; si < spCount; si++) {
              try { await activeSock.sendMessage(jid, { text: spText }); await new Promise(r => setTimeout(r, 280)); } catch {}
            }
          }
          continue;
        }
        // ─── تاق الكل ────────────────────────────────────────
        if ((myS.tagEnabled ?? false) && (trimmed === "!tag" || trimmed === "@all" || trimmed.startsWith("!tag "))) {
          if (!isGroup) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0647\\u0630\\u0627 \\u0627\\u0644\\u0623\\u0645\\u0631 \\u0644\\u0644\\u0645\\u062C\\u0645\\u0648\\u0639\\u0627\\u062A \\u0641\\u0642\\u0637" }); } catch {}
          } else {
            try {
              const tagMeta = await Promise.race([activeSock.groupMetadata(jid), new Promise(r => setTimeout(() => r(null), 10000))]);
              const tagParts = (tagMeta?.participants || []);
              if (tagParts.length === 0) {
                try { await activeSock.sendMessage(jid, { text: "\\u274C \\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F \\u0628\\u064A\\u0627\\u0646\\u0627\\u062A \\u0623\\u0639\\u0636\\u0627\\u0621" }); } catch {}
              } else {
                const tagMentions = tagParts.map(p => p.id);
                const tagMsg = (trimmed.startsWith("!tag ") ? trimmed.slice(5).trim() : "\\uD83D\\uDCE3") + "\\n" + tagParts.map(p => "@" + p.id.split("@")[0]).join(" ");
                try { await activeSock.sendMessage(jid, { text: tagMsg, mentions: tagMentions }); } catch {}
              }
            } catch (tagErr) {
              try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0641\\u064A\\u0630 \\u0627\\u0644\\u062A\\u0627\\u0642" }); } catch {}
            }
          }
          continue;
        }
        // ─── طقس ───────────────────────────────────────────────
        if ((myS.weatherEnabled ?? false) && trimmed.startsWith((myS.weatherCmd || "!w") + " ")) {
          const wCity = trimmed.slice((myS.weatherCmd || "!w").length).trim();
          try {
            const wR = await fetch("https://wttr.in/" + encodeURIComponent(wCity) + "?format=j1", { signal: AbortSignal.timeout(12000) });
            const wData = await wR.json();
            const wCur = wData.current_condition?.[0];
            if (!wCur) throw new Error("no data");
            const wMsg = "\\uD83C\\uDF24\\uFE0F *\\u0627\\u0644\\u0637\\u0642\\u0633 \\u0641\\u064A " + wCity + "*\\n\\n\\uD83C\\uDF21\\uFE0F " + wCur.temp_C + "\\u00B0C (\\u064A\\u0628\\u062F\\u0648: " + wCur.FeelsLikeC + "\\u00B0C)\\n\\u2601\\uFE0F " + (wCur.weatherDesc?.[0]?.value || "") + "\\n\\uD83D\\uDCA7 \\u0631\\u0637\\u0648\\u0628\\u0629: " + wCur.humidity + "%\\n\\uD83D\\uDCA8 \\u0631\\u064A\\u0627\\u062D: " + wCur.windspeedKmph + " \\u0643\\u0645/\\u0633";
            await activeSock.sendMessage(jid, { text: wMsg });
          } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062C\\u0644\\u0628 \\u0627\\u0644\\u0637\\u0642\\u0633 \\u0644\\u0640 \\"" + wCity + "\\"" }); } catch {} }
          continue;
        }
        // ─── ترجمة ─────────────────────────────────────────────
        if ((myS.translateEnabled ?? false) && trimmed.startsWith((myS.translateCmd || "!tr") + " ")) {
          const trRest = trimmed.slice((myS.translateCmd || "!tr").length).trim();
          const trParts = trRest.split(" ");
          let trLang = "ar", trText;
          if (trParts[0]?.length === 2 && /^[a-z]{2}$/i.test(trParts[0])) { trLang = trParts[0]; trText = trParts.slice(1).join(" "); }
          else { trText = trRest; }
          if (!trText) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: " + (myS.translateCmd || "!tr") + " ar hello world" }); } catch {}
          } else {
            try {
              const trR = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(trText) + "&langpair=auto|" + trLang, { signal: AbortSignal.timeout(12000) });
              const trData = await trR.json();
              const trOut = trData.responseData?.translatedText;
              if (!trOut) throw new Error("no result");
              await activeSock.sendMessage(jid, { text: "\\uD83C\\uDF10 *\\u0627\\u0644\\u062A\\u0631\\u062C\\u0645\\u0629:*\\n" + trOut });
            } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u0627\\u0644\\u062A\\u0631\\u062C\\u0645\\u0629" }); } catch {} }
          }
          continue;
        }
        // ─── أخبار ─────────────────────────────────────────────
        if ((myS.newsEnabled ?? false) && (trimmed === (myS.newsCmd || "!news") || trimmed.startsWith((myS.newsCmd || "!news") + " "))) {
          const nQuery = trimmed.slice((myS.newsCmd || "!news").length).trim();
          try {
            const nUrl = nQuery
              ? "https://news.google.com/rss/search?q=" + encodeURIComponent(nQuery) + "&hl=ar&gl=AE&ceid=AE:ar"
              : "https://news.google.com/rss?hl=ar&gl=AE&ceid=AE:ar";
            const nR = await fetch(nUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(14000) });
            const nXml = await nR.text();
            const nItems = [];
            const nRe = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g;
            let nM; let skip = true;
            while ((nM = nRe.exec(nXml)) !== null && nItems.length < 6) {
              if (skip) { skip = false; continue; } // skip channel title
              const t = nM[1].replace(/ - [^-]+$/, "").trim();
              if (t && !nItems.includes(t)) nItems.push(t);
            }
            if (nItems.length === 0) throw new Error("no news");
            const nMsg = "\\uD83D\\uDCF0 *\\u0623\\u062E\\u0628\\u0627\\u0631" + (nQuery ? " " + nQuery : "") + ":*\\n\\n" + nItems.map((t, i) => (i+1) + ". " + t).join("\\n");
            await activeSock.sendMessage(jid, { text: nMsg });
          } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062C\\u0644\\u0628 \\u0627\\u0644\\u0623\\u062E\\u0628\\u0627\\u0631" }); } catch {} }
          continue;
        }
        // ─── نكتة ──────────────────────────────────────────────
        if ((myS.jokeEnabled ?? false) && trimmed === (myS.jokeCmd || "!joke")) {
          const jokeFallbacks = ["\\uD83D\\uDE02 \\u0644\\u0645\\u0627\\u0630\\u0627 \\u0644\\u0627 \\u064A\\u062B\\u0642 \\u0627\\u0644\\u0631\\u064A\\u0627\\u0636\\u064A\\u0648\\u0646 \\u0628\\u0627\\u0644\\u0633\\u0644\\u0627\\u0644\\u0645\\u061F \\u0644\\u0623\\u0646\\u0647\\u0645 \\u064A\\u0631\\u0641\\u0639\\u0648\\u0646 \\u0627\\u0644\\u0623\\u0634\\u062E\\u0627\\u0635 \\u0648\\u064A\\u0633\\u0642\\u0637\\u0648\\u0646\\u0647\\u0645!", "\\uD83D\\uDE02 \\u0642\\u0627\\u0644 \\u0645\\u0639\\u0644\\u0645: \\u0645\\u0646 \\u064A\\u0639\\u0631\\u0641 \\u062C\\u0648\\u0627\\u0628 \\u0647\\u0630\\u0627 \\u0627\\u0644\\u0633\\u0624\\u0627\\u0644\\u061F \\u0642\\u0627\\u0644 \\u0637\\u0627\\u0644\\u0628: \\u0623\\u0646\\u0627! \\u0642\\u0627\\u0644: \\u0623\\u062D\\u0633\\u0646\\u062A\\u060C \\u0648\\u0645\\u0646 \\u064A\\u0639\\u0631\\u0641 \\u0627\\u0644\\u0633\\u0624\\u0627\\u0644 \\u0627\\u0644\\u062B\\u0627\\u0646\\u064A?", "\\uD83D\\uDE02 \\u0637\\u0631\\u0642 \\u0634\\u062E\\u0635 \\u0628\\u0627\\u0628 \\u0637\\u0628\\u064A\\u0628 \\u0627\\u0644\\u0623\\u0633\\u0646\\u0627\\u0646\\u060C \\u0642\\u0627\\u0644: \\u0627\\u0641\\u062A\\u062D \\u0641\\u0645\\u0643... \\u0642\\u0627\\u0644 \\u0627\\u0644\\u0637\\u0628\\u064A\\u0628: \\u0644\\u062F\\u064A\\u0643 \\u0633\\u0646\\u0629 12!", "\\uD83D\\uDE02 \\u0643\\u064A\\u0641 \\u062A\\u062F\\u062E\\u0644 \\u0641\\u064A\\u0644 \\u0641\\u064A \\u062B\\u0644\\u0627\\u062C\\u0629\\u061F \\u062A\\u0636\\u063A\\u0637 \\u0632\\u0631 \\u0627\\u0644\\u062B\\u0644\\u0627\\u062C\\u0629!"];
          try {
            const jR = await fetch("https://official-joke-api.appspot.com/random_joke", { signal: AbortSignal.timeout(10000) });
            const jData = await jR.json();
            if (jData.setup && jData.punchline) {
              await activeSock.sendMessage(jid, { text: "\\uD83D\\uDE02 *\\u0646\\u0643\\u062A\\u0629:*\\n\\n" + jData.setup + "\\n\\n" + jData.punchline });
            } else throw new Error("no joke");
          } catch { try { await activeSock.sendMessage(jid, { text: jokeFallbacks[Math.floor(Math.random() * jokeFallbacks.length)] }); } catch {} }
          continue;
        }
        // ─── حظ اليوم ──────────────────────────────────────────
        if ((myS.fortuneEnabled ?? false) && trimmed === (myS.fortuneCmd || "!fortune")) {
          const fortunes = ["\\u2728 \\u0627\\u0644\\u064A\\u0648\\u0645 \\u064A\\u0628\\u062F\\u0623 \\u0628\\u0627\\u0644\\u0623\\u0645\\u0644 \\u0648\\u064A\\u0646\\u062A\\u0647\\u064A \\u0628\\u0627\\u0644\\u0625\\u0646\\u062C\\u0627\\u0632","\\uD83C\\uDF1F \\u0627\\u0644\\u0635\\u0628\\u0631 \\u0645\\u0641\\u062A\\u0627\\u062D \\u0627\\u0644\\u0641\\u0631\\u062C","\\uD83D\\uDCA1 \\u0643\\u0644 \\u0645\\u0634\\u0643\\u0644\\u0629 \\u062A\\u062D\\u0645\\u0644 \\u0641\\u064A \\u0637\\u064A\\u0627\\u062A\\u0647\\u0627 \\u0641\\u0631\\u0635\\u0629","\\uD83D\\uDE80 \\u0627\\u0644\\u0646\\u062C\\u0627\\u062D \\u064A\\u0628\\u062F\\u0623 \\u0628\\u062E\\u0637\\u0648\\u0629 \\u0648\\u0627\\u062D\\u062F\\u0629","\\uD83C\\uDF08 \\u0628\\u0639\\u062F \\u0643\\u0644 \\u0639\\u0627\\u0635\\u0641\\u0629 \\u062A\\u0634\\u0631\\u0642 \\u0627\\u0644\\u0634\\u0645\\u0633","\\uD83C\\uDFAF \\u062D\\u0644\\u0645\\u0643 \\u0627\\u0644\\u064A\\u0648\\u0645 \\u0647\\u0648 \\u0648\\u0627\\u0642\\u0639\\u0643 \\u0627\\u0644\\u063A\\u062F","\\uD83D\\uDCAA \\u0627\\u0644\\u0642\\u0648\\u0629 \\u062A\\u0623\\u062A\\u064A \\u0645\\u0646 \\u0627\\u0644\\u062F\\u0627\\u062E\\u0644","\\uD83C\\uDF3A \\u0627\\u0644\\u062C\\u0645\\u0627\\u0644 \\u0641\\u064A \\u0627\\u0644\\u062A\\u0641\\u0627\\u0635\\u064A\\u0644 \\u0627\\u0644\\u0635\\u063A\\u064A\\u0631\\u0629","\\uD83D\\uDCB0 \\u0641\\u0631\\u0635\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629 \\u062A\\u0642\\u062A\\u0631\\u0628 \\u0645\\u0646\\u0643","\\uD83C\\uDF4E \\u0627\\u0644\\u064A\\u0648\\u0645 \\u064A\\u0648\\u0645 \\u0645\\u062D\\u0638\\u0648\\u0638 \\u2014 \\u0627\\u063A\\u062A\\u0646\\u0645\\u0647!"];
          const ft = fortunes[Math.floor(Math.random() * fortunes.length)];
          try { await activeSock.sendMessage(jid, { text: "\\uD83D\\uDD2E *\\u062D\\u0638\\u0643 \\u0627\\u0644\\u064A\\u0648\\u0645:*\\n\\n" + ft }); } catch {}
          continue;
        }
        // ─── ويكيبيديا ─────────────────────────────────────────
        if ((myS.wikiEnabled ?? false) && trimmed.startsWith((myS.wikiCmd || "!wiki") + " ")) {
          const wkQ = trimmed.slice((myS.wikiCmd || "!wiki").length).trim();
          if (!wkQ) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: " + (myS.wikiCmd || "!wiki") + " \\u0645\\u0635\\u0631" }); } catch {}
          } else {
            try {
              let wkR = await fetch("https://ar.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wkQ), { signal: AbortSignal.timeout(12000) });
              let wkData = await wkR.json();
              if (!wkData.extract || wkData.type === "disambiguation") {
                wkR = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wkQ), { signal: AbortSignal.timeout(10000) });
                wkData = await wkR.json();
              }
              if (!wkData.extract) throw new Error("not found");
              const wkText = "\\uD83D\\uDCDA *" + wkData.title + ":*\\n\\n" + wkData.extract.slice(0, 700) + (wkData.extract.length > 700 ? "..." : "");
              await activeSock.sendMessage(jid, { text: wkText });
            } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u0644\\u0645 \\u0623\\u062C\\u062F \\u0645\\u0639\\u0644\\u0648\\u0645\\u0627\\u062A \\u0639\\u0646 \\"" + wkQ + "\\"" }); } catch {} }
          }
          continue;
        }
        // ─── مواقيت الصلاة ─────────────────────────────────────
        if ((myS.prayerEnabled ?? false) && (trimmed === (myS.prayerCmd || "!prayer") || trimmed.startsWith((myS.prayerCmd || "!prayer") + " "))) {
          const prCity = trimmed.slice((myS.prayerCmd || "!prayer").length).trim() || "Riyadh";
          try {
            const prR = await fetch("https://api.aladhan.com/v1/timingsByCity?city=" + encodeURIComponent(prCity) + "&country=&method=4", { signal: AbortSignal.timeout(12000) });
            const prData = await prR.json();
            if (prData.code !== 200 || !prData.data?.timings) throw new Error("not found");
            const pt = prData.data.timings;
            const pd = prData.data.date?.readable || "";
            const prMsg = "\\uD83D\\uDD4C *\\u0645\\u0648\\u0627\\u0642\\u064A\\u062A \\u0627\\u0644\\u0635\\u0644\\u0627\\u0629 \\u0641\\u064A " + prCity + "*\\n\\uD83D\\uDCC5 " + pd + "\\n\\n\\uD83C\\uDF05 \\u0627\\u0644\\u0641\\u062C\\u0631: " + pt.Fajr + "\\n\\u2600\\uFE0F \\u0627\\u0644\\u0634\\u0631\\u0648\\u0642: " + pt.Sunrise + "\\n\\uD83C\\uDF1E \\u0627\\u0644\\u0638\\u0647\\u0631: " + pt.Dhuhr + "\\n\\uD83C\\uDF06 \\u0627\\u0644\\u0639\\u0635\\u0631: " + pt.Asr + "\\n\\uD83C\\uDF07 \\u0627\\u0644\\u0645\\u063A\\u0631\\u0628: " + pt.Maghrib + "\\n\\uD83C\\uDF19 \\u0627\\u0644\\u0639\\u0634\\u0627\\u0621: " + pt.Isha;
            await activeSock.sendMessage(jid, { text: prMsg });
          } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062C\\u0644\\u0628 \\u0645\\u0648\\u0627\\u0642\\u064A\\u062A \\u0627\\u0644\\u0635\\u0644\\u0627\\u0629 \\u0644\\u0640 \\"" + prCity + "\\"" }); } catch {} }
          continue;
        }
        // ─── تحويل عملة ────────────────────────────────────────
        if ((myS.currencyEnabled ?? false) && trimmed.startsWith((myS.currencyCmd || "!cur") + " ")) {
          const curRest = trimmed.slice((myS.currencyCmd || "!cur").length).trim();
          const curParts = curRest.toUpperCase().split(/\\s+/);
          let curAmt = 1, curFrom, curTo;
          if (curParts.length >= 3 && /^\\d+(\\.\\d+)?$/.test(curParts[0])) { curAmt = parseFloat(curParts[0]); curFrom = curParts[1]; curTo = curParts[2]; }
          else if (curParts.length >= 2) { curFrom = curParts[0]; curTo = curParts[1]; }
          else { try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: " + (myS.currencyCmd || "!cur") + " 100 USD SAR" }); } catch {} continue; }
          try {
            const curR = await fetch("https://api.frankfurter.app/latest?from=" + curFrom + "&to=" + curTo, { signal: AbortSignal.timeout(12000) });
            const curData = await curR.json();
            if (curData.error) throw new Error(curData.error);
            const curRate = curData.rates?.[curTo];
            if (!curRate) throw new Error("not found");
            const curResult = (curAmt * curRate).toFixed(4);
            await activeSock.sendMessage(jid, { text: "\\uD83D\\uDCB1 *\\u062A\\u062D\\u0648\\u064A\\u0644 \\u0627\\u0644\\u0639\\u0645\\u0644\\u0629*\\n\\n" + curAmt + " " + curFrom + " = *" + curResult + " " + curTo + "*\\n\\uD83D\\uDCCA \\u0627\\u0644\\u0633\\u0639\\u0631: 1 " + curFrom + " = " + curRate.toFixed(4) + " " + curTo });
          } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u0627\\u0644\\u062A\\u062D\\u0648\\u064A\\u0644. \\u062A\\u0623\\u0643\\u062F \\u0645\\u0646 \\u0631\\u0645\\u0632 \\u0627\\u0644\\u0639\\u0645\\u0644\\u0629 (\\u0645\\u062B\\u0627\\u0644: USD SAR EUR)" }); } catch {} }
          continue;
        }
        // ─── ستيكر (تحويل صورة → webp) ────────────────────────
        if ((myS.stickerEnabled ?? false) && trimmed.startsWith((myS.stickerCmd || "!sticker"))) {
          const stkCtx = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.stickerMessage?.contextInfo;
          const stkQuoted = stkCtx?.quotedMessage;
          const stkHasImg = stkQuoted?.imageMessage || stkQuoted?.stickerMessage;
          if (!stkHasImg) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0631\\u062F\\u0651 \\u0639\\u0644\\u0649 \\u0635\\u0648\\u0631\\u0629 \\u062B\\u0645 \\u0623\\u0631\\u0633\\u0644 " + (myS.stickerCmd || "!sticker") + " \\u0644\\u062A\\u062D\\u0648\\u064A\\u0644\\u0647\\u0627 \\u0625\\u0644\\u0649 \\u0633\\u062A\\u064A\\u0643\\u0631" }); } catch {}
          } else {
            try {
              const { downloadMediaMessage: stkDM } = await Promise.resolve().then(() => (init_lib6(), lib_exports4));
              const stkMsgForDl = { key: { remoteJid: jid, fromMe: false, id: stkCtx?.quotedMessageId || stkCtx?.stanzaId || "" }, message: stkQuoted };
              const stkBuf = await stkDM(stkMsgForDl, "buffer", {}, { logger: baileysLogger, reuploadRequest: activeSock.updateMediaMessage });
              if (!stkBuf || stkBuf.length < 100) throw new Error("empty");
              // إذا كانت الصورة webp بالفعل (ستيكر) نرسلها مباشرة
              if (stkQuoted.stickerMessage) {
                await activeSock.sendMessage(jid, { sticker: stkBuf });
              } else {
                // حاول التحويل باستخدام ffmpeg
                const { mkdtemp, rm, writeFile: wf, readFile: rf } = await import("fs/promises");
                const { join: jn } = await import("path");
                const { tmpdir: td } = await import("os");
                const stkTmp = await mkdtemp(jn(td(), "stk-"));
                const stkIn = jn(stkTmp, "in.jpg");
                const stkOut = jn(stkTmp, "out.webp");
                await wf(stkIn, stkBuf);
                const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
                const { execFile: ef2 } = await import("child_process");
                const { promisify: p2 } = await import("util");
                const efP = p2(ef2);
                try {
                  await efP(ffmpegPath, ["-i", stkIn, "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:white,format=rgba", "-c:v", "libwebp", "-quality", "80", "-loop", "0", stkOut], { timeout: 20000 });
                  const stkWebp = await rf(stkOut);
                  await activeSock.sendMessage(jid, { sticker: stkWebp, mimetype: "image/webp" });
                } finally {
                  rm(stkTmp, { recursive: true, force: true }).catch(() => {});
                }
              }
            } catch (stkErr) {
              logger.warn({ stkErr }, "[sticker] failed");
              try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u062D\\u0648\\u064A\\u0644 \\u0627\\u0644\\u0635\\u0648\\u0631\\u0629 \\u0625\\u0644\\u0649 \\u0633\\u062A\\u064A\\u0643\\u0631" }); } catch {}
            }
          }
          continue;
        }
        continue;
      }
      cachePush(cacheKey, msg);
      const senderName = msg.pushName || jid.split("@")[0];`;

patch(ANCHOR, NEW_HANDLERS, "إضافة ميزات رسائلي: سبام+تاق+ترجمة+نكتة+ويكيبيديا+ستيكر");

// ══════════════════════════════════════════════════════════════
// PATCH 2: تحسين /film — عرض العنوان قبل التحميل + بحث مرن
// ══════════════════════════════════════════════════════════════
patch(
  `if (myS.filmEnabled && trimmed.startsWith(myS.filmCmd + " ")) {
          const query = trimmed.slice(myS.filmCmd.length).trim();
          if (!query) {
            try {
              await activeSock.sendMessage(jid, { text: \`\u26A0\uFE0F \u0645\u062B\u0627\u0644: \${myS.filmCmd} inception\` });
            } catch {
            }
          } else {
            try {
              await activeSock.sendMessage(jid, { text: \`\u{1F3A5} \u0623\u0628\u062D\u062B \u0639\u0646 \u0641\u064A\u0644\u0645 "\${query}" \u0648\u0623\u0646\u0632\u0651\u0644\u0647... (\u0642\u062F \u064A\u0633\u062A\u063A\u0631\u0642 \u0628\u0636\u0639 \u062F\u0642\u0627\u0626\u0642)\` });
            } catch {
            }
            try {
              const { downloadMovie: downloadMovie2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const result = await downloadMovie2(query);
              await activeSock.sendMessage(jid, {
                video: result.buffer,
                caption: \`\u{1F3A5} \${result.title}\`,
                mimetype: "video/mp4"
              });
            } catch (e) {
              logger.warn({ e }, "[/film] failed");
              const errMsg = e?.message?.includes("\u0644\u0645 \u0623\u062C\u062F") ? \`\u274C \${e.message}\` : \`\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645 \u2014 \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u062D\u0627\u0648\u0644 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629\`;
              try {
                await activeSock.sendMessage(jid, { text: errMsg });
              } catch {
              }
            }
          }
          continue;
        }`,
  `if (myS.filmEnabled && trimmed.startsWith(myS.filmCmd + " ")) {
          const filmQuery = trimmed.slice(myS.filmCmd.length).trim();
          if (!filmQuery) {
            try { await activeSock.sendMessage(jid, { text: "\u26A0\uFE0F \u0645\u062B\u0627\u0644: " + myS.filmCmd + " inception \u0623\u0648 " + myS.filmCmd + " \u0634\u0627\u0647\u064A\u0646" }); } catch {}
          } else {
            try { await activeSock.sendMessage(jid, { text: "\uD83D\uDD0D \u0623\u0628\u062D\u062B \u0639\u0646 \\"" + filmQuery + "\\"..." }); } catch {}
            const filmStrategies = [filmQuery + " full movie", filmQuery + " \u0641\u064A\u0644\u0645 \u0643\u0627\u0645\u0644", filmQuery + " movie", filmQuery + " film", filmQuery];
            let filmBest = null;
            const { ytdlpSearch: ytdlpSearchFilm, ytdlpDownload: ytdlpDownloadFilm } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
            for (const filmStrat of filmStrategies) {
              try {
                const filmVids = await ytdlpSearchFilm(filmStrat, 8, 0);
                if (filmVids.length > 0) {
                  filmBest = filmVids.find(v => v.duration >= 1800) || filmVids.find(v => v.duration >= 600) || filmVids[0];
                  if (filmBest) break;
                }
              } catch {}
            }
            if (!filmBest) {
              try { await activeSock.sendMessage(jid, { text: "\u274C \u0644\u0645 \u0623\u062C\u062F \u0641\u064A\u0644\u0645 \\"" + filmQuery + "\\" \u2014 \u062C\u0631\u0651\u0628 \u0627\u0633\u0645\u0627\u064B \u0622\u062E\u0631 \u0623\u0648 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629" }); } catch {}
            } else {
              const filmDurMin = Math.floor((filmBest.duration || 0) / 60);
              try { await activeSock.sendMessage(jid, { text: "\uD83C\uDFA5 \u0648\u062C\u062F\u062A: " + filmBest.title + " (" + (filmDurMin > 0 ? filmDurMin + " \u062F\u0642\u064A\u0642\u0629" : "?") + ")\n\u23F3 \u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644..." }); } catch {}
              const filmQualAttempts = [
                { args: ["-f", "worst[ext=mp4]/worst", "--max-filesize", "40m", "--recode-video", "mp4"], maxMB: 40 },
                { args: ["-f", "bestvideo[height<=360]+bestaudio/best[height<=360]/worst", "--merge-output-format", "mp4", "--max-filesize", "35m"], maxMB: 35 },
                { args: ["-f", "worst", "--max-filesize", "30m"], maxMB: 30 }
              ];
              let filmDone = false;
              for (const { args: filmArgs, maxMB: filmMaxMB } of filmQualAttempts) {
                try {
                  const filmBuf = await ytdlpDownloadFilm(filmBest.url, filmArgs, "film", 600000, filmMaxMB);
                  await activeSock.sendMessage(jid, { video: filmBuf, caption: "\uD83C\uDFA5 " + filmBest.title, mimetype: "video/mp4" });
                  filmDone = true; break;
                } catch (filmE) { logger.warn({ filmE }, "[/film] quality fallback"); }
              }
              if (!filmDone) {
                try { await activeSock.sendMessage(jid, { text: "\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645 \u2014 \u0627\u0644\u0645\u0644\u0641 \u0623\u0643\u0628\u0631 \u0645\u0646 \u062D\u062F \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629" }); } catch {}
              }
            }
          }
          continue;
        }`,
  "تحسين /film: بحث مرن + عرض العنوان قبل التحميل"
);

// ══════════════════════════════════════════════════════════════
// PATCH 3: إضافة tagEnabled إلى DEFAULTS
// ══════════════════════════════════════════════════════════════
patch(
  `      codEnabled: true\n    };`,
  `      codEnabled: true,\n      tagEnabled: false,\n      tagCmd: "!tag"\n    };`,
  "إضافة tagEnabled إلى DEFAULTS"
);

// ══════════════════════════════════════════════════════════════
// PATCH 4: إضافة زر تاق في قائمة رسائلي
// ══════════════════════════════════════════════════════════════
patch(
  `[{ text: "\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645", callback_data: "mymsgs_show_cod" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }]`,
  `[f(s.tagEnabled ?? false, "\uD83D\uDCE3 \u062A\u0627\u0642 \u0627\u0644\u0643\u0644", "mymsgs_show_tag"), { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }],\n      [{ text: "\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645", callback_data: "mymsgs_show_cod" }]`,
  "إضافة زر تاق الكل في القائمة"
);

// ══════════════════════════════════════════════════════════════
// حفظ
// ══════════════════════════════════════════════════════════════
if (removeRetiredMyMsgsHandlers()) {
  ok("تم حذف معالجات الميزات المتقاعدة من الحزمة");
}

if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "✅ تم حفظ " + patches + " تعديل على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي تعديل" + N + "\n");
}
