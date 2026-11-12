# CLEANUP_REPORT.md — تقرير التنظيف الكامل
> WhatsApp Bot Pro v8.0 | Phase 2.6 — Project Cleanup & Technical Debt Removal
> تاريخ التنفيذ: 2026-06-28 | **تحليل جديد كامل من الصفر**
> المحلّل: فحص مباشر لجميع الملفات + مقارنة مع PATCH_REGISTRY + dist/index.mjs

---

## 0. ملاحظة منهجية

هذا التقرير **جديد تماماً** ولا يعتمد على أي تقرير سابق. تم فحص كل ملف بشكل مستقل من خلال:
- قراءة رؤوس الملفات وفهم دورها
- التحقق من الاستيراد في `dist/index.mjs` عبر grep
- مقارنة patch-*.mjs مع `PATCH_REGISTRY` في `infrastructure/patch-manager.mjs`
- تتبع سلسلة bootstrap → startup → engine

---

## 1. إحصائيات الجرد الكامل

| البند | القيمة |
|---|---|
| **إجمالي الملفات** | **120 ملفاً** |
| **🟢 آمن للحذف** | 0 ملف |
| **🟡 يحتاج مراجعة مستقبلية** | 18 ملف |
| **🔴 احتفظ** | 102 ملف |
| **مجلدات فارغة** | 0 مجلد |

> **ملاحظة هامة:** عدد الملفات الحالي 120، وكان 112 في آخر تقرير (بعد حذف CLEANUP_REPORT.md الجذري). الزيادة 8 ملفات جديدة لم تكن موثقة في أي وثيقة.

---

## 2. التعارضات المكتشفة بين الوثائق والواقع ⚠️

| # | التعارض | ما تقوله الوثائق | الواقع الفعلي | الخطورة |
|---|---|---|---|---|
| C-01 | عدد ملفات dist/ | 16 ملف | **19 ملف** (bridge+schedule+security جديدة) | ⚠️ عالي |
| C-02 | patches في الجذر | 35 في Registry + 1 يتيم | **35 في Registry + 4 يتيمة** (3 جديدة) | ⚠️ عالي |
| C-03 | إجمالي الملفات | 112 (بعد cleanup) | **120** | ℹ️ |
| C-04 | PATCH_REGISTRY نفسه | 35 patch | **35 patch لا تغيير** ✅ | ✅ |

### شرح C-01 و C-02:
```
الملفات الجديدة غير الموثقة:
  dist/bridge.mjs     (183 سطر / 16KB)  — handleBridgeCallback
  dist/schedule.mjs   (100 سطر / 8KB)   — handleScheduleCallback
  dist/security.mjs   (146 سطر / 12KB)  — handleSecurityCallback
  patch-bridge-split.mjs   (54 سطر)
  patch-schedule-split.mjs (48 سطر)
  patch-security-split.mjs (54 سطر)
  docs/RUNTIME_MAP.md  (توثيق جديد — مفيد)
  + الفرق الثامن = docs/DEPLOYMENT.md (لم يُوثَّق في قائمة التقرير السابق)

التحقق من الاتصال:
  grep "bridge.mjs|schedule.mjs|security.mjs" dist/index.mjs → 0 نتائج
  grep "PATCH_BRIDGE|PATCH_SCHEDULE|PATCH_SECURITY" dist/index.mjs → 0 نتائج
  patch-bridge-split.mjs في PATCH_REGISTRY → لا (غير مسجّل)
  patch-schedule-split.mjs في PATCH_REGISTRY → لا (غير مسجّل)
  patch-security-split.mjs في PATCH_REGISTRY → لا (غير مسجّل)
```

---

## 3. ملفات 🟢 آمن للحذف

### **لا يوجد أي ملف 🟢 في الحالة الحالية.**

الملف الوحيد الذي كان 🟢 في التحليل السابق:

