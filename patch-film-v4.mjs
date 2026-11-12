#!/usr/bin/env node
// patch-film-v4.mjs — تنزيل ذكي للأفلام: جودات 1/2/3، ضغط تلقائي، بدون استهلاك RAM
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist", "index.mjs");
const G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const inf = m => console.log(C + "ℹ️  " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);

let code = readFileSync(DIST, "utf8");

const GUARD = "// PATCH_FILM_V4_APPLIED";
if (code.includes(GUARD)) { inf("مطبّق سابقاً"); process.exit(0); }

let applied = 0;

// ── 1. أضف downloadMovieSmart للـ exports ──────────────────────────
{
  const OLD = `  downloadMovieFlex: () => downloadMovieFlex,\n  searchVideos: () => searchVideos`;
  const NEW = `  downloadMovieFlex: () => downloadMovieFlex,\n  downloadMovieSmart: () => downloadMovieSmart,\n  searchVideos: () => searchVideos`;
  if (code.includes(OLD)) { code = code.replace(OLD, NEW); applied++; }
  else wrn("exports: لم تتطابق");
}

// ── 2. أضف دالة downloadMovieSmart (قبل downloadInstagram) ────────
{
  const OLD = `async function downloadInstagram(url) {`;
  if (!code.includes(OLD)) { wrn("downloadInstagram: لم تتطابق"); }
  else {
    const FUNC = `
// PATCH_FILM_V4_APPLIED
// downloadMovieSmart: تنزيل ذكي بجودة مختارة + ضغط تلقائي بدون استهلاك RAM
async function downloadMovieSmart(query, quality) {
  quality = Math.min(3, Math.max(1, parseInt(quality) || 2));

  // بحث متعدد الاستراتيجيات - لا نشترط مدة محددة (يقبل كليبات وأفلام كاملة)
  const strategies = [
    query + " full movie",
    query + " film complet",
    query + " فيلم كامل",
    query + " movie",
    query
  ];
  let bestVideo = null;
  for (const st of strategies) {
    try {
      const vids = await smartYouTubeSearch(st, 8, 0);
      if (vids.length > 0) {
        const long = vids.filter(function(v) { return v.duration >= 1200; });
        bestVideo = long[0] || vids[0] || null;
        if (bestVideo) break;
      }
    } catch(e2) {}
  }
  if (!bestVideo) throw new Error('لم أجد نتيجة لـ "' + query + '" — جرّب اسماً آخر أو بالإنجليزية');

  const YTDLP = await getYtdlp();
  const FFMPEG = await getFfmpeg();
  const tmpDir = await mkdtemp(join4(tmpdir3(), "film-v4-"));
  const outTemplate = join4(tmpDir, "film.%(ext)s");

  // صيغ الجودة
  const fmts = {
    1: ["-f", "worst[ext=mp4]/worst"],
    2: ["-f", "best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst"],
    3: ["-f", "best[height<=720][ext=mp4]/best[height<=720]/best"]
  };
  const formatArgs = fmts[quality] || fmts[2];

  const dlArgs = [
    bestVideo.url,
    ...formatArgs,
    "--merge-output-format", "mp4",
    "-o", outTemplate,
    "--no-playlist", "--no-warnings", "-q"
  ];
  if (FFMPEG) dlArgs.push("--ffmpeg-location", FFMPEG);
  const cookiesArgs = await getCookiesArgs();
  if (cookiesArgs.length) dlArgs.push(...cookiesArgs);
  dlArgs.push("--js-runtimes", "node:" + await getNodeBin());

  const dlTimeout = quality === 3 ? 1200000 : 600000;
  try {
    await execFileP(YTDLP, dlArgs, { timeout: dlTimeout });
  } catch (firstErr) {
    try {
      await execFileP(YTDLP, [...dlArgs, "--extractor-args", "youtube:player_client=mweb"], { timeout: dlTimeout });
    } catch { throw firstErr; }
  }

  // ابحث عن الملف المُنتَج
  const { stdout: fpRaw } = await execFileP("sh", ["-c", 'ls "' + tmpDir + '"/film.* 2>/dev/null | head -1']);
  const fp = fpRaw.trim();
  if (!fp) {
    rm(tmpDir, { recursive: true, force: true }).catch(function(){});
    throw new Error("فشل التنزيل — لم يُنتج ملف. الفيديو قد يكون محميًا أو غير متاح");
  }

  // فحص الحجم وضغط تلقائي إذا تجاوز الحد
  const fileStat = await stat2(fp);
  const fileMB = fileStat.size / 1024 / 1024;
  const MAX_MB = 47;
  let finalPath = fp;

  if (fileMB > MAX_MB && FFMPEG) {
    try {
      const compressedPath = join4(tmpDir, "film_c.mp4");
      // جرّب ffprobe لمعرفة المدة
      let duration = 0;
      try {
        const ffprobePath = FFMPEG.replace("ffmpeg", "ffprobe");
        const { stdout: durOut } = await execFileP(ffprobePath, [
          "-v", "quiet", "-show_entries", "format=duration",
          "-of", "default=noprint_wrappers=1:nokey=1", fp
        ], { timeout: 15000 });
        duration = parseFloat(durOut.trim()) || 0;
      } catch(ep) {}

      let ffArgs;
      if (duration > 0) {
        const targetBitrate = Math.max(150, Math.floor(((MAX_MB - 3) * 8 * 1024 * 1024 / duration - 64000) / 1000));
        ffArgs = ["-i", fp, "-c:v", "libx264", "-b:v", targetBitrate + "k",
                  "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", "-y", compressedPath];
      } else {
        ffArgs = ["-i", fp, "-c:v", "libx264", "-crf", "28",
                  "-vf", "scale=-2:360", "-c:a", "aac", "-b:a", "64k",
                  "-movflags", "+faststart", "-y", compressedPath];
      }

      await execFileP(FFMPEG, ffArgs, { timeout: 900000 });
      const cStat = await stat2(compressedPath);
      if (cStat.size > 10000) finalPath = compressedPath;
      logger.info({ originalMB: fileMB.toFixed(1), compressedMB: (cStat.size/1024/1024).toFixed(1) }, "[film-v4] compressed");
    } catch(ce) {
      logger.warn({ ce }, "[film-v4] compress failed, sending original");
    }
  }

  const buffer = await readFile2(finalPath);
  rm(tmpDir, { recursive: true, force: true }).catch(function(){});
  return { buffer, title: bestVideo.title, ext: "mp4", quality };
}

async function downloadInstagram(url) {`;
    code = code.replace(OLD, FUNC);
    applied++;
  }
}

