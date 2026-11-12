#!/usr/bin/env node
/**
 * patch-download.mjs — تقوية قسم التنزيل الشامل v2
 *
 * ما يفعله:
 *  1. إضافة /vid /song /film /tiktok في تيليجرام (handleTextMessage)
 *  2. إصلاح parser /song في واتساب ليستخدم parseMediaCmd2
 *  3. تحسين رسائل الخطأ للاستقرار
 *
 * استخدام:  node patch-download.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "\u2705 " + m + N);
const wrn = m => console.log(Y + "\u26A0\uFE0F  " + m + N);
const err = m => { console.error(R + "\u274C " + m + N); process.exit(1); };

if (!fs.existsSync(FILE)) err("dist/index.mjs \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");

let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

// ─── helper: بحث وإحلال بالنص الحرفي ──────────────────────────────
function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("\u0644\u0645 \u064A\u064F\u062C\u062F: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

// ─── helper: بحث بـ regex وإحلال ─────────────────────────────────
function patchRe(re, newStr, desc) {
  if (!re.test(code)) { wrn("\u0644\u0645 \u064A\u064F\u062C\u062F (regex): " + desc); return false; }
  code = code.replace(re, newStr);
  patches++;
  ok(desc);
  return true;
}

// ─── guard: تحقق أن الباتش لم يُطبَّق من قبل ────────────────────
function alreadyApplied(marker) {
  return code.includes(marker);
}

// ══════════════════════════════════════════════════════════════════
// PATCH 1: أوامر التنزيل في تيليجرام
// تُحقن قبل: if (text === "/evil") {
// الأنكور: سطر واحد فريد — لا يحتوي unicode escapes
// ══════════════════════════════════════════════════════════════════
const TG_GUARD = '// \u2500\u2500 \u0646\u0647\u0627\u064A\u0629 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0632\u064A\u0644 (TG) \u2500\u2500';

if (alreadyApplied(TG_GUARD)) {
  ok("\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0632\u064A\u0644 \u0645\u062D\u0642\u0648\u0646\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u062A\u062E\u0637\u064A");
} else {
  // الأنكور الفريد — يظهر مرة واحدة فقط في الملف
  const EVIL_LINE = '  if (text === "/evil") {';
  const idx = code.indexOf(EVIL_LINE);
  if (idx < 0) {
    wrn('\u0644\u0645 \u064A\u064F\u062C\u062F \u0633\u0637\u0631 if (text === "/evil") \u2014 \u062A\u062E\u0637\u064A PATCH 1');
  } else {
    const TG_DL_BLOCK = [
      "  " + TG_GUARD,
      '  // /vid [1-3] [\u0639\u062F\u062F] <\u0628\u062D\u062B>  |  /song [\u0639\u062F\u062F] <\u0628\u062D\u062B>  |  /film <\u0627\u0633\u0645>  |  /tiktok [\u0639\u062F\u062F] <\u0628\u062D\u062B>',
      '  if (text.startsWith("/vid ") || text === "/vid") {',
      '    var _vRest = text.replace("/vid", "").trim();',
      '    if (!_vRest) { await bot2.sendMessage(chatId, "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: /vid 3 2 \\u0628\\u062D\\u062B\\n\\u2191\\u062C\\u0648\\u062F\\u0629(1-3) \\u2191\\u0639\\u062F\\u062F \\u2191\\u0628\\u062D\\u062B").catch(function(){}); return; }',
      '    var _vParts = _vRest.split(/\\s+/), _vQual=2, _vCount=1, _vQs=0;',
      '    if (/^[123]$/.test(_vParts[0])) { _vQual=parseInt(_vParts[0]); _vQs=1; }',
      '    if (_vQs<_vParts.length && /^\\d+$/.test(_vParts[_vQs]) && parseInt(_vParts[_vQs])>=1) { _vCount=Math.min(parseInt(_vParts[_vQs]),5); _vQs++; }',
      '    var _vQuery = _vParts.slice(_vQs).join(" ");',
      '    if (!_vQuery) { await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0646\\u0633\\u064A\\u062A \\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0628\\u062D\\u062B!").catch(function(){}); return; }',
      '    var _vLbl = _vQual===1?"360p":_vQual===2?"480p":"720p";',
      '    var _vSm = await bot2.sendMessage(chatId,"\\u{1F50D} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 \\""+_vQuery+"\\" \\u2014 "+_vLbl+" \\u00D7"+_vCount+"...").catch(function(){return null;});',
      '    try {',
      '      var _vDl=(await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).searchAndDownloadYouTubeVideo;',
      '      var _vRes=await _vDl(_vQuery,_vCount,0,_vQual);',
      '      for(var _vR of _vRes){try{await bot2.sendVideo(chatId,_vR.buffer,{caption:"\\u{1F3AC} "+_vR.title});await new Promise(function(r){setTimeout(r,800);});}catch(e2){logger.warn({e2},"[TG /vid] sendVideo");}}',
      '      if(_vRes.length===0) await bot2.sendMessage(chatId,"\\u274C \\u0644\\u0645 \\u0623\\u062C\\u062F \\u0646\\u062A\\u0627\\u0626\\u062C \\u0644\\u0640 \\""+_vQuery+"\\"").catch(function(){});',
      '    } catch(e) {',
      '      logger.warn({e},"[TG /vid] failed");',
      '      await bot2.sendMessage(chatId,"\\u274C "+(e&&e.message?e.message.slice(0,80):"\\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u0627\\u0644\\u0641\\u064A\\u062F\\u064A\\u0648")).catch(function(){});',
      '    }',
      '    if(_vSm) bot2.deleteMessage(chatId,_vSm.message_id).catch(function(){});',
      '    return;',
      '  }',
      '  if (text.startsWith("/song ") || text === "/song") {',
      '    var _sRest=text.replace("/song","").trim();',
      '    if(!_sRest){await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: /song 3 \\u0641\\u064A\\u0631\\u0648\\u0632").catch(function(){});return;}',
      '    var _sPts=_sRest.split(/\\s+/),_sCnt=1,_sSi=0;',
      '    if(/^\\d+$/.test(_sPts[0])&&parseInt(_sPts[0])>=1){_sCnt=Math.min(parseInt(_sPts[0]),10);_sSi=1;}',
      '    var _sQuery=_sPts.slice(_sSi).join(" ");',
      '    if(!_sQuery){await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0646\\u0633\\u064A\\u062A \\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0628\\u062D\\u062B!").catch(function(){});return;}',
      '    var _sSm=await bot2.sendMessage(chatId,"\\u{1F50D} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 \\""+_sQuery+"\\" \\u00D7"+_sCnt+" \\u0623\\u063A\\u0646\\u064A\\u0629...").catch(function(){return null;});',
      '    try {',
      '      var _sDl=(await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).searchAndDownloadYouTubeAudio;',
      '      var _sRes=await _sDl(_sQuery,_sCnt,0);',
      '      for(var _sR of _sRes){try{await bot2.sendAudio(chatId,_sR.buffer,{title:_sR.title,performer:"YouTube"});await new Promise(function(r){setTimeout(r,600);});}catch(e2){logger.warn({e2},"[TG /song] sendAudio");}}',
      '      if(_sRes.length===0) await bot2.sendMessage(chatId,"\\u274C \\u0644\\u0645 \\u0623\\u062C\\u062F \\u0646\\u062A\\u0627\\u0626\\u062C \\u0644\\u0640 \\""+_sQuery+"\\"").catch(function(){});',
      '    } catch(e){',
      '      logger.warn({e},"[TG /song] failed");',
      '      await bot2.sendMessage(chatId,"\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u0627\\u0644\\u0623\\u063A\\u0646\\u064A\\u0629 \\u2014 \\u062D\\u0627\\u0648\\u0644 \\u0645\\u062C\\u062F\\u062F\\u0627\\u064B").catch(function(){});',
      '    }',
      '    if(_sSm) bot2.deleteMessage(chatId,_sSm.message_id).catch(function(){});',
      '    return;',
      '  }',
      '  if (text.startsWith("/film ") || text === "/film") {',
      '    var _fQ=text.replace("/film","").trim();',
      '    if(!_fQ){await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: /film inception").catch(function(){});return;}',
      '    var _fSm=await bot2.sendMessage(chatId,"\\u{1F3A5} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 \\""+_fQ+"\\" \\u0648\\u0623\\u0646\\u0632\\u0651\\u0644\\u0647... (\\u0642\\u062F \\u064A\\u0633\\u062A\\u063A\\u0631\\u0642 \\u062F\\u0642\\u0627\\u0626\\u0642)").catch(function(){return null;});',
      '    try{',
      '      var _fDl=(await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).downloadMovie;',
      '      var _fR=await _fDl(_fQ);',
      '      await bot2.sendVideo(chatId,_fR.buffer,{caption:"\\u{1F3A5} "+_fR.title});',
      '    }catch(e){',
      '      logger.warn({e},"[TG /film] failed");',
      '      await bot2.sendMessage(chatId,"\\u274C "+(e&&e.message?e.message.slice(0,80):"\\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u0627\\u0644\\u0641\\u064A\\u0644\\u0645")).catch(function(){});',
      '    }',
      '    if(_fSm) bot2.deleteMessage(chatId,_fSm.message_id).catch(function(){});',
      '    return;',
      '  }',
      '  if (text.startsWith("/tiktok ") || text === "/tiktok") {',
      '    var _tRest=text.replace("/tiktok","").trim();',
      '    if(!_tRest){await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: /tiktok 3 \\u062A\\u062D\\u0634\\u064A\\u0634 \\u0639\\u0631\\u0627\\u0642\\u064A").catch(function(){});return;}',
      '    var _tPts=_tRest.split(/\\s+/),_tCnt=3,_tTi=0;',
      '    if(/^\\d+$/.test(_tPts[0])&&parseInt(_tPts[0])>=1){_tCnt=Math.min(parseInt(_tPts[0]),5);_tTi=1;}',
      '    var _tQuery=_tPts.slice(_tTi).join(" ");',
      '    if(!_tQuery){await bot2.sendMessage(chatId,"\\u26A0\\uFE0F \\u0646\\u0633\\u064A\\u062A \\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0628\\u062D\\u062B!").catch(function(){});return;}',
      '    var _tSm=await bot2.sendMessage(chatId,"\\u{1F50D} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 \\""+_tQuery+"\\" \\u0641\\u064A \\u062A\\u064A\\u0643 \\u062A\\u0648\\u0643 \\u00D7"+_tCnt+"...").catch(function(){return null;});',
      '    try{',
      '      var _tDl=(await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).searchAndDownloadTikTok;',
      '      var _tRes=await _tDl(_tQuery,_tCnt);',
      '      for(var _tR of _tRes){try{await bot2.sendVideo(chatId,_tR.buffer,{caption:_tR.title||undefined});await new Promise(function(r){setTimeout(r,400);});}catch(e2){logger.warn({e2},"[TG /tiktok] sendVideo");}}',
      '      if(_tRes.length===0) await bot2.sendMessage(chatId,"\\u274C \\u0644\\u0645 \\u0623\\u062C\\u062F \\u0646\\u062A\\u0627\\u0626\\u062C \\u062A\\u064A\\u0643 \\u062A\\u0648\\u0643 \\u0644\\u0640 \\""+_tQuery+"\\"").catch(function(){});',
      '    }catch(e){',
      '      logger.warn({e},"[TG /tiktok] failed");',
      '      await bot2.sendMessage(chatId,"\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u062A\\u064A\\u0643 \\u062A\\u0648\\u0643 \\u2014 \\u062D\\u0627\\u0648\\u0644 \\u0645\\u062C\\u062F\\u062F\\u0627\\u064B").catch(function(){});',
      '    }',
      '    if(_tSm) bot2.deleteMessage(chatId,_tSm.message_id).catch(function(){});',
      '    return;',
      '  }',
    ].join("\n") + "\n";

    code = code.slice(0, idx) + TG_DL_BLOCK + code.slice(idx);
    patches++;
    ok("\u0625\u0636\u0627\u0641\u0629 /vid /song /film /tiktok \u0641\u064A \u062A\u064A\u0644\u064A\u062C\u0631\u0627\u0645 (handleTextMessage)");
  }
}

// ══════════════════════════════════════════════════════════════════
// PATCH 2: إصلاح /song في واتساب — parseMediaCmd2 بدل parts/countStr
// ══════════════════════════════════════════════════════════════════
const SONG_GUARD = '// \u0633\u0648\u0646\u062C \u0645\u0639 parseMediaCmd2';

if (alreadyApplied(SONG_GUARD)) {
  ok("/song \u062A\u0645 \u0625\u0635\u0644\u0627\u062D\u0647 \u0645\u0633\u0628\u0642\u0627\u064B");
} else {
  // الأنكور: 4 أسطر فريدة بدون Unicode إشكالي
  const SONG_OLD = [
    '          const parts = rest.split(/\\s+/);',
    '          const countStr = parts[parts.length - 1];',
    '          const count = /^\\d+$/.test(countStr) ? Math.min(Math.max(parseInt(countStr), 1), 10) : 1;',
    '          const query = /^\\d+$/.test(countStr) ? parts.slice(0, -1).join(" ") : rest;',
  ].join("\n");

  const SONG_NEW = [
    '          ' + SONG_GUARD,
    '          const { count, query, hashtags } = parseMediaCmd2(rest);',
  ].join("\n");

  patch(SONG_OLD, SONG_NEW, "\u0625\u0635\u0644\u0627\u062D /song \u0648\u0627\u062A\u0633\u0622\u0628: \u0627\u0633\u062A\u062E\u062F\u0627\u0645 parseMediaCmd2");
}

// ══════════════════════════════════════════════════════════════════
// PATCH 3: إصلاح رسالة usage لـ /song في واتساب (تناسب الصيغة الجديدة)
// ══════════════════════════════════════════════════════════════════
// البحث الحرفي: يحتوي فقط على ASCII/Latin chars + unicode escapes للعربي
const SONG_USAGE_OLD = '              await activeSock.sendMessage(jid, { text: `\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: ${myS.songCmd} \\u0641\\u064A\\u0631\\u0648\\u0632 2` });';
const SONG_USAGE_NEW = '              await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644:\\n" + myS.songCmd + " 3 \\u0641\\u064A\\u0631\\u0648\\u0632\\n  \\u2191\\u0639\\u062F\\u062F \\u2191\\u0628\\u062D\\u062B" });';
patch(SONG_USAGE_OLD, SONG_USAGE_NEW, "\u062A\u062D\u062F\u064A\u062B usage message \u0644\u0640 /song \u0641\u064A \u0648\u0627\u062A\u0633\u0622\u0628");

// ══════════════════════════════════════════════════════════════════
// PATCH 4: تحسين رسالة حالة /song في واتساب
// ══════════════════════════════════════════════════════════════════
const SONG_STATUS_OLD = '              await activeSock.sendMessage(jid, { text: `\\u{1F50D} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 "${query}" \\u0648\\u0623\\u0646\\u0632\\u0651\\u0644 ${count} \\u0623\\u063A\\u0646\\u064A\\u0629...` });';
const SONG_STATUS_NEW = '              await activeSock.sendMessage(jid, { text: "\\u{1F50D} \\u0623\\u0628\\u062D\\u062B \\u0639\\u0646 \\"" + query + "\\" \\u00D7" + count + " \\u0623\\u063A\\u0646\\u064A\\u0629..." });';
patch(SONG_STATUS_OLD, SONG_STATUS_NEW, "\u062A\u062D\u062F\u064A\u062B \u0631\u0633\u0627\u0644\u0629 \u062D\u0627\u0644\u0629 /song");

// ══════════════════════════════════════════════════════════════════
// حفظ الملف
// ══════════════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "\u2705 \u062A\u0645 \u062D\u0641\u0638 " + patches + " \u062A\u0639\u062F\u064A\u0644 \u0639\u0644\u0649 dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "\u26A0\uFE0F  \u0644\u0645 \u064A\u064F\u0637\u0628\u064E\u0651\u0642 \u0623\u064A \u062A\u0639\u062F\u064A\u0644 (\u0631\u0628\u0645\u0627 \u0645\u0637\u0628\u064E\u0651\u0642 \u0645\u0646 \u0642\u0628\u0644)" + N + "\n");
}
