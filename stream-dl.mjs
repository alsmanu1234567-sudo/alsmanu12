#!/usr/bin/env node
/**
 * stream-dl.mjs — Pure-Streaming Downloader v3.0
 *
 * المعمارية: صفر تنزيل على السيرفر — البيانات تتدفق مباشرة من CDN يوتيوب
 * إلى واتساب عبر أحد مسارين فقط:
 *
 *   المسار A (الأفضل): رابط مباشر واحد → Baileys يبثه بنفسه { url }
 *   المسار B: دمج/تحويل ffmpeg بالنسخ (بدون إعادة ترميز) → أنبوب مباشر { stream }
 *
 * لا يوجد أي مسار Buffer — لا RAM ولا ملفات مؤقتة من طرفنا.
 * (واتساب نفسه يتطلب تمريرة تشفير واحدة عابرة يديرها Baileys داخلياً)
 *
 * إصلاحات v3:
 *  • فيديو صامت في الجودة العالية (كان يُرسل رابط الفيديو بدون الصوت) — أُصلح
 *  • 720p حقيقية عبر دمج DASH بالنسخ (يوتيوب أزال الصيغة المدمجة 22)
 *  • صيغ واتساب الأصيلة: mp4 (h264+aac) للفيديو، m4a/aac للصوت
 *  • تمرير المدة والصورة المصغرة لتجنب حفظ Baileys نسخة أصلية ثانية على القرص
 */

import { spawn, execFile } from "child_process";
import { existsSync }       from "fs";
import { join, dirname }    from "path";
import { fileURLToPath }    from "url";
import { promisify }        from "util";
import https from "https";
import http  from "http";
import { PassThrough } from "stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileP = promisify(execFile);

const QUALITY_LABEL = {
  1: "منخفضة 360p",
  2: "متوسطة 720p",
  3: "عالية 1080p"
};

// ══════════════════════════════════════════════════════════════════════════════
// مساعدات مرئية (واجهة متوافقة مع الإصدارات السابقة)
// ══════════════════════════════════════════════════════════════════════════════

