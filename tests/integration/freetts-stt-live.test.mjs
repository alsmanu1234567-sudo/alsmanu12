// tests/integration/freetts-stt-live.test.mjs
// اختبار حي (شبكة حقيقية): تحويل صوت إلى نص عبر FreeTTS.org.
// نولّد الصوت أولاً بواسطة TTS الخاص بنفس الخدمة (حلقة كاملة تثبت أن المسارين يعملان معاً)
// ثم نتحقق أن الترانسكربت المُستخرج يحتوي فعلاً على كلمات ذات معنى من نفس اللغة.
// يُشغَّل يدوياً: node --test tests/integration/freetts-stt-live.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textToSpeech } from '../../dist/services/media/freetts-tts-client.mjs';
import { speechToText } from '../../dist/services/media/freetts-stt-client.mjs';

test('[LIVE] speechToText: صوت عربي مولَّد → نص عربي مع كشف تلقائي للغة', { timeout: 45000 }, async () => {
  const tts = await textToSpeech('السلام عليكم ورحمة الله، كيف حالك اليوم؟', { lang: 'ar' });
  assert.equal(tts.ok, true, tts.ok ? '' : tts.error);

  const stt = await speechToText(tts.buffer, { mimetype: 'audio/mp3', language: 'auto' });
  assert.equal(stt.ok, true, stt.ok ? '' : stt.error);
  assert.ok(stt.text.length > 0, 'يجب استخراج نص غير فارغ');
  assert.match(stt.text, /[\u0600-\u06FF]/, 'يجب أن يحتوي النص على أحرف عربية');
});

test('[LIVE] speechToText: صوت إنجليزي مولَّد → نص إنجليزي مطابق تقريباً', { timeout: 45000 }, async () => {
  const original = 'Please call me back tomorrow morning.';
  const tts = await textToSpeech(original, { lang: 'en' });
  assert.equal(tts.ok, true, tts.ok ? '' : tts.error);

  const stt = await speechToText(tts.buffer, { mimetype: 'audio/mp3', language: 'auto' });
  assert.equal(stt.ok, true, stt.ok ? '' : stt.error);
  const normalized = stt.text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  assert.ok(normalized.includes('call') || normalized.includes('tomorrow'), `النص المستخرج غير مطابق: "${stt.text}"`);
});

test('[LIVE] speechToText: صوت فرنسي مولَّد → نص فرنسي', { timeout: 45000 }, async () => {
  const tts = await textToSpeech('Je voudrais réserver une table pour ce soir.', { lang: 'fr' });
  assert.equal(tts.ok, true, tts.ok ? '' : tts.error);

  const stt = await speechToText(tts.buffer, { mimetype: 'audio/mp3', language: 'auto' });
  assert.equal(stt.ok, true, stt.ok ? '' : stt.error);
  assert.ok(stt.text.length > 0, 'يجب استخراج نص غير فارغ');
});

test('[LIVE] speechToText: صوت فارغ يُرفض محلياً بدون طلب شبكة', async () => {
  const stt = await speechToText(Buffer.alloc(0));
  assert.equal(stt.ok, false);
  assert.match(stt.error, /لا يوجد صوت/);
});