| الملف | السبب | الحالة |
|---|---|---|
| `CLEANUP_REPORT.md` (الجذر — غير docs/) | مكرر بالكامل مع docs/CLEANUP_REPORT.md | ✅ **حُذف مسبقاً في v8.0.1** |

---

## 4. ملفات 🟡 تحتاج مراجعة مستقبلية (18 ملف)

هذه الملفات **لا تُحذف الآن** — موثقة هنا لمراجعتها في المرحلة المناسبة.

### 4.1 وحدات dist/ غير متصلة (جديدة — 3 ملفات)

| # | الملف | الحجم | المشكلة | المرحلة المقترحة |
|---|---|---|---|---|
| J-01 | `dist/bridge.mjs` | 183 سطر / 16KB | موجودة لكن **لا import** في dist/index.mjs — PATCH_BRIDGE_SPLIT_APPLIED غائبة من index.mjs | Phase 3 |
| J-02 | `dist/schedule.mjs` | 100 سطر / 8KB | نفس المشكلة — PATCH_SCHEDULE_SPLIT_APPLIED غائبة | Phase 3 |
| J-03 | `dist/security.mjs` | 146 سطر / 12KB | نفس المشكلة — PATCH_SECURITY_SPLIT_APPLIED غائبة | Phase 3 |

> **خطر R-UNCONNECT-001 (جديد):** هذه الوحدات موجودة لكن معزولة تماماً عن dist/index.mjs. إذا لم تُربط في Phase 3 يجب حذفها مع patches المقابلة.

### 4.2 Patches يتيمة غير مسجلة في PATCH_REGISTRY (4 ملفات)

| # | الملف | الحجم | المشكلة | المرحلة المقترحة |
|---|---|---|---|---|
| J-04 | `patch-bridge-split.mjs` | 54 سطر / 4KB | **غير مسجّل في PATCH_REGISTRY** — لن يُطبَّق في أي startup | Phase 3 |
| J-05 | `patch-schedule-split.mjs` | 48 سطر / 4KB | **غير مسجّل في PATCH_REGISTRY** | Phase 3 |
| J-06 | `patch-security-split.mjs` | 54 سطر / 4KB | **غير مسجّل في PATCH_REGISTRY** | Phase 3 |
| J-07 | `patch-stream-dl-fix.mjs` | متوسط | يتيم سابق — غير مسجّل في PATCH_REGISTRY منذ session سابقة | Phase 5 |

> **ملاحظة J-04/J-05/J-06:** مرتبطة بـ J-01/J-02/J-03. القرار واحد لهما معاً: إما ربط أو حذف في Phase 3.

### 4.3 أدوات CLI نادرة الاستخدام (3 ملفات)

| # | الملف | السبب | المرحلة المقترحة |
|---|---|---|---|
| J-08 | `encode-token.mjs` | أداة CLI للتشفير — تُستخدم مرة عند الإعداد | Phase 15 |
| J-09 | `github-sync.mjs` | أداة CLI للرفع اليدوي إلى GitHub | Phase 15 |
| J-10 | `setup-yt-cookies.mjs` | إعداد كوكيز يوتيوب — نادراً | Phase 15 |

### 4.4 ملفات الاختبار اليدوي (7 ملفات — تنتهك PROJECT_RULES.md Q1.1)

| # | الملف | المشكلة | المرحلة المقترحة |
|---|---|---|---|
| J-11 | `test-download.mjs` | test-* في الجذر بدلاً من tests/ | Phase 14 |
| J-12 | `test-download-all.mjs` | test-* في الجذر | Phase 14 |
| J-13 | `test-media.mjs` | test-* في الجذر | Phase 14 |
| J-14 | `test-stream-dl.mjs` | test-* في الجذر | Phase 14 |
| J-15 | `test-tiktok-new.mjs` | test-* في الجذر | Phase 14 |
| J-16 | `test-translate.mjs` | test-* في الجذر | Phase 14 |
| J-17 | `test-yt-new.mjs` | test-* في الجذر | Phase 14 |

