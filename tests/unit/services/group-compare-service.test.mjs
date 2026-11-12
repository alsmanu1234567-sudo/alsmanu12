// tests/unit/services/group-compare-service.test.mjs
// Unit Tests — group-compare-service

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGroupMembers,
  compareGroups,
  formatMembersList,
} from '../../../dist/services/groups/group-compare-service.mjs';

// ─── getGroupMembers ─────────────────────────────────────────────

test('getGroupMembers: يرجع المشاركين', async () => {
  const sock = {
    groupMetadata: async (id) => ({
      participants: [{ id: '1@s' }, { id: '2@s' }]
    })
  };
  const members = await getGroupMembers(sock, 'g1@g.us');
  assert.equal(members.length, 2);
});

test('getGroupMembers: مجموعة فارغة', async () => {
  const sock = { groupMetadata: async () => ({ participants: [] }) };
  const members = await getGroupMembers(sock, 'g@g.us');
  assert.deepEqual(members, []);
});

test('getGroupMembers: groupMetadata=undefined', async () => {
  const members = await getGroupMembers({}, 'g@g.us');
  assert.deepEqual(members, []);
});

// ─── compareGroups ────────────────────────────────────────────────

test('compareGroups: مقارنة صحيحة', async () => {
  const sock = {
    groupMetadata: async (id) => {
      if (id === 'g1') return { participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
      if (id === 'g2') return { participants: [{ id: 'b' }, { id: 'c' }, { id: 'd' }] };
    }
  };
  const r = await compareGroups(sock, 'g1', 'g2');
  assert.deepEqual(r.common.sort(), ['b', 'c']);
  assert.deepEqual(r.only1.sort(), ['a']);
  assert.deepEqual(r.only2.sort(), ['d']);
});

test('compareGroups: مجموعتان متطابقتان', async () => {
  const sock = {
    groupMetadata: async () => ({ participants: [{ id: 'x' }, { id: 'y' }] })
  };
  const r = await compareGroups(sock, 'g1', 'g2');
  assert.equal(r.common.length, 2);
  assert.equal(r.only1.length, 0);
  assert.equal(r.only2.length, 0);
});

test('compareGroups: لا أعضاء مشتركين', async () => {
  const sock = {
    groupMetadata: async (id) => {
      if (id === 'g1') return { participants: [{ id: 'a' }] };
      return { participants: [{ id: 'b' }] };
    }
  };
  const r = await compareGroups(sock, 'g1', 'g2');
  assert.equal(r.common.length, 0);
  assert.equal(r.only1.length, 1);
  assert.equal(r.only2.length, 1);
});

// ─── formatMembersList ────────────────────────────────────────────

test('formatMembersList: تنسيق صحيح', () => {
  const members = [{ id: '966501234567@s.whatsapp.net' }];
  const text = formatMembersList(members);
  assert.ok(text.includes('+966501234567'));
});

test('formatMembersList: يحترم maxDisplay', () => {
  const members = Array.from({ length: 30 }, (_, i) => ({ id: `${i}@s.whatsapp.net` }));
  const text = formatMembersList(members, 5);
  assert.ok(text.includes('25 آخرين'));
});

test('formatMembersList: أقل من maxDisplay', () => {
  const members = [{ id: 'a@s' }, { id: 'b@s' }];
  const text = formatMembersList(members, 20);
  assert.ok(!text.includes('آخرين'));
});
