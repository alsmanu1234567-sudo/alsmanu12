#!/usr/bin/env node
// tests/run-all.mjs
// Test Runner — يشغّل جميع الاختبارات ويطبع تقريراً شاملاً

import { execSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function banner(title) {
  const line = '═'.repeat(58);
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${line}${RESET}`);
}

function section(title) {
  console.log(`\n${BOLD}── ${title} ──${RESET}`);
}

let totalPassed = 0;
let totalFailed = 0;
let totalSuites  = 0;
let failedSuites = [];
const startTime  = Date.now();

function runTestFile(filePath, label) {
  totalSuites++;
  const rel = filePath.replace(ROOT + '/', '');
  process.stdout.write(`  ${CYAN}▶${RESET} ${label || rel} ... `);

  const result = spawnSync(
    'node',
    ['--test', '--test-force-exit', filePath],
    {
      cwd:     ROOT,
      timeout: 60_000,
      encoding: 'utf8',
    }
  );

  const output  = (result.stdout || '') + (result.stderr || '');
  // node:test يطبع "ℹ pass N" أو "# pass N" (حسب الإصدار)
  const passed  = parseInt(output.match(/(?:ℹ|#) pass\s+(\d+)/)?.[1] || '0');
  const failed  = parseInt(output.match(/(?:ℹ|#) fail\s+(\d+)/)?.[1] || '0');
  const skipped = parseInt(output.match(/(?:ℹ|#) skip\s+(\d+)/)?.[1] || '0');

  totalPassed += parseInt(passed) || 0;
  totalFailed += parseInt(failed) || 0;

  if (result.status === 0) {
    console.log(`${GREEN}✅ PASS${RESET} (${passed} tests)`);
  } else {
    console.log(`${RED}❌ FAIL${RESET} (${failed} failed)`);
    failedSuites.push({ label: label || rel, output });
  }

  return result.status === 0;
}

// ──────────────────────────────────────────────────────────────────
banner('Phase 12 — Test Suite Runner');
console.log(`  Node.js ${process.version} | ${new Date().toISOString()}`);

// ─── 1. Static Analysis (Quality Gate) ───────────────────────────
section('1. Static Analysis');
{
  process.stdout.write(`  ${CYAN}▶${RESET} Quality Gate ... `);
  const r = spawnSync('node', [join(__dirname, 'static/quality-gate.mjs')], {
    cwd: ROOT, timeout: 30_000, encoding: 'utf8'
  });
  const passed = (r.stdout || '').match(/✅ Passed: (\d+)/)?.[1] || '0';
  const failed = (r.stdout || '').match(/❌ Failed: (\d+)/)?.[1] || '0';
  totalPassed += parseInt(passed);
  totalFailed += parseInt(failed);
  totalSuites++;
  if (r.status === 0) {
    console.log(`${GREEN}✅ PASS${RESET} (${passed} checks)`);
  } else {
    console.log(`${RED}❌ FAIL${RESET} (${failed} checks failed)`);
    failedSuites.push({ label: 'Quality Gate', output: r.stdout + r.stderr });
  }
}

// ─── 2. Unit Tests — Services ─────────────────────────────────────
section('2. Unit Tests — Services');
const servicesDir = join(__dirname, 'unit/services');
const serviceFiles = readdirSync(servicesDir).filter(f => f.endsWith('.test.mjs'));
for (const f of serviceFiles.sort()) {
  runTestFile(join(servicesDir, f), `unit/services/${f}`);
}

// ─── 3. Unit Tests — Core ─────────────────────────────────────────
section('3. Unit Tests — Core');
const unitDir = join(__dirname, 'unit');
const unitFiles = readdirSync(unitDir).filter(f => f.endsWith('.test.mjs'));
for (const f of unitFiles.sort()) {
  runTestFile(join(unitDir, f), `unit/${f}`);
}

// ─── 4. Integration Tests ─────────────────────────────────────────
section('4. Integration Tests');
const integrationDir = join(__dirname, 'integration');
const integFiles = readdirSync(integrationDir).filter(f => f.endsWith('.test.mjs'));
for (const f of integFiles.sort()) {
  runTestFile(join(integrationDir, f), `integration/${f}`);
}

// ─── 5. Performance Tests ─────────────────────────────────────────
section('5. Performance Tests');
runTestFile(join(__dirname, 'perf/performance.test.mjs'), 'perf/performance.test.mjs');

// ─── 6. Legacy Validate Engine ────────────────────────────────────
section('6. Engine Tests (Legacy)');
{
  process.stdout.write(`  ${CYAN}▶${RESET} validate-engine.mjs ... `);
  const r = spawnSync('node', [join(ROOT, 'tests/validate-engine.mjs')], {
    cwd: ROOT, timeout: 60_000, encoding: 'utf8'
  });
  totalSuites++;
  if (r.status === 0) {
    const passMatch = (r.stdout || '').match(/PASSED[:\s]+(\d+)/i);
    const p = passMatch?.[1] || '?';
    console.log(`${GREEN}✅ PASS${RESET} (${p} tests)`);
    totalPassed += parseInt(p) || 0;
  } else {
    console.log(`${RED}❌ FAIL${RESET}`);
    failedSuites.push({ label: 'validate-engine', output: r.stdout + r.stderr });
    totalFailed++;
  }
}

// ─── Summary ──────────────────────────────────────────────────────
const duration = ((Date.now() - startTime) / 1000).toFixed(1);
banner('النتائج النهائية');
console.log(`  ⏱  الوقت:         ${duration}s`);
console.log(`  📦 Suites:        ${totalSuites}`);
console.log(`  ${GREEN}✅ Passed:${RESET}        ${totalPassed}`);
console.log(`  ${totalFailed > 0 ? RED : GREEN}❌ Failed:${RESET}        ${totalFailed}`);

if (failedSuites.length > 0) {
  console.log(`\n${RED}${BOLD}── الاختبارات الفاشلة ────────────────────────────────────${RESET}`);
  for (const s of failedSuites) {
    console.log(`\n  ${RED}❌ ${s.label}${RESET}`);
    const lines = (s.output || '').split('\n').filter(l =>
      l.includes('fail') || l.includes('Error') || l.includes('❌') || l.includes('AssertionError')
    ).slice(0, 10);
    for (const l of lines) {
      console.log(`     ${l}`);
    }
  }
}

console.log('\n' + '═'.repeat(60));
if (totalFailed === 0) {
  console.log(`${GREEN}${BOLD}  🎉 جميع الاختبارات نجحت — Phase 12 PASSED${RESET}`);
} else {
  console.log(`${RED}${BOLD}  💥 ${totalFailed} فشل — راجع التفاصيل أعلاه${RESET}`);
}
console.log('═'.repeat(60) + '\n');

process.exit(totalFailed > 0 ? 1 : 0);
