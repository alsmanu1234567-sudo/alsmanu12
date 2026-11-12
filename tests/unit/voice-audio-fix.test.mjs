// tests/unit/voice-audio-fix.test.mjs
// يتحقق من إصلاح مشاكل حقيقية اكتُشفت بالاختبار الفعلي في ميزتَي التحويل الصوتي:
//  1) الصوت الناتج (/صوت) كان يصل تالفاً لواتساب لأنه mp3 حقيقي بمسمى mimetype خاطئ.
//  2) /صوت كان يتطلب دائماً الرد على رسالة، لا يقبل نصاً مباشراً بعد الأمر.
//  3) /نص (تفريغ الصوت) كان يمكن أن يعلّق للأبد بلا مهلة زمنية عند فشل التنزيل.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function readIndexSource() {
  return fs.readFileSync(path.join(ROOT, 'dist', 'index.mjs'), 'utf-8');
}

test('guard الإصلاح مطبَّق في dist/index.mjs', () => {
  const code = readIndexSource();
  assert.match(code, /PATCH_FIX_VOICE_AUDIO_APPLIED_v1/);
});

test('الصوت يُحوَّل إلى OGG/Opus حقيقي قبل الإرسال كـ ptt', () => {
  const code = readIndexSource();
  assert.match(code, /convertToWhatsappOpus/);
  assert.match(code, /audio\/ogg; codecs=opus/);
});

test('/صوت يقبل نصاً مباشراً بعد الأمر بدون اشتراط الرد', () => {
  const code = readIndexSource();
  assert.match(code, /trimmed\.startsWith\(\(myS\.ttsCmd \|\| "\/صوت"\) \+ " "\)/);
  assert.match(code, /directTtsText/);
});

test('/نص يستخدم مهلة زمنية صريحة عند تنزيل الصوت وتفريغه', () => {
  const code = readIndexSource();
  assert.match(code, /_withTimeoutPatchVA/);
  assert.match(code, /"تنزيل الرسالة الصوتية"/);
  assert.match(code, /"خدمة تفريغ الصوت"/);
});

test('ملف audio-converter.mjs موجود ويصدّر convertToWhatsappOpus', async () => {
  const filePath = path.join(ROOT, 'dist', 'services', 'media', 'audio-converter.mjs');
  assert.ok(fs.existsSync(filePath));
  const mod = await import(filePath);
  assert.equal(typeof mod.convertToWhatsappOpus, 'function');
});

test('convertToWhatsappOpus يحوّل mp3 حقيقي إلى Opus/OGG حقيقي (اختبار فعلي بالبيانات الثنائية)', async () => {
  const { textToSpeech } = await import(path.join(ROOT, 'dist', 'services', 'media', 'freetts-tts-client.mjs'));
  const { convertToWhatsappOpus } = await import(path.join(ROOT, 'dist', 'services', 'media', 'audio-converter.mjs'));

  const ttsResult = await textToSpeech('اختبار تحويل النص إلى صوت');
  assert.equal(ttsResult.ok, true, 'يجب أن تنجح خدمة FreeTTS.org الفعلية');
  assert.ok(ttsResult.buffer.length > 0);
  // يجب أن يكون الناتج الخام فعلاً mp3 (ID3/MPEG) قبل التحويل
  assert.equal(ttsResult.buffer.slice(0, 3).toString('latin1'), 'ID3');

  const opusResult = await convertToWhatsappOpus(ttsResult.buffer);
  assert.equal(opusResult.ok, true, 'يجب أن ينجح تحويل ffmpeg إلى Opus');
  assert.ok(opusResult.buffer.length > 0);
  // ترويسة ملفات Ogg تبدأ دائماً بـ "OggS"
  assert.equal(opusResult.buffer.slice(0, 4).toString('latin1'), 'OggS');
});

test('speechToText يفرّغ صوتاً حقيقياً بنجاح (اختبار فعلي عبر FreeTTS.org)', async () => {
  const { speechToText } = await import(path.join(ROOT, 'dist', 'services', 'media', 'freetts-stt-client.mjs'));
  // نولّد صوتاً حقيقياً أولاً عبر TTS، ثم نحاول تفريغه — اختبار طرف-لطرف كامل بدون واتساب
  const { textToSpeech } = await import(path.join(ROOT, 'dist', 'services', 'media', 'freetts-tts-client.mjs'));
  const ttsResult = await textToSpeech('hello this is a real test');
  assert.equal(ttsResult.ok, true);

  const sttResult = await speechToText(ttsResult.buffer, { mimetype: 'audio/mp3', language: 'auto' });
  assert.equal(sttResult.ok, true, 'يجب أن تنجح خدمة التفريغ مع صوت حقيقي');
  assert.ok(sttResult.text.length > 0, 'يجب أن يعيد نصاً غير فارغ');
});