### 4.5 ملف توثيق جذري مكرر (1 ملف)

| # | الملف | السبب | المرحلة المقترحة |
|---|---|---|---|
| J-18 | `IMPORTANT.md` | معلوماته موجودة في docs/ — مكرر في الجذر | Phase 15 |

---

## 5. ملفات 🔴 احتفظ — التصنيف الكامل (102 ملف)

### 5.1 طبقة Startup والتشغيل الأساسية

| الملف | الدور | الأهمية |
|---|---|---|
| `startup.mjs` | نقطة الدخول الرئيسية — يُشغّله .replit workflow | 🔴 حرج |
| `deploy.mjs` | تحميل dist/ + تشغيل بديل (نقطة دخول .replit) | 🔴 حرج |
| `.replit` | إعداد Replit — workflow + port config | 🔴 حرج |
| `package.json` | التبعيات + scripts | 🔴 حرج |
| `package-lock.json` | قفل نسخ التبعيات (npm ci) | 🔴 حرج |
| `.gitignore` | منع رفع config.json وbot-data/ لـ GitHub | 🔴 حرج |

### 5.2 طبقة Bootstrap (1 ملف)

| الملف | الدور | الأهمية |
|---|---|---|
| `bootstrap/index.mjs` | تنسيق خطوات الإقلاع الـ 8 | 🔴 حرج |

### 5.3 طبقة Core (3 ملفات)

| الملف | الدور | الأهمية |
|---|---|---|
| `core/config.mjs` | تحميل config.json + ENV + الافتراضيات | 🔴 حرج |
| `core/health.mjs` | فحص Node.js + RAM + ffmpeg + yt-dlp | 🔴 حرج |
| `core/logger.mjs` | pino logger المركزي (ok/wrn/inf/section) | 🔴 حرج |

### 5.4 طبقة Infrastructure (4 ملفات)

| الملف | الدور | الأهمية |
|---|---|---|
| `infrastructure/binary-manager.mjs` | yt-dlp: تحميل + فحص + تحديث تلقائي | 🔴 حرج |
| `infrastructure/package-manager.mjs` | npm install / تحديث التبعيات | 🔴 حرج |
| `infrastructure/patch-manager.mjs` | PATCH_REGISTRY + تطبيق 35 patch بالترتيب | 🔴 حرج |
| `infrastructure/process-manager.mjs` | spawn dist/index.mjs + مراقبة العملية | 🔴 حرج |

### 5.5 طبقة Utils (2 ملف)

| الملف | الدور | الأهمية |
|---|---|---|
| `utils/platform.mjs` | كشف النظام (Linux/Mac/Windows) + مسار yt-dlp | 🔴 حرج |
| `utils/token-codec.mjs` | AES-256-CBC + XOR backward compat | 🔴 حرج |

### 5.6 طبقة Session Engine (10 ملفات)

| الملف | الدور | الأهمية |
|---|---|---|
| `engine/index.mjs` | نقطة دخول Engine + تنسيق | 🔴 حرج |
| `engine/session-manager.mjs` | إدارة دورة حياة الجلسات | 🔴 حرج |
| `engine/session-storage.mjs` | قراءة/كتابة بيانات الجلسات | 🔴 حرج |
| `engine/lifecycle.mjs` | دورة حياة جلسة واحدة (QR/Pair/Active/Dead) | 🔴 حرج |
| `engine/reconnect-manager.mjs` | إعادة الاتصال المجدولة (كل ساعة) | 🔴 حرج |
| `engine/recovery-manager.mjs` | استعادة الجلسات بعد crash | 🔴 حرج |
| `engine/health-monitor.mjs` | مراقبة GET /health (port 5000) | 🔴 حرج |
| `engine/heartbeat.mjs` | نبضات القلب للكشف عن التجمد | 🔴 حرج |
| `engine/queue.mjs` | Queue لتأجيل العمليات المتزامنة | 🔴 حرج |
| `engine/worker-tracker.mjs` | تتبع حالة workers النشطة | 🔴 حرج |

