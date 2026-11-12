#!/usr/bin/env node
/**
 * test-download-all.mjs — اختبار شامل لكل أنواع التنزيل
 *
 * استخدام:
 *   node test-download-all.mjs [vid|song|film|tiktok|all] [بحث]
 *
 * أمثلة:
 *   node test-download-all.mjs all
 *   node test-download-all.mjs vid 3 1 قطة كيوت
 *   node test-download-all.mjs song 2 فيروز
 *   node test-download-all.mjs film inception
 *   node test-download-all.mjs tiktok 2 تحشيش عراقي
 */
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readFile, readdir, stat } from "fs/promises";
import { tmpdir } from "os";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ألوان ─────────────────────────────────────────────────────────
const G="\x1b[32m",Y="\x1b[33m",R="\x1b[31m",B="\x1b[34m",C="\x1b[36m",M="\x1b[35m",N="\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => console.log(R + "❌ " + m + N);
const info = m => console.log(B + "ℹ️  " + m + N);
const head = m => console.log(C + "\n" + "═".repeat(50) + "\n  " + m + "\n" + "═".repeat(50) + N);
const sub  = m => console.log(M + "  ► " + m + N);

// ── معالجة المعاملات ──────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const MODE = rawArgs[0] || "all"; // vid | song | film | tiktok | all
const extraArgs = rawArgs.slice(1);

// ── مجلد الإخراج ──────────────────────────────────────────────────
const OUT_DIR = join(__dirname, "test_out");
await mkdir(OUT_DIR, { recursive: true });

// ── ثوابت ─────────────────────────────────────────────────────────
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const YTDLP_BIN = join(__dirname, "bin", "yt-dlp");
const FFMPEG_CANDIDATES = [
  "/usr/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg",
];

