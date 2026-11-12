# WhatsApp Bot Pro v8.0 — Engineering Task Board

> **هذا الملف هو لوحة التحكم التنفيذية الرسمية للمشروع.**
> يُحدَّث في نهاية كل مرحلة تطوير أو إصلاح.
> المراجع: [ARCHITECTURE.md](./ARCHITECTURE.md) · [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) · [PROJECT_RULES.md](./PROJECT_RULES.md)
> آخر تحديث: 2026-06-28

---

## 1. Executive Summary

WhatsApp Bot Pro v8.0 بوت واتسآب متكامل يُدار عبر تيليجرام.
يعمل حالياً بشكل مستقر على Replit مع إعادة اتصال تلقائية ساعية وتقرير يومي.

**الحالة الإجمالية:** 🟡 في مرحلة إعادة الهيكلة — Phase 1 مكتمل، Phase 2 قيد التخطيط.

```
النقاط القوية الحالية:
  ✅ بوت يعمل 24/7 بدون توقف
  ✅ Bootstrap layer نظيف (startup.mjs → 8 أسطر)
  ✅ 11 وحدة مستقلة في dist/*.mjs
  ✅ إعادة اتصال تلقائية ساعية
  ✅ نسخ احتياطي يدوي عبر GitHub
  ✅ وثائق معمارية رسمية (ARCHITECTURE.md)

نقاط تحتاج عمل:
  ❌ dist/index.mjs مضمّن ومكثّف (16MB bundle)
  ❌ 38 ملف patch-*.mjs في جذر المشروع
  ❌ لا توجد اختبارات رسمية
  ❌ لا نسخ احتياطية مجدولة تلقائياً
  ❌ تحذير أمني: url.parse() deprecated
```

---

## 2. Current Status

### ✅ مكتمل

