/**
 * engine/rules-cache.mjs — v2
 * ─────────────────────────────────────────────────────────────────
 * كاش في الذاكرة لقواعد التحويل — يقضي على readFileSync على كل رسالة.
 *
 * التطويرات v2:
 *  • polling fallback كل 60 ثانية (حماية ضد أحداث fs.watch الفائتة)
 *  • getCacheStats() — إحصائيات صحة الكاش (آخر تحميل، عدد القراءات، عدد القواعد)
 *  • كشف إنشاء الملف بعد التهيئة (مراقبة المجلد عند غياب الملف)
 *  • _watchFile مُحسَّن: يُعيد المراقبة عند إنشاء الملف من جديد
 *
 * Exports:
 *   getRules()       → ForwardRule[]
 *   getChats()       → { groups, channels }
 *   invalidate()     → void
 *   initRulesCache() → void
 *   getCacheStats()  → object
 */

import { readFileSync, watch, existsSync, mkdirSync } from "fs";
import { dirname }                                     from "path";

// ── حالة داخلية ──────────────────────────────────────────────────
let _rules       = [];
let _chats       = { groups: [], channels: [] };
let _rulesFile   = null;
let _chatsFile   = null;
let _initialized = false;

// طوابير debounce
let _rulesTimer  = null;
let _chatsTimer  = null;
const DEBOUNCE_MS    = 500;
const POLL_INTERVAL  = 60_000; // fallback polling كل دقيقة

// إحصائيات
let _hitCount       = 0;
let _lastReloadTime = null;
let _reloadCount    = 0;
let _initTime       = null;

// ── قراءة آمنة ───────────────────────────────────────────────────

function _readRules() {
  if (!_rulesFile || !existsSync(_rulesFile)) { _rules = []; return false; }
  try {
    const raw    = readFileSync(_rulesFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) { _rules = parsed; _lastReloadTime = Date.now(); _reloadCount++; return true; }
  } catch { /* ملف تالف — نحتفظ بالقيمة السابقة */ }
  return false;
}

function _readChats() {
  if (!_chatsFile || !existsSync(_chatsFile)) { _chats = { groups: [], channels: [] }; return false; }
  try {
    const raw    = readFileSync(_chatsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") { _chats = parsed; _lastReloadTime = Date.now(); _reloadCount++; return true; }
  } catch { /* نحتفظ بالقيمة السابقة */ }
  return false;
}

// ── API عام ──────────────────────────────────────────────────────

/** O(1) — بدون disk I/O */
export function getRules()  { _hitCount++; return _rules; }

/** O(1) — بدون disk I/O */
export function getChats()  { return _chats; }

/** إعادة القراءة الفورية (بعد saveRules/saveChats مباشرةً). */
export function invalidate() { _readRules(); _readChats(); }

/**
 * إحصائيات الكاش.
 * @returns {{ hitCount, lastReloadTime, reloadCount, rulesCount, groupsCount, channelsCount, uptimeSec }}
 */
export function getCacheStats() {
  return {
    hitCount:       _hitCount,
    lastReloadTime: _lastReloadTime,
    reloadCount:    _reloadCount,
    rulesCount:     _rules.length,
    groupsCount:    _chats.groups?.length  ?? 0,
    channelsCount:  _chats.channels?.length ?? 0,
    uptimeSec:      _initTime ? Math.floor((Date.now() - _initTime) / 1000) : 0,
  };
}

/**
 * تهيئة الكاش ومراقبة الملفات.
 * يجب استدعاؤه مرة واحدة عند بدء التشغيل.
 */
export function initRulesCache(rulesFile, chatsFile) {
  if (_initialized) return;
  _initialized = true;
  _initTime    = Date.now();
  _rulesFile   = rulesFile;
  _chatsFile   = chatsFile;

  // قراءة أولية
  _readRules();
  _readChats();

  // مراقبة التغييرات بـ fs.watch
  _watchFile(rulesFile, () => {
    clearTimeout(_rulesTimer);
    _rulesTimer = setTimeout(_readRules, DEBOUNCE_MS);
  });
  _watchFile(chatsFile, () => {
    clearTimeout(_chatsTimer);
    _chatsTimer = setTimeout(_readChats, DEBOUNCE_MS);
  });

  // Polling fallback — حماية ضد أحداث watch الفائتة
  const poll = setInterval(() => { _readRules(); _readChats(); }, POLL_INTERVAL);
  if (poll.unref) poll.unref(); // لا يمنع إيقاف العملية
}

// ── مراقبة الملف ─────────────────────────────────────────────────

function _watchFile(filePath, cb) {
  if (!filePath) return;

  const dir = dirname(filePath);
  _ensureDir(dir);

  if (existsSync(filePath)) {
    _attachWatcher(filePath, cb);
  } else {
    // الملف غير موجود بعد — راقب المجلد لاكتشاف إنشائه
    _watchDirForFile(dir, filePath, cb);
  }
}

function _attachWatcher(filePath, cb) {
  try {
    const w = watch(filePath, { persistent: false }, (event) => {
      if (event === "change" || event === "rename") {
        cb();
        // عند rename قد يختفي الملف ثم يعود — أعد ربط المراقبة بعد debounce
        if (event === "rename") {
          try { w.close(); } catch {}
          setTimeout(() => _watchFile(filePath, cb), 1_000);
        }
      }
    });
  } catch {
    // فشل المراقبة — نعتمد على polling
  }
}

function _watchDirForFile(dir, filePath, cb) {
  try {
    const dw = watch(dir, { persistent: false }, (event, filename) => {
      if (!filename || !filePath.endsWith(filename)) return;
      if (existsSync(filePath)) {
        try { dw.close(); } catch {}
        cb();
        _attachWatcher(filePath, cb); // انتقل لمراقبة الملف مباشرةً
      }
    });
  } catch { /* نعتمد على polling */ }
}

function _ensureDir(dir) {
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  }
}

/** للاختبار: إعادة تعيين كاملة */
export function _resetForTest() {
  _rules       = [];
  _chats       = { groups: [], channels: [] };
  _initialized = false;
  _rulesFile   = null;
  _chatsFile   = null;
  _hitCount    = 0;
  _reloadCount = 0;
  _lastReloadTime = null;
  _initTime    = null;
}