// ── كشف المسارات ──────────────────────────────────────────────────
async function resolveYtdlp() {
  if (existsSync(YTDLP_BIN)) return YTDLP_BIN;
  try { const { stdout } = await execFileP("which", ["yt-dlp"]); return stdout.trim(); } catch {}
  return "yt-dlp";
}
async function resolveFfmpeg() {
  for (const p of FFMPEG_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  try { await execFileP("ffmpeg", ["-version"], { timeout: 3000 }); return "ffmpeg"; } catch {}
  return "";
}

const YTDLP = await resolveYtdlp();
const FFMPEG = await resolveFfmpeg();
info("yt-dlp: " + YTDLP);
info("ffmpeg: " + (FFMPEG || "غير متوفر"));
info("Node:   " + process.version);
info("مجلد الإخراج: " + OUT_DIR);

// ── نتائج الاختبارات ──────────────────────────────────────────────
const results = [];
function addResult(type, query, status, sizeMB, source, note = "") {
  results.push({ type, query, status, sizeMB, source, note });
}

// ══════════════════════════════════════════════════════════════════
// أدوات التنزيل
// ══════════════════════════════════════════════════════════════════

// loader.to
async function loaderTo(ytUrl, format, timeoutMs = 120000) {
  sub("[loader.to] بدء: " + format + " ← " + ytUrl.slice(0,60));
  const startRes = await fetch(
    "https://loader.to/ajax/download.php?url=" + encodeURIComponent(ytUrl) + "&format=" + format + "&lang=en",
    { headers: { "User-Agent": UA, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(30000) }
  );
  if (!startRes.ok) throw new Error("loader.to HTTP " + startRes.status);
  const json = await startRes.json();
  if (!json.success || !json.id) throw new Error("loader.to: no id");
  const id = json.id;
  const deadline = Date.now() + Math.min(timeoutMs, 90000);
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3500));
    const pRes = await fetch("https://loader.to/ajax/progress.php?id=" + id, {
      headers: { "User-Agent": UA, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(10000)
    });
    const p = await pRes.json();
    if (p.download_url?.startsWith("http")) {
      const dlRes = await fetch(p.download_url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
      if (!dlRes.ok) throw new Error("loader.to dl HTTP " + dlRes.status);
      const buf = Buffer.from(await dlRes.arrayBuffer());
      if (buf.length < 5000) throw new Error("loader.to: ملف فارغ");
      return buf;
    }
    if (p.progress >= 100 && !p.download_url) throw new Error("loader.to: اكتمل بدون رابط");
  }
  throw new Error("loader.to: انتهت المهلة");
}

// yt-dlp search
async function ytSearch(query, count = 5, maxSec = 0) {
  const nodeExec = process.execPath;
  const { stdout } = await execFileP(YTDLP, [
    `ytsearch${count + 5}:${query}`,
    "--print", "%(webpage_url)s    %(duration)s    %(title)s",
    "--flat-playlist", "--no-warnings",
    "--js-runtimes", `node:${nodeExec}`,
  ], { timeout: 40000 });
  return stdout.trim().split("\n").filter(Boolean).map(line => {
    const parts = line.split("  ");
    return { url: (parts[0]||"").trim(), duration: parseInt((parts[1]||"0").trim())||0, title: parts.slice(2).join("      ").trim()||"video" };
  }).filter(v => v.url.startsWith("http") && (maxSec === 0 || !v.duration || v.duration <= maxSec)).slice(0, count);
}

// yt-dlp download
async function ytDownload(ytUrl, formatArgs, label, timeoutMs = 180000, maxMB = 40) {
  const tmpDir = await mkdtemp(join(tmpdir(), `test-${label}-`));
  try {
    const args = [ytUrl, ...formatArgs, "-o", join(tmpDir, "out.%(ext)s"), "--no-playlist", "--no-warnings", "-q"];
    if (FFMPEG) args.push("--ffmpeg-location", FFMPEG);
    args.push("--js-runtimes", `node:${process.execPath}`);
    try {
      await execFileP(YTDLP, args, { timeout: timeoutMs });
    } catch (e1) {
      const args2 = [...args, "--extractor-args", "youtube:player_client=mweb"];
      await execFileP(YTDLP, args2, { timeout: timeoutMs });
    }
    const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
    const fp = stdout.trim();
    if (!fp) throw new Error("ملف الإخراج مفقود");
    const fileStat = await stat(fp);
    const fileMB = fileStat.size / 1024 / 1024;
    if (fileMB > maxMB + 5) throw new Error(`الملف كبير جداً: ${fileMB.toFixed(1)}MB`);
    return await readFile(fp);
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// tikwm search+download
async function tikwmSearch(q, n = 10) {
  const res = await fetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=${n}&cursor=0&web=1&hd=1`, {
    headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" }, signal: AbortSignal.timeout(20000)
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error("tikwm: " + json.msg);
  return json.data?.videos || [];
}
async function tikwmDownload(video) {
  const authorId = video.author?.unique_id || video.author?.id || "user";
  const videoId = video.id || video.video_id;
  const tiktokUrl = `https://www.tiktok.com/@${authorId}/video/${videoId}`;
  const res = await fetch("https://www.tikwm.com/api/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: `url=${encodeURIComponent(tiktokUrl)}&hd=1`, signal: AbortSignal.timeout(20000)
  });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.play) throw new Error("tikwm api: " + json.msg);
  const toAbs = u => u?.startsWith("http") ? u : `https://www.tikwm.com${u}`;
  for (const dlUrl of [toAbs(json.data.hdplay || json.data.play), toAbs(json.data.play)]) {
    try {
      const dlRes = await fetch(dlUrl, { headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" }, signal: AbortSignal.timeout(60000) });
      if (!dlRes.ok) continue;
      const buf = Buffer.from(await dlRes.arrayBuffer());
      if (buf.length < 1000 || buf.length > 30*1024*1024) continue;
      return { buffer: buf, title: json.data.title || "tiktok" };
    } catch { continue; }
  }
  throw new Error("كل روابط tikwm فشلت");
}

// ══════════════════════════════════════════════════════════════════
// اختبار /vid
// ══════════════════════════════════════════════════════════════════
async function testVid() {
  head("🎬 اختبار /vid — تنزيل فيديو يوتيوب");
  const quality = parseInt(extraArgs[0]) || 2;  // 1=360p, 2=480p, 3=720p
  const count = parseInt(extraArgs[1]) || 1;
  const query = extraArgs.slice(2).join(" ") || "قطة كيوت";
  const fmtMap = { 1: { fmt: "360", args: ["-f","worst[ext=mp4]/worst","--recode-video","mp4"], maxMB: 20 },
                   2: { fmt: "480", args: ["-f","bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]","--merge-output-format","mp4"], maxMB: 30 },
                   3: { fmt: "720", args: ["-f","bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]","--merge-output-format","mp4"], maxMB: 40 } };
  const { fmt, args: fmtArgs, maxMB } = fmtMap[quality] || fmtMap[2];

  info(`بحث: "${query}" | جودة: ${quality}(${fmt}p) | عدد: ${count}`);

  let videos = [];
  try { videos = await ytSearch(query, count + 3); info(`وُجد ${videos.length} فيديو`); }
  catch (e) { fail("فشل البحث: " + e.message); return; }

  let successCount = 0;
  for (let i = 0; i < Math.min(videos.length, count + 2) && successCount < count; i++) {
    const v = videos[i];
    sub(`\n[${i+1}] "${v.title.slice(0,50)}" — ${v.duration}s`);
    // محاولة 1: loader.to
    try {
      info("  [loader.to] جاري...");
      const buf = await loaderTo(v.url, fmt, 120000);
      const mb = (buf.length/1024/1024).toFixed(1);
      ok(`  loader.to نجح! ${mb}MB`);
      await writeFile(join(OUT_DIR, `vid-${successCount+1}-loaderTo.mp4`), buf);
      addResult("vid", query, "نجح", parseFloat(mb), "loader.to");
      successCount++; continue;
    } catch (e) { wrn("  loader.to فشل: " + e.message.slice(0,60)); }
    // محاولة 2: yt-dlp
    try {
      info("  [yt-dlp] جاري...");
      const buf = await ytDownload(v.url, [...fmtArgs, "--max-filesize", maxMB+"m", "--postprocessor-args", "ffmpeg:-movflags +faststart"], "vid", 180000, maxMB);
      const mb = (buf.length/1024/1024).toFixed(1);
      ok(`  yt-dlp نجح! ${mb}MB`);
      await writeFile(join(OUT_DIR, `vid-${successCount+1}-ytdlp.mp4`), buf);
      addResult("vid", query, "نجح", parseFloat(mb), "yt-dlp");
      successCount++;
    } catch (e) {
      // محاولة 3: جودة أقل
      try {
        info("  [yt-dlp fallback] جاري...");
        const buf = await ytDownload(v.url, ["-f","worst[ext=mp4]/worst","--max-filesize","18m","--recode-video","mp4"], "vid-fb", 120000, 18);
        const mb = (buf.length/1024/1024).toFixed(1);
        ok(`  yt-dlp fallback نجح! ${mb}MB`);
        await writeFile(join(OUT_DIR, `vid-${successCount+1}-ytdlp-fb.mp4`), buf);
        addResult("vid", query, "نجح(fallback)", parseFloat(mb), "yt-dlp-fallback");
        successCount++;
      } catch (e2) {
        fail(`  فشل كل المصادر: ${e2.message.slice(0,60)}`);
        addResult("vid", query, "فشل", 0, "—", e2.message.slice(0,60));
      }
    }
  }
  if (successCount > 0) ok(`/vid: نجح ${successCount}/${count}`);
  else fail(`/vid: فشل (0/${count})`);
}

// ══════════════════════════════════════════════════════════════════
// اختبار /song
// ══════════════════════════════════════════════════════════════════
async function testSong() {
  head("🎵 اختبار /song — تنزيل أغنية MP3");
  const count = parseInt(extraArgs[0]) || 2;
  const query = extraArgs.slice(1).join(" ") || "فيروز";

  info(`بحث: "${query}" | عدد: ${count}`);

  let videos = [];
  try {
    videos = await ytSearch(query + " music", count + 5);
    if (!videos.length) videos = await ytSearch(query, count + 3);
    info(`وُجد ${videos.length} نتيجة`);
  } catch (e) { fail("فشل البحث: " + e.message); return; }

  let successCount = 0;
  for (let i = 0; i < Math.min(videos.length, count + 3) && successCount < count; i++) {
    const v = videos[i];
    sub(`\n[${i+1}] "${v.title.slice(0,50)}"`);
    // محاولة 1: loader.to mp3
    try {
      info("  [loader.to mp3] جاري...");
      const buf = await loaderTo(v.url, "mp3", 120000);
      const mb = (buf.length/1024/1024).toFixed(1);
      ok(`  loader.to نجح! ${mb}MB`);
      await writeFile(join(OUT_DIR, `song-${successCount+1}-loaderTo.mp3`), buf);
      addResult("song", query, "نجح", parseFloat(mb), "loader.to");
      successCount++; continue;
    } catch (e) { wrn("  loader.to فشل: " + e.message.slice(0,60)); }
    // محاولة 2: yt-dlp
    try {
      info("  [yt-dlp] جاري...");
      const buf = await ytDownload(v.url, ["-f","bestaudio[ext=m4a]/bestaudio/best","--extract-audio","--audio-format","mp3","--audio-quality","5","--max-filesize","25m"], "aud", 180000, 25);
      const mb = (buf.length/1024/1024).toFixed(1);
      ok(`  yt-dlp نجح! ${mb}MB`);
      await writeFile(join(OUT_DIR, `song-${successCount+1}-ytdlp.mp3`), buf);
      addResult("song", query, "نجح", parseFloat(mb), "yt-dlp");
      successCount++;
    } catch (e) {
      fail(`  فشل: ${e.message.slice(0,60)}`);
      addResult("song", query, "فشل", 0, "—", e.message.slice(0,60));
    }
  }
  if (successCount > 0) ok(`/song: نجح ${successCount}/${count}`);
  else fail(`/song: فشل (0/${count})`);
}

// ══════════════════════════════════════════════════════════════════
// اختبار /film
// ══════════════════════════════════════════════════════════════════
async function testFilm() {
  head("🎥 اختبار /film — تنزيل فيلم");
  const query = extraArgs.join(" ") || "inception";

  info(`بحث عن فيلم: "${query}"`);

  const strategies = [
    `${query} full movie`, `${query} film complet`, `${query} فيلم كامل`, `${query} movie`, query
  ];
  let bestVideo = null;
  for (const strat of strategies) {
    try {
      const vids = await ytSearch(strat, 5, 14400);
      if (vids.length > 0) {
        const long = vids.filter(v => v.duration >= 3600);
        bestVideo = long[0] || vids[0];
        info(`وُجد: "${bestVideo.title.slice(0,60)}" — ${Math.round(bestVideo.duration/60)} دقيقة`);
        break;
      }
    } catch {}
  }
  if (!bestVideo) { fail('لم يُجد فيلم "' + query + '"'); addResult("film", query, "فشل", 0, "—", "لم يُجد"); return; }

  const qualityAttempts = [
    { args: ["-f","worst[ext=mp4]/worst","--recode-video","mp4","--max-filesize","40m"], maxMB: 40 },
    { args: ["-f","bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]/worst","--merge-output-format","mp4","--max-filesize","35m"], maxMB: 35 },
    { args: ["-f","worst","--max-filesize","30m"], maxMB: 30 },
  ];
  for (const { args, maxMB } of qualityAttempts) {
    try {
      info(`[yt-dlp] محاولة (maxMB=${maxMB})...`);
      const buf = await ytDownload(bestVideo.url, args, "film", 600000, maxMB);
      const mb = (buf.length/1024/1024).toFixed(1);
      ok(`نجح! ${mb}MB`);
      await writeFile(join(OUT_DIR, `film-out.mp4`), buf);
      addResult("film", query, "نجح", parseFloat(mb), "yt-dlp", bestVideo.title.slice(0,50));
      return;
    } catch (e) { wrn("فشل: " + e.message.slice(0,60)); }
  }
  fail(`/film: فشل جميع محاولات تنزيل "${query}"`);
  addResult("film", query, "فشل", 0, "—", "فشل جميع المحاولات");
}

// ══════════════════════════════════════════════════════════════════
// اختبار /tiktok
// ══════════════════════════════════════════════════════════════════
async function testTiktok() {
  head("📱 اختبار /tiktok — تنزيل تيك توك");
  const count = parseInt(extraArgs[0]) || 3;
  const query = extraArgs.slice(1).join(" ") || "تحشيش عراقي";

  info(`بحث: "${query}" | عدد: ${count}`);

  let videos = [];
  try {
    videos = await tikwmSearch(query, count + 5);
    info(`وُجد ${videos.length} فيديو`);
  } catch (e) { fail("فشل البحث: " + e.message); return; }

  if (!videos.length) { fail("لم يُجد أي فيديو تيك توك"); return; }

  let successCount = 0;
  for (let i = 0; i < Math.min(videos.length, count + 3) && successCount < count; i++) {
    const v = videos[i];
    const title = v.title || v.desc || "tiktok";
    sub(`\n[${i+1}] "${String(title).slice(0,50)}"`);
    try {
      const result = await tikwmDownload(v);
      const mb = (result.buffer.length/1024/1024).toFixed(1);
      ok(`نجح! ${mb}MB — "${result.title.slice(0,40)}"`);
      await writeFile(join(OUT_DIR, `tiktok-${successCount+1}.mp4`), result.buffer);
      addResult("tiktok", query, "نجح", parseFloat(mb), "tikwm.com");
      successCount++;
    } catch (e) {
      wrn("فشل: " + e.message.slice(0,60));
      addResult("tiktok", query, "فشل", 0, "—", e.message.slice(0,60));
    }
  }
  if (successCount > 0) ok(`/tiktok: نجح ${successCount}/${count}`);
  else fail(`/tiktok: فشل (0/${count})`);
}

// ══════════════════════════════════════════════════════════════════
// تنفيذ الاختبارات
// ══════════════════════════════════════════════════════════════════
console.log("\n" + G + "═".repeat(55) + N);
console.log(G + "  اختبار شامل لأوامر التنزيل" + N);
console.log(G + "═".repeat(55) + N + "\n");

const startTime = Date.now();

switch (MODE.toLowerCase()) {
  case "vid":    await testVid();    break;
  case "song":   await testSong();   break;
  case "film":   await testFilm();   break;
  case "tiktok": await testTiktok(); break;
  case "all":
  default:
    await testVid();
    await testSong();
    await testTiktok();
    // film يأخذ وقتاً طويلاً — اختياري
    if (MODE === "all-with-film") await testFilm();
    break;
}

// ── ملخص النتائج ──────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
head("📊 ملخص النتائج — " + elapsed + "s");

const passed = results.filter(r => r.status !== "فشل").length;
const total  = results.length;

console.log(`\n  ${B}النوع    | البحث                | النتيجة    | الحجم | المصدر${N}`);
console.log("  " + "─".repeat(70));
for (const r of results) {
  const icon = r.status === "فشل" ? R+"❌"+N : G+"✅"+N;
  const size = r.sizeMB ? r.sizeMB.toFixed(1) + "MB" : "—";
  console.log(`  ${icon} ${r.type.padEnd(6)} | ${r.query.slice(0,20).padEnd(20)} | ${r.status.padEnd(10)} | ${size.padEnd(6)} | ${r.source}`);
  if (r.note) console.log(`           ↳ ${Y}${r.note}${N}`);
}

console.log("\n" + "─".repeat(55));
if (passed === total && total > 0) {
  ok(`🎉 جميع الاختبارات نجحت (${passed}/${total})`);
} else if (passed > 0) {
  wrn(`نجح ${passed}/${total} اختبار`);
} else {
  fail("فشلت جميع الاختبارات!");
}
console.log(`${B}الملفات محفوظة في:${N} ${OUT_DIR}`);
console.log("═".repeat(55) + "\n");
