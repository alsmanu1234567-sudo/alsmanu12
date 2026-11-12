// tests/unit/bot-username-grant-fix.test.mjs
// يتحقق من إصلاحين حقيقيين اكتُشفا أثناء التشغيل الفعلي للبوت:
//  1) ReferenceError: BOT_USERNAME is not defined (كان يكسر رابط الإحالة وقائمة شراء الميزات)
//  2) /grant_feature كان يقبل أي فئة بصمت ويسقط لحد رقم واحد دون تنبيه المطوّر

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
  assert.match(code, /PATCH_FIX_BOT_USERNAME_GRANT_APPLIED_v1/);
});

test('BOT_USERNAME أصبح متغيّر var على نطاق الوحدة العلوي (وليس const محلي)', () => {
  const code = readIndexSource();
  assert.match(code, /var BOT_USERNAME = "";/);
  assert.match(code, /BOT_USERNAME = _botInfo\.username \|\| '';/);
  assert.doesNotMatch(code, /const BOT_USERNAME = _botInfo\.username \|\| '';/);
});

test('/grant_feature يتحقق من صحة الفئة قبل التفعيل', () => {
  const code = readIndexSource();
  assert.match(code, /if \(!\(feature in TIER_MAX_NUMBERS2\)\)/);
});

test('patch-fix-bot-username-grant.mjs مسجَّل في PATCH_REGISTRY', () => {
  const registry = fs.readFileSync(path.join(ROOT, 'infrastructure', 'patch-manager.mjs'), 'utf-8');
  assert.match(registry, /patch-fix-bot-username-grant\.mjs/);
});