### 5.7 طبقة dist/ — المحرك والوحدات (16 ملف أساسي)

| الملف | الأسطر | الدور | الأهمية |
|---|---|---|---|
| `dist/index.mjs` | 331,253 | المحرك الرئيسي — Telegram + WhatsApp + Express | 🔴 حرج |
| `dist/ai.mjs` | 85 | وحدة الذكاء الاصطناعي (واجهة تيليجرام) | 🔴 حرج |
| `dist/auto-reply.mjs` | 1,001 | الردود التلقائية (نص/صورة/ستيكر/AI) | 🔴 حرج |
| `dist/calls.mjs` | 126 | إدارة المكالمات الواردة | 🔴 حرج |
| `dist/developer.mjs` | 1,025 | لوحة المطوّر God Panel (40+ أمر) | 🔴 حرج |
| `dist/forward.mjs` | 783 | تحويل الرسائل بين الأرقام | 🔴 حرج |
| `dist/groups.mjs` | 112 | إدارة المجموعات | 🔴 حرج |
| `dist/my-msgs.mjs` | 428 | رسائلي (12+ ميزة: طقس/ترجمة/صلاة...) | 🔴 حرج |
| `dist/persons.mjs` | 195 | جهات الاتصال | 🔴 حرج |
| `dist/points.mjs` | 319 | نظام النقاط والباقات | 🔴 حرج |
| `dist/reports.mjs` | 98 | البلاغات | 🔴 حرج |
| `dist/status.mjs` | 311 | عرض حالات واتسآب | 🔴 حرج |
| `dist/pino-file.mjs` | 4,350 | pino transport — ملفات | 🔴 حرج |
| `dist/pino-pretty.mjs` | 3,312 | pino transport — تجميل | 🔴 حرج |
| `dist/pino-worker.mjs` | 4,706 | pino worker thread | 🔴 حرج |
| `dist/thread-stream-worker.mjs` | 228 | thread-stream worker | 🔴 حرج |

### 5.8 patch-*.mjs المسجلة في PATCH_REGISTRY (35 ملف)

> **تحذير R-06:** لا تُحذف أي من هذه الـ 35 patch — كلها تُطبَّق في كل startup وتحتوي على حارسات تمنع التطبيق المزدوج.

