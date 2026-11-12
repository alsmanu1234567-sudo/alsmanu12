#!/usr/bin/env node
// tests/static/quality-gate.mjs
// Static Analysis & Quality Gate
// يمنع الدمج إذا: وجد import مكسور، plugins مكررة، handler بدون manifest، ...

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const DIST = join(ROOT, 'dist');
const HANDLERS = join(DIST, 'handlers');
const SERVICES = join(DIST, 'services');
const PLUGINS = join(DIST, 'plugins');

let passed = 0;
let failed = 0;
const failures = [];

function pass(check) {
  console.log(`  ✅ ${check}`);
  passed++;
}

function fail(check, reason) {
  console.log(`  ❌ ${check}: ${reason}`);
  failed++;
  failures.push({ check, reason });
}

function section(title) {
  console.log(`\n── ${title} ────────────────────────────────`);
}

// ─── 1. Critical Files Exist ─────────────────────────────────────
section('1. ملفات أساسية');

const REQUIRED_FILES = [
  'dist/index.mjs',
  'dist/plugins/plugin-loader.mjs',
  'dist/plugins/plugin-registry.mjs',
  'dist/handlers/registry.mjs',
  'dist/message-router.mjs',
  'dist/dispatcher.mjs',
  'dist/worker-manager.mjs',
  'dist/text-handler.mjs',
  'dist/callback-handler.mjs',
  'bootstrap/index.mjs',
  'startup.mjs',
];

for (const f of REQUIRED_FILES) {
  if (existsSync(join(ROOT, f))) {
    pass(`موجود: ${f}`);
  } else {
    fail(`ملف مفقود`, f);
  }
}

// ─── 2. Plugin Manifests ─────────────────────────────────────────
section('2. Plugin Manifests');

const NON_PLUGIN_HANDLERS = new Set([
  'state-switch-handler.mjs',
  'payment-handler.mjs',
  'media-handler.mjs',
  'document-handler.mjs',
  'forward-hook.mjs',
  'registry.mjs',
]);

const handlerFiles = (await readdir(HANDLERS)).filter(f => f.endsWith('.mjs'));
const pluginNames = [];
let pluginCount = 0;

for (const file of handlerFiles) {
  if (NON_PLUGIN_HANDLERS.has(file)) continue;
  try {
    const mod = await import(join(HANDLERS, file));
    if (!mod.pluginManifest) {
      fail(`بدون pluginManifest`, file);
      continue;
    }
    if (!mod.pluginManifest.name) {
      fail(`manifest.name مفقود`, file);
      continue;
    }
    if (typeof mod.setDeps !== 'function') {
      fail(`setDeps مفقودة`, file);
      continue;
    }
    if (typeof mod.handleText !== 'function' && typeof mod.handleCallback !== 'function') {
      fail(`handleText/handleCallback مفقودة`, file);
      continue;
    }
    pluginNames.push(mod.pluginManifest.name);
    pluginCount++;
    pass(`handler صحيح: ${file} (${mod.pluginManifest.name})`);
  } catch (e) {
    fail(`import مكسور`, `${file}: ${e.message.slice(0, 80)}`);
  }
}

// ─── 3. Duplicate Plugins ─────────────────────────────────────────
section('3. Plugins مكررة');

const uniqueNames = new Set(pluginNames);
if (uniqueNames.size === pluginNames.length) {
  pass(`لا plugins مكررة (${pluginNames.length} plugin)`);
} else {
  const dups = pluginNames.filter((n, i) => pluginNames.indexOf(n) !== i);
  fail('plugins مكررة', dups.join(', '));
}

// ─── 4. Plugin Count ──────────────────────────────────────────────
section('4. عدد الـ Plugins');

if (pluginCount === 18) {
  pass(`عدد صحيح: 18 plugin`);
} else {
  fail(`عدد خاطئ`, `وجد ${pluginCount} بدلاً من 18`);
}

// ─── 5. Services Integrity ────────────────────────────────────────
section('5. Services');

