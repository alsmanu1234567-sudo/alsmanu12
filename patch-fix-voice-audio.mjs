#!/usr/bin/env node
/**
 * patch-fix-voice-audio.mjs
 *
 * يصلح مشاكل حقيقية اكتُشفت بالاختبار الفعلي على ميزتَي التحويل الصوتي:
 *
 * 1) نص←صوت (/صوت) يصل "صوت مكسور" في واتساب: تأكدنا بالاختبار الفعلي أن
 *    FreeTTS.org يُرجع ملف mp3 حقيقي (ID3/MPEG)، لكن الكود كان يرسله لواتساب
 *    باسم mimetype "audio/mp4" مع ptt:true — واتساب يتطلب أن تكون ملاحظات
 *    الصوت (PTT) بصيغة OGG/Opus حقيقية، فيصل الملف تالفاً. الحل: تحويل
 *    الـ mp3 إلى OGG/Opus حقيقي عبر ffmpeg قبل الإرسال (audio-converter.mjs).
 *
 * 2) /صوت كان يتطلب الرد على رسالة نصية دائماً. الآن يعمل بالطريقتين:
 *    - "/صوت مرحبا كيف حالك" مباشرة (بدون رد)
 *    - أو الرد على رسالة نصية بـ "/صوت" فقط (الطريقة القديمة، لا تزال تعمل)
 *
 * 3) /نص (تفريغ الصوت) كان يمكن أن "يعلّق" بصمت إلى الأبد إذا تعطّل تنزيل
 *    الوسائط من واتساب (مثال: انتهت صلاحية الرابط) دون رمي استثناء صريح.
 *    الحل: إضافة مهلة زمنية صريحة (30 ثانية) لكل من تنزيل الصوت واستدعاء
 *    خدمة التفريغ، بحيث يصل المستخدم دائماً رد واضح بدل الانتظار للأبد.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", N = "\x1b[0m";
const ok = (m) => console.log(G + "✅ " + m + N);
const wrn = (m) => console.log(Y + "⚠️  " + m + N);

if (!fs.existsSync(FILE)) { console.error("dist/index.mjs غير موجود"); process.exit(1); }
let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

const GUARD = "// PATCH_FIX_VOICE_AUDIO_APPLIED_v1";
if (code.includes(GUARD)) {
  ok("patch-fix-voice-audio: مُطبَّق مسبقاً — تخطّي");
  process.exit(0);
}

const OLD_STT = `        // PATCH_VOICE_CONVERT_APPLIED_v1
        // ─── صوت←نص: رد على رسالة صوتية مقتبسة بأمر sttCmd (افتراضي /نص) ───
        if ((myS.sttEnabled ?? true) && trimmed === (myS.sttCmd || "/نص")) {
          try {
            const ctxInfoStt = msg.message?.extendedTextMessage?.contextInfo;
            const quotedStt = ctxInfoStt?.quotedMessage;
            const quotedAudio = quotedStt?.audioMessage;
            if (!quotedAudio) {
              await activeSock.sendMessage(jid, { text: \`⚠️ رد على رسالة صوتية أولاً ثم أرسل \${myS.sttCmd || "/نص"}\` });
            } else {
              await activeSock.sendMessage(jid, { text: "🎙️ جارٍ تفريغ الرسالة الصوتية..." });
              const quotedMsgForStt = {
                key: {
                  remoteJid: jid,
                  fromMe: ctxInfoStt?.participant ? ctxInfoStt.participant === activeSock.user?.id?.split(":")[0] + "@s.whatsapp.net" : false,
                  id: ctxInfoStt?.stanzaId || ctxInfoStt?.quotedMessageId || "",
                  participant: ctxInfoStt?.participant
                },
                message: quotedStt
              };
              const { downloadMediaMessage: downloadMediaMessageStt } = await Promise.resolve().then(() => (init_lib6(), lib_exports4));
              const audioBuf = await downloadMediaMessageStt(
                quotedMsgForStt,
                "buffer",
                {},
                { logger: baileysLogger, reuploadRequest: activeSock.updateMediaMessage }
              );
              const { speechToText } = await import("./services/media/freetts-stt-client.mjs");
              const sttResult = await speechToText(audioBuf, { mimetype: quotedAudio.mimetype || "audio/ogg", language: "auto" });
              if (!sttResult.ok) {
                await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر تفريغ الصوت: \${sttResult.error}\` }, { quoted: msg });
              } else {
                let edited = false;
                try {
                  if (quotedMsgForStt.key.fromMe && quotedMsgForStt.key.id) {
                    await activeSock.sendMessage(jid, { text: sttResult.text, edit: quotedMsgForStt.key });
                    edited = true;
                  }
                } catch (editErr) {
                  logger.warn({ editErr }, "[/نص] edit failed, falling back to reply");
                }
                if (!edited) {
                  await activeSock.sendMessage(jid, { text: \`📝 *النص المُفرَّغ:*
\${sttResult.text}\` }, { quoted: msg });
                }
              }
            }
          } catch (e) {
            logger.warn({ e }, "[/نص] stt failed");
            try {
              await activeSock.sendMessage(jid, { text: "⚠️ تعذّر تحويل الصوت إلى نص" });
            } catch {
            }
          }
          continue;
        }
        // ─── نص←صوت: رد على رسالة نصية مقتبسة بأمر ttsCmd (افتراضي /صوت) ───
        if ((myS.ttsEnabled ?? true) && trimmed === (myS.ttsCmd || "/صوت")) {
          try {
            const ctxInfoTts = msg.message?.extendedTextMessage?.contextInfo;
            const quotedTts = ctxInfoTts?.quotedMessage;
            const qTtsText = quotedTts?.conversation || quotedTts?.extendedTextMessage?.text || quotedTts?.ephemeralMessage?.message?.conversation || quotedTts?.ephemeralMessage?.message?.extendedTextMessage?.text || null;
            if (!qTtsText) {
              await activeSock.sendMessage(jid, { text: \`⚠️ رد على رسالة نصية أولاً ثم أرسل \${myS.ttsCmd || "/صوت"}\` });
            } else {
              await activeSock.sendMessage(jid, { text: "🔊 جارٍ تحويل النص إلى صوت..." });
              const { textToSpeech } = await import("./services/media/freetts-tts-client.mjs");
              const ttsResult = await textToSpeech(qTtsText);
              if (!ttsResult.ok) {
                await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر توليد الصوت: \${ttsResult.error}\` }, { quoted: msg });
              } else {
                await activeSock.sendMessage(jid, { audio: ttsResult.buffer, mimetype: "audio/mp4", ptt: true }, { quoted: msg });
              }
            }
          } catch (e) {
            logger.warn({ e }, "[/صوت] tts failed");
            try {
              await activeSock.sendMessage(jid, { text: "⚠️ تعذّر تحويل النص إلى صوت" });
            } catch {
            }
          }
          continue;
        }`;

const NEW_STT = `${GUARD}
        function _withTimeoutPatchVA(promise, ms, label) {
          return Promise.race([
            promise,
            new Promise((_, rej) => setTimeout(() => rej(new Error(\`\${label} تجاوز الوقت المسموح (\${Math.round(ms / 1e3)} ثانية)\`)), ms))
          ]);
        }
        // ─── صوت←نص: رد على رسالة صوتية مقتبسة بأمر sttCmd (افتراضي /نص) ───
        if ((myS.sttEnabled ?? true) && trimmed === (myS.sttCmd || "/نص")) {
          try {
            const ctxInfoStt = msg.message?.extendedTextMessage?.contextInfo;
            const quotedStt = ctxInfoStt?.quotedMessage;
            const quotedAudio = quotedStt?.audioMessage;
            if (!quotedAudio) {
              await activeSock.sendMessage(jid, { text: \`⚠️ رد على رسالة صوتية أولاً ثم أرسل \${myS.sttCmd || "/نص"}\` });
            } else {
              await activeSock.sendMessage(jid, { text: "🎙️ جارٍ تفريغ الرسالة الصوتية..." });
              const quotedMsgForStt = {
                key: {
                  remoteJid: jid,
                  fromMe: ctxInfoStt?.participant ? ctxInfoStt.participant === activeSock.user?.id?.split(":")[0] + "@s.whatsapp.net" : false,
                  id: ctxInfoStt?.stanzaId || ctxInfoStt?.quotedMessageId || "",
                  participant: ctxInfoStt?.participant
                },
                message: quotedStt
              };
              const { downloadMediaMessage: downloadMediaMessageStt } = await Promise.resolve().then(() => (init_lib6(), lib_exports4));
              let audioBuf;
              try {
                audioBuf = await _withTimeoutPatchVA(
                  downloadMediaMessageStt(
                    quotedMsgForStt,
                    "buffer",
                    {},
                    { logger: baileysLogger, reuploadRequest: activeSock.updateMediaMessage }
                  ),
                  3e4,
                  "تنزيل الرسالة الصوتية"
                );
              } catch (dlErr) {
                logger.warn({ dlErr }, "[/نص] download failed/timeout");
                await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر تنزيل الرسالة الصوتية من واتساب: \${String(dlErr?.message || dlErr)}\n\u062C\u0631\u0651\u0628 \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 \u062D\u062F\u064A\u062B\u0629 (\u0642\u062F \u062A\u0643\u0648\u0646 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647\u0627 \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0642\u062F\u064A\u0645\u0629)\` }, { quoted: msg });
                audioBuf = null;
              }
              if (audioBuf) {
                const { speechToText } = await import("./services/media/freetts-stt-client.mjs");
                const sttResult = await _withTimeoutPatchVA(
                  speechToText(audioBuf, { mimetype: quotedAudio.mimetype || "audio/ogg", language: "auto" }),
                  3e4,
                  "خدمة تفريغ الصوت"
                ).catch((e) => ({ ok: false, error: String(e?.message || e) }));
                if (!sttResult.ok) {
                  await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر تفريغ الصوت: \${sttResult.error}\` }, { quoted: msg });
                } else {
                  let edited = false;
                  try {
                    if (quotedMsgForStt.key.fromMe && quotedMsgForStt.key.id) {
                      await activeSock.sendMessage(jid, { text: sttResult.text, edit: quotedMsgForStt.key });
                      edited = true;
                    }
                  } catch (editErr) {
                    logger.warn({ editErr }, "[/نص] edit failed, falling back to reply");
                  }
                  if (!edited) {
                    await activeSock.sendMessage(jid, { text: \`📝 *النص المُفرَّغ:*
\${sttResult.text}\` }, { quoted: msg });
                  }
                }
              }
            }
          } catch (e) {
            logger.warn({ e }, "[/نص] stt failed");
            try {
              await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر تحويل الصوت إلى نص: \${String(e?.message || e)}\` });
            } catch {
            }
          }
          continue;
        }
        // ─── نص←صوت: "/صوت <نص>" مباشرة، أو رد على رسالة نصية بـ "/صوت" فقط ───
        if ((myS.ttsEnabled ?? true) && (trimmed === (myS.ttsCmd || "/صوت") || trimmed.startsWith((myS.ttsCmd || "/صوت") + " "))) {
          try {
            const ttsCmdPatchVA = myS.ttsCmd || "/صوت";
            const directTtsText = trimmed.startsWith(ttsCmdPatchVA + " ") ? trimmed.slice(ttsCmdPatchVA.length + 1).trim() : null;
            const ctxInfoTts = msg.message?.extendedTextMessage?.contextInfo;
            const quotedTts = ctxInfoTts?.quotedMessage;
            const qTtsText = quotedTts?.conversation || quotedTts?.extendedTextMessage?.text || quotedTts?.ephemeralMessage?.message?.conversation || quotedTts?.ephemeralMessage?.message?.extendedTextMessage?.text || null;
            const finalTtsText = directTtsText || qTtsText;
            if (!finalTtsText) {
              await activeSock.sendMessage(jid, { text: \`⚠️ اكتب النص مباشرة بعد الأمر مثل: \${ttsCmdPatchVA} مرحبا كيف حالك\n\u0623\u0648 \u0631\u062F عل\u0649 رسالة نصية بـ \${ttsCmdPatchVA} \u0641\u0642\u0637\` });
            } else {
              await activeSock.sendMessage(jid, { text: "🔊 جارٍ تحويل النص إلى صوت..." });
              const { textToSpeech } = await import("./services/media/freetts-tts-client.mjs");
              const ttsResult = await _withTimeoutPatchVA(textToSpeech(finalTtsText), 3e4, "خدمة تحويل النص إلى صوت").catch((e) => ({ ok: false, error: String(e?.message || e) }));
              if (!ttsResult.ok) {
                await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر توليد الصوت: \${ttsResult.error}\` }, { quoted: msg });
              } else {
                const { convertToWhatsappOpus } = await import("./services/media/audio-converter.mjs");
                const opusResult = await convertToWhatsappOpus(ttsResult.buffer);
                if (opusResult.ok) {
                  await activeSock.sendMessage(jid, { audio: opusResult.buffer, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
                } else {
                  logger.warn({ err: opusResult.error }, "[/صوت] ffmpeg conversion failed, sending raw mp3 (non-ptt)");
                  await activeSock.sendMessage(jid, { audio: ttsResult.buffer, mimetype: "audio/mpeg", ptt: false }, { quoted: msg });
                }
              }
            }
          } catch (e) {
            logger.warn({ e }, "[/صوت] tts failed");
            try {
              await activeSock.sendMessage(jid, { text: \`⚠️ تعذّر تحويل النص إلى صوت: \${String(e?.message || e)}\` });
            } catch {
            }
          }
          continue;
        }`;

patch(OLD_STT, NEW_STT, "إصلاح صيغة الصوت الحقيقية (OGG/Opus) + دعم /صوت المباشر + مهلة زمنية لتفريغ الصوت");

if (patches === 0) {
  wrn("patch-fix-voice-audio: لم يُطبَّق أي تعديل");
  process.exit(0);
}

fs.writeFileSync(FILE, code, "utf-8");
ok(`patch-fix-voice-audio: تم تطبيق ${patches} تعديل بنجاح`);