| # | الملف | الوصف |
|---|---|---|
| 1 | `patch-cod.mjs` | /cod لربط واتسآب |
| 2 | `patch-fixes.mjs` | إصلاحات cod + تيليجرام |
| 3 | `patch-download.mjs` | تنزيل vid/song/film/tiktok |
| 4 | `patch-loader.mjs` | إصلاح ffmpeg + loader.to timeout |
| 5 | `patch-mymsgs.mjs` | رسائلي: سبام+طقس+ترجمة+أخبار+نكتة+حظ+ويكي+صلاة+عملة+ستيكر+تاق |
| 6 | `patch-video-fix.mjs` | إصلاح تنزيل vid/song/film: cobalt+timeout+RAM |
| 7 | `patch-dl-v3.mjs` | إصلاح شامل v3: smartSearch+cobalt-API+y2mate |
| 8 | `patch-film-v4.mjs` | فيلم v4: downloadMovieSmart+جودات+ضغط تلقائي |
| 9 | `patch-github-token.mjs` | إدارة GitHub Token: تعيين+حذف+تشفير |
| 10 | `patch-github-v2.mjs` | GitHub Token v2: AES-256 + قراءة من config.json |
| 11 | `patch-new-features.mjs` | أكواد خاصة+ساحر+معالج WA+/حالة |
| 12 | `patch-new-features-2.mjs` | زر قائمة+شريط تقدم vid/tiktok/song |
| 13 | `patch-fixes-v2.mjs` | مزامنة جهات الاتصال |
| 14 | `patch-fixes-v3.mjs` | عرض حالات+نماذج ذكاء فوراً |
| 15 | `patch-clone-direct.mjs` | نسخ البوت مباشر بدون أسئلة |
| 16 | `patch-del-append.mjs` | تتبع ردود البوت (append) للحذف |
| 17 | `patch-fix-clone-url.mjs` | إصلاح URL النسخ: حذف /bot |
| 18 | `patch-multi-number.mjs` | إصلاح الأرقام المتعددة: كل رقم بإعداداته |
| 19 | `patch-all-fixes-v1.mjs` | إصلاحات شاملة: بث+ردود+فيديو+دليل AI+كود أجزاء |
| 20 | `patch-bugfix-final.mjs` | إصلاح حد كل شخص / 8 ساعات + فيلم URL مباشر |
| 21 | `patch-stream-dl.mjs` | بث مباشر YouTube→WhatsApp: صفر ملفات |
| 22 | `patch-stream-dl-v2.mjs` | stream-dl v2: directUrl+جودات صحيحة+offset |
| 23 | `patch-auto-reply-split.mjs` | فصل الردود التلقائية إلى dist/auto-reply.mjs |
| 24 | `patch-mymsgs-split.mjs` | فصل رسائلي إلى dist/my-msgs.mjs |
| 25 | `patch-status-split.mjs` | فصل الحالات إلى dist/status.mjs |
| 26 | `patch-calls-split.mjs` | فصل المكالمات إلى dist/calls.mjs |
| 27 | `patch-reports-split.mjs` | فصل البلاغات إلى dist/reports.mjs |
| 28 | `patch-persons-split.mjs` | فصل الأشخاص إلى dist/persons.mjs |
| 29 | `patch-ai-split.mjs` | فصل الذكاء الاصطناعي إلى dist/ai.mjs |
| 30 | `patch-groups-split.mjs` | فصل المجموعات إلى dist/groups.mjs |
| 31 | `patch-fix-token.mjs` | إصلاح التوكن الحرفي ${token} |
| 32 | `patch-per-user-limit-fix.mjs` | إصلاح زر حد كل شخص / 8 ساعات |
| 33 | `patch-translate-v3.mjs` | تحسين الترجمة v3: Google + رد على رسالة |
| 34 | `patch-forward-hook.mjs` | قسم التحويل: ربط forward.mjs بـ index.mjs |
| 35 | `patch-master-fix.mjs` | الإصلاح الشامل: جلسات+GitHub+god_reconnect |

### 5.9 Binary + Stream

| الملف | الدور | الأهمية |
|---|---|---|
| `bin/yt-dlp-py` | yt-dlp binary (Python wrapper) | 🔴 حرج |
| `stream-dl.mjs` | بث YouTube→WhatsApp (مُستخدَم من dist/index.mjs) | 🔴 حرج |

### 5.10 توثيق الجذر (6 ملفات)

| الملف | الدور | الأهمية |
|---|---|---|
| `ARCHITECTURE.md` | معمارية عالية المستوى (مرجع سريع للمطوّر) | 🔴 محفوظ |
| `REFACTOR_PLAN.md` | خطة إعادة الهيكلة الكاملة (Phases 1-15) | 🔴 محفوظ |
| `PROJECT_RULES.md` | قواعد الكود والمشروع (Q1-Q7) | 🔴 محفوظ |
| `TODO.md` | قائمة المهام النشطة والمكتملة | 🔴 محفوظ |
| `BAILEYS_RESEARCH.md` | أبحاث Baileys API وحلول المشاكل | 🔴 محفوظ |
| `YOUTUBE_COOKIES_README.md` | دليل إعداد كوكيز يوتيوب | 🔴 محفوظ |

### 5.11 توثيق docs/ (16 ملف)

