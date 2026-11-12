#!/usr/bin/env node
/**
 * patch-stream-dl.mjs — الباتش الرئيسي: صفر ملفات + شريط تقدم حقيقي
 *
 * يُطبّق 3 تعديلات على dist/index.mjs:
 *  1. هاندلر /film في واتساب  → stream-dl: streamFilm()
 *  2. هاندلر /vid  في واتساب  → stream-dl: streamVideo()
 *  3. هاندلر /song في واتساب  → stream-dl: streamSong()
 *
 * خصائص النظام الجديد:
 *  • صفر ملفات مؤقتة على الديسك (yt-dlp stdout pipe مباشرةً)
 *  • شريط تقدم حقيقي يتحدث كل 2.5 ثانية في رسالة واحدة
 *  • حد RAM: فيلم 80MB | فيديو 50MB | صوت 20MB
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const inf = m => console.log(C + "ℹ️  " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);

const GUARD = "// PATCH_STREAM_DL_APPLIED";

let code = readFileSync(DIST, "utf8");
if (code.includes(GUARD)) { inf("مُطبَّق سابقاً"); process.exit(0); }

let applied = 0;

function patch(old, nw, desc) {
  if (!code.includes(old)) { wrn("لم يُجد النص: " + desc); return false; }
  code = code.replace(old, nw);
  applied++;
  ok("تعديل: " + desc);
  return true;
}

// مسار stream-dl.mjs بالنسبة لـ import.meta.url الخاص بـ dist/index.mjs
// import.meta.url = file:///home/runner/workspace/alsmanu/dist/index.mjs
// → new URL("../stream-dl.mjs", import.meta.url) = .../alsmanu/stream-dl.mjs
const SDL_IMPORT = `new URL("../stream-dl.mjs", import.meta.url).href`;

// ══════════════════════════════════════════════════════════════════════════════
// 1. هاندلر /film (واتساب) — شريط تقدم حقيقي + صفر ملفات
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `await _fPrgSend("🎬 *" + _fmQ + "* [جودة " + _qlArr[_fmQv] + "]\\n🔍 جاري البحث...");
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
              if (_fPrgKey) try { await activeSock.sendMessage(jid, { delete: _fPrgKey }); } catch {}`,

  `// PATCH_STREAM_DL_APPLIED
              // هاندلر /film — stream-dl.mjs: صفر ملفات + شريط تقدم حقيقي
              {
                const _sdl = await import(${SDL_IMPORT});
                const _bpm = _sdl.buildProgressMsg;
                const _qlLbl = ["", "منخفضة 360p", "متوسطة 360p", "عالية 480p"][_fmQv] || "متوسطة";
                await _fPrgSend(_bpm(_fmQ, "search", _qlLbl, 0, 0, 0));
                const _filmRes = await _sdl.streamFilm(_fmQ, _fmQv, async (stage, title, ql, recv, tot, pct) => {
                  await _fPrgSend(_bpm(title || _fmQ, stage, ql || _qlLbl, recv || 0, tot || 0, pct));
                });
                await _fPrgSend(_bpm(_filmRes.title, "done", _qlLbl, _filmRes.buffer.length, _filmRes.buffer.length, 100));
                await activeSock.sendMessage(jid, {
                  video: _filmRes.buffer,
                  caption: "🎬 *" + _filmRes.title.slice(0, 60) + "*\\n🎯 جودة " + _qlLbl + " | ⚡ بث مباشر صفر ملفات",
                  mimetype: "video/mp4"
                });
                if (_fPrgKey) try { await activeSock.sendMessage(jid, { delete: _fPrgKey }); } catch {}
              }`,

  "/film WA handler — stream-dl.mjs + شريط تقدم حقيقي"
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. هاندلر /vid (واتساب) — شريط تقدم حقيقي + صفر ملفات
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `// PATCH_NEW_FEATURES_2_APPLIED
              let _vPK = null;
              try {
                const _vSent = await activeSock.sendMessage(jid, { text: "⏳ جارٍ التحميل... █████░░░░░ 50%" });
                _vPK = _vSent && _vSent.key || null;
              } catch {}
              const { searchAndDownloadYouTubeVideo: searchAndDownloadYouTubeVideo2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const results = await searchAndDownloadYouTubeVideo2(query, count, 0, quality);
              if (_vPK) activeSock.sendMessage(jid, { text: "✅ اكتمل التحميل (" + results.length + " فيديو) ██████████ 100%", edit: _vPK }).catch(() => {});
              for (const r of results) {
                const tags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                try {
                  await activeSock.sendMessage(jid, {
                    video: r.buffer,
                    caption: \`\u{1F3AC} \${r.title}\${tags}\`,
                    mimetype: "video/mp4"
                  });
                  await new Promise((res) => setTimeout(res, 1e3));
                } catch {
                }
              }`,

  `// PATCH_STREAM_DL_APPLIED (vid)
              // هاندلر /vid — stream-dl.mjs: صفر ملفات + شريط تقدم حقيقي
              {
                const _sdlV = await import(${SDL_IMPORT});
                const _bpmV = _sdlV.buildProgressMsg;
                const _fmtV = _sdlV.fmtBytes;
                const _qlLblV = ["", "منخفضة", "متوسطة", "عالية"][quality] || "متوسطة";
                let _vPK = null;
                const _vUpd = async (txt) => {
                  try {
                    if (_vPK) await activeSock.sendMessage(jid, { text: txt, edit: _vPK });
                    else { const s = await activeSock.sendMessage(jid, { text: txt }); if (s && s.key) _vPK = s.key; }
                  } catch { try { const s2 = await activeSock.sendMessage(jid, { text: txt }); if (s2 && s2.key) _vPK = s2.key; } catch {} }
                };
                for (let _vi = 0; _vi < count; _vi++) {
                  try {
                    await _vUpd(_bpmV(query, "search", _qlLblV, 0, 0, 0));
                    const _vRes = await _sdlV.streamVideo(query, quality, async (stage, title, ql, recv, tot, pct) => {
                      await _vUpd(_bpmV(title || query, stage, ql || _qlLblV, recv || 0, tot || 0, pct));
                    });
                    await _vUpd(_bpmV(_vRes.title, "done", _qlLblV, _vRes.buffer.length, _vRes.buffer.length, 100));
                    const tags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                    await activeSock.sendMessage(jid, {
                      video: _vRes.buffer,
                      caption: "🎬 " + _vRes.title.slice(0, 55) + tags + "\\n⚡ بث مباشر | " + _fmtV(_vRes.buffer.length),
                      mimetype: "video/mp4"
                    });
                    await new Promise(r => setTimeout(r, 1000));
                  } catch (ve) {
                    logger.warn({ ve }, "[/vid stream] single failed");
                    if (_vPK) await activeSock.sendMessage(jid, { text: "❌ " + (ve.message || "فشل").slice(0, 120), edit: _vPK }).catch(() => {});
                  }
                  if (count === 1) break;
                }
                if (_vPK) try { await activeSock.sendMessage(jid, { delete: _vPK }); } catch {}
              }`,

  "/vid WA handler — stream-dl.mjs + شريط تقدم"
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. هاندلر /song (واتساب) — شريط تقدم حقيقي + صفر ملفات
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `let _sgPK = null;
              try {
                const _sgSent = await activeSock.sendMessage(jid, { text: "⏳ جارٍ التحميل... █████░░░░░ 50%" });
                _sgPK = _sgSent && _sgSent.key || null;
              } catch {}
              const { searchAndDownloadYouTubeAudio: searchAndDownloadYouTubeAudio2 } = await Promise.resolve().then(() => (init_search_utils(), search_utils_exports));
              const results = await searchAndDownloadYouTubeAudio2(query, count, 0);
              if (_sgPK) activeSock.sendMessage(jid, { text: "✅ اكتمل التحميل (" + results.length + " أغنية) ██████████ 100%", edit: _sgPK }).catch(() => {});
              for (const r of results) {
                const songTags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                try {
                  await activeSock.sendMessage(jid, { audio: r.buffer, mimetype: "audio/mpeg", ptt: false });
                  if (r.title) await activeSock.sendMessage(jid, { text: "🎵 " + r.title + songTags }).catch(() => {});
                  await new Promise((res) => setTimeout(res, 500));
                } catch {
                }
              }`,

  `// PATCH_STREAM_DL_APPLIED (song)
              // هاندلر /song — stream-dl.mjs: صفر ملفات + شريط تقدم حقيقي
              {
                const _sdlS = await import(${SDL_IMPORT});
                const _bpmS = _sdlS.buildProgressMsg;
                const _fmtS = _sdlS.fmtBytes;
                let _sgPK = null;
                const _sUpd = async (txt) => {
                  try {
                    if (_sgPK) await activeSock.sendMessage(jid, { text: txt, edit: _sgPK });
                    else { const s = await activeSock.sendMessage(jid, { text: txt }); if (s && s.key) _sgPK = s.key; }
                  } catch { try { const s2 = await activeSock.sendMessage(jid, { text: txt }); if (s2 && s2.key) _sgPK = s2.key; } catch {} }
                };
                for (let _si = 0; _si < count; _si++) {
                  try {
                    await _sUpd(_bpmS(query, "search", "صوت", 0, 0, 0));
                    const _sRes = await _sdlS.streamSong(query, async (stage, title, ql, recv, tot, pct) => {
                      await _sUpd(_bpmS(title || query, stage, ql || "صوت", recv || 0, tot || 0, pct));
                    });
                    await _sUpd(_bpmS(_sRes.title, "done", "صوت", _sRes.buffer.length, _sRes.buffer.length, 100));
                    const songTags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                    await activeSock.sendMessage(jid, { audio: _sRes.buffer, mimetype: "audio/mpeg", ptt: false });
                    await activeSock.sendMessage(jid, { text: "🎵 *" + _sRes.title.slice(0, 55) + "*" + songTags + "\\n💾 " + _fmtS(_sRes.buffer.length) + " | ⚡ بث مباشر" }).catch(() => {});
                    await new Promise(r => setTimeout(r, 500));
                  } catch (se) {
                    logger.warn({ se }, "[/song stream] single failed");
                    await _sUpd("❌ " + (se.message || "فشل").slice(0, 120)).catch(() => {});
                  }
                  if (count === 1) break;
                }
                if (_sgPK) try { await activeSock.sendMessage(jid, { delete: _sgPK }); } catch {}
              }`,

  "/song WA handler — stream-dl.mjs + شريط تقدم"
);

// ══════════════════════════════════════════════════════════════════════════════
// الحفظ
// ══════════════════════════════════════════════════════════════════════════════
if (applied > 0) {
  writeFileSync(DIST, code, "utf8");
  ok(`تم تطبيق ${applied} تعديل — صفر ملفات + شريط تقدم حقيقي`);
} else {
  console.log(Y + "⚠️  لم يُطبَّق أي تعديل — النصوص لم تتطابق" + N);
}
