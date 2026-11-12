#!/usr/bin/env node
/**
 * test-media.mjs — اختبار تنزيل اليوتيوب والتيك توك
 * استخدام: node test-media.mjs
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const YTDLP = join(__dirname, "bin", "yt-dlp");
const FFMPEG = process.env.FFMPEG_PATH ||
  "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg";
const NODE_BIN = process.execPath;

const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", B = "\x1b[34m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => console.log(R + "❌ " + m + N);
const info = m => console.log(B + "ℹ️  " + m + N);

console.log("\n" + B + "══════════════════════════════════════════════" + N);
console.log(B + "   اختبار تنزيل الوسائط — يوتيوب و تيك توك" + N);
console.log(B + "══════════════════════════════════════════════" + N + "\n");

// ── مساعدة تشغيل yt-dlp ────────────────────────────────────────
function baseArgs(url, extra = []) {
  return [url, ...extra,
    "--js-runtimes", `node:${NODE_BIN}`,
    "--ffmpeg-location", FFMPEG,
    "--no-playlist", "--no-warnings", "-q"];
}

// ── 1. فحص الأدوات ────────────────────────────────────────────
info("فحص yt-dlp...");
try {
  const { stdout } = await execFileP(YTDLP, ["--version"], { timeout: 10000 });
  ok("yt-dlp: " + stdout.trim());
} catch (e) { fail("yt-dlp لا يعمل: " + e.message); process.exit(1); }

info("فحص ffmpeg...");
try {
  const { stdout } = await execFileP(FFMPEG, ["-version"], { timeout: 5000 });
  ok("ffmpeg: " + stdout.split("\n")[0]);
} catch { wrn("ffmpeg غير متاح — جرب: " + FFMPEG); }

// ── 2. بحث يوتيوب ─────────────────────────────────────────────
async function ytSearch(query, count = 5) {
  const { stdout } = await execFileP(YTDLP, [
    `ytsearch${count + 3}:${query}`,
    "--print", "%(webpage_url)s\t%(duration)s\t%(title)s",
    "--flat-playlist", "--no-warnings",
    "--js-runtimes", `node:${NODE_BIN}`
  ], { timeout: 30000 });
  return stdout.trim().split("\n").filter(Boolean).map(line => {
    const p = line.split("\t");
    return { url: p[0]?.trim(), dur: parseInt(p[1] || "0"), title: (p[2] || "").trim() };
  }).filter(v => v.url?.startsWith("http") && v.dur >= 10 && v.dur <= 600).slice(0, count);
}

// ── 3. تنزيل يوتيوب فيديو ─────────────────────────────────────
console.log("\n" + B + "── اختبار يوتيوب فيديو ──" + N);
let ytVideoOk = false;
try {
  info("بحث عن فيديوهات يوتيوب (1-5 دقائق)...");
  const videos = await ytSearch("funny animals compilation short", 5);
  if (!videos.length) { fail("لم يُجد فيديوهات"); }
  else {
    ok(`وُجدت ${videos.length} فيديو — أول: "${videos[0].title}" (${videos[0].dur}ث)`);
    for (const v of videos.slice(0, 3)) {
      const tmpDir = await mkdtemp(join(tmpdir(), "ytdlp-vid-"));
      try {
        info(`جاري تنزيل "${v.title.slice(0,40)}"...`);
        await execFileP(YTDLP, baseArgs(v.url, [
          "-f", "worst[ext=mp4]/worst",
          "--max-filesize", "28m",
          "-o", join(tmpDir, "out.%(ext)s")
        ]), { timeout: 90000 });
        const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
        const fp = stdout.trim();
        if (!fp) throw new Error("لا يوجد ملف");
        const s = await stat(fp);
        const mb = (s.size / 1024 / 1024).toFixed(1);
        if (s.size < 1000) throw new Error("ملف فارغ");
        ok(`يوتيوب فيديو: نجح! الحجم=${mb}MB — "${v.title.slice(0,40)}"`);
        ytVideoOk = true;
        await rm(tmpDir, { recursive: true, force: true });
        break;
      } catch (e) {
        wrn(`فيديو "${v.title.slice(0,30)}" فشل: ${e.message.split("\n")[0]}`);
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
    if (!ytVideoOk) fail("فشلت جميع محاولات الفيديو");
  }
} catch (e) { fail("اختبار يوتيوب فيديو فشل: " + e.message); }

// ── 4. تنزيل يوتيوب صوت ───────────────────────────────────────
console.log("\n" + B + "── اختبار يوتيوب صوت ──" + N);
let ytAudioOk = false;
try {
  info("بحث عن أغاني...");
  const songs = await ytSearch("فيروز أغنية", 3);
  if (!songs.length) { fail("لم يُجد أغاني"); }
  else {
    ok(`وُجدت ${songs.length} — أول: "${songs[0].title}" (${songs[0].dur}ث)`);
    const tmpDir = await mkdtemp(join(tmpdir(), "ytdlp-aud-"));
    try {
      info("جاري تنزيل الصوت...");
      await execFileP(YTDLP, baseArgs(songs[0].url, [
        "-f", "bestaudio[ext=m4a]/bestaudio/best",
        "--extract-audio", "--audio-format", "mp3",
        "--audio-quality", "5",
        "--max-filesize", "25m",
        "-o", join(tmpDir, "out.%(ext)s")
      ]), { timeout: 90000 });
      const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
      const fp = stdout.trim();
      if (!fp) throw new Error("لا يوجد ملف");
      const s = await stat(fp);
      const mb = (s.size / 1024 / 1024).toFixed(1);
      if (s.size < 1000) throw new Error("ملف فارغ");
      ok(`يوتيوب صوت: نجح! الحجم=${mb}MB`);
      ytAudioOk = true;
    } catch (e) {
      fail("يوتيوب صوت فشل: " + e.message.split("\n")[0]);
    }
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
} catch (e) { fail("اختبار يوتيوب صوت فشل: " + e.message); }

// ── 5. تيك توك (TikWM) ────────────────────────────────────────
console.log("\n" + B + "── اختبار تيك توك (TikWM API) ──" + N);
let tiktokOk = false;
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

async function tikwmSearch(q, n = 5) {
  const r = await fetch(
    `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=${n}&cursor=0&web=1&hd=1`,
    { headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" }, signal: AbortSignal.timeout(20000) }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(`API: ${j.msg}`);
  return j.data?.videos || [];
}

async function tikwmDownload(v) {
  const authorId = v.author?.unique_id || v.author?.id || "user";
  const videoId = v.id || v.video_id;
  const url = `https://www.tiktok.com/@${authorId}/video/${videoId}`;
  const r = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: `url=${encodeURIComponent(url)}&hd=1`,
    signal: AbortSignal.timeout(20000)
  });
  const j = await r.json();
  if (j.code !== 0 || !j.data?.play) throw new Error(`tikwm: ${j.msg}`);
  const toAbs = u => u?.startsWith("http") ? u : `https://www.tikwm.com${u}`;
  for (const dlUrl of [toAbs(j.data.hdplay || j.data.play), toAbs(j.data.play)].filter(Boolean)) {
    try {
      const dr = await fetch(dlUrl, {
        headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" },
        signal: AbortSignal.timeout(60000)
      });
      if (!dr.ok) continue;
      const buf = Buffer.from(await dr.arrayBuffer());
      if (buf.length < 1000 || buf.length > 30 * 1024 * 1024) continue;
      return { mb: (buf.length / 1024 / 1024).toFixed(1), title: j.data.title || "tiktok" };
    } catch { continue; }
  }
  throw new Error("كل الروابط فشلت");
}

try {
  const videos = await tikwmSearch("funny cat", 5);
  ok(`وُجدت ${videos.length} فيديو تيك توك`);
  for (const v of videos.slice(0, 3)) {
    try {
      info(`جاري تنزيل تيك توك...`);
      const r = await tikwmDownload(v);
      ok(`تيك توك: نجح! الحجم=${r.mb}MB — "${r.title.slice(0,40)}"`);
      tiktokOk = true; break;
    } catch (e) { wrn("محاولة فشلت: " + e.message); }
  }
  if (!tiktokOk) fail("فشلت كل محاولات التيك توك");
} catch (e) { fail("TikWM فشل: " + e.message); }

// ── 6. ملخص ──────────────────────────────────────────────────
console.log("\n" + B + "══════════ الملخص ══════════" + N);
console.log((ytVideoOk ? G + "✅" : R + "❌") + " يوتيوب فيديو" + N);
console.log((ytAudioOk ? G + "✅" : R + "❌") + " يوتيوب صوت" + N);
console.log((tiktokOk  ? G + "✅" : R + "❌") + " تيك توك" + N);
if (ytVideoOk && ytAudioOk && tiktokOk) {
  console.log("\n" + G + "🎉 كل الميزات تعمل بنجاح!" + N);
} else {
  console.log("\n" + Y + "⚠️  بعض الميزات تحتاج مراجعة — راجع السجل أعلاه." + N);
}