| الملف | الدور | الأهمية |
|---|---|---|
| `docs/ARCHITECTURE.md` | معمارية مفصلة (طبقات + تدفق) | 🔴 محفوظ |
| `docs/REFACTOR_PLAN.md` | خطة إعادة الهيكلة | 🔴 محفوظ |
| `docs/PROJECT_RULES.md` | القواعد التفصيلية | 🔴 محفوظ |
| `docs/TODO.md` | المهام التفصيلية | 🔴 محفوظ |
| `docs/CHANGELOG.md` | سجل التغييرات | 🔴 محفوظ |
| `docs/SESSION_ENGINE.md` | توثيق Session Engine (10 ملفات) | 🔴 محفوظ |
| `docs/VALIDATION_REPORT.md` | تقرير 74 اختبار ✅ 100% | 🔴 محفوظ |
| `docs/PERFORMANCE.md` | الأداء والقابلية للتوسع | 🔴 محفوظ |
| `docs/SECURITY.md` | الأمان والحماية | 🔴 محفوظ |
| `docs/TESTING.md` | خطة الاختبار الرسمي | 🔴 محفوظ |
| `docs/DATABASE.md` | طبقة البيانات | 🔴 محفوظ |
| `docs/MODULES.md` | وصف الوحدات التفصيلي | 🔴 محفوظ |
| `docs/API.md` | واجهات البرمجة | 🔴 محفوظ |
| `docs/RUNTIME_MAP.md` | خريطة dist/index.mjs الكاملة (جديد) | 🔴 محفوظ |
| `docs/DEPLOYMENT.md` | دليل النشر | 🔴 محفوظ |
| `docs/CLEANUP_REPORT.md` | **هذا الملف** | 🔴 محفوظ |

### 5.12 الاختبار الرسمي

| الملف | الدور | الأهمية |
|---|---|---|
| `tests/validate-engine.mjs` | 74 اختبار (100% ✅) | 🔴 محفوظ |

---

## 6. الديون التقنية الكاملة (TD)