export function fmtBytes(b) {
  if (!b || b < 0) return "?";
  if (b < 1024 * 1024) return Math.round(b / 1024) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export function progressBar(pct, width = 14) {
  if (pct < 0) {
    const spin = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    return spin[Math.floor(Date.now() / 300) % spin.length] + " جاري البث...";
  }
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round(p / 100 * width);
  return "█".repeat(filled) + "░".repeat(width - filled) + " " + p + "%";
}

export function buildProgressMsg(title, stage, qlLabel, recv, total, pct) {
  const bar = progressBar(typeof pct === "number" ? pct : -1);
  const sep = "━".repeat(22);
  let lines = ["🎬 *" + String(title || "").slice(0, 50) + "*", sep];

  switch (stage) {
    case "search":
      lines.push("🔍 البحث على يوتيوب...", "⚡ بث مباشر — صفر تخزين");
      break;
    case "found":
      lines.push("✅ تم العثور — جودة " + qlLabel, "📡 جاري تجهيز رابط البث...", "⚡ بث مباشر — صفر تخزين");
      break;
    case "url_send":
      lines.push("📡 بث مباشر من المصدر → واتساب", "جودة " + qlLabel, "⚡ صفر تنزيل على السيرفر");
      break;
    case "merging":
      lines.push("🔗 دمج الصوت والصورة أثناء البث — " + qlLabel, bar, "💨 " + fmtBytes(recv) + " تدفّقت | صفر تخزين");
      break;
    case "streaming":
    case "piping":
      lines.push("📡 بث مباشر — " + qlLabel, bar, "💨 " + fmtBytes(recv) + " تدفّقت | صفر تخزين");
      break;
    case "progress":
      const recvStr = fmtBytes(recv);
      const totStr  = total > 0 ? " / " + fmtBytes(total) : "";
      lines.push("📡 تدفق — " + qlLabel, bar, "💨 " + recvStr + totStr + " | صفر تخزين");
      break;
    case "done":
      lines.push("✅ اكتمل البث — " + fmtBytes(recv), "📤 واتساب يعالج الوسائط...");
      break;
    default:
      lines.push(String(stage));
  }
  return lines.join("\n");
}

// ══════════════════════════════════════════════════════════════════════════════
// مسارات الأدوات (yt-dlp + ffmpeg)
// ══════════════════════════════════════════════════════════════════════════════

async function ytdlpBin() {
  // كل الأسماء المحتملة محلياً (yt-dlp الثنائي أو yt-dlp-py الـ zipapp)
  for (const name of ["yt-dlp", "yt-dlp-py"]) {
    const local = join(__dirname, "bin", name);
    if (existsSync(local)) return local;
  }
  if (process.env.YTDLP_PATH && existsSync(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
  try {
    const { stdout } = await execFileP("which", ["yt-dlp"], { timeout: 3000 });
    const p = stdout.trim();
    if (p && existsSync(p)) return p;
  } catch {}
  throw new Error("yt-dlp غير موجود");
}

let _ffmpegCached = null;
async function ffmpegBin() {
  if (_ffmpegCached) return _ffmpegCached;
  // 1) الحلّال الموحد (نظام أولاً ثم ffmpeg-static)
  try {
    const mod = await import(join(__dirname, "dist", "services", "media", "ffmpeg-path.mjs"));
    if (mod.getFfmpegPath) {
      _ffmpegCached = await mod.getFfmpegPath();
      return _ffmpegCached;
    }
  } catch {}
  // 2) متغير البيئة
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    _ffmpegCached = process.env.FFMPEG_PATH;
    return _ffmpegCached;
  }
  // 3) ffmpeg-static مباشرة
  try {
    const { createRequire } = await import("module");
    const req = createRequire(join(__dirname, "package.json"));
    const p = req("ffmpeg-static");
    if (p && existsSync(p)) { _ffmpegCached = p; return p; }
  } catch {}
  _ffmpegCached = "ffmpeg";
  return _ffmpegCached;
}

// ══════════════════════════════════════════════════════════════════════════════
// البحث على يوتيوب مع دعم Offset
// ══════════════════════════════════════════════════════════════════════════════

export async function youtubeSearch(queries, minDurSec, offset, poolSize) {
  minDurSec = minDurSec || 0;
  offset    = Math.max(0, parseInt(offset) || 0);
  poolSize  = Math.max(offset + 1, parseInt(poolSize) || offset + 5);

  let ytSearch = null;
  try { ytSearch = (await import(join(__dirname, "node_modules", "yt-search", "index.js"))).default; } catch {}
  if (!ytSearch) { try { ytSearch = (await import("yt-search")).default; } catch {} }

  if (ytSearch) {
    for (const q of queries) {
      try {
        const r = await Promise.race([
          ytSearch(q),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 18000))
        ]);
        const vids = (r && r.videos ? r.videos : [])
          .filter(v => !minDurSec || ((v.duration && v.duration.seconds) || 0) >= minDurSec);
        if (vids.length > offset) {
          const v = vids[offset];
          return { url: v.url, title: v.title || q, duration: (v.duration && v.duration.seconds) || 0, videoId: v.videoId || null };
        }
        if (vids.length > 0) {
          const v = vids[vids.length - 1];
          return { url: v.url, title: v.title || q, duration: (v.duration && v.duration.seconds) || 0, videoId: v.videoId || null };
        }
      } catch {}
    }
  }

  // احتياط: yt-dlp ytsearch
  const bin = await ytdlpBin();
  for (const q of queries) {
    try {
      const n = Math.max(5, poolSize);
      const { stdout } = await execFileP(bin, [
        "ytsearch" + n + ":" + q, "--flat-playlist",
        "--print", "%(webpage_url)s\t%(title)s\t%(duration)s\t%(id)s",
        "--no-warnings", "-q"
      ], { timeout: 20000 });

      const lines = stdout.trim().split("\n").filter(Boolean);
      const all   = [];
      for (const line of lines) {
        const parts = line.split("\t");
        const url   = parts[0];
        const title = parts[1] || q;
        const dur   = parseInt(parts[2] || "0");
        const vid   = parts[3] || null;
        if (url && url.startsWith("http") && (!minDurSec || dur >= minDurSec))
          all.push({ url, title, duration: dur, videoId: vid });
      }
      if (all.length > 0) {
        const idx = Math.min(offset, all.length - 1);
        return all[idx];
      }
    } catch {}
  }

  return null;
}