// ── 3. واتساب: تحليل الجودة من الأمر واستخدام downloadMovieSmart ──
{
  const OLD_WA = `              const { downloadMovieFlex: dmFlex } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const filmRes = dmFlex ? await dmFlex(filmQuery) : await (async () => {
                const { downloadMovie: dmOrig } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
                return dmOrig(filmQuery);
              })();
              try { await activeSock.sendMessage(jid, { text: "🎥 " + filmRes.title + " — جاري الإرسال..." }); } catch {}
              await activeSock.sendMessage(jid, { video: filmRes.buffer, caption: "🎥 " + filmRes.title, mimetype: "video/mp4" });`;

  const NEW_WA = `              // FILM V4: تحليل الجودة من الأمر
              let _fmQ = filmQuery.trim(), _fmQv = 2;
              {
                const _fmParts = _fmQ.split(" ");
                if (_fmParts.length >= 2) {
                  const _fmLast = _fmParts[_fmParts.length - 1];
                  const _fmFirst = _fmParts[0];
                  if (_fmLast === "1" || _fmLast === "2" || _fmLast === "3") {
                    _fmQv = parseInt(_fmLast); _fmQ = _fmParts.slice(0, -1).join(" ");
                  } else if ((_fmFirst === "1" || _fmFirst === "2" || _fmFirst === "3") && _fmParts.length > 1) {
                    _fmQv = parseInt(_fmFirst); _fmQ = _fmParts.slice(1).join(" ");
                  }
                }
              }
              const _qlArr = ["", "منخفضة", "متوسطة", "عالية"];
              try { await activeSock.sendMessage(jid, { text: "⏳ أبحث عن \\"" + _fmQ + "\\" (جودة: " + _qlArr[_fmQv] + ") — قد يستغرق دقائق..." }); } catch {}
              const { downloadMovieSmart: _dmS } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const filmRes = await _dmS(_fmQ, _fmQv);
              try { await activeSock.sendMessage(jid, { text: "🎬 " + filmRes.title + " — جاري الإرسال..." }); } catch {}
              await activeSock.sendMessage(jid, { video: filmRes.buffer, caption: "🎬 " + filmRes.title + " [" + _qlArr[filmRes.quality] + "]", mimetype: "video/mp4" });`;

  if (code.includes(OLD_WA)) { code = code.replace(OLD_WA, NEW_WA); applied++; }
  else wrn("WA /film handler: لم تتطابق");
}

// ── 4. تيليجرام: تحليل الجودة واستخدام downloadMovieSmart ────────
{
  const OLD_TG = `      var _fDl=(await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).downloadMovie;
      var _fR=await _fDl(_fQ);
      await bot2.sendVideo(chatId,_fR.buffer,{caption:"\u{1F3A5} "+_fR.title});`;

  const NEW_TG = `      // FILM V4: تحليل الجودة
      var _fmQtg = _fQ.trim(), _fmQvtg = 2;
      {
        var _fmPtg = _fmQtg.split(" ");
        if (_fmPtg.length >= 2) {
          var _fmLtg = _fmPtg[_fmPtg.length - 1], _fmFtg = _fmPtg[0];
          if (_fmLtg === "1" || _fmLtg === "2" || _fmLtg === "3") { _fmQvtg = parseInt(_fmLtg); _fmQtg = _fmPtg.slice(0, -1).join(" "); }
          else if ((_fmFtg === "1" || _fmFtg === "2" || _fmFtg === "3") && _fmPtg.length > 1) { _fmQvtg = parseInt(_fmFtg); _fmQtg = _fmPtg.slice(1).join(" "); }
        }
      }
      var _fmSfn = (await Promise.resolve().then(function(){return(init_search_utils(),search_utils_exports);})).downloadMovieSmart;
      var _fR = await _fmSfn(_fmQtg, _fmQvtg);
      var _fmQlArr2 = ["", "منخفضة", "متوسطة", "عالية"];
      await bot2.sendVideo(chatId, _fR.buffer, {caption: "🎬 " + _fR.title + " [" + _fmQlArr2[_fR.quality] + "]"});`;

  if (code.includes(OLD_TG)) { code = code.replace(OLD_TG, NEW_TG); applied++; }
  else wrn("TG /film handler: لم تتطابق");
}

writeFileSync(DIST, code, "utf8");
if (applied > 0) ok("تطبيق " + applied + " تعديل: downloadMovieSmart + جودات 1/2/3 + ضغط تلقائي");
else console.log("ℹ️  لم يُطبَّق أي تعديل");