| # | الدين | الخطورة | المرحلة |
|---|---|---|---|
| TD-NEW-001 | dist/bridge+schedule+security موجودة لكن غير متصلة بـ dist/index.mjs | ⚠️ عالي | Phase 3 |
| TD-NEW-002 | 3 patches جديدة غير مسجلة في PATCH_REGISTRY | ⚠️ عالي | Phase 3 |
| TD-001 | dist/index.mjs = 16MB bundle (331K سطر) — صعوبة الصيانة | 🔴 حرج | Phase 2-5 |
| TD-004 | الكتابة غير الذرية لـ bot-data/*.json → خطر تلف البيانات | 🔴 حرج | Phase 12 |
| TD-008 | mongoose مثبّت (12MB) لكن غير مستخدم → تحذير كل startup | ⚠️ متوسط | Phase 3 |

---

## 7. المخاطر المحفوظة

| # | الخطر | الوصف | المصدر |
|---|---|---|---|
| R-01 | الكتابة غير الذرية | crash أثناء JSON.stringify → بيانات تالفة | ARCHITECTURE.md |
| R-02 | PATCH_REGISTRY محدودة | إضافة patch جديد دون تحديث registry | ARCHITECTURE.md |
| R-03 | inMemoryDB بلا حد | قد يستنزف RAM مع 10,000+ مستخدم | ARCHITECTURE.md |
| R-04 | GITHUB_TOKEN منتهي الصلاحية | فشل النسخ الاحتياطي بصمت | ARCHITECTURE.md |
| R-05 | yt-dlp لا يُحدَّث تلقائياً | فشل التنزيل بعد تحديثات يوتيوب | ARCHITECTURE.md |
| R-06 | حذف patch من PATCH_REGISTRY | قد يُعيد تعطيل ميزة مطبّقة | ARCHITECTURE.md |
| R-UNCONNECT-001 | وحدات dist/ غير متصلة (جديد) | 3 وحدات معزولة عن index.mjs | هذا التحليل |

---

## 8. ما تم تنفيذه في Phase 2.6

### حُذف فعلياً:

| الملف | الحجم | السبب | متى |
|---|---|---|---|
| `CLEANUP_REPORT.md` (الجذر) | 16KB | مكرر بالكامل مع docs/CLEANUP_REPORT.md | v8.0.1 (session سابقة) |

**ملفات جديدة وُجدت وحُللت (لم تُحذف):**

| الملف | القرار | السبب |
|---|---|---|
| `dist/bridge.mjs` | 🟡 احتفظ مؤقتاً | عمل مبدوء لـ Phase 3 |
| `dist/schedule.mjs` | 🟡 احتفظ مؤقتاً | عمل مبدوء لـ Phase 3 |
| `dist/security.mjs` | 🟡 احتفظ مؤقتاً | عمل مبدوء لـ Phase 3 |
| `patch-bridge-split.mjs` | 🟡 احتفظ مؤقتاً | مرتبط بـ dist/bridge.mjs |
| `patch-schedule-split.mjs` | 🟡 احتفظ مؤقتاً | مرتبط بـ dist/schedule.mjs |
| `patch-security-split.mjs` | 🟡 احتفظ مؤقتاً | مرتبط بـ dist/security.mjs |
| `docs/RUNTIME_MAP.md` | 🔴 احتفظ | توثيق مفيد |

### لا تغييرات هيكلية:
- لا ملفات أُعيد ترتيبها
- لا مجلدات فارغة (تحقق: 0 مجلد فارغ)
- لا مجلدات جديدة

---

## 9. نتيجة التحقق من سلامة الملفات

```
✅ startup.mjs موجود (نقطة الدخول)
✅ deploy.mjs موجود (نقطة الدخول البديلة)
✅ dist/index.mjs موجود (331,253 سطر)
✅ PATCH_REGISTRY يحتوي 35 patch — كلها موجودة في الجذر
✅ engine/ (10 ملفات) موجودة كاملة
✅ bootstrap/index.mjs موجود
✅ core/ (3 ملفات) موجودة
✅ infrastructure/ (4 ملفات) موجودة
✅ utils/ (2 ملفات) موجودة
✅ bin/yt-dlp-py موجود
✅ stream-dl.mjs موجود
✅ tests/validate-engine.mjs موجود
✅ 0 مجلدات فارغة
⚠️ dist/bridge.mjs + dist/schedule.mjs + dist/security.mjs — موجودة لكن غير متصلة
⚠️ 3 patches يتيمة جديدة غير مسجلة في PATCH_REGISTRY
```

---

## 10. الخطوات التالية الموصى بها (Phase 3)

```
[ ] البت في مصير الثلاثية dist/bridge+schedule+security:
    الخيار أ: ربطها — أضف patches إلى PATCH_REGISTRY ثم طبّق
    الخيار ب: احذفها — احذف dist/bridge+schedule+security + patches المقابلة

[ ] تحديث docs/MODULES.md بإضافة وصف الوحدات الجديدة (إذا اخترت الخيار أ)

[ ] حذف mongoose أو تهيئة MONGODB_URI (TD-008)

[ ] الشروع في Core Runtime Decomposition (هدف Phase 3 الأصلي)
```

---

## 11. الخلاصة

| المعيار | النتيجة |
|---|---|
| إجمالي الملفات المحللة | 120 ملف |
| ملفات محذوفة (هذه الجلسة) | 0 ملف |
| ملفات محذوفة (إجمالاً منذ Phase 2.6 بدأ) | 1 ملف (CLEANUP_REPORT.md الجذري) |
| تعارضات وثائق/كود مكتشفة | 3 تعارضات (C-01/C-02/C-03) |
| ديون تقنية جديدة | 2 ديون (TD-NEW-001/002) |
| مخاطر جديدة | 1 خطر (R-UNCONNECT-001) |
| سلامة startup chain | ✅ |
| سلامة PATCH_REGISTRY | ✅ |
| سلامة Session Engine | ✅ |

---

*Phase 2.6 مكتملة ✅ — آخر تحديث: 2026-06-28*
