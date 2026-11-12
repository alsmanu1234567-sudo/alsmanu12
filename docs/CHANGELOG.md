# CHANGELOG.md — سجل التغييرات
> WhatsApp Bot Pro | تسجيل الإصدارات والتغييرات الكبرى
> التاريخ: 2026-06-30 | الإصدار الحالي: v8.0.11

---

## v8.0.11 — 2026-06-30 (الإصدار الحالي)

### Added — Phase 12: Comprehensive Test Infrastructure & Quality Gate

**ملفات اختبار جديدة (tests/):**
- `tests/run-all.mjs` — Test Runner رئيسي (18 suites / 30s)
- `tests/unit/services/download-parser.test.mjs` (19 اختبار)
- `tests/unit/services/limit-service.test.mjs` (9 اختبارات)
- `tests/unit/services/blocklist-service.test.mjs` (11 اختبار)
- `tests/unit/services/bulk-points-service.test.mjs` (6 اختبارات)
- `tests/unit/services/broadcast-service.test.mjs` (9 اختبارات)
- `tests/unit/services/user-admin-service.test.mjs` (11 اختبار)
- `tests/unit/services/bulk-send-service.test.mjs` (6 اختبارات)
- `tests/unit/services/group-compare-service.test.mjs` (9 اختبارات)
- `tests/unit/plugin-registry.test.mjs` (23 اختبار)
- `tests/unit/plugin-loader.test.mjs` (13 اختبار)
- `tests/unit/message-router.test.mjs` (8 اختبارات)
- `tests/unit/dispatcher.test.mjs` (8 اختبارات)
- `tests/unit/worker-manager.test.mjs` (17 اختبار)
- `tests/integration/plugin-system.test.mjs` (15 اختبار)
- `tests/integration/handler-discovery.test.mjs` (6 اختبارات)
- `tests/static/quality-gate.mjs` (49 فحص — Static Analysis)
- `tests/perf/performance.test.mjs` (8 اختبارات أداء)

**وثائق:**
- `docs/PHASE12_REPORT.md` — تقرير مفصَّل لـ Phase 12

### Test Results
```
Suites: 18 | Passed: 227 | Failed: 0 | Duration: 30.6s
Quality Gate: 49 checks PASSED
Bot: RUNNING ✅
```

### Quality Gates مُنفَّذة
- ✅ لا Imports مكسورة
- ✅ لا Circular Dependencies
- ✅ لا Plugins مكررة
- ✅ لا Handlers بدون Manifest
- ✅ لا Services بدون exports
- ✅ 18/18 Plugins صحيحة
- ✅ Startup exception-free

---

## v8.0.10 — 2026-06-30

### Added — Phase 9: Service Layer Extraction

**ملفات جديدة (dist/services/):**
- `dist/services/admin/broadcast-service.mjs` (62 سطر) — بث تيليجرام جماعي / Evil Blast
- `dist/services/admin/user-admin-service.mjs` (74 سطر) — إدارة المستخدمين (فئة، حذف، رسالة، نقاط)
- `dist/services/bridge/bulk-send-service.mjs` (52 سطر) — إرسال واتساب جماعي + إحصائيات
- `dist/services/calls/blocklist-service.mjs` (55 سطر) — إدارة قائمة حظر المكالمات
- `dist/services/download/download-parser-service.mjs` (90 سطر) — تحليل أوامر التنزيل
- `dist/services/groups/group-compare-service.mjs` (55 سطر) — مقارنة أعضاء المجموعات
- `dist/services/points/bulk-points-service.mjs` (25 سطر) — توزيع نقاط جماعي
- `dist/services/users/limit-service.mjs` (35 سطر) — فحص الحدود اليومية

**وثائق:**
- `docs/PHASE9_REPORT.md` — تقرير مفصَّل لـ Phase 9

### Changed

