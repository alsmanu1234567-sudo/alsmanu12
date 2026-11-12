#!/usr/bin/env node
/**
 * patch-video-fix.mjs — إصلاح تنزيل الفيديو/الأغنية/الفيلم v1
 *
 * المشاكل التي يحلّها:
 *  1. loader.to timeout = 12 ثانية (يحتاج ≥60ث) → يُرفع إلى 65 ثانية
 *  2. MAX_RAM_MB=250 أقل من استهلاك البوت الفعلي → يُرفع إلى 600
 *  3. yt-dlp محجوب من YouTube → إضافة cobalt.tools كـ primary قبل loader.to
 *  4. downloadMovieFlex غير موجود → تُضاف دالة تستخدم cobalt.tools أيضاً
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);

if (!fs.existsSync(FILE)) { console.error(R + "❌ dist/index.mjs غير موجود" + N); process.exit(1); }

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
const GUARD = "// PATCH_VIDEO_FIX_v1_APPLIED";
if (alreadyApplied(GUARD)) {
  ok("إصلاح الفيديو مطبّق مسبقاً — تخطي");
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// FIX 1: رفع timeout لـ loader.to من 12s إلى 65s (لكلا النداءين)
// ═══════════════════════════════════════════════════════════════════
patch(
  "await loaderToDownload(v.url, loaderFmt, 12e3)",
  "await loaderToDownload(v.url, loaderFmt, 65e3)",
  "رفع loader.to timeout للفيديو من 12s إلى 65s"
);

patch(
  'await loaderToDownload(v.url, "mp3", 12e3)',
  'await loaderToDownload(v.url, "mp3", 65e3)',
  "رفع loader.to timeout للصوت من 12s إلى 65s"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 2: رفع حد الذاكرة الافتراضي من 250MB إلى 600MB
// ═══════════════════════════════════════════════════════════════════
patch(
  'const maxRam = parseInt(process.env.MAX_RAM_MB || "250");',
  'const maxRam = parseInt(process.env.MAX_RAM_MB || "600");',
  "رفع MAX_RAM_MB الافتراضي من 250 إلى 600"
);

// ═══════════════════════════════════════════════════════════════════
// FIX 3: إضافة cobalt.tools كـ primary downloader قبل loader.to
//         (يتجاوز bot detection الخاص بـ YouTube)
// ═══════════════════════════════════════════════════════════════════
const COBALT_FN = `
// PATCH_VIDEO_FIX_v1_APPLIED
async function cobaltDownload(ytUrl, audioOnly, quality) {
  // cobalt.tools API — free, no bot detection
  const apiUrl = "https://api.cobalt.tools/";
  const body = JSON.stringify({
    url: ytUrl,
    videoQuality: audioOnly ? undefined : (quality === 1 ? "360" : quality === 2 ? "480" : "720"),
    filenameStyle: "basic",
    ...(audioOnly ? { audioOnly: true, audioBitrate: "128" } : {})
  });
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA2 },
    body,
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error("cobalt HTTP " + res.status);
  const json = await res.json();
  if (json.status === "error" || json.error) throw new Error("cobalt: " + (json.error?.code || json.error || "unknown"));
  const dlUrl = json.url;
  if (!dlUrl) throw new Error("cobalt: no url in response");
  const dlRes = await fetch(dlUrl, {
    headers: { "User-Agent": UA2, "Referer": "https://cobalt.tools/" },
    signal: AbortSignal.timeout(12e4)
  });
  if (!dlRes.ok) throw new Error("cobalt dl HTTP " + dlRes.status);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  if (buf.length < 5e3) throw new Error("cobalt: empty file (" + buf.length + " bytes)");
  return buf;
}
`;

// أضف دالة cobaltDownload بعد دالة loaderToDownload
const LOADER_END = "  throw new Error(\"loader.to: timeout\");\n}";
if (!alreadyApplied(GUARD) && code.includes(LOADER_END)) {
  code = code.replace(LOADER_END, LOADER_END + "\n" + COBALT_FN);
  patches++;
  ok("إضافة دالة cobaltDownload");
} else {
  wrn("لم يُجد نهاية loaderToDownload لإضافة cobaltDownload");
}

// ═══════════════════════════════════════════════════════════════════
// FIX 4: إضافة cobaltDownload كـ primary قبل loader.to في /vid
// ═══════════════════════════════════════════════════════════════════
const VID_BEFORE = `    // الأولوية: loader.to (يتجاوز حجب يوتيوب)
    try {
      const buffer = await loaderToDownload(v.url, loaderFmt, 65e3);
      results.push({ buffer, title: v.title, ext: "mp4" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/vid] loader.to failed, fallback yt-dlp");
    }`;

const VID_AFTER = `    // الأولوية 1: cobalt.tools (أسرع، يتجاوز bot detection)
    try {
      const buffer = await cobaltDownload(v.url, false, quality);
      results.push({ buffer, title: v.title, ext: "mp4" });
      continue;
    } catch (cobaltErr) {
      logger.warn({ err: cobaltErr, title: v.title }, "[/vid] cobalt failed, trying loader.to");
    }
    // الأولوية 2: loader.to
    try {
      const buffer = await loaderToDownload(v.url, loaderFmt, 65e3);
      results.push({ buffer, title: v.title, ext: "mp4" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/vid] loader.to failed, fallback yt-dlp");
    }`;

patch(VID_BEFORE, VID_AFTER, "إضافة cobalt.tools كأولوية أولى لـ /vid");

// ═══════════════════════════════════════════════════════════════════
// FIX 5: إضافة cobaltDownload كـ primary قبل loader.to في /song
// ═══════════════════════════════════════════════════════════════════
const SONG_BEFORE = `    // الأولوية: loader.to mp3
    try {
      const buffer = await loaderToDownload(v.url, "mp3", 65e3);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/song] loader.to failed, fallback yt-dlp");
    }`;

const SONG_AFTER = `    // الأولوية 1: cobalt.tools audio
    try {
      const buffer = await cobaltDownload(v.url, true, 2);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (cobaltErr) {
      logger.warn({ err: cobaltErr, title: v.title }, "[/song] cobalt failed, trying loader.to");
    }
    // الأولوية 2: loader.to mp3
    try {
      const buffer = await loaderToDownload(v.url, "mp3", 65e3);
      results.push({ buffer, title: v.title, ext: "mp3" });
      continue;
    } catch (loaderErr) {
      logger.warn({ err: loaderErr, title: v.title }, "[/song] loader.to failed, fallback yt-dlp");
    }`;

patch(SONG_BEFORE, SONG_AFTER, "إضافة cobalt.tools كأولوية أولى لـ /song");

// ═══════════════════════════════════════════════════════════════════
// FIX 6: إضافة downloadMovieFlex للـ exports (يستخدم cobalt.tools)
// ═══════════════════════════════════════════════════════════════════
const EXPORT_OLD = "  searchVideos: () => searchVideos\n});";
const EXPORT_NEW = `  downloadMovieFlex: () => downloadMovieFlex,
  searchVideos: () => searchVideos
});`;
patch(EXPORT_OLD, EXPORT_NEW, "إضافة downloadMovieFlex للـ exports");

// إضافة دالة downloadMovieFlex بعد downloadMovie
const MOVIE_END = `  throw new Error(\`\u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u0644\u0645 "\${query}" \u2014 \u0627\u0644\u0645\u0644\u0641 \u0623\u0643\u0628\u0631 \u0645\u0646 \u062D\u062F \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 (250MB)\`);
}`;
const MOVIE_FLEX_FN = `
async function downloadMovieFlex(query) {
  // أولاً: ابحث عن الفيلم على يوتيوب وجرّب cobalt.tools
  const searchStrategies = [
    \`\${query} full movie\`, \`\${query} \u0641\u064A\u0644\u0645 \u0643\u0627\u0645\u0644\`, \`\${query} movie\`, query
  ];
  let bestVideo = null;
  for (const strategy of searchStrategies) {
    try {
      const videos = await ytdlpSearch(strategy, 5, 10800); // max 3 hours
      const long = videos.filter(v => v.duration >= 1800); // at least 30min
      bestVideo = long[0] || videos[0] || null;
      if (bestVideo) break;
    } catch {}
  }
  if (!bestVideo) throw new Error(\`\u0644\u0645 \u0623\u062C\u062F \u0641\u064A\u0644\u0645 "\${query}" \u0639\u0644\u0649 \u064A\u0648\u062A\u064A\u0648\u0628\`);
  logger.info({ title: bestVideo.title, query }, "[/film flex] found, trying cobalt");
  // جرب cobalt.tools أولاً
  try {
    const buffer = await cobaltDownload(bestVideo.url, false, 1); // 360p
    return { buffer, title: bestVideo.title, ext: "mp4" };
  } catch (cobaltErr) {
    logger.warn({ cobaltErr }, "[/film flex] cobalt failed, trying yt-dlp");
  }
  // fallback: yt-dlp أدنى جودة
  const buffer = await ytdlpDownload(bestVideo.url, ["-f", "worst[ext=mp4]/worst", "--max-filesize", "40m", "--recode-video", "mp4"], "film-flex", 6e5, 40);
  return { buffer, title: bestVideo.title, ext: "mp4" };
}
`;
if (code.includes(MOVIE_END)) {
  code = code.replace(MOVIE_END, MOVIE_END + MOVIE_FLEX_FN);
  patches++;
  ok("إضافة دالة downloadMovieFlex");
} else {
  wrn("لم يُجد نهاية downloadMovie لإضافة downloadMovieFlex");
}

// ═══════════════════════════════════════════════════════════════════
// حفظ
// ═══════════════════════════════════════════════════════════════════
if (patches > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log("\n" + G + "✅ تم حفظ " + patches + " إصلاح على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي إصلاح" + N + "\n");
}