export async function youtubeSearchMultiple(query, count, minDurSec) {
  count     = Math.max(1, parseInt(count) || 1);
  minDurSec = minDurSec || 0;

  const bin = await ytdlpBin();
  const n   = count * 2;
  const results = [];

  let ytSearch = null;
  try { ytSearch = (await import(join(__dirname, "node_modules", "yt-search", "index.js"))).default; } catch {}
  if (!ytSearch) { try { ytSearch = (await import("yt-search")).default; } catch {} }

  if (ytSearch) {
    try {
      const r = await Promise.race([
        ytSearch(query),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 18000))
      ]);
      const vids = (r && r.videos ? r.videos : [])
        .filter(v => !minDurSec || ((v.duration && v.duration.seconds) || 0) >= minDurSec)
        .slice(0, count);
      if (vids.length >= count) {
        return vids.map(v => ({ url: v.url, title: v.title || query, duration: (v.duration && v.duration.seconds) || 0 }));
      }
      vids.forEach(v => results.push({ url: v.url, title: v.title || query, duration: (v.duration && v.duration.seconds) || 0 }));
    } catch {}
  }

  if (results.length >= count) return results.slice(0, count);

  try {
    const { stdout } = await execFileP(bin, [
      "ytsearch" + n + ":" + query, "--flat-playlist",
      "--print", "%(webpage_url)s\t%(title)s\t%(duration)s",
      "--no-warnings", "-q"
    ], { timeout: 25000 });

    const seen = new Set(results.map(r => r.url));
    for (const line of stdout.trim().split("\n").filter(Boolean)) {
      if (results.length >= count) break;
      const parts = line.split("\t");
      const url   = parts[0];
      const title = parts[1] || query;
      const dur   = parseInt(parts[2] || "0");
      if (url && url.startsWith("http") && !seen.has(url) && (!minDurSec || dur >= minDurSec)) {
        seen.add(url);
        results.push({ url, title, duration: dur });
      }
    }
  } catch {}

  return results.slice(0, count);
}

// ══════════════════════════════════════════════════════════════════════════════
// استخراج الروابط المباشرة من CDN يوتيوب (بدون أي تنزيل)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * وسائط إضافية مشتركة لـ yt-dlp:
 *  - cookies.txt في جذر المشروع (إن وُجد) يتجاوز حظر "confirm you're not a bot"
 *  - YTDLP_EXTRA_ARGS من البيئة لمرونة الاستضافات المختلفة
 */
function ytdlpCommonArgs() {
  const extra = [];
  const cookiesFile = join(__dirname, "cookies.txt");
  if (existsSync(cookiesFile)) extra.push("--cookies", cookiesFile);
  if (process.env.YTDLP_EXTRA_ARGS) {
    try { extra.push(...process.env.YTDLP_EXTRA_ARGS.split(" ").filter(Boolean)); } catch {}
  }
  return extra;
}

// عملاء يوتيوب بالترتيب — بعض الاستضافات يُحظر عليها العميل الافتراضي
const YT_CLIENTS = [null, "tv", "android", "web_safari"];

// ذاكرة حظر IP: عند رصد "Sign in to confirm you're not a bot" نتوقف عن
// محاولات yt-dlp لمدة 10 دقائق ونقفز مباشرة لوسطاء الإنقاذ — بدل إهدار
// دقائق لكل طلب في محاولات محكومة بالفشل.
let _ytBlockedUntil = 0;
function ytBlocked() { return Date.now() < _ytBlockedUntil; }
function markYtBlocked() { _ytBlockedUntil = Date.now() + 10 * 60 * 1000; }

