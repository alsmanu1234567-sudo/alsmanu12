#!/usr/bin/env node
/**
 * patch-stream-dl-v2.mjs — تحديث handlers لـ stream-dl v2
 *
 * يُطبّق 3 تحديثات:
 *  1. /film  — يدعم directUrl (صفر RAM) + buffer + جودات صحيحة
 *  2. /vid   — يمرر offset لكل تكرار (فيديوهات مختلفة) + directUrl
 *  3. /song  — يمرر offset + يدعم m4a
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);
const inf = m => console.log(C + "ℹ️  " + m + N);

const GUARD = "// PATCH_STREAM_DL_V2_APPLIED";
let code = readFileSync(DIST, "utf8");
if (code.includes(GUARD)) { inf("مُطبَّق سابقاً"); process.exit(0); }

let applied = 0;

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(oldStr, newStr);
  applied++;
  ok(desc);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. /film handler — directUrl + buffer + جودات صحيحة
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `              // PATCH_STREAM_DL_APPLIED
              // هاندلر /film — stream-dl.mjs: صفر ملفات + شريط تقدم حقيقي
              {
                const _sdl = await import(new URL("../stream-dl.mjs", import.meta.url).href);
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

  `              // PATCH_STREAM_DL_V2_APPLIED (film)
              // /film v2: directUrl (صفر RAM) + buffer كمسار أخير + جودات صحيحة
              {
                const _sdl = await import(new URL("../stream-dl.mjs", import.meta.url).href);
                const _bpm = _sdl.buildProgressMsg;
                const _qlLabels = { 1: "منخفضة 360p", 2: "متوسطة 720p", 3: "عالية (أفضل)" };
                const _qlLbl = _qlLabels[_fmQv] || "متوسطة 720p";
                await _fPrgSend(_bpm(_fmQ, "search", _qlLbl, 0, 0, 0));
                const _filmRes = await _sdl.streamFilm(_fmQ, _fmQv, async (stage, title, ql, recv, tot, pct) => {
                  await _fPrgSend(_bpm(title || _fmQ, stage, ql || _qlLbl, recv || 0, tot || 0, pct));
                });
                const _filmCaption = "🎬 *" + _filmRes.title.slice(0, 60) + "*\\n🎯 جودة " + _qlLbl + " | ⚡ صفر ملفات";
                if (_filmRes.directUrl) {
                  // واتساب يحمّل مباشرةً — صفر RAM على السيرفر
                  await _fPrgSend(_bpm(_filmRes.title, "url_send", _qlLbl, 0, 0, 0));
                  await activeSock.sendMessage(jid, {
                    video: { url: _filmRes.directUrl },
                    caption: _filmCaption,
                    mimetype: "video/mp4",
                    gifPlayback: false
                  });
                } else {
                  await _fPrgSend(_bpm(_filmRes.title, "done", _qlLbl, (_filmRes.buffer || Buffer.alloc(0)).length, (_filmRes.buffer || Buffer.alloc(0)).length, 100));
                  await activeSock.sendMessage(jid, {
                    video: _filmRes.buffer,
                    caption: _filmCaption,
                    mimetype: "video/mp4"
                  });
                }
                if (_fPrgKey) try { await activeSock.sendMessage(jid, { delete: _fPrgKey }); } catch {}
              }`,

  "/film handler v2 — directUrl + جودات صحيحة"
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. /vid handler — offset + directUrl + عدد صحيح
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `              // PATCH_VID_STREAM_DL_APPLIED
              {
                const _sdlV = await import(new URL("../stream-dl.mjs", import.meta.url).href);
                const _bpmV = _sdlV.buildProgressMsg;
                const _fmtV = _sdlV.fmtBytes;
                const _qlLblV = ['', 'منخفضة', 'متوسطة', 'عالية'][quality] || 'متوسطة';
                let _vPK = null;
                const _vUpd = async (txt) => {
                  try {
                    if (_vPK) await activeSock.sendMessage(jid, { text: txt, edit: _vPK });
                    else { const s = await activeSock.sendMessage(jid, { text: txt }); if (s && s.key) _vPK = s.key; }
                  } catch { try { const s2 = await activeSock.sendMessage(jid, { text: txt }); if (s2 && s2.key) _vPK = s2.key; } catch {} }
                };
                for (let _vi = 0; _vi < count; _vi++) {
                  try {
                    await _vUpd(_bpmV(query, 'search', _qlLblV, 0, 0, 0));
                    const _vRes = await _sdlV.streamVideo(query, quality, async (stage, title, ql, recv, tot, pct) => {
                      await _vUpd(_bpmV(title || query, stage, ql || _qlLblV, recv || 0, tot || 0, pct));
                    });
                    await _vUpd(_bpmV(_vRes.title, 'done', _qlLblV, _vRes.buffer.length, _vRes.buffer.length, 100));
                    const tags = hashtags.length > 0 ? '\\n' + hashtags.join(' ') : '';
                    await activeSock.sendMessage(jid, {
                      video: _vRes.buffer,
                      caption: '🎬 ' + _vRes.title.slice(0,55) + tags + '\\n⚡ بث مباشر | ' + _fmtV(_vRes.buffer.length),
                      mimetype: 'video/mp4'
                    });
                    await new Promise(r => setTimeout(r, 1000));
                  } catch (ve) {
                    logger.warn({ ve }, '[/vid stream] failed');
                    await _vUpd('❌ ' + (ve.message || 'فشل').slice(0,120)).catch(() => {});
                  }
                  if (count === 1) break;
                }
                if (_vPK) try { await activeSock.sendMessage(jid, { delete: _vPK }); } catch {}
              }`,

  `              // PATCH_STREAM_DL_V2_APPLIED (vid)
              // /vid v2: offset صحيح (فيديوهات مختلفة) + directUrl (صفر RAM) + جودات صحيحة
              {
                const _sdlV = await import(new URL("../stream-dl.mjs", import.meta.url).href);
                const _bpmV = _sdlV.buildProgressMsg;
                const _fmtV = _sdlV.fmtBytes;
                const _qlLabelsV = { 1: "منخفضة 360p", 2: "متوسطة 720p", 3: "عالية (أفضل)" };
                const _qlLblV = _qlLabelsV[quality] || "متوسطة 720p";
                let _vPK = null;
                const _vUpd = async (txt) => {
                  try {
                    if (_vPK) await activeSock.sendMessage(jid, { text: txt, edit: _vPK });
                    else { const s = await activeSock.sendMessage(jid, { text: txt }); if (s && s.key) _vPK = s.key; }
                  } catch { try { const s2 = await activeSock.sendMessage(jid, { text: txt }); if (s2 && s2.key) _vPK = s2.key; } catch {} }
                };
                // count=5 مثلاً يُنزّل 5 فيديوهات مختلفة
                for (let _vi = 0; _vi < count; _vi++) {
                  try {
                    await _vUpd(_bpmV(query + (_vi > 0 ? " (" + (_vi+1) + "/" + count + ")" : ""), "search", _qlLblV, 0, 0, 0));
                    // _vi هو الـ offset: 0=الأول, 1=الثاني, 2=الثالث...
                    const _vRes = await _sdlV.streamVideo(query, quality, async (stage, title, ql, recv, tot, pct) => {
                      await _vUpd(_bpmV((title || query) + (_vi > 0 ? " (" + (_vi+1) + "/" + count + ")" : ""), stage, ql || _qlLblV, recv || 0, tot || 0, pct));
                    }, _vi);
                    const tags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                    const _vCaption = "🎬 " + _vRes.title.slice(0, 50) + tags + (count > 1 ? " [" + (_vi+1) + "/" + count + "]" : "") + "\\n⚡ صفر ملفات | " + _qlLblV;
                    if (_vRes.directUrl) {
                      await _vUpd(_bpmV(_vRes.title, "url_send", _qlLblV, 0, 0, 0));
                      await activeSock.sendMessage(jid, {
                        video: { url: _vRes.directUrl },
                        caption: _vCaption,
                        mimetype: "video/mp4",
                        gifPlayback: false
                      });
                    } else {
                      await _vUpd(_bpmV(_vRes.title, "done", _qlLblV, (_vRes.buffer || Buffer.alloc(0)).length, (_vRes.buffer || Buffer.alloc(0)).length, 100));
                      await activeSock.sendMessage(jid, {
                        video: _vRes.buffer,
                        caption: _vCaption,
                        mimetype: "video/mp4"
                      });
                    }
                    await new Promise(r => setTimeout(r, 1200));
                  } catch (ve) {
                    logger.warn({ ve }, "[/vid stream v2] failed idx=" + _vi);
                    await _vUpd("❌ " + (ve.message || "فشل").slice(0, 120)).catch(() => {});
                  }
                }
                if (_vPK) try { await activeSock.sendMessage(jid, { delete: _vPK }); } catch {}
              }`,

  "/vid handler v2 — offset + directUrl + عدد صحيح"
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. /song handler — offset + m4a mimetype
// ══════════════════════════════════════════════════════════════════════════════
patch(
  `              // PATCH_STREAM_DL_APPLIED (song)
              // هاندلر /song — stream-dl.mjs: صفر ملفات + شريط تقدم حقيقي
              {
                const _sdlS = await import(new URL("../stream-dl.mjs", import.meta.url).href);
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

  `              // PATCH_STREAM_DL_V2_APPLIED (song)
              // /song v2: offset صحيح + m4a/mp3 + أغاني مختلفة
              {
                const _sdlS = await import(new URL("../stream-dl.mjs", import.meta.url).href);
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
                    await _sUpd(_bpmS(query + (_si > 0 ? " (" + (_si+1) + "/" + count + ")" : ""), "search", "صوت", 0, 0, 0));
                    // _si هو الـ offset: يُعطي أغنية مختلفة لكل تكرار
                    const _sRes = await _sdlS.streamSong(query, async (stage, title, ql, recv, tot, pct) => {
                      await _sUpd(_bpmS((title || query) + (_si > 0 ? " (" + (_si+1) + "/" + count + ")" : ""), stage, ql || "صوت", recv || 0, tot || 0, pct));
                    }, _si);
                    await _sUpd(_bpmS(_sRes.title, "done", "صوت", _sRes.buffer.length, _sRes.buffer.length, 100));
                    const songTags = hashtags.length > 0 ? "\\n" + hashtags.join(" ") : "";
                    const _sMime = _sRes.ext === "m4a" ? "audio/mp4" : "audio/mpeg";
                    await activeSock.sendMessage(jid, { audio: _sRes.buffer, mimetype: _sMime, ptt: false });
                    await activeSock.sendMessage(jid, {
                      text: "🎵 *" + _sRes.title.slice(0, 55) + "*" + songTags +
                            (count > 1 ? " [" + (_si+1) + "/" + count + "]" : "") +
                            "\\n💾 " + _fmtS(_sRes.buffer.length) + " | ⚡ صفر ملفات"
                    }).catch(() => {});
                    await new Promise(r => setTimeout(r, 500));
                  } catch (se) {
                    logger.warn({ se }, "[/song stream v2] idx=" + _si);
                    await _sUpd("❌ " + (se.message || "فشل").slice(0, 120)).catch(() => {});
                  }
                }
                if (_sgPK) try { await activeSock.sendMessage(jid, { delete: _sgPK }); } catch {}
              }`,

  "/song handler v2 — offset + m4a"
);

// ══════════════════════════════════════════════════════════════════════════════
// الحفظ
// ══════════════════════════════════════════════════════════════════════════════
if (applied > 0) {
  writeFileSync(DIST, code, "utf8");
  ok("تطبيق " + applied + " تعديل — v2 جاهز");
} else {
  wrn("لم يُطبَّق أي تعديل");
}
