// tests/unit/services/download-parser.test.mjs
// Unit Tests — download-parser-service (pure functions)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVideoCommand,
  parseAudioCommand,
  parseFilmCommand,
  parseTikTokCommand,
  qualityLabel,
} from '../../../dist/services/download/download-parser-service.mjs';

// ─── parseVideoCommand ────────────────────────────────────────────

test('parseVideoCommand: أمر بسيط بدون معاملات', () => {
  const r = parseVideoCommand('/vid faisal');
  assert.ok(r);
  assert.equal(r.query, 'faisal');
  assert.equal(r.quality, 2);
  assert.equal(r.count, 1);
  assert.equal(r.label, '480p');
});

test('parseVideoCommand: جودة محددة', () => {
  const r = parseVideoCommand('/vid 3 فيروز');
  assert.ok(r);
  assert.equal(r.quality, 3);
  assert.equal(r.label, '720p');
  assert.equal(r.query, 'فيروز');
});

test('parseVideoCommand: جودة وعدد محددان', () => {
  const r = parseVideoCommand('/vid 1 3 شيلة');
  assert.ok(r);
  assert.equal(r.quality, 1);
  assert.equal(r.count, 3);
  assert.equal(r.label, '360p');
  assert.equal(r.query, 'شيلة');
});

test('parseVideoCommand: الحد الأقصى للعدد = 5', () => {
  const r = parseVideoCommand('/vid 2 10 أغنية');
  assert.ok(r);
  assert.equal(r.count, 5);
});

test('parseVideoCommand: بدون نص بحث → null', () => {
  assert.equal(parseVideoCommand('/vid'), null);
});

test('parseVideoCommand: أمر فارغ → null', () => {
  assert.equal(parseVideoCommand('/vid 2'), null);
});

// ─── parseAudioCommand ────────────────────────────────────────────

test('parseAudioCommand: بسيط', () => {
  const r = parseAudioCommand('/song فيروز');
  assert.ok(r);
  assert.equal(r.query, 'فيروز');
  assert.equal(r.count, 1);
});

test('parseAudioCommand: عدد محدد', () => {
  const r = parseAudioCommand('/song 5 أم كلثوم');
  assert.ok(r);
  assert.equal(r.count, 5);
  assert.equal(r.query, 'أم كلثوم');
});

test('parseAudioCommand: الحد الأقصى 10', () => {
  const r = parseAudioCommand('/song 15 test');
  assert.ok(r);
  assert.equal(r.count, 10);
});

test('parseAudioCommand: بدون نص → null', () => {
  assert.equal(parseAudioCommand('/song'), null);
});

// ─── parseFilmCommand ────────────────────────────────────────────

test('parseFilmCommand: فيلم بسيط', () => {
  const r = parseFilmCommand('/film inception');
  assert.ok(r);
  assert.equal(r.query, 'inception');
  assert.equal(r.quality, 2);
});

test('parseFilmCommand: جودة في الآخر', () => {
  const r = parseFilmCommand('/film the godfather 3');
  assert.ok(r);
  assert.equal(r.quality, 3);
  assert.equal(r.query, 'the godfather');
});

test('parseFilmCommand: جودة في الأول', () => {
  const r = parseFilmCommand('/film 1 avengers');
  assert.ok(r);
  assert.equal(r.quality, 1);
  assert.equal(r.query, 'avengers');
});

test('parseFilmCommand: بدون نص → null', () => {
  assert.equal(parseFilmCommand('/film'), null);
});

// ─── parseTikTokCommand ────────────────────────────────────────────

test('parseTikTokCommand: بسيط', () => {
  const r = parseTikTokCommand('/tiktok رقص');
  assert.ok(r);
  assert.equal(r.count, 3);
  assert.equal(r.query, 'رقص');
});

test('parseTikTokCommand: عدد محدد', () => {
  const r = parseTikTokCommand('/tiktok 2 كوميدي');
  assert.ok(r);
  assert.equal(r.count, 2);
});

test('parseTikTokCommand: الحد الأقصى 5', () => {
  const r = parseTikTokCommand('/tiktok 10 test');
  assert.ok(r);
  assert.equal(r.count, 5);
});

test('parseTikTokCommand: بدون نص → null', () => {
  assert.equal(parseTikTokCommand('/tiktok'), null);
});

// ─── qualityLabel ─────────────────────────────────────────────────

test('qualityLabel: جميع القيم', () => {
  assert.equal(qualityLabel(1), 'منخفضة');
  assert.equal(qualityLabel(2), 'متوسطة');
  assert.equal(qualityLabel(3), 'عالية');
  assert.equal(qualityLabel(99), 'متوسطة');
});