/** يُرجع كل الروابط التي يطبعها yt-dlp (1 = مدمج، 2 = فيديو + صوت منفصلان) */
export async function getDirectUrls(ytUrl, format) {
  if (ytBlocked()) throw new Error("yt-dlp محظور مؤقتاً (IP) — استخدم وسيط الإنقاذ");
  const bin    = await ytdlpBin();
  const common = ytdlpCommonArgs();
  let lastErr  = null;
  for (const client of YT_CLIENTS) {
    const args = [ytUrl, "-f", format, "--get-url", "--no-playlist", "--no-warnings", "-q", ...common];
    if (client) args.push("--extractor-args", "youtube:player_client=" + client);
    try {
      const { stdout } = await execFileP(bin, args, { timeout: 40000 });
      const urls = stdout.trim().split("\n").filter(u => u.startsWith("http"));
      if (urls.length) return urls;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.stderr || e?.message || "");
      // خطأ الصيغة غير المتاحة لن يتغير بتبديل العميل — لا داعي للإعادة
      if (msg.includes("Requested format is not available")) break;
      // حظر IP: كل العملاء سيفشلون بنفس السبب — سجّل وتوقف فوراً
      if (msg.includes("Sign in to confirm") || msg.includes("not a bot")) { markYtBlocked(); break; }
    }
  }
  throw new Error("لم يُعثر على رابط مباشر" + (lastErr ? ": " + String(lastErr.stderr || lastErr.message || "").slice(0, 120) : ""));
}

/**
 * [توافقية] يُرجع رابطاً واحداً فقط إذا كانت الصيغة مدمجة (فيديو+صوت معاً)
 * — يرمي خطأ لو كانت النتيجة رابطين، لمنع خطأ "الفيديو الصامت" القديم.
 */
