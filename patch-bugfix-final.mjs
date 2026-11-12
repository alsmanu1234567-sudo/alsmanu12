#!/usr/bin/env node
/**
 * patch-bugfix-final.mjs
 *
 * الإصلاح 1: زر "حد لكل شخص / 8 ساعات" — لم يكن يحفظ التغيير ولا يظهر خطأ عند عدم إيجاد الرد
 * الإصلاح 2: تنزيل الفيلم — يُرسَل مباشرة من cobalt.tools لواتساب بدون تحميل على السيرفر
 *             مع دعم H.264+AAC صحيح لواتساب + فولباك على downloadMovieSmart
 *             إصلاح "/dev/shm" → يستخدم tmpdir() الصحيح
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);
const err = m => console.log(R + "❌ " + m + N);

let code = readFileSync(DIST, "utf8");

const GUARD = "// PATCH_BUGFIX_FINAL_APPLIED";
if (code.includes(GUARD)) {
  ok("مُطبَّق سابقاً — تخطّي");
  process.exit(0);
}

let applied = 0;

function patch(old, nw, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, nw);
  applied++;
  ok(desc);
  return true;
}

// ════════════════════════════════════════════════════════════════
// FIX 1: إصلاح "حد لكل شخص / 8 ساعات"
//   - إضافة persistReplies() بعد الحفظ
//   - إظهار خطأ إذا لم يُعثر على الرد بدلاً من رسالة نجاح كاذبة
// ════════════════════════════════════════════════════════════════
patch(
  `    case "awaiting_reply_per_user_limit": {
      const sPU = getState(userId);
      const limPU = parseInt(text);
      clearState(userId);
      if (isNaN(limPU) || limPU < 0) {
        await bot2.sendMessage(chatId, "\\u274C \\u0623\\u062F\\u062E\\u0644 \\u0631\\u0642\\u0645\\u064B\\u0627 \\u0635\\u062D\\u064A\\u062D\\u064B\\u0627 (0 = \\u0628\\u0644\\u0627 \\u062D\\u062F)");
        break;
      }
      const allRepliesPU = getUserReplies(userId);
      const replyPU = allRepliesPU.find((r) => r.id === sPU?.data?.limitReplyId);
      if (replyPU) {
        replyPU.perUserLimit = limPU;
        inMemoryDB.autoReplies.set(userId, allRepliesPU);
      }
      await bot2.sendMessage(chatId, \`\\u2705 \\u062A\\u0645 \\u062A\\u062D\\u062F\\u064A\\u062F \\u062D\\u062F \\u0643\\u0644 \\u0634\\u062E\\u0635: \${limPU === 0 ? "\\u0628\\u0644\\u0627 \\u062D\\u062F" : limPU + " \\u0645\\u0631\\u0629 / 8 \\u0633\\u0627\\u0639\\u0627\\u062A"}\`);
      break;
    }`,

  `    case "awaiting_reply_per_user_limit": {
      // PATCH_BUGFIX_FINAL_APPLIED
      const sPU = getState(userId);
      const limPU = parseInt(text);
      clearState(userId);
      if (isNaN(limPU) || limPU < 0) {
        await bot2.sendMessage(chatId, "\\u274C \\u0623\\u062F\\u062E\\u0644 \\u0631\\u0642\\u0645\\u064B\\u0627 \\u0635\\u062D\\u064A\\u062D\\u064B\\u0627 (0 = \\u0628\\u0644\\u0627 \\u062D\\u062F)");
        break;
      }
      const allRepliesPU = getUserReplies(userId);
      const replyPU = allRepliesPU.find((r) => r.id === sPU?.data?.limitReplyId);
      if (!replyPU) {
        await bot2.sendMessage(chatId, "\\u274C \\u0644\\u0645 \\u064A\\u064F\\u0639\\u062B\\u0631 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0631\\u062F \\u2014 \\u062C\\u0631\\u0651\\u0628 \\u0645\\u0646 \\u062C\\u062F\\u064A\\u062F");
        break;
      }
      replyPU.perUserLimit = limPU;
      inMemoryDB.autoReplies.set(userId, allRepliesPU);
      persistReplies();
      await bot2.sendMessage(chatId, \`\\u2705 \\u062A\\u0645 \\u062A\\u062D\\u062F\\u064A\\u062F \\u062D\\u062F \\u0643\\u0644 \\u0634\\u062E\\u0635: \${limPU === 0 ? "\\u0628\\u0644\\u0627 \\u062D\\u062F" : limPU + " \\u0645\\u0631\\u0629 / 8 \\u0633\\u0627\\u0639\\u0627\\u062A"}\`);
      break;
    }`,

  "Fix1: إصلاح حفظ perUserLimit + persistReplies + رسالة خطأ صحيحة"
);

// ════════════════════════════════════════════════════════════════
// FIX 2: إضافة دالة cobaltGetUrl (تُرجع URL مباشر بدون تحميل)
//         + تصدير downloadMovieURL للاستخدام في هاندلر واتساب
// ════════════════════════════════════════════════════════════════
{
  const EXPORT_OLD = `  downloadMovieFlex: () => downloadMovieFlex,
  downloadMovieSmart: () => downloadMovieSmart,
  searchVideos: () => searchVideos`;

  const EXPORT_NEW = `  downloadMovieFlex: () => downloadMovieFlex,
  downloadMovieSmart: () => downloadMovieSmart,
  downloadMovieURL: () => downloadMovieURL,
  searchVideos: () => searchVideos`;

  patch(EXPORT_OLD, EXPORT_NEW, "Fix2a: تصدير downloadMovieURL");
}

// ════════════════════════════════════════════════════════════════
// FIX 2b: إضافة دالة downloadMovieURL قبل downloadInstagram
//          — تُرجع { url, title, quality } بدون أي تحميل على السيرفر
//          — cobalt.tools أولاً، ثم yt-dlp --get-url كفولباك
// ════════════════════════════════════════════════════════════════
{
  const BEFORE_INSTAGRAM = `async function downloadInstagram(url) {`;
  if (!code.includes(BEFORE_INSTAGRAM)) {
    wrn("Fix2b: لم يُجد downloadInstagram");
  } else {
    const NEW_FN = `// PATCH_BUGFIX_FINAL_APPLIED
// downloadMovieURL: يُرجع URL مباشر للفيلم بدون تحميل للسيرفر
// cobalt.tools أولاً (بدون استهلاك RAM) ثم yt-dlp --get-url كفولباك
async function downloadMovieURL(query, quality) {
  quality = Math.min(3, Math.max(1, parseInt(quality) || 2));

  // بحث على يوتيوب
  const strategies = [
    query + " full movie", query + " \\u0641\\u064A\\u0644\\u0645 \\u0643\\u0627\\u0645\\u0644",
    query + " movie", query + " film", query
  ];
  let bestVideo = null;
  for (const st of strategies) {
    try {
      const vids = await Promise.race([
        smartYouTubeSearch(st, 8, 0),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000))
      ]);
      if (vids && vids.length > 0) {
        const long = vids.filter(v => v.duration >= 600);
        bestVideo = long[0] || vids[0] || null;
        if (bestVideo) break;
      }
    } catch(e2) {}
  }
  if (!bestVideo) throw new Error("\\u0644\\u0645 \\u0623\\u062C\\u062F \\"" + query + "\\" \\u2014 \\u062C\\u0631\\u0651\\u0628 \\u0627\\u0633\\u0645\\u064B\\u0627 \\u0622\\u062E\\u0631 \\u0623\\u0648 \\u0628\\u0627\\u0644\\u0625\\u0646\\u062C\\u0644\\u064A\\u0632\\u064A\\u0629");

  // cobalt.tools: يُرجع URL مباشر فقط
  const qlMap = { 1: "360", 2: "480", 3: "720" };
  let directUrl = null;
  try {
    const cobaltRes = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA2 },
      body: JSON.stringify({
        url: bestVideo.url,
        videoQuality: qlMap[quality] || "480",
        filenameStyle: "basic",
        downloadMode: "auto"
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (cobaltRes.ok) {
      const cj = await cobaltRes.json();
      if (cj.url && (cj.status === "tunnel" || cj.status === "redirect" || cj.url.startsWith("http"))) {
        directUrl = cj.url;
      }
    }
  } catch(ce) {
    logger.warn({ ce }, "[downloadMovieURL] cobalt failed");
  }

  // فولباك: yt-dlp --get-url
  if (!directUrl) {
    try {
      const YTDLP2 = await getYtdlp();
      const fmtMap = {
        1: "worst[ext=mp4]/worst[ext=webm]/worst",
        2: "best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst",
        3: "best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best"
      };
      const cookArgs = await getCookiesArgs();
      const { stdout: urlOut } = await execFileP(YTDLP2, [
        bestVideo.url,
        "-f", fmtMap[quality] || fmtMap[2],
        "--get-url", "--no-playlist", "--no-warnings",
        ...cookArgs
      ], { timeout: 30000 });
      const u = urlOut.trim().split("\\n")[0];
      if (u && u.startsWith("http")) directUrl = u;
    } catch(ye) {
      logger.warn({ ye }, "[downloadMovieURL] yt-dlp --get-url failed");
    }
  }

  if (!directUrl) throw new Error("\\u0644\\u0645 \\u064A\\u064F\\u062A\\u0645\\u0643\\u0651\\u0646 \\u0645\\u0646 \\u0627\\u0644\\u062D\\u0635\\u0648\\u0644 \\u0639\\u0644\\u0649 \\u0631\\u0627\\u0628\\u0637 \\u0645\\u0628\\u0627\\u0634\\u0631 \\u2014 \\u062C\\u0631\\u0651\\u0628 \\u0644\\u0627\\u062D\\u0642\\u064B\\u0627");

  logger.info({ title: bestVideo.title, quality, directUrl: directUrl.slice(0, 80) }, "[downloadMovieURL] got direct url");
  return { url: directUrl, title: bestVideo.title, quality, ext: "mp4" };
}

async function downloadInstagram(url) {`;

    code = code.replace(BEFORE_INSTAGRAM, NEW_FN);
    applied++;
    ok("Fix2b: إضافة downloadMovieURL (URL مباشر بدون تحميل)");
  }
}

// ════════════════════════════════════════════════════════════════
// FIX 2c: تحديث هاندلر واتساب للفيلم — يُرسِل { video: { url } }
//          بدلاً من تحميل البفر الكامل على السيرفر
// ════════════════════════════════════════════════════════════════
{
  const OLD_WA = `              await _fPrgSend("🎬 *" + _fmQ + "* [جودة " + _qlArr[_fmQv] + "]\\n🔍 جاري البحث...");
              const { downloadMovieSmart: _dmS } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const filmRes = await _dmS(_fmQ, _fmQv, _fPrgSend);
              await _fPrgSend("✅ " + filmRes.title.slice(0,50) + "\\n📤 جاري الإرسال...");
              await activeSock.sendMessage(jid, { video: filmRes.buffer, caption: "🎬 " + filmRes.title.slice(0,60) + " [" + _qlArr[filmRes.quality] + "]", mimetype: "video/mp4" });
              // احذف رسالة التقدم بعد الإرسال
              if (_fPrgKey) try { await activeSock.sendMessage(jid, { delete: _fPrgKey }); } catch {}`;

  const NEW_WA = `              await _fPrgSend("🎬 *" + _fmQ + "* [جودة " + _qlArr[_fmQv] + "]\\n🔍 جاري البحث...");
              // PATCH_BUGFIX_FINAL: إرسال مباشر بدون تحميل على السيرفر
              const { downloadMovieURL: _dmURL, downloadMovieSmart: _dmS } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              let _filmSent = false;
              // المحاولة الأولى: URL مباشر (بدون تحميل)
              if (_dmURL) {
                try {
                  const _urlRes = await _dmURL(_fmQ, _fmQv);
                  await _fPrgSend("📡 " + _urlRes.title.slice(0,50) + "\\n📤 جاري الإرسال المباشر...");
                  await activeSock.sendMessage(jid, {
                    video: { url: _urlRes.url },
                    caption: "🎬 " + _urlRes.title.slice(0,60) + " [" + _qlArr[_urlRes.quality] + "]",
                    mimetype: "video/mp4",
                    gifPlayback: false
                  });
                  _filmSent = true;
                } catch(urlErr) {
                  logger.warn({ urlErr }, "[/film] direct url failed, fallback to smart download");
                  await _fPrgSend("🔄 جاري التحويل للصيغة الصحيحة...");
                }
              }
              // الفولباك: تنزيل وتحويل H.264+AAC (للواتساب)
              if (!_filmSent) {
                const filmRes = await _dmS(_fmQ, _fmQv, _fPrgSend);
                await _fPrgSend("✅ " + filmRes.title.slice(0,50) + "\\n📤 جاري الإرسال...");
                await activeSock.sendMessage(jid, { video: filmRes.buffer, caption: "🎬 " + filmRes.title.slice(0,60) + " [" + _qlArr[filmRes.quality] + "]", mimetype: "video/mp4" });
              }
              // احذف رسالة التقدم بعد الإرسال
              if (_fPrgKey) try { await activeSock.sendMessage(jid, { delete: _fPrgKey }); } catch {}`;

  patch(OLD_WA, NEW_WA, "Fix2c: هاندلر واتساب — URL مباشر أولاً بدون تحميل");
}

// ════════════════════════════════════════════════════════════════
// FIX 3: إصلاح /dev/shm في downloadMovieSmart
//         (بعض الاستضافات لا تدعمه) → استخدم tmpdir() كفولباك
// ════════════════════════════════════════════════════════════════
patch(
  `const tmpDir = await mkdtemp("/dev/shm/film-"); /* PATCH_V3: RAM-based tmp, no disk */`,
  `// PATCH_BUGFIX_FINAL: /dev/shm قد لا يكون متاحاً — استخدم tmpdir() كبديل
  let tmpDir;
  try {
    tmpDir = await mkdtemp("/dev/shm/film-v5-");
  } catch(_shmErr) {
    tmpDir = await mkdtemp(join4(tmpdir3(), "film-v5-"));
  }`,
  "Fix3: إصلاح /dev/shm → استخدام tmpdir() كفولباك"
);

// ════════════════════════════════════════════════════════════════
// حفظ
// ════════════════════════════════════════════════════════════════
if (applied > 0) {
  writeFileSync(DIST, code, "utf8");
  console.log("\n" + G + "✅ تم تطبيق " + applied + " إصلاح على dist/index.mjs" + N + "\n");
} else {
  console.log("\n" + Y + "⚠️  لم يُطبَّق أي إصلاح" + N + "\n");
}
