// tests/integration/freetts-tts-live.test.mjs
// اختبار حي (شبكة حقيقية): تحويل نص إلى صوت عبر FreeTTS.org والتأكد من صيغة الملف الناتج.
// يُشغَّل يدوياً: node --test tests/integration/freetts-tts-live.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textToSpeech } from '../../dist/services/media/freetts-tts-client.mjs';

function looksLikeMp3(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // ID3 tag أو MPEG frame sync (0xFFFB / 0xFFF3 ...)
  const hasId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

test('[LIVE] textToSpeech: نص عربي → mp3 صالح', { timeout: 30000 }, async () => {
  const result = await textToSpeech('مرحباً، هذه رسالة تجريبية للتحقق من تحويل النص إلى صوت.', { lang: 'ar' });
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  assert.ok(looksLikeMp3(result.buffer), 'يجب أن يكون الناتج ملف mp3 صالح');
  assert.ok(result.buffer.length > 1000, 'يجب أن يكون حجم الصوت معقولاً وليس فارغاً');
});

test('[LIVE] textToSpeech: نص إنجليزي → mp3 صالح', { timeout: 30000 }, async () => {
  const result = await textToSpeech('Hello, this is a test message for text to speech conversion.', { lang: 'en' });
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  assert.ok(looksLikeMp3(result.buffer), 'يجب أن يكون الناتج ملف mp3 صالح');
});

test('[LIVE] textToSpeech: نص فرنسي → mp3 صالح', { timeout: 30000 }, async () => {
  const result = await textToSpeech('Bonjour, ceci est un message de test pour la synthèse vocale.', { lang: 'fr' });
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  assert.ok(looksLikeMp3(result.buffer), 'يجب أن يكون الناتج ملف mp3 صالح');
});

test('[LIVE] textToSpeech: نص فارغ يُرفض محلياً بدون طلب شبكة', async () => {
  const result = await textToSpeech('   ');
  assert.equal(result.ok, false);
  assert.match(result.error, /فارغ/);
});