export async function getDirectUrl(ytUrl, format) {
  const urls = await getDirectUrls(ytUrl, format);
  if (urls.length > 1) throw new Error("الصيغة تتطلب دمجاً (رابطان منفصلان)");
  return urls[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// الصورة المصغرة من CDN يوتيوب (بضعة KB — تمنع Baileys من حفظ نسخة أصلية للقرص)
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// طبقة الإنقاذ: وسطاء Piped — يجلبون نفس فيديو يوتيوب لكن عبر خادم وسيط
// بـ IP غير محظور. تُستخدم فقط عندما يحظر يوتيوب IP الاستضافة نفسها
// ("Sign in to confirm you're not a bot"). المصدر يبقى يوتيوب دون تغيير.
// قابلة للتوسيع من البيئة: PIPED_INSTANCES="https://x.com,https://y.com"
// ══════════════════════════════════════════════════════════════════════════════
const PIPED_INSTANCES = (process.env.PIPED_INSTANCES || "")
  .split(",").map(s => s.trim()).filter(Boolean)
  .concat([
    "https://api.piped.private.coffee",
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.reallyaweso.me",
    "https://pipedapi.ducks.party",
  ]);

/** يجلب روابط البث من أول وسيط Piped يستجيب. يرمي خطأ إن فشل الجميع. */
export async function pipedStreams(videoId) {
  for (const base of PIPED_INSTANCES) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(base + "/streams/" + videoId, { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const d = await res.json();
      // مدمج h264+aac (itag 18) — يُرسل لواتساب كما هو
      const prog  = (d.videoStreams || []).find(s => s.mimeType === "video/mp4" && !s.videoOnly && s.url);
      // صوت m4a منفصل + فيديو-فقط mp4 (للدمج بالنسخ إن توفرا)
      const audio = (d.audioStreams || []).find(s => s.mimeType === "audio/mp4" && s.url) || null;
      const vOnly = (d.videoStreams || []).filter(s => s.mimeType === "video/mp4" && s.videoOnly && s.url)
        .map(s => ({ url: s.url, height: parseInt(s.quality) || 0 }));
      if (!prog && !audio && !vOnly.length) continue;
      return {
        prog: prog ? prog.url : null,
        audio: audio ? audio.url : null,
        videoOnly: vOnly,
        duration: d.duration || 0,
        title: d.title || ""
      };
    } catch {}
  }
  throw new Error("يوتيوب حظر IP الخادم وكل وسطاء الإنقاذ غير متاحين حالياً");
}

function extractVideoId(ytUrl) {
  const m = String(ytUrl || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function fetchThumb(ytUrlOrId) {
  return new Promise((resolve) => {
    const id = /^[\w-]{11}$/.test(String(ytUrlOrId)) ? ytUrlOrId : extractVideoId(ytUrlOrId);
    if (!id) return resolve(null);
    const tryUrl = (name, next) => {
      const req = https.get(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { timeout: 6000 }, (res) => {
        if (res.statusCode !== 200) { res.resume(); return next ? next() : resolve(null); }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > 300 * 1024) { req.destroy(); return resolve(null); }
          chunks.push(c);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => (next ? next() : resolve(null)));
      });
      req.on("error", () => (next ? next() : resolve(null)));
      req.on("timeout", () => { req.destroy(); next ? next() : resolve(null); });
    };
    tryUrl("mqdefault", () => tryUrl("default", null));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// أنابيب البث الصافي (صفر RAM / صفر ملفات من طرفنا)
// ══════════════════════════════════════════════════════════════════════════════

const FF_NET_ARGS = [
  "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
  "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122"
];

/** يلف تدفقاً بعدّاد بايتات لإظهار التقدم دون لمس البيانات */
function withByteCounter(stream, onBytes) {
  if (!onBytes) return stream;
  const pt = new PassThrough();
  let received = 0;
  let lastReport = 0;
  stream.on("data", (chunk) => {
    received += chunk.length;
    const now = Date.now();
    if (now - lastReport > 2500) {
      lastReport = now;
      try { onBytes(received); } catch {}
    }
  });
  stream.pipe(pt);
  stream.on("error", (e) => pt.destroy(e));
  return pt;
}

/**
 * دمج فيديو + صوت من رابطين مباشرين إلى MP4 مُجزّأ عبر أنبوب — نسخ بدون
 * إعادة ترميز (-c copy): شبه صفر CPU وصفر تخزين. MP4 المجزأ (fMP4) هو
 * h264+aac قياسي يفهمه واتساب.
 */
export async function mergeUrlsToStream(videoUrl, audioUrl, onBytes) {
  const ff = await ffmpegBin();
  const args = [
    "-hide_banner", "-loglevel", "error",
    ...FF_NET_ARGS, "-i", videoUrl,
    ...FF_NET_ARGS, "-i", audioUrl,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c", "copy",
    "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1"
  ];
  const proc = spawn(ff, args, { stdio: ["ignore", "pipe", "pipe"] });
  let errBuf = "";
  proc.stderr.on("data", (d) => { errBuf = (errBuf + d.toString()).slice(-500); });
  const stream = withByteCounter(proc.stdout, onBytes);
  const cleanup = () => { try { proc.kill("SIGKILL"); } catch {} };
  proc.on("close", (code) => {
    if (code !== 0 && code !== null) stream.destroy(new Error("ffmpeg merge كود " + code + ": " + errBuf.slice(-200)));
  });
  return { stream, cleanup };
}

/** إعادة تغليف رابط واحد إلى fMP4 عبر أنبوب (لصيغ mp4 غير القابلة للبث مباشرة) */
export async function remuxUrlToStream(url, onBytes) {
  const ff = await ffmpegBin();
  const args = [
    "-hide_banner", "-loglevel", "error",
    ...FF_NET_ARGS, "-i", url,
    "-c", "copy",
    "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1"
  ];
  const proc = spawn(ff, args, { stdio: ["ignore", "pipe", "pipe"] });
  proc.stderr.on("data", () => {});
  const stream = withByteCounter(proc.stdout, onBytes);
  const cleanup = () => { try { proc.kill("SIGKILL"); } catch {} };
  return { stream, cleanup };
}

/**
 * تحويل رابط صوت (أي codec) إلى AAC-ADTS عبر أنبوب — صيغة صوت أصيلة
 * لواتساب قابلة للبث بلا حاويات تحتاج seek. تُستخدم فقط عندما لا يتوفر m4a.
 */
export async function audioUrlToAdtsStream(url, onBytes) {
  const ff = await ffmpegBin();
  const args = [
    "-hide_banner", "-loglevel", "error",
    ...FF_NET_ARGS, "-i", url,
    "-vn", "-c:a", "aac", "-b:a", "128k",
    "-f", "adts", "pipe:1"
  ];
  const proc = spawn(ff, args, { stdio: ["ignore", "pipe", "pipe"] });
  proc.stderr.on("data", () => {});
  const stream = withByteCounter(proc.stdout, onBytes);
  const cleanup = () => { try { proc.kill("SIGKILL"); } catch {} };
  return { stream, cleanup };
}

/** بث stdout من yt-dlp مباشرة (احتياط أخير — ما يزال بثاً صافياً بلا تخزين) */
export async function ytdlpReadable(ytUrl, format, onBytes) {
  const bin  = await ytdlpBin();
  const ff   = await ffmpegBin();
  const args = [ytUrl, "-f", format, "--output", "-",
    "--no-playlist", "--no-warnings", "-q", "--no-part",
    "--ffmpeg-location", ff,
    ...ytdlpCommonArgs()
  ];
  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  let errTail = "";
  proc.stderr.on("data", (d) => { errTail = (errTail + d.toString()).slice(-300); });
  const stream = withByteCounter(proc.stdout, onBytes);
  const cleanup = () => { try { proc.kill("SIGKILL"); } catch {} };
  proc.on("close", (code) => {
    if (code !== 0 && code !== null) stream.destroy(new Error("yt-dlp بث فشل: " + errTail.slice(-150)));
  });
  return { stream, cleanup };
}

// ══════════════════════════════════════════════════════════════════════════════
// حلّالات الجودة — تُرجع خطة إرسال جاهزة للمعالج
// ══════════════════════════════════════════════════════════════════════════════

/**
 * يحلّ فيديو يوتيوب إلى خطة بث بحسب الجودة المطلوبة:
 *   { title, seconds, thumb, directUrl?, makeStream? }
 *
 * - directUrl: رابط mp4 مدمج واحد — الأفضل: Baileys يبثه بنفسه (صفر موارد)
 * - makeStream(): يبدأ بث ffmpeg/yt-dlp عند الطلب — يُستدعى فقط إن فشل الرابط
 *
 * الجودات:
 *   1 → 360p  (الصيغة 18 المدمجة — رابط واحد مضمون)
 *   2 → 720p  حقيقية (دمج DASH بالنسخ؛ يوتيوب أزال 22 المدمجة)
 *   3 → 1080p حقيقية (دمج DASH بالنسخ)
 */
async function resolveVideoPlan(video, quality, onProgress, qlLabel) {
  const heightCap = quality === 1 ? 360 : quality === 2 ? 720 : 1080;
  const plan = {
    title: video.title,
    seconds: Math.max(1, video.duration || 0),
    thumb: null,
    directUrl: null,
    makeStream: null
  };

  // الصورة المصغرة بالتوازي (بضعة KB — لا تعطل شيئاً لو فشلت)
  const thumbPromise = fetchThumb(video.videoId || video.url).catch(() => null);

  if (quality === 1) {
    // 360p: الصيغة 18 مدمجة h264+aac — رابط واحد يعمل مباشرة على واتساب
    try {
      const urls = await getDirectUrls(video.url, "18/b[height<=360][ext=mp4][vcodec^=avc]");
      if (urls.length === 1) plan.directUrl = urls[0];
      else if (urls.length === 2) {
        plan.makeStream = (onBytes) => mergeUrlsToStream(urls[0], urls[1], onBytes);
      }
    } catch {}
    if (!plan.directUrl && !plan.makeStream) {
      // إنقاذ Piped: نفس الفيديو عبر وسيط بـ IP غير محظور
      try {
        const ps = await pipedStreams(video.videoId || extractVideoId(video.url));
        if (ps.prog) plan.directUrl = ps.prog;
        else if (ps.videoOnly.length && ps.audio) {
          const bestV = ps.videoOnly.filter(v => v.height <= 360).sort((a, b) => b.height - a.height)[0] || ps.videoOnly[0];
          plan.makeStream = (onBytes) => mergeUrlsToStream(bestV.url, ps.audio, onBytes);
        }
      } catch {}
    }
    if (!plan.directUrl && !plan.makeStream) {
      plan.makeStream = (onBytes) => ytdlpReadable(video.url, "18/b[height<=360]", onBytes);
    }
  } else {
    // 720p/1080p: جرّب مدمجاً واحداً أولاً (نادر لكنه أرخص)، ثم دمج DASH بالنسخ
    let premergedUrl = null;
    try {
      const urls = await getDirectUrls(video.url, `b[height<=${heightCap}][ext=mp4][vcodec^=avc][acodec!=none]`);
      if (urls.length === 1) premergedUrl = urls[0];
    } catch {}

    if (premergedUrl) {
      plan.directUrl = premergedUrl;
    } else {
      // h264+aac حصراً حتى يكون الناتج المدموج نسخاً صافياً يفهمه واتساب
      let pair = null;
      try {
        const urls = await getDirectUrls(
          video.url,
          `bv*[height<=${heightCap}][ext=mp4][vcodec^=avc]+ba[ext=m4a]`
        );
        if (urls.length === 2) pair = urls;
        else if (urls.length === 1) plan.directUrl = urls[0];
      } catch {}
      if (pair) {
        plan.makeStream = (onBytes) => mergeUrlsToStream(pair[0], pair[1], onBytes);
      } else if (!plan.directUrl) {
        // آخر احتياط: الجودة الأدنى المضمونة بدل الفشل الكامل
        try {
          const urls = await getDirectUrls(video.url, "18");
          if (urls.length === 1) plan.directUrl = urls[0];
        } catch {}
        if (!plan.directUrl) {
          // إنقاذ Piped: أعلى جودة متاحة عبر الوسيط (دمج إن وُجد فيديو+صوت منفصلان)
          try {
            const ps = await pipedStreams(video.videoId || extractVideoId(video.url));
            const bestV = ps.videoOnly.filter(v => v.height <= heightCap).sort((a, b) => b.height - a.height)[0];
            if (bestV && ps.audio) {
              plan.makeStream = (onBytes) => mergeUrlsToStream(bestV.url, ps.audio, onBytes);
            } else if (ps.prog) {
              plan.directUrl = ps.prog;
            }
          } catch {}
        }
        if (!plan.directUrl && !plan.makeStream) {
          plan.makeStream = (onBytes) => ytdlpReadable(video.url, "18", onBytes);
        }
      }
    }
  }

  plan.thumb = await thumbPromise;
  return plan;
}

// ══════════════════════════════════════════════════════════════════════════════
// الواجهات العامة — فيديو / فيلم / صوت
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @returns {{ title, seconds, thumb, directUrl?, makeStream? }}
 *   directUrl  → sendMessage({ video: { url: directUrl } })          — صفر موارد
 *   makeStream → const {stream, cleanup} = await makeStream(onBytes)
 *                sendMessage({ video: { stream } })                  — بث صافٍ
 */
export async function streamVideo(query, quality, onProgress, offset) {
  quality = Math.min(3, Math.max(1, parseInt(quality) || 2));
  offset  = Math.max(0, parseInt(offset) || 0);
  const qlLabel = QUALITY_LABEL[quality];

  if (onProgress) await onProgress("search", query, qlLabel, 0, 0, 0).catch(() => {});

  const video = await youtubeSearch([query, query + " youtube", query + " فيديو"], 0, offset, offset + 5);
  if (!video) throw new Error('لم أجد "' + query + '"');

  if (onProgress) await onProgress("found", video.title, qlLabel, 0, 0, 0).catch(() => {});

  const plan = await resolveVideoPlan(video, quality, onProgress, qlLabel);
  plan.qlLabel = qlLabel;
  return plan;
}

export async function streamFilm(query, quality, onProgress) {
  quality = Math.min(3, Math.max(1, parseInt(quality) || 2));
  const qlLabel = QUALITY_LABEL[quality];

  if (onProgress) await onProgress("search", query, qlLabel, 0, 0, 0).catch(() => {});

  const queries = [
    query + " full movie",
    query + " فيلم كامل",
    query + " movie",
    query + " film",
    query
  ];
  const video = await youtubeSearch(queries, 300, 0, 5);
  if (!video) throw new Error('لم أجد "' + query + '" — جرّب اسماً آخر أو بالإنجليزية');

  if (onProgress) await onProgress("found", video.title, qlLabel, 0, 0, 0).catch(() => {});

  const plan = await resolveVideoPlan(video, quality, onProgress, qlLabel);
  plan.qlLabel = qlLabel;
  return plan;
}

/**
 * @returns {{ title, seconds, directUrl?, mimetype, makeStream? }}
 *   directUrl  → sendMessage({ audio: { url }, mimetype: 'audio/mp4' })
 *   makeStream → sendMessage({ audio: { stream }, mimetype: 'audio/aac' })
 */
export async function streamSong(query, onProgress, offset) {
  offset = Math.max(0, parseInt(offset) || 0);
  if (onProgress) await onProgress("search", query, "صوت", 0, 0, 0).catch(() => {});

  const video = await youtubeSearch([query, query + " audio", query + " أغنية", query + " music"], 0, offset, offset + 5);
  if (!video) throw new Error('لم أجد "' + query + '"');

  if (onProgress) await onProgress("found", video.title, "صوت", 0, 0, 0).catch(() => {});

  const plan = {
    title: video.title,
    seconds: Math.max(1, video.duration || 0),
    directUrl: null,
    mimetype: "audio/mp4",
    makeStream: null
  };

  // m4a (الصيغة 140 = AAC) متوفرة على كل يوتيوب تقريباً — رابط واحد مباشر
  try {
    const urls = await getDirectUrls(video.url, "140/139/ba[ext=m4a]");
    if (urls.length >= 1) {
      plan.directUrl = urls[0];
      return plan;
    }
  } catch {}

  // احتياط: أفضل صوت متاح (غالباً opus) → تحويل بث إلى AAC-ADTS يفهمه واتساب
  try {
    const urls = await getDirectUrls(video.url, "ba");
    if (urls.length >= 1) {
      const src = urls[0];
      plan.mimetype = "audio/aac";
      plan.makeStream = (onBytes) => audioUrlToAdtsStream(src, onBytes);
      return plan;
    }
  } catch {}

  // إنقاذ Piped: صوت m4a مباشر إن وُجد، وإلا استخلاص AAC من المدمج 360p
  // (نسخ بدون إعادة ترميز عندما يكون صوت المصدر AAC أصلاً)
  try {
    const ps = await pipedStreams(video.videoId || extractVideoId(video.url));
    if (ps.audio) {
      plan.directUrl = ps.audio;
      plan.mimetype = "audio/mp4";
      return plan;
    }
    if (ps.prog) {
      const src = ps.prog;
      plan.mimetype = "audio/aac";
      plan.makeStream = (onBytes) => audioUrlToAdtsStream(src, onBytes);
      return plan;
    }
  } catch {}

  // احتياط أخير: بث yt-dlp نفسه
  plan.mimetype = "audio/mp4";
  plan.makeStream = (onBytes) => ytdlpReadable(video.url, "140/139/ba[ext=m4a]/ba", onBytes);
  return plan;
}
