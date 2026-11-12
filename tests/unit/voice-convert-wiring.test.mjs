// tests/unit/voice-convert-wiring.test.mjs
// يتحقق أن تعديل صوت←نص (/نص) ونص←صوت (/صوت) مطبَّق فعلياً في dist/index.mjs
// وأن الإعدادات الافتراضية في قسم "رسائلي" تحتوي على المفاتيح الصحيحة،
// بدون تشغيل الحزمة الكاملة (330 ألف سطر لها آثار جانبية عند الاستيراد).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMyMsgsSettings, saveMyMsgsSettings } from '../../dist/my-msgs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function readIndexSource() {
  return fs.readFileSync(path.join(ROOT, 'dist', 'index.mjs'), 'utf-8');
}

test('dist/index.mjs يحتوي على تعديل صوت←نص/نص←صوت (guard مطبَّق)', () => {
  const code = readIndexSource();
  assert.match(code, /PATCH_VOICE_CONVERT_APPLIED_v1/);
});

test('dist/index.mjs يستورد عملاء FreeTTS من المسار الصحيح', () => {
  const code = readIndexSource();
  assert.match(code, /import\(["']\.\/services\/media\/freetts-stt-client\.mjs["']\)/);
  assert.match(code, /import\(["']\.\/services\/media\/freetts-tts-client\.mjs["']\)/);
});

test('ملفات عملاء FreeTTS موجودة فعلياً في المسار المستورد', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'services', 'media', 'freetts-stt-client.mjs')));
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'services', 'media', 'freetts-tts-client.mjs')));
});

test('patch-voice-convert.mjs مسجَّل في PATCH_REGISTRY', () => {
  const registry = fs.readFileSync(path.join(ROOT, 'infrastructure', 'patch-manager.mjs'), 'utf-8');
  assert.match(registry, /patch-voice-convert\.mjs/);
});

test('إعدادات رسائلي الافتراضية: /نص و /صوت مفعّلتان بالافتراضي', () => {
  const s = getMyMsgsSettings({});
  assert.equal(s.sttEnabled, true);
  assert.equal(s.sttCmd, '/نص');
  assert.equal(s.ttsEnabled, true);
  assert.equal(s.ttsCmd, '/صوت');
});

test('يمكن تعطيل وتخصيص أوامر صوت←نص ونص←صوت وحفظها عبر saveMyMsgsSettings', async () => {
  const users = new Map();
  const { setDeps } = await import('../../dist/my-msgs.mjs');
  setDeps({
    getUser: (id) => users.get(id) || {},
    saveUser: (id, patch) => users.set(id, { ...(users.get(id) || {}), ...patch }),
  });

  const updated = saveMyMsgsSettings('u1', { sttEnabled: false, ttsCmd: '/تكلم' });
  assert.equal(updated.sttEnabled, false);
  assert.equal(updated.ttsCmd, '/تكلم');
  assert.equal(updated.ttsEnabled, true, 'يجب أن تبقى بقية الإعدادات الافتراضية كما هي');
});
