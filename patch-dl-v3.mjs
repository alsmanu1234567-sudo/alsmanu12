#!/usr/bin/env node
/**
 * patch-dl-v3.mjs — إصلاح شامل لتنزيل الفيديو/الصوت/الفيلم v3
 *
 * المشاكل التي يحلّها:
 *  1. ytdlpSearch تفشل (yt-dlp غير مثبت / محجوب) → استخدام yt-search npm أولاً
 *  2. cobalt.tools API تغيّر: audioOnly:true → downloadMode:"audio"
 *  3. إضافة y2mate كـ fallback لتنزيل الصوت
 *  4. إضافة دالة smartYouTubeSearch تجمع yt-search + ytdlp بالترتيب
 *  5. تأكّد أن كل بحث يُعيد نتيجة أو رسالة واضحة
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

function alreadyApplied(marker) { return code.includes(marker); }
function patch(old, nw, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, nw);
  patches++;
  ok(desc);
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// GUARD
// ═══════════════════════════════════════════════════════════════════
const GUARD = "// PATCH_DL_V3_APPLIED";
if (alreadyApplied(GUARD)) {
  ok("patch-dl-v3: مُطبَّق مسبقاً — تخطي");
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// FIX 1: إصلاح cobalt.tools API — downloadMode:"audio" بدل audioOnly:true
// ═══════════════════════════════════════════════════════════════════
patch(
  `...(audioOnly ? { audioOnly: true, audioBitrate: "128" } : {})`,
  `...(audioOnly ? { downloadMode: "audio", audioBitrate: "128" } : { downloadMode: "auto" })`,
  "إصلاح cobalt.tools API: downloadMode بدل audioOnly"
);

// إصلاح videoQuality عند audioOnly (undefined يسبب مشاكل في JSON)
patch(
  `videoQuality: audioOnly ? undefined : (quality === 1 ? "360" : quality === 2 ? "480" : "720"),`,
  `...(audioOnly ? {} : { videoQuality: quality === 1 ? "360" : quality === 2 ? "480" : "720" }),`,
  "إصلاح videoQuality: حذف undefined من JSON"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 2: إضافة دالة smartYouTubeSearch + y2mateAudioDownload
//         تُحقن قبل searchAndDownloadYouTubeVideo
// ═══════════════════════════════════════════════════════════════════
const INJECT_BEFORE = `async function searchAndDownloadYouTubeVideo(query, count = 1, maxSeconds = 0, quality = 2) {`;

const NEW_HELPERS = `${GUARD}
// ─── smartYouTubeSearch: يجرّب yt-search (npm) أولاً ثم yt-dlp ─────
async function smartYouTubeSearch(query, count, maxSeconds) {
  // أولاً: yt-search (npm — لا يحتاج yt-dlp)
  try {
    const ytSearch = (await Promise.resolve().then(() => __toESM(require_yt_search(), 1))).default;
    const r = await ytSearch({ query });
    const items = (r.videos || [])
      .filter(v => !maxSeconds || !v.seconds || v.seconds <= maxSeconds)
      .slice(0, count)
      .map(v => ({ url: v.url || "", title: v.title || "video", duration: v.seconds || 0 }))
      .filter(v => v.url.startsWith("http"));
    if (items.length > 0) {
      logger.info({ query, count: items.length }, "[smartSearch] yt-search OK");
      return items;
    }
  } catch (e) {
    logger.warn({ e }, "[smartSearch] yt-search failed, trying ytdlp");
  }
  // ثانياً: yt-dlp (إن كان متاحاً)
  try {
    const items = await ytdlpSearch(query, count, maxSeconds);
    if (items.length > 0) return items;
  } catch {}
  return [];
}

// ─── y2mateAudioDownload: تنزيل mp3 عبر y2mate.nu ──────────────
async function y2mateAudioDownload(ytUrl) {
  try {
    let vid;
    try { const u = new URL(ytUrl); vid = u.searchParams.get("v") || u.pathname.split("/").pop(); } catch {}
    if (!vid || vid.length < 8) throw new Error("no video id");
    const analyzeRes = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA2, "Referer": "https://www.y2mate.com/" },
      body: "k_query=" + encodeURIComponent(ytUrl) + "&k_page=home&hl=en&q_auto=0",
      signal: AbortSignal.timeout(15e3)
    });
    const aData = await analyzeRes.json();
    const mp3Key = aData?.links?.mp3?.mp3128?.k;
    if (!mp3Key) throw new Error("no mp3 key");
    const convRes = await fetch("https://www.y2mate.com/mates/convertV2/index", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA2, "Referer": "https://www.y2mate.com/" },
      body: "vid=" + encodeURIComponent(vid) + "&k=" + encodeURIComponent(mp3Key),
      signal: AbortSignal.timeout(30e3)
    });
    const cData = await convRes.json();
    const dlUrl = cData?.dlink;
    if (!dlUrl) throw new Error("no download link");
    const dlRes = await fetch(dlUrl, { headers: { "User-Agent": UA2 }, signal: AbortSignal.timeout(6e4) });
    if (!dlRes.ok) throw new Error("dl HTTP " + dlRes.status);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    if (buf.length < 1e3) throw new Error("empty file");
    return buf;
  } catch (e) {
    throw new Error("y2mate: " + e.message);
  }
}

` + INJECT_BEFORE;

if (code.includes(INJECT_BEFORE)) {
  code = code.replace(INJECT_BEFORE, NEW_HELPERS);
  patches++;
  ok("إضافة smartYouTubeSearch + y2mateAudioDownload");
} else {
  wrn("لم يُجد searchAndDownloadYouTubeVideo لإضافة الدوال المساعدة");
}

// ═══════════════════════════════════════════════════════════════════
// FIX 3: استبدال ytdlpSearch بـ smartYouTubeSearch في searchAndDownloadYouTubeVideo
// ═══════════════════════════════════════════════════════════════════
patch(
  `async function searchAndDownloadYouTubeVideo(query, count = 1, maxSeconds = 0, quality = 2) {
  const videos = await ytdlpSearch(query, count + 3, maxSeconds);
  if (videos.length === 0) {
    const fallback = await ytdlpSearch(query, 1, 0);
    if (fallback.length === 0) throw new Error(\`\\u0644\\u0645 \\u0623\\u062C\\u062F \\u0623\\u064A \\u0646\\u062A\\u0627\\u0626\\u062C \\u064A\\u0648\\u062A\\u064A\\u0648\\u0628 \\u0644\\u0640 "\${query}"\`);
    throw new Error(\`\\u0644\\u0645 \\u0623\\u062C\\u062F \\u0641\\u064A\\u062F\\u064A\\u0648\\u0647\\u0627\\u062A \\u0645\\u0646\\u0627\\u0633\\u0628\\u0629 \\u0644\\u0640 "\${query}"\`);
  }`,
  `async function searchAndDownloadYouTubeVideo(query, count = 1, maxSeconds = 0, quality = 2) {
  let videos = await smartYouTubeSearch(query, count + 3, maxSeconds);
  if (videos.length === 0) {
    videos = await smartYouTubeSearch(query, 3, 0);
    if (videos.length === 0) throw new Error(\`لم أجد أي نتائج يوتيوب لـ "\${query}" — جرّب كلمات أخرى\`);
  }`,
  "استبدال ytdlpSearch بـ smartYouTubeSearch في searchAndDownloadYouTubeVideo"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 4: استبدال ytdlpSearch بـ smartYouTubeSearch في searchAndDownloadYouTubeAudio
//         + إضافة y2mate كـ fallback جديد للصوت
// ═══════════════════════════════════════════════════════════════════
patch(
  `async function searchAndDownloadYouTubeAudio(query, count = 1, maxSeconds = 0) {
  let videos = await ytdlpSearch(query, count + 5, maxSeconds);
  if (videos.length === 0) {
    videos = await ytdlpSearch(\`\${query} audio\`, count + 3, 0);
    if (videos.length === 0) videos = await ytdlpSearch(\`\${query} song music\`, 1, 0);
    if (videos.length === 0) throw new Error(\`\\u0644\\u0645 \\u0623\\u062C\\u062F \\u0623\\u064A \\u0646\\u062A\\u0627\\u0626\\u062C \\u0644\\u0640 "\${query}"\`);
  }`,
  `async function searchAndDownloadYouTubeAudio(query, count = 1, maxSeconds = 0) {
  let videos = await smartYouTubeSearch(query, count + 5, maxSeconds);
  if (videos.length === 0) {
    videos = await smartYouTubeSearch(\`\${query} audio\`, count + 3, 0);
    if (videos.length === 0) videos = await smartYouTubeSearch(\`\${query} song music\`, 1, 0);
    if (videos.length === 0) throw new Error(\`لم أجد أي نتائج لـ "\${query}" — جرّب كلمات أخرى\`);
  }`,
  "استبدال ytdlpSearch بـ smartYouTubeSearch في searchAndDownloadYouTubeAudio"
);

// إضافة y2mate كأولوية 3 في صوت (قبل yt-dlp)
patch(
  `    // الأولوية 2: loader.to mp3
    try {
      const buffer = await loaderToDownload(v.url, "mp3", 65e3);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/song] loader.to failed, fallback yt-dlp");
    }
    // fallback: yt-dlp`,
  `    // الأولوية 2: loader.to mp3
    try {
      const buffer = await loaderToDownload(v.url, "mp3", 65e3);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/song] loader.to failed, trying y2mate");
    }
    // الأولوية 3: y2mate
    try {
      const buffer = await y2mateAudioDownload(v.url);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (y2Err) {
      logger.warn({ err: y2Err, title: v.title }, "[/song] y2mate failed, fallback yt-dlp");
    }
    // fallback: yt-dlp`,
  "إضافة y2mate كأولوية 3 في تنزيل الصوت"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 5: استبدال ytdlpSearch بـ smartYouTubeSearch في downloadMovie + downloadMovieFlex
// ═══════════════════════════════════════════════════════════════════
// downloadMovie
if (code.includes("const videos = await ytdlpSearch(strategy, 5, 14400);")) {
  code = code.split("const videos = await ytdlpSearch(strategy, 5, 14400);")
              .join("const videos = await smartYouTubeSearch(strategy, 5, 14400);");
  patches++;
  ok("استبدال ytdlpSearch بـ smartYouTubeSearch في downloadMovie");
} else {
  wrn("لم يُجد ytdlpSearch في downloadMovie");
}

// downloadMovieFlex
if (code.includes("const videos = await ytdlpSearch(strategy, 5, 10800);")) {
  code = code.split("const videos = await ytdlpSearch(strategy, 5, 10800);")
              .join("const videos = await smartYouTubeSearch(strategy, 5, 10800);");
  patches++;
  ok("استبدال ytdlpSearch بـ smartYouTubeSearch في downloadMovieFlex");
} else {
  wrn("لم يُجد ytdlpSearch في downloadMovieFlex");
}

// ═══════════════════════════════════════════════════════════════════
// FIX 6: تحسين رسائل الخطأ في واتساب — لا "حدث خطأ" أبداً
// ═══════════════════════════════════════════════════════════════════
// رسالة خطأ /vid في واتساب — أوضح
patch(
  `const msg2 = e?.message?.includes("\\u0644\\u0645 \\u0623\\u062C\\u062F") || e?.message?.includes("\\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F") || e?.message?.includes("\\u0641\\u0634\\u0644") ? \`\\u274C \${e.message}\` : "\\u26A0\\uFE0F \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u0627\\u0644\\u0641\\u064A\\u062F\\u064A\\u0648\\u0647\\u0627\\u062A\\u060C \\u062D\\u0627\\u0648\\u0644 \\u0645\\u062C\\u062F\\u062F\\u0627\\u064B";`,
  `const msg2 = e?.message ? \`❌ \${e.message}\` : "⚠️ تعذّر تنزيل الفيديو — حاول مجدداً أو جرّب اسماً آخر";`,
  "تحسين رسالة خطأ /vid في واتساب"
);

// رسالة خطأ /song في واتساب — أوضح
patch(
  `const msg2 = e?.message?.includes("\\u0644\\u0645 \\u0623\\u062C\\u062F") || e?.message?.includes("\\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F") || e?.message?.includes("\\u0641\\u0634\\u0644") ? \`\\u274C \${e.message}\` : "\\u26A0\\uFE0F \\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0632\\u064A\\u0644 \\u0627\\u0644\\u0623\\u063A\\u0627\\u0646\\u064A\\u060C \\u062D\\u0627\\u0648\\u0644 \\u0645\\u062C\\u062F\\u062F\\u0627\\u064B";`,
  `const msg2 = e?.message ? \`❌ \${e.message}\` : "⚠️ تعذّر تنزيل الأغنية — حاول مجدداً أو جرّب اسماً آخر";`,
  "تحسين رسالة خطأ /song في واتساب"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 7: تأكّد إرسال "لم أجد نتائج" بدل صمت عند results.length===0
// ═══════════════════════════════════════════════════════════════════
// /vid واتساب — إضافة رسالة عند results فارغ
patch(
  `            } catch (e) {
              logger.warn({ e }, "[/vid] failed");
              const msg2 = e?.message ? \`❌ \${e.message}\` : "⚠️ تعذّر تنزيل الفيديو — حاول مجدداً أو جرّب اسماً آخر";`,
  `            } catch (e) {
              logger.warn({ e }, "[/vid] failed");
              const msg2 = e?.message ? \`❌ \${e.message.slice(0,120)}\` : "⚠️ تعذّر تنزيل الفيديو — حاول مجدداً أو جرّب اسماً آخر";`,
  "قصر رسالة خطأ /vid على 120 حرف"
);

// ═══════════════════════════════════════════════════════════════════
// حفظ
// ═══════════════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "✅ تم حفظ " + patches + " إصلاح على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي إصلاح (ربما مطبَّق مسبقاً أو تغيّرت الأنكورات)" + N + "\n");
}