async function checkServicesDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await checkServicesDir(fullPath);
    } else if (entry.name.endsWith('.mjs')) {
      try {
        const mod = await import(fullPath);
        const exports = Object.keys(mod);
        if (exports.length === 0) {
          fail(`service بدون exports`, entry.name);
        } else {
          pass(`service صحيحة: ${entry.name} (${exports.length} export)`);
        }
      } catch (e) {
        fail(`import مكسور`, `${entry.name}: ${e.message.slice(0, 80)}`);
      }
    }
  }
}
await checkServicesDir(SERVICES);

// ─── 6. Plugin System Files ───────────────────────────────────────
section('6. Plugin System Files');

const pluginFiles = await readdir(PLUGINS);
const expectedPluginFiles = ['plugin-loader.mjs', 'plugin-registry.mjs'];
for (const f of expectedPluginFiles) {
  if (pluginFiles.includes(f)) {
    pass(`موجود: plugins/${f}`);
  } else {
    fail(`مفقود`, `plugins/${f}`);
  }
}

// ─── 7. Non-Plugin Handlers have setDeps ─────────────────────────
section('7. Non-Plugin Handlers');

const NON_PLUGIN_CHECK = ['state-switch-handler.mjs', 'payment-handler.mjs', 'media-handler.mjs', 'document-handler.mjs'];
for (const file of NON_PLUGIN_CHECK) {
  const fPath = join(HANDLERS, file);
  if (!existsSync(fPath)) { pass(`اختياري: ${file}`); continue; }
  try {
    const mod = await import(fPath);
    if (typeof mod.setDeps === 'function') {
      pass(`setDeps موجودة: ${file}`);
    } else {
      fail(`setDeps مفقودة`, file);
    }
  } catch (e) {
    fail(`import مكسور`, `${file}: ${e.message.slice(0,80)}`);
  }
}

// ─── 8. Circular Imports Check (heuristic) ────────────────────────
section('8. Circular Imports (heuristic)');

// نفحص أن plugin-registry لا تستورد من plugin-loader (دائرة)
const regContent = await readFile(join(PLUGINS, 'plugin-registry.mjs'), 'utf8');
if (!regContent.includes('plugin-loader')) {
  pass('plugin-registry لا تستورد plugin-loader (لا دائرية)');
} else {
  fail('circular import محتمل', 'plugin-registry تستورد plugin-loader');
}

// نفحص أن handlers لا تستورد من index.mjs مباشرة
let indexImports = 0;
for (const file of handlerFiles) {
  const content = await readFile(join(HANDLERS, file), 'utf8');
  if (content.includes("from '../index.mjs'") || content.includes('from "../index.mjs"')) {
    indexImports++;
    fail(`import مباشر من index.mjs`, file);
  }
}
if (indexImports === 0) {
  pass('لا handler تستورد من index.mjs مباشرة');
}

// ─── 9. dist/index.mjs Exists and is Non-Empty ───────────────────
section('9. dist/index.mjs');

const indexPath = join(DIST, 'index.mjs');
if (existsSync(indexPath)) {
  const stat = await readFile(indexPath, 'utf8');
  if (stat.length > 1000) {
    pass(`dist/index.mjs موجود وليس فارغاً (${Math.round(stat.length/1024)}KB)`);
  } else {
    fail('dist/index.mjs صغير جداً', `${stat.length} حرف`);
  }
} else {
  fail('dist/index.mjs مفقود', 'الملف الرئيسي للبوت غير موجود');
}

// ─── 10. startup.mjs integrity ────────────────────────────────────
section('10. startup.mjs');

const startupContent = await readFile(join(ROOT, 'startup.mjs'), 'utf8');
if (startupContent.includes('bootstrap')) {
  pass('startup.mjs يستدعي bootstrap');
} else {
  fail('startup.mjs لا يستدعي bootstrap', 'خطأ معماري');
}

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`  Quality Gate Results`);
console.log('═'.repeat(50));
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\n  الإخفاقات:');
  for (const f of failures) {
    console.log(`    • ${f.check}: ${f.reason}`);
  }
}
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n  🎉 Quality Gate: PASSED');
}