**Handlers مُحدَّثة (استخدام Services):**
- `dist/handlers/developer-handler.mjs` — يستخدم admin/* + points/* services (+3 imports)
- `dist/handlers/state-switch-handler.mjs` — يستخدم bridge/* + groups/* services (+2 imports)
- `dist/handlers/calls-handler.mjs` — يستخدم calls/blocklist-service (+1 import)
- `dist/handlers/numbers-handler.mjs` — يستخدم users/limit-service (+1 import)
- `dist/handlers/download-handler.mjs` — يستخدم download/download-parser-service (+1 import)

### Business Logic Extracted
~108 سطر Business Logic انتقلت من Handlers إلى Services:
- broadcast loops (developer-handler → broadcast-service)
- user admin ops (developer-handler → user-admin-service)
- bulk points distribution (developer-handler → bulk-points-service)
- WA bulk send loop (state-switch → bulk-send-service)
- group comparison logic (state-switch → group-compare-service)
- blocklist manipulation (calls-handler → blocklist-service)
- limit checking (numbers-handler → limit-service)
- command parsing (download-handler → download-parser-service)

### Verified
- `node --check` جميع الملفات الـ 13 (8 services + 5 handlers): ✅ OK
- البوت في حالة Running بعد إعادة التشغيل: ✅
- جميع الـ 16 Modules مسجَّلة في الـ Router: ✅
- لا errors في السجلات: ✅
- لا تغيير في سلوك البوت: ✅

### Architecture After Phase 9
- `dist/services/` = طبقة Business Logic خالصة (8 ملفات / 7 مجلدات)
- Handlers = Thin Orchestrators فقط (استقبال → تحقق → استدعاء Service → إرسال)
- Pure Functions في Services (DI عبر function params، لا setDeps() في Services)

---

## v8.0.9 — 2026-06-28

### Added — Phase 7: Final Business Logic Extraction

**ملفات جديدة:**
- `dist/handlers/payment-handler.mjs` (46 سطر) — معالج Mizaj Stars Purchase (successful_payment)
- `dist/handlers/media-handler.mjs` (28 سطر) — معالج رفع الصور/فيديو للحالات (status upload)
- `dist/handlers/document-handler.mjs` (49 سطر) — معالج استيراد JSON للردود التلقائية + أجزاء الكود
- `dist/handlers/forward-hook.mjs` (15 سطر) — تسجيل prefix 'fw_' في Dispatcher → forward.mjs

### Changed

- `dist/index.mjs` — 328,933 → 328,884 سطر (﹣49 سطر صافية):
  - حُذف: 4 inline lambdas من Phase 4b block (~53 سطر business logic)
  - أُضيف: 4 imports لوحدات Phase 7 (أسطر 32-35)
  - أُضيف: Phase 7 wiring block — `setDeps + setHandler` (22 سطر)
  - Guard: `[PATCH_PHASE7_HANDLERS_EXTRACTED]`

### Verified

- `node --check` جميع الملفات الجديدة: ✅ 4/4 OK
- البوت في حالة Running: ✅
- Router: payment/media/document handlers مسجَّلة: ✅ بأسماء صريحة
- fw_ prefix في Dispatcher: ✅ مسجَّل عبر forward-hook.mjs
- Phase 5/6 handlers: ✅ تعمل

### Architecture After Phase 7

- `dist/index.mjs` = Bootstrap/Composition/DI/Init/Wiring فقط ✅
- لا Business Logic مباشر في index.mjs ✅
- جميع Handlers عبر Registry أو named module functions ✅

---

## v8.0.8 — 2026-06-28

### Added — Phase 6: State Switch Handler Extraction

**ملفات جديدة:**
- `dist/handlers/state-switch-handler.mjs` (554 سطر) — ~30 switch case مُستخرجة من text-handler.mjs

### Changed

- `dist/text-handler.mjs` — 474 → 60 سطر (تخفيض 87%):
  - حُذف: كامل switch statement (~414 سطر من Business Logic)
  - أُضيف: `import * as _switchHandler from './handlers/state-switch-handler.mjs'`
  - أُضيف في `setDeps()`: `_switchHandler.setDeps(d)`
  - أُضيف في `handleTextMessage()`: `await _switchHandler.handleText(bot2, msg)` بعد early state handlers
- `dist/index.mjs` — _p5CommonDeps +3 سطر:
  - `addPoints, saveAutoReply, triggerTypeKeyboard, replyScopeKeyboard, personChatKeyboard, getContacts`
  - تأمين وصول state-switch-handler للـ bundle-internal functions عبر DI

### Verified

- `node --check state-switch-handler.mjs` ✅
- `node --check text-handler.mjs` ✅
- `node --check handlers/registry.mjs` ✅
- text-handler.mjs: Thin Orchestrator خالص (60 سطر) ✅
- جميع الـ cases (30+) منقولة لـ state-switch-handler.mjs ✅

---

## v8.0.7 — 2026-06-28

### Added — Phase 4: Message Router Integration & Callback Dispatcher Activation

**ملفات جديدة:**
- `patch-phase4-activate.mjs` (80 سطر) — Patch: تفعيل Router & Dispatcher
- `docs/PHASE4_REPORT.md` — تقرير Phase 4 الكامل

### Changed

- `dist/message-router.mjs` — +18 سطر (69 → 87):
  - `setMessageHandler(fn)` — تسجيل handleTextMessage كـ handler رسمي
  - `routeMessage(bot, msg)` — نقطة الدخول الوحيدة للرسائل
  - `getStats()` يشمل `hasMessageHandler`
- `dist/dispatcher.mjs` — +21 سطر (75 → 96):
  - `setCallbackHandler(fn)` — تسجيل handleCallback كـ handler رسمي + fallback
  - `routeCallback(bot, query)` — نقطة الدخول الوحيدة للـ callbacks
  - `getStats()` يشمل `hasCallbackHandler`
- `dist/index.mjs` — +7 أسطر (330,463 → 330,470):
  - بلوك Phase 4: تسجيل handlers في Router & Dispatcher
  - `bot.on('message')`: `handleTextMessage(bot, msg)` → `_routerMod.routeMessage(bot, msg)`
  - `bot.on('callback_query')`: `handleCallback(bot, query)` → `_dispatcherMod.routeCallback(bot, query)`
- `infrastructure/patch-manager.mjs` — PATCH_REGISTRY: 42 → 43 إدخالاً
- `docs/REFACTOR_PLAN.md` — Phase 4 → مكتمل ✅

### Verified

- 5/5 ملفات dist/ اجتازت فحص syntax ✅
- patch idempotent (guard يمنع التطبيق المزدوج) ✅
- 3 guards (PATCH_PHASE4_ACTIVATE_APPLIED) في index.mjs ✅
- 74/74 اختبار Phase 2.5 ناجح ✅
- bot.on('message') يمر عبر Router فعلياً ✅
- bot.on('callback_query') يمر عبر Dispatcher فعلياً ✅

---

## v8.0.6 — 2026-06-28

### Added — Phase 3: Worker Manager & Message Routing Refactor

**ملفات جديدة:**
- `dist/worker-manager.mjs` (195 سطر) — WorkerManager class + singleton مُستقل
- `dist/keepalive.mjs` (68 سطر) — Keepalive Watchdog مُستقل
- `dist/daily-report.mjs` (100 سطر) — Daily Report Scheduler مُستقل
- `dist/message-router.mjs` (69 سطر) — Routing Registry (بنية تحتية جديدة)
- `dist/dispatcher.mjs` (75 سطر) — Callback Dispatcher Registry (بنية تحتية جديدة)
- `patch-worker-manager-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 39)
- `patch-keepalive-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 40)
- `patch-daily-report-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 41)
- `patch-router-init.mjs` — مسجّل في PATCH_REGISTRY (إدخال 42)
- `docs/PHASE3_REPORT.md` — تقرير Phase 3 الكامل

### Changed

- `dist/index.mjs` — -227 سطر / -7,715 بايت (330,690 → 330,463 سطر)
  - workers.ts __esm block: استُبدِل بـ stub (165 سطر → 10 أسطر)
  - keepalive.ts: استُبدِل بـ stubs (76 سطر → 12 سطر)
  - daily-report.ts: استُبدِل بـ stubs (77 سطر → 12 سطر)
  - 5 imports جديدة في الرأس (أسطر 25-29)
  - تهيئة Router + Dispatcher (17 وحدة مُسجَّلة) قبل startDailyReport
- `infrastructure/patch-manager.mjs` — PATCH_REGISTRY: 38 → 42 إدخالاً
- `docs/ARCHITECTURE.md` — تحديث dist/ list + طبقات البنية
- `docs/REFACTOR_PLAN.md` — Phase 3 → مكتمل ✅

### Verified

- 24/24 ملف dist/ اجتاز فحص syntax ✅
- 4 patches idempotent ✅
- 4 guards موجودة في dist/index.mjs ✅
- 17 وحدة مُسجَّلة في Router عند التشغيل ✅
- workerManager.getStats() متاح لجميع الوحدات عبر _wmMod ✅

---

## v8.0.5 — 2026-06-28

### Added — Phase 2.7 Orphan Modules Resolution

- `docs/ORPHAN_MODULES_REPORT.md` — **تقرير جديد** يوثّق تحليل وحسم 6 ملفات يتيمة
- `dist/bridge.mjs` — مدمج رسمياً: import في سطر 11، stub في سطر 324318
- `dist/schedule.mjs` — مدمج رسمياً: import في سطر 8، stub في سطر 324320
- `dist/security.mjs` — مدمج رسمياً: import في سطر 10، stub في سطر 324248
- `patch-security-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 36)
- `patch-schedule-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 37)
- `patch-bridge-split.mjs` — مسجّل في PATCH_REGISTRY (إدخال 38)

### Changed

- `infrastructure/patch-manager.mjs` — PATCH_REGISTRY: 35 → 38 إدخالاً
- `dist/index.mjs` — وُفِّر 30,955 حرف (563 سطر)، من 331,253 إلى 330,690 سطر
- TD-NEW-001 و TD-NEW-002 في `TODO.md` → محسومة ✅

### Verified

- 40/40 ملف اجتاز فحص الـ syntax ✅
- الـ patches idempotent (guard يمنع التطبيق المزدوج) ✅
- 0 Orphan Modules متبقية من نطاق Phase 2.7

---

## v8.0.4 — 2026-06-28

### Changed — Phase 2.6 إعادة تحليل كاملة من الصفر

- `docs/CLEANUP_REPORT.md` — **أُعيد كتابته بالكامل** بتحليل مستقل لكل ملف:
  - فحص **120 ملف** (كان 112 → اكتُشفت 8 ملفات جديدة غير موثقة)
  - تعارضات C-01/C-02/C-03 موثقة بين الوثائق والواقع
  - 0 ملف 🟢، 18 ملف 🟡، 102 ملف 🔴
  - ديون تقنية جديدة: TD-NEW-001، TD-NEW-002
  - خطر جديد: R-UNCONNECT-001

### Discovered — ملفات جديدة غير موثقة (لا تُحذف — تحتاج قرار في Phase 3)
- `dist/bridge.mjs` (183 سطر) — مفصولة لكن غير مستوردة في dist/index.mjs
- `dist/schedule.mjs` (100 سطر) — مفصولة لكن غير مستوردة في dist/index.mjs
- `dist/security.mjs` (146 سطر) — مفصولة لكن غير مستوردة في dist/index.mjs
- `patch-bridge-split.mjs` — غير مسجّل في PATCH_REGISTRY
- `patch-schedule-split.mjs` — غير مسجّل في PATCH_REGISTRY
- `patch-security-split.mjs` — غير مسجّل في PATCH_REGISTRY
- `docs/RUNTIME_MAP.md` — توثيق جديد مفيد (محفوظ)
- `docs/DEPLOYMENT.md` — كان موجوداً لكن غير مُدرَج في قائمة التقارير

### Technical Debt موثق (يُعالَج في مراحله)
- TD-NEW-001: 3 وحدات dist/ غير متصلة → Phase 3
- TD-NEW-002: 3 patches غير مسجلة في PATCH_REGISTRY → Phase 3
- TD-002: 35 ملف `patch-*.mjs` في الجذر → بعد Phase 5
- TD-007: 7 ملفات `test-*.mjs` في الجذر → Phase 14
- TD-010: `patch-stream-dl-fix.mjs` patch يتيم (إجمالاً 4 يتيمة الآن) → بعد Phase 5

---

## v8.0.3 — 2026-06-28

### Added — Phase 2.6 Project Cleanup & Technical Debt Removal (الجلسة السابقة)
- `docs/CLEANUP_REPORT.md` — تقرير تنظيف أولي: تحليل 113 ملف
  - تصنيف: 🟢 / 🟡 / 🔴 لكل ملف
  - توثيق 11 Technical Debt نشط مع خطة المعالجة

### Removed — Phase 2.6 Safe Cleanup
- `CLEANUP_REPORT.md` (الجذر) — مكرر مع docs/CLEANUP_REPORT.md

### Technical Debt Documented
- TD-009: `IMPORTANT.md` يشير إلى `alsmanu4/` → تصحيح قريب
- TD-011: `github-sync.mjs` يدوي → Phase 7

---

## v8.0.2 — 2026-06-28

### Fixed — Phase 2.5 Validation Findings
- **BUG-003**: `engine/health-monitor.mjs` — `checkHttp()` كانت تُعيد `{ ok: true }` حتى عند HTTP 4xx/5xx
  - **السبب**: `fetch()` لا تُلقي exception عند 4xx/5xx — تعيد response فقط
  - **الإصلاح**: إضافة تحقق من `res.ok` قبل تصفير `consecutiveFails`
  - **الأثر**: Bot يُعدّ صحياً حتى لو أعاد 503 — onUnhealthy لم يكن يُستدعى عند HTTP 5xx
  - **الملف**: `engine/health-monitor.mjs` (lines 67-71)

### Added — Phase 2.5 Validation & Stress Testing
- `tests/validate-engine.mjs` — مجموعة اختبارات شاملة (74 اختبار، 100% ناجح)
- `docs/VALIDATION_REPORT.md` — تقرير التحقق التفصيلي

---

## v8.0.1 — 2026-06-28

### Removed — Project Cleanup
- `bootstrap.mjs` — bootstrap قديم (pre-Phase1)، استُبدل بـ `bootstrap/index.mjs` بالكامل
- `fix-syntax.mjs` — أداة طارئة one-off لإصلاح syntax في dist/index.mjs
- `fix-syntax.cjs` — نسخة CJS من fix-syntax.mjs
- `fix-tiktok-dup.mjs` — إصلاح تكرار TikTok handler (one-off منتهي الغرض)
- `patch-developer-split.mjs` — باتش مُطبَّق (guard موجود في dist/index.mjs)، غير مسجَّل في PATCH_REGISTRY
- `patch-points-split.mjs` — باتش مُطبَّق (guard موجود في dist/index.mjs)، غير مسجَّل في PATCH_REGISTRY

### Added
- `CLEANUP_REPORT.md` — تقرير تفصيلي لتحليل 105 ملف وإجراءات التنظيف

---

## v8.0.0 — 2026-06-28

### Added
- **Bootstrap Layer** — تنفيذ Phase 1 من REFACTOR_PLAN.md
  - `startup.mjs` → entry point نقي (8 أسطر فقط)
  - `bootstrap/index.mjs` → orchestrator المرحلي (52 سطر)
- **Core Layer** — طبقة منطق عامة مستقلة
  - `core/logger.mjs` → source of truth للطباعة الملوّنة
  - `core/config.mjs` → تحميل config.json + defaults + AES decode
  - `core/health.mjs` → فحص Node.js ≥ 18، RAM، ffmpeg
- **Infrastructure Layer** — إدارة الموارد الخارجية
  - `infrastructure/patch-manager.mjs` → سجل 35 تعديل + تطبيق مُسلسَل
  - `infrastructure/package-manager.mjs` → npm + حزم حرجة
  - `infrastructure/binary-manager.mjs` → yt-dlp lifecycle (4 استراتيجيات)
  - `infrastructure/process-manager.mjs` → spawn + monitor
- **Utils Layer** — مكتبات مساعدة خالصة
  - `utils/token-codec.mjs` → AES-256-CBC + XOR backward compat
  - `utils/platform.mjs` → platform detection
- **Documentation** — وثائق معمارية رسمية
  - `ARCHITECTURE.md` — البنية الكاملة (628 سطر)
  - `REFACTOR_PLAN.md` — 15 مرحلة مفصّلة (388 سطر)
  - `PROJECT_RULES.md` — دستور المشروع (419 سطر)
  - `TODO.md` — لوحة التحكم التنفيذية
  - `BAILEYS_RESEARCH.md` — وثائق Baileys التقنية
  - `docs/` — 13 ملف توثيق شامل

### Changed
- `startup.mjs` أُعيد هيكلته من 286 سطر إلى 8 أسطر
- كل منطق التشغيل نُقل إلى طبقات مناسبة (Bootstrap/Core/Infrastructure)
- سجل الباتشات موحَّد في `infrastructure/patch-manager.mjs`

---

## v7.x — قبل 2026-06-28 (إصدارات تاريخية)

### Added
- **11 وحدة مستقلة** في dist/*.mjs (مستخرجة من dist/index.mjs):
  - `dist/auto-reply.mjs` — الردود التلقائية (patch-auto-reply-split.mjs)
  - `dist/ai.mjs` — الذكاء الاصطناعي (patch-ai-split.mjs)
  - `dist/calls.mjs` — المكالمات (patch-calls-split.mjs)
  - `dist/developer.mjs` — God Panel
  - `dist/forward.mjs` — التحويل (patch-forward-hook.mjs)
  - `dist/groups.mjs` — المجموعات (patch-groups-split.mjs)
  - `dist/my-msgs.mjs` — رسائلي (patch-mymsgs-split.mjs)
  - `dist/persons.mjs` — جهات الاتصال (patch-persons-split.mjs)
  - `dist/points.mjs` — النقاط (patch-points-split.mjs)
  - `dist/reports.mjs` — البلاغات (patch-reports-split.mjs)
  - `dist/status.mjs` — الحالات (patch-status-split.mjs)
- نظام إعادة الاتصال الساعي (hourly reconnect)
- التقرير اليومي (6ص UTC)
- Keepalive Watchdog
- GitHub Sync (يدوي — github-sync.mjs)
- نظام النقاط والباقات (6 مستويات)
- ميزة البث المباشر YouTube→WhatsApp
- ميزة الترجمة v3 (Google + رد على رسالة)
- GitHub Token v2 (AES-256-CBC)
- SmartSearch: cobalt + y2mate + yt-dlp
- نظام أجزاء الكود (dev feature)
- نسخ البوت المباشر (clone direct)
- تتبع ردود البوت (append) للحذف
- إصلاح الأرقام المتعددة (كل رقم بإعداداته)
- شريط تقدم vid/tiktok/song
- فيلم v4: downloadMovieSmart + جودات متعددة

### Changed
- `encode-token.mjs`: ترقية من XOR إلى AES-256-CBC
- رسائلي: توسيع من 6 أوامر إلى 12+
- Developer Panel: إضافة god_reconnect + لوحة صحة
- تحسين جلب الصورة: من طريقة واحدة إلى 4 استراتيجيات متسلسلة
- تحسين fetchStatus: تصحيح معالجة Array (bug كلاسيكي)

### Fixed
- BUG: `${token}` حرفية في تعيين GitHub Token (patch-fix-token.mjs)
- BUG: حد كل شخص / 8 ساعات (patch-per-user-limit-fix.mjs + patch-bugfix-final.mjs)
- BUG: URL النسخ يحتوي /bot الزائد (patch-fix-clone-url.mjs)
- BUG: ffmpeg timeout مع loader.to (patch-loader.mjs)
- BUG: مزامنة جهات الاتصال (patch-fixes-v2.mjs)

---

## v6.x — إصدارات أقدم

### Added
- `/cod` — ربط واتسآب (patch-cod.mjs)
- تنزيل vid/song/film/tiktok (patch-download.mjs)
- رسائلي: سبام + طقس + ترجمة + أخبار + نكتة + حظ + ويكي + صلاة + عملة + ستيكر + تاق
- أكواد خاصة + ساحر + معالج WA + /حالة
- إدارة GitHub Token: تعيين + حذف + تشفير

---

## v8.1.0 — 2026-06-28 (الإصدار الحالي)

### Added — Phase 2: Session Engine Refactor

**طبقة `engine/` الجديدة — 10 ملفات (1,369 سطر):**

| الملف | المسؤولية | الحجم |
|---|---|---|
| `engine/lifecycle.mjs` | آلة حالة الجلسة (8 حالات + 35 انتقال) | 106 سطر |
| `engine/session-storage.mjs` | قراءة/تحقق/عزل ملفات creds.json | 154 سطر |
| `engine/queue.mjs` | طابور عمليات async بأولوية + retry | 114 سطر |
| `engine/worker-tracker.mjs` | تتبع صحة كل جلسة بشكل مستقل | 151 سطر |
| `engine/health-monitor.mjs` | استطلاع HTTP /healthz + فحص الملفات | 133 سطر |
| `engine/heartbeat.mjs` | نبضة دورية 30s + اكتشاف جلسات مجمدة | 112 سطر |
| `engine/reconnect-manager.mjs` | Exponential backoff لكل جلسة مستقلة | 150 سطر |
| `engine/recovery-manager.mjs` | عزل تالف + إعادة تشغيل بـ cooldown | 132 سطر |
| `engine/session-manager.mjs` | تنسيق شامل بين جميع المكونات | 141 سطر |
| `engine/index.mjs` | `startEngine()` — نقطة الدخول الرئيسية | 176 سطر |

**مشاكل مُحلّة:**
- ✅ تلف الجلسات بعد restart — فحص + عزل تلقائي قبل التشغيل
- ✅ اتصال غير مستقر — Exponential backoff مستقل لكل جلسة (5s→15s→30s→60s→120s)
- ✅ جلسات متوقفة دون اكتشاف — Heartbeat 30s + كشف الجمود > 10 دقائق
- ✅ الحاجة لإعادة تشغيل يدوية — Recovery Manager + إعادة تشغيل تلقائية مع cooldown
- ✅ إدارة موارد فوضوية — Queue مع maxConcurrent + WorkerTracker مستقل

### Changed

**`infrastructure/process-manager.mjs`** — تحسين إدارة العملية:
- إضافة `autoRestart: true` (حد أقصى 10 إعادات)
- callback `onSpawn` لإخطار engine بالعملية الجديدة
- استبدال `err()` الفادح بـ `logErr()` غير الفادح

**`core/logger.mjs`** — إضافة `logErr`:
- `logErr(m)` — تسجيل خطأ بالأحمر بدون `process.exit(1)`
- مُصمَّم للاستخدام في engine/ حيث الأخطاء غير فادحة

**`bootstrap/index.mjs`** — دمج Session Engine:
- استدعاء `startEngine()` بعد 8 ثوانٍ من إطلاق البوت
- تمرير مرجع العملية الفرعية للـ Engine
- فشل Engine لا يوقف البوت (try-catch)

---

## Unreleased (مخطَّط — Phase 5+)

### Planned
- `dist/keepalive-service.mjs` — استخراج Keepalive Service (Phase 5)
- `dist/daily-report-service.mjs` — استخراج Daily Report (Phase 5)
- نسخ احتياطية يومية تلقائية (Phase 7)
- atomic JSON writes (Phase 12)
- graceful shutdown handler (Phase 5)
- LRU Cache لـ inMemoryDB (Phase 12)
- GET /api/metrics (Phase 13)
- تشفير bot-data/sessions/ (Phase 15)
- testing infrastructure (Phase 14)

---

## كيفية تحديث هذا الملف

1. في نهاية كل مرحلة إعادة هيكلة → أضف إصداراً جديداً
2. الإصدار يتبع SemVer: `MAJOR.MINOR.PATCH`
   - MAJOR: إعادة هيكلة كبرى أو تغيير جوهري في البنية
   - MINOR: ميزة جديدة أو وحدة جديدة
   - PATCH: إصلاح خطأ أو تحسين صغير
3. الأقسام: Added / Changed / Deprecated / Removed / Fixed / Security
