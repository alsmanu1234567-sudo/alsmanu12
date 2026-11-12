#!/usr/bin/env node
/**
 * patch-voice-convert.mjs — إضافة ميزتَي التحويل الصوتي في قسم "رسائلي":
 *  - myS.sttCmd (افتراضي: /نص)  — رد على رسالة صوتية مقتبسة → تفريغ نصي (كشف تلقائي عربي/إنجليزي/فرنسي)
 *  - myS.ttsCmd (افتراضي: /صوت) — رد على رسالة نصية مقتبسة → رسالة صوتية (تحويل نص لصوت)
 * يعتمد على dist/services/media/freetts-stt-client.mjs و freetts-tts-client.mjs
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

const GUARD = "// PATCH_VOICE_CONVERT_APPLIED_v1";
if (code.includes(GUARD)) {
  ok("patch-voice-convert: مُطبَّق مسبقاً — تخطّي");
  process.exit(0);
}

const ANCHOR = `          } catch (e) {
            logger.warn({ e }, "[/copy] failed");
            try {
              await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u062A\\u0639\\u0630\\u0651\\u0631\\u062A \\u0625\\u0639\\u0627\\u062F\\u0629 \\u0627\\u0644\\u0625\\u0631\\u0633\\u0627\\u0644" });
            } catch {
            }
          }
          continue;
        }`;

const NEW_HANDLERS = `          } catch (e) {
            logger.warn({ e }, "[/copy] failed");
            try {
              await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u062A\\u0639\\u0630\\u0651\\u0631\\u062A \\u0625\\u0639\\u0627\\u062F\\u0629 \\u0627\\u0644\\u0625\\u0631\\u0633\\u0627\\u0644" });
            } catch {
            }
          }
          continue;
        }
        ${GUARD}
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
                  await activeSock.sendMessage(jid, { text: \`📝 *النص المُفرَّغ:*\n\${sttResult.text}\` }, { quoted: msg });
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

patch(ANCHOR, NEW_HANDLERS, "إضافة أوامر صوت←نص ونص←صوت في رسائلي");

if (patches === 0) {
  wrn("patch-voice-convert: لم يُطبَّق أي تعديل");
  process.exit(0);
}

fs.writeFileSync(FILE, code, "utf-8");
ok(`patch-voice-convert: تم تطبيق ${patches} تعديل بنجاح`);
