#!/usr/bin/env node
/**
 * patch-stream-dl-fix.mjs — تصحيح /vid handler
 * (النص السابق كان مختلفاً قليلاً — هذا الباتش يُطبّق التعديل الصحيح)
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

const GUARD = "// PATCH_STREAM_DL_FIX_APPLIED";
let code = readFileSync(DIST, "utf8");
if (code.includes(GUARD)) { inf("مُطبَّق سابقاً"); process.exit(0); }

let applied = 0;

const SDL_IMPORT = `new URL("../stream-dl.mjs", import.meta.url).href`;

// /vid handler — النص الدقيق كما هو في الملف حالياً
const VID_OLD = `              // PATCH_NEW_FEATURES_2_APPLIED
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
              }`;

const VID_NEW = `              // PATCH_STREAM_DL_FIX_APPLIED — /vid stream-dl.mjs
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
                      caption: "\uD83C\uDFAC " + _vRes.title.slice(0, 55) + tags + "\\n\u26A1 بث مباشر | " + _fmtV(_vRes.buffer.length),
                      mimetype: "video/mp4"
                    });
                    await new Promise(r => setTimeout(r, 1000));
                  } catch (ve) {
                    logger.warn({ ve }, "[/vid stream] failed");
                    await _vUpd("❌ " + (ve.message || "فشل").slice(0, 120)).catch(() => {});
                  }
                  if (count === 1) break;
                }
                if (_vPK) try { await activeSock.sendMessage(jid, { delete: _vPK }); } catch {}
              }`;

if (code.includes(VID_OLD)) {
  code = code.replace(VID_OLD, VID_NEW);
  applied++;
  ok("/vid WA handler — stream-dl.mjs + شريط تقدم");
} else {
  wrn("لم يُجد نص /vid handler");
}

if (applied > 0) {
  writeFileSync(DIST, code, "utf8");
  ok(`تم تطبيق ${applied} تعديل`);
} else {
  console.log(Y + "⚠️  لم يُطبَّق أي تعديل" + N);
}