| ما تم إنجازه | التاريخ | الملفات |
|---|---|---|
| Bootstrap Layer (Phase 1) | 2026-06-28 | startup.mjs, bootstrap/index.mjs |
| Core Layer | 2026-06-28 | core/logger.mjs, config.mjs, health.mjs |
| Infrastructure Layer | 2026-06-28 | infrastructure/*.mjs (4 ملفات) |
| Utils Layer | 2026-06-28 | utils/token-codec.mjs, platform.mjs |
| وثائق معمارية (3 ملفات) | 2026-06-28 | ARCHITECTURE.md, REFACTOR_PLAN.md, PROJECT_RULES.md |
| استخراج 11 وحدة مستقلة | سابق | dist/auto-reply, ai, calls, developer, forward, groups, my-msgs, persons, points, reports, status |
| نظام إعادة الاتصال الساعي | سابق | مضمّن في dist/index.mjs |
| التقرير اليومي (6ص) | سابق | مضمّن في dist/index.mjs |
| Keepalive Watchdog | سابق | مضمّن في dist/index.mjs |

### 🟡 قيد التنفيذ / التخطيط

| المهمة | المرحلة | المسار |
|---|---|---|
| استخراج Session Engine | Phase 2 | dist/session-engine.mjs |
| استخراج Worker Manager | Phase 3 | dist/worker-manager.mjs |
| استخراج Message Router | Phase 4 | dist/message-router.mjs |
| استخراج Keepalive Service | Phase 5 | dist/keepalive-service.mjs |

---

## 3. Technical Debt

> مشاكل معمارية مكتشفة أثناء التحليل — لا تمنع التشغيل حالياً لكنها تُعيق التطوير المستقبلي.

### TD-001 — dist/index.mjs مضمّن ومكثّف 🔴
**الخطورة:** عالية
**الوصف:** المحرك الرئيسي للبوت ملف واحد بحجم 16MB و331,000 سطر — يحتوي npm libraries + كود المشروع مخلوطة.
**الأثر:** لا يمكن استعراض أي وحدة بمعزل، الاختبار شبه مستحيل، الصيانة صعبة.
**الحل:** استخراج تدريجي (Phases 2-5).

### TD-002 — 38 ملف patch-*.mjs في جذر المشروع 🔴
**الخطورة:** عالية
**الوصف:** 38 ملف تعديل تاريخي يلوّث جذر المشروع ويخالف PROJECT_RULES.md.
**الأثر:** يصعب فهم ما هو "الكود الرئيسي" — أي ملف جديد يُضاف.
**الحل:** أرشفة في `legacy/patches/` بعد إتمام Phase 2-5، ثم حذف نهائي.

### TD-003 — 23 تعديلاً تُطبَّق بصفر تغيير عند كل تشغيل ⚠️
**الخطورة:** متوسطة
**الوصف:** من 35 تعديل مسجّل، 23 تعود بـ "0 تغيير" لأنها مطبّقة مسبقاً. هذا 23 عملية `node patch-*.mjs` لا فائدة منها عند كل startup.
**الأثر:** بطء في وقت التشغيل الأولي (من 15 إلى 45 ثانية إضافية).
**الحل:** بعد Phase 2-5، الغاء آلية الباتشات كلياً.

### TD-004 — قاعدة بيانات JSON بدون حماية تزامن ⚠️
**الخطورة:** متوسطة
**الوصف:** `bot-data/*.json` تُكتب بشكل متكرر (كل 3 دقائق). إذا توقف البوت أثناء الكتابة → ملف JSON تالف.
**الأثر:** فقدان بيانات جميع المستخدمين عند crash في لحظة خاطئة.
**الحل:** الكتابة الآمنة (write to temp → rename) أو الانتقال لـ SQLite/MongoDB.

### TD-005 — لا graceful shutdown handler ⚠️
**الخطورة:** متوسطة
**الوصف:** عند إعادة تشغيل Replit (SIGTERM)، البوت يُغلق فوراً بدون حفظ البيانات الأخيرة.
**الأثر:** قد يُفقد آخر 3 دقائق من البيانات (فترة الحفظ التلقائي).
**الحل:** إضافة `process.on('SIGTERM', saveAndExit)`.

### TD-006 — TypeScript source غير متاح 🔴
**الخطورة:** عالية
**الوصف:** `dist/index.mjs` مُجمَّع من TypeScript لكن ملفات `src/` غير موجودة في المشروع الحالي — لا يمكن إعادة البناء.
**الأثر:** أي تغيير في Engine يجب أن يتم عبر تعديل الـ bundle مباشرة (هش وخطير).
**الحل المؤقت:** استخراج الوحدات إلى dist/*.mjs مستقلة (Phases 2-5).
**الحل الدائم:** استعادة src/ أو إعادة كتابة TypeScript من الصفر.

### TD-007 — ملفات تنتهك قواعد التسمية ⚠️
**الخطورة:** منخفضة
**الوصف:** الملفات التالية موجودة في جذر المشروع وتنتهك PROJECT_RULES.md:
- `fix-syntax.cjs`, `fix-syntax.mjs` (تبدأ بـ fix-)
- `fix-tiktok-dup.mjs` (تبدأ بـ fix-)
- `bootstrap.mjs` (ملف قديم يتعارض مع `bootstrap/` الجديد)
**الحل:** مراجعة وأرشفة أو حذف.

### TD-008 — MongoDB مُعلَّن كـ dependency لكن غير مُهيَّأ ⚠️
**الخطورة:** منخفضة
**الوصف:** `package.json` يحتوي `mongoose` لكن لا يوجد `MONGODB_URI` → يطبع تحذيراً عند كل تشغيل.
**الأثر:** تحذير في السجلات + حزمة mongoose (12MB) تُثبَّت دون استخدام.
**الحل:** إما تهيئة MongoDB أو حذف mongoose من dependencies.

### TD-009 — patch-fixes-v2.mjs كان مسجَّلاً مرتين في القائمة التاريخية ℹ️
**الخطورة:** منخفضة (مُصلَح في Phase 1)
**الوصف:** في startup.mjs الأصلي، `patch-fixes-v2.mjs` كان يظهر مرتين بوصفين مختلفين.
**الحالة:** تم توحيدهما في `infrastructure/patch-manager.mjs` — المرور المزدوج كان no-op بسبب guard الداخلي.

### ~~TD-NEW-001~~ — وحدات dist/ مفصولة لكن غير متصلة ✅ محلول (Phase 2.7)
**الخطورة:** متوسطة (كانت)
**الوصف:** `dist/bridge.mjs`, `dist/schedule.mjs`, `dist/security.mjs` كانت موجودة لكن غير مستوردة.
**الحالة:** ✅ **حُسمت في Phase 2.7 — 2026-06-28**
- 3 patches طُبِّقت على dist/index.mjs (وُفِّر 30,955 حرف)
- 3 imports أُضيفت (أسطر 8، 10، 11)
- 3 stubs استبدلت الكود الأصلي
- 3 patches سُجِّلت في PATCH_REGISTRY (إدخالات 36-38)

### TD-NEW-002 — patch-stream-dl-fix.mjs يتيم ⚠️ (متبقٍّ من Phase 2.6 بعد حسم الثلاثة الأخرى)
**الخطورة:** منخفضة
**الوصف:** ملف واحد متبقٍّ غير مسجّل في PATCH_REGISTRY:
- `patch-stream-dl-fix.mjs` (يتيم من session قديمة — غير معروفة الوظيفة بدقة)
**الأثر:** يُشغل مساحة في جذر المشروع دون أثر وظيفي.
**الحل:** Phase 15 (تنظيف الجذر) — فحص ومراجعة.

---

## 4. Known Bugs

### BUG-001 — تحذير أمني: `url.parse()` deprecated 🔴
**الموقع:** داخل dist/index.mjs (مكتبة خارجية مضمّنة)
**السجل:**
```
[DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized
and prone to errors that have security implications.
```
**الأثر:** Node.js قد يُوقف الدعم في إصدار مستقبلي.
**الحل:** تحديث المكتبة المسببة أو تجاوزها بـ `--no-deprecation` (مؤقت).
**الحالة:** 🟡 مُعلَّق — يحتاج تحديد المكتبة المسببة.

### BUG-002 — MongoDB unavailable عند كل تشغيل ⚠️
**الموقع:** dist/index.mjs عند init_database()
**السجل:**
```
WARN: MongoDB not available — using file-based storage
```
**الأثر:** لا أثر على الوظائف — لكن يملأ السجلات بتحذيرات مضللة.
**الحل:** إزالة mongoose من dependencies أو تهيئة MONGODB_URI.
**الحالة:** 🔴 لم يُصلَح.

### ~~BUG-003~~ — bootstrap.mjs في الجذر (ملف قديم) ✅ محلول
**الموقع:** الجذر
**الوصف:** ملف قديم في الجذر كان يتعارض اسمياً مع مجلد `bootstrap/` الجديد.
**الحالة:** ✅ **محذوف في v8.0.1 — 2026-06-28**

---

## 5. Critical Tasks

> يجب تنفيذها قبل أي توسع في قاعدة المستخدمين.

| # | المهمة | السبب | المرحلة |
|---|---|---|---|
| C-01 | **استخراج Session Engine** — `dist/session-engine.mjs` | أي خطأ في session يمس كل المستخدمين | Phase 2 |
| C-02 | **graceful shutdown handler** — حفظ البيانات قبل SIGTERM | خطر فقدان البيانات | Phase 5 |
| C-03 | **atomic JSON writes** — كتابة آمنة لـ bot-data/ | خطر تلف البيانات عند crash | Phase 12 |
| C-04 | **تنظيف patch-*.mjs** — أرشفة 38 ملف | انتهاك معماري مستمر | بعد Phase 5 |

---

## 6. High Priority

| # | المهمة | السبب |
|---|---|---|
| H-01 | استخراج Worker Manager → `dist/worker-manager.mjs` | يتحكم في كل جلسات المستخدمين |
| H-02 | استخراج Keepalive Service → `dist/keepalive-service.mjs` | خدمة حرجة يجب اختبارها مستقلة |
| H-03 | نسخ احتياطية مجدولة تلقائياً (يومياً) | حالياً: manual فقط |
| H-04 | إصلاح BUG-002: إزالة mongoose أو تهيئته | يلوّث السجلات بتحذيرات |
| H-05 | حذف أو أرشفة: `bootstrap.mjs`, `fix-syntax.*`, `fix-tiktok-dup.mjs` | تنتهك PROJECT_RULES.md |

---

## 7. Medium Priority

| # | المهمة | السبب |
|---|---|---|
| M-01 | استخراج Message Router → `dist/message-router.mjs` | توجيه الرسائل يجب أن يكون قابلاً للقراءة |
| M-02 | استخراج Callback Dispatcher → `dist/callback-dispatcher.mjs` | 50+ زر في handler واحد |
| M-03 | استخراج Daily Report Service | background task يجب أن يكون مستقلاً |
| M-04 | LRU Cache لـ inMemoryDB | منع تسرب الذاكرة مع نمو المستخدمين |
| M-05 | تحديث الحزمة المسببة لـ BUG-001 (url.parse) | تحذير أمني |
| M-06 | إضافة `export const patches` من patch-manager.mjs لعرضها في Dev Panel | شفافية |
| M-07 | pagination لقوائم المستخدمين في Developer Panel | يتعطل مع 1000+ مستخدم |

---

## 8. Low Priority

| # | المهمة | السبب |
|---|---|---|
| L-01 | metrics endpoint: GET /api/metrics | مراقبة خارجية |
| L-02 | نظام انتهاء صلاحية النقاط (points expiry) | نظام اقتصادي سليم |
| L-03 | ذاكرة محادثة AI دائمة (بين الجلسات) | تجربة مستخدم أفضل |
| L-04 | rate limiting على HTTP endpoints | أمان |
| L-05 | تشفير credentials في bot-data/sessions/ | أمان البيانات الحساسة |
| L-06 | export قائمة المستخدمين (CSV) من Dev Panel | أداة إدارة مفيدة |
| L-07 | إحصائيات نمو أسبوعية في التقرير اليومي | متابعة الأداء التجاري |

---

## 9. Future Improvements

> أفكار استراتيجية بعيدة المدى — لا تنفيذ فوري مطلوب.

| الفكرة | الفائدة | الجهد |
|---|---|---|
| الانتقال لـ SQLite بدلاً من JSON | أمان البيانات + أداء أفضل مع 10k+ مستخدم | عالٍ |
| إعادة كتابة المصدر TypeScript | قابلية صيانة كاملة | عالٍ جداً |
| نظام إضافات (plugin system) | توسيع الوحدات دون تعديل Engine | عالٍ |
| دعم multi-tenant (بوت لكل مستخدم) | عزل كامل بين المستخدمين | عالٍ جداً |
| واجهة ويب لإدارة البوت | بديل للـ Dev Panel في تيليجرام | متوسط |
| دعم nسخ متعددة من البوت (clustering) | عدم وقف الخدمة عند التحديثات | عالٍ |
| تقرير تكلفة OpenAI يومي | مراقبة الميزانية | منخفض |
| إشعارات واتسآب عند فشل الجلسة | تجربة مستخدم أفضل | منخفض |

---

## 10. Completed Tasks

| المهمة | التاريخ | التفاصيل |
|---|---|---|
| Phase 1: Bootstrap Layer | 2026-06-28 | استخراج 9 ملفات خدمة من startup.mjs (286→8 سطر) |
| Core Layer: logger.mjs | 2026-06-28 | source of truth لكل طباعة ملوّنة |
| Core Layer: config.mjs | 2026-06-28 | تحميل config.json + env defaults + token decode |
| Core Layer: health.mjs | 2026-06-28 | Node.js + RAM + ffmpeg checks |
| Infrastructure: patch-manager.mjs | 2026-06-28 | سجل 35 تعديل + تطبيق منظّم |
| Infrastructure: package-manager.mjs | 2026-06-28 | npm + حزم حرجة |
| Infrastructure: binary-manager.mjs | 2026-06-28 | yt-dlp lifecycle (4 استراتيجيات) |
| Infrastructure: process-manager.mjs | 2026-06-28 | spawn/monitor bot process |
| Utils: token-codec.mjs | 2026-06-28 | AES-256-CBC + XOR — مستقل ومُعاد استخدامه |
| Utils: platform.mjs | 2026-06-28 | platform info + binary names |
| وثائق: ARCHITECTURE.md | 2026-06-28 | 628 سطر — المرجع التقني الكامل |
| وثائق: REFACTOR_PLAN.md | 2026-06-28 | 388 سطر — 15 مرحلة مفصّلة |
| وثائق: PROJECT_RULES.md | 2026-06-28 | 419 سطر — دستور المشروع |
| وثائق: TODO.md | 2026-06-28 | هذا الملف — لوحة التحكم التنفيذية |
| استخراج dist/auto-reply.mjs | سابق | الردود التلقائية — وحدة مستقلة |
| استخراج dist/ai.mjs | سابق | الذكاء الاصطناعي — وحدة مستقلة |
| استخراج dist/calls.mjs | سابق | المكالمات — وحدة مستقلة |
| استخراج dist/developer.mjs | سابق | God Panel — وحدة مستقلة |
| استخراج dist/forward.mjs | سابق | التحويل — وحدة مستقلة |
| استخراج dist/groups.mjs | سابق | المجموعات — وحدة مستقلة |
| استخراج dist/my-msgs.mjs | سابق | رسائلي — وحدة مستقلة |
| استخراج dist/persons.mjs | سابق | جهات الاتصال — وحدة مستقلة |
| استخراج dist/points.mjs | سابق | النقاط — وحدة مستقلة |
| استخراج dist/reports.mjs | سابق | البلاغات — وحدة مستقلة |
| استخراج dist/status.mjs | سابق | الحالات — وحدة مستقلة |
| نظام إعادة الاتصال الساعي | سابق | reconnectSession كل ساعة |
| التقرير اليومي (6ص) | سابق | إرسال للمطوّر تلقائياً |
| Keepalive Watchdog | سابق | مراقبة استجابة البوت |
| نظام GitHub Sync (يدوي) | سابق | نسخ/استعادة bot-data/ |
| نظام النقاط الأساسي | سابق | شراء الباقات، رصيد، سجل |

---

## 11. Risks

| # | الخطر | الاحتمال | الأثر | التخفيف |
|---|---|---|---|---|
| R-01 | تلف bot-data/*.json عند crash | متوسط | كارثي — فقدان بيانات كل المستخدمين | كتابة atomic + نسخ احتياطي يومي |
| R-02 | انهيار dist/index.mjs (bundle corruption) | منخفض | توقف تام للبوت | نسخة احتياطية من dist/ في GitHub |
| R-03 | نفاد الذاكرة (RAM) مع نمو الجلسات | متوسط | توقف Replit تلقائياً | LRU Cache + مراقبة MAX_RAM_MB |
| R-04 | انتهاء صلاحية GITHUB_TOKEN | متوسط | فشل النسخ الاحتياطية | تنبيه عند اقتراب الانتهاء |
| R-05 | Node.js يُوقف url.parse() (BUG-001) | منخفض | crash محتمل في إصدار مستقبلي | تحديث المكتبة المسببة |
| R-06 | حذف patch-*.mjs قبل استخراج الوحدات | مرتفع | فقدان منطق لم يُستخرج بعد | لا تحذف حتى Phase 5 مكتمل |
| R-07 | تعارض الجلسات عند restart سريع | منخفض | جلسات مكررة أو متنافسة | graceful shutdown في C-02 |
| R-08 | تجاوز حد Telegram API (30 msg/s) | متوسط | حظر مؤقت للبوت | rate limiting في message router |
| R-09 | OpenAI API key تنتهي/تُلغى | منخفض | توقف AI فقط (لا يمس باقي الوظائف) | error handling في ai.mjs موجود |

---

## 12. Performance Targets

| المعيار | الهدف | الحالة |
|---|---|---|
| وقت تشغيل البوت (startup) | < 30 ثانية | 🟡 ~45-60 ثانية (بسبب 23 patch بلا تغيير) |
| استهلاك RAM (خامل) | < 200MB | ✅ ~150-180MB |
| استهلاك RAM (نشط مع 50 جلسة) | < 512MB | 🟡 غير مقاس |
| وقت استجابة تيليجرام | < 500ms | ✅ طبيعي مع polling |
| الجلسات المتزامنة | هدف: 1,000 | 🟡 غير مختبر |
| المستخدمون النهائيون | هدف: 10,000 | 🟡 غير مختبر |
| استقرار 24/7 | لا توقف غير مجدوَل | ✅ Watchdog يُعيد التشغيل تلقائياً |
| استعادة الجلسات بعد restart | 100% من الجلسات | ✅ hourly reconnect يتولى ذلك |
| عدم توقف البوت عند خطأ Module | دائماً | ✅ try-catch في كل handler |
| وقت استرداد النسخة الاحتياطية | < 60 ثانية | 🟡 يدوي — لم يُختبر بانتظام |

---

## 13. Architecture Progress

| النظام | الملف الرئيسي | الحالة | ملاحظة |
|---|---|---|---|
| **Bootstrap** | `bootstrap/index.mjs` | ✅ مكتمل | Phase 1 — 52 سطر نظيفة |
| **Core** | `core/*.mjs` | ✅ مكتمل | logger, config, health |
| **Infrastructure** | `infrastructure/*.mjs` | ✅ مكتمل | 4 ملفات، مسؤوليات واضحة |
| **Utils** | `utils/*.mjs` | ✅ مكتمل | token-codec, platform |
| **Engine** | `dist/index.mjs` | 🟡 مضمّن | يحتاج Phases 2-5 |
| **Session Manager** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 2 التالي |
| **Worker Manager** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 3 |
| **Message Router** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 4 |
| **Callback Dispatcher** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 4 |
| **Keepalive** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 5 |
| **Daily Report** | داخل dist/index.mjs | 🔴 لم يُستخرج | Phase 5 |
| **Developer Module** | `dist/developer.mjs` | ✅ مستخرج | يعمل بشكل كامل |
| **GitHub Sync** | داخل dist/developer.mjs | 🟡 يدوي فقط | Phase 7: جدولة تلقائية |
| **Groups Module** | `dist/groups.mjs` | ✅ مستخرج | وظائف أساسية |
| **Users System** | داخل dist/index.mjs | 🟡 أساسي | Phase 9: تطوير |
| **Points System** | `dist/points.mjs` | ✅ مستخرج | يعمل، بدون expiry |
| **AI Module** | `dist/ai.mjs` | ✅ مستخرج | بدون ذاكرة دائمة |
| **Auto Reply** | `dist/auto-reply.mjs` | ✅ مستخرج | يعمل كاملاً |
| **Backup System** | جزئي في developer.mjs | 🟡 يدوي | Phase 7: تلقائي |
| **Scheduler** | مُضمَّن (hourly + 6AM) | 🟡 بدائي | Phase 5: وحدة مستقلة |
| **Monitoring** | Watchdog + Dev alerts | 🟡 أساسي | Phase 13: شامل |
| **Testing** | test-*.mjs يدوية | 🔴 لم يبدأ | Phase 14 |

---

## 14. Refactor Checklist

### ◉ Bootstrap & Startup
- [x] `startup.mjs` → entry point نقي (8 أسطر)
- [x] `bootstrap/index.mjs` → orchestrator (52 سطر)
- [x] `core/logger.mjs` → source of truth للطباعة
- [x] `core/config.mjs` → تحميل config.json + defaults
- [x] `core/health.mjs` → فحوصات النظام
- [x] `infrastructure/patch-manager.mjs` → سجل + تطبيق
- [x] `infrastructure/package-manager.mjs` → npm management
- [x] `infrastructure/binary-manager.mjs` → yt-dlp lifecycle
- [x] `infrastructure/process-manager.mjs` → spawn + monitor
- [x] `utils/token-codec.mjs` → AES + XOR codec
- [x] `utils/platform.mjs` → platform info

### ◉ Engine Layer
- [ ] استخراج Session Engine → `dist/session-engine.mjs`
- [ ] استخراج Worker Manager → `dist/worker-manager.mjs`
- [ ] استخراج Message Router → `dist/message-router.mjs`
- [ ] استخراج Callback Dispatcher → `dist/callback-dispatcher.mjs`
- [ ] استخراج Keepalive Service → `dist/keepalive-service.mjs`
- [ ] استخراج Daily Report Service → `dist/daily-report-service.mjs`

### ◉ Infrastructure Hardening
- [ ] graceful shutdown handler (SIGTERM → save → exit)
- [ ] atomic JSON writes (write to temp file → rename)
- [ ] أرشفة patch-*.mjs في `legacy/patches/`
- [ ] حذف الملفات المنتهكة لقواعد التسمية

### ◉ Modules Enhancement
- [ ] GitHub Backup: جدولة يومية تلقائية
- [ ] Groups: تصفية + إرسال جماعي مع rate limiting
- [ ] Users: pagination + filtering + export CSV
- [ ] Points: نظام انتهاء الصلاحية
- [ ] AI: ذاكرة محادثة دائمة

### ◉ Performance
- [ ] LRU Cache لـ inMemoryDB (حد أقصى للحجم)
- [ ] Queue للعمليات الثقيلة (download, compress)
- [ ] Rate limiting: WhatsApp (1 msg/2s per contact)
- [ ] اختبار ضغط: 100 جلسة متزامنة

### ◉ Reliability
- [ ] اختبار استعادة الجلسات بعد restart
- [ ] اختبار سلوك البوت عند فشل Module
- [ ] اختبار النسخ الاحتياطي والاستعادة
- [ ] اختبار crash وتحقق من سلامة البيانات

### ◉ Monitoring
- [ ] `GET /api/metrics` (Prometheus format)
- [ ] لوحة صحة في Dev Panel (RAM, sessions, uptime)
- [ ] تنبيه فوري عند فشل جلسة لأكثر من 10 دقائق

### ◉ Testing
- [ ] `tests/unit/token-codec.test.mjs`
- [ ] `tests/unit/config.test.mjs`
- [ ] `tests/unit/health.test.mjs`
- [ ] `tests/integration/session-lifecycle.test.mjs`
- [ ] `tests/integration/message-flow.test.mjs`
- [ ] `npm test` يعمل ويطبع نتائج

### ◉ Cleanup
- [ ] إزالة mongoose من dependencies (أو تهيئته)
- [ ] حذف/أرشفة 7 ملفات test-*.mjs من الجذر
- [ ] إصلاح url.parse() deprecation (BUG-001)
- [ ] حذف bootstrap.mjs القديم من الجذر

---

> **كيفية استخدام هذا الملف:**
> 1. في بداية كل جلسة عمل — اقرأ الأقسام 2، 5، 13
> 2. عند اكتمال مهمة — حرّك من الـ Checklist إلى قسم 10 مع التاريخ
> 3. عند اكتشاف مشكلة جديدة — أضفها لقسم 3 أو 4 حسب نوعها
> 4. تحديث قسم 13 عند اكتمال أي نظام
