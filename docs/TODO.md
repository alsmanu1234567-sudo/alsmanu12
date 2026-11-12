# TODO.md — لوحة المهام (نسخة docs/)
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-30
> هذا ملف مرجعي مُلخَّص — لوحة التحكم الكاملة في /alsmanu6/TODO.md

---

## ⚠️ ملاحظة
هذا الملف ملخص سريع لحالة المهام. اللوحة التنفيذية الكاملة (مع TD، Bugs، Risks، Checklists) موجودة في:
**`/alsmanu6/TODO.md`** — المرجع الرسمي الثالث.

---

## 1. الحالة الإجمالية

```
🟢 Phase 1→9 جميعها مكتملة ✅
✅ البوت يعمل 24/7 بشكل مستقر + Session Engine نشط
✅ dist/index.mjs = Bootstrap/Composition خالص — لا Business Logic مباشر
✅ 29 ملف dist/*.mjs + dist/handlers/ (22 handler + 4 بنية تحتية + index)
✅ dist/services/ = طبقة Business Logic مستقلة (8 ملفات / 7 مجلدات)
✅ text-handler.mjs: Thin Orchestrator (60 سطر) ✅
✅ payment/media/document/forward handlers: وحدات مستقلة ✅
✅ Handlers = Thin Orchestrators — Business Logic في Services ✅
```

---

## 2. مكتمل ✅

| المهمة | التاريخ |
|---|---|
| Bootstrap Layer (Phase 1) | 2026-06-28 |
| Core Layer (logger, config, health) | 2026-06-28 |
| Infrastructure Layer (4 ملفات) | 2026-06-28 |
| Utils Layer (token-codec, platform) | 2026-06-28 |
| استخراج 11 وحدة dist/*.mjs | قبل 2026-06-28 |
| نظام إعادة الاتصال الساعي | قبل 2026-06-28 |
| التقرير اليومي (6ص) | قبل 2026-06-28 |
| Keepalive Watchdog | قبل 2026-06-28 |
| نسخ احتياطي يدوي عبر GitHub | قبل 2026-06-28 |
| وثائق معمارية شاملة (docs/ — 14 ملف) | 2026-06-28 |
| **Project Cleanup v1** — تنظيف 6 ملفات orphan/fix/bootstrap | 2026-06-28 |
| **Phase 9: Service Layer Extraction** — 8 Services + 5 handlers محدَّثة + ~108 سطر business logic منقولة | 2026-06-30 |
| **Phase 2: Session Engine** — طبقة engine/ كاملة (10 ملفات) | 2026-06-28 |
| **Phase 2.5: Validation & Stress Testing** — 74 اختبار 100% ✅ | 2026-06-28 |
| **Phase 2.6: Project Cleanup** — تحليل 113 ملف + docs/CLEANUP_REPORT.md (الجلسة الأولى) | 2026-06-28 |
| **Phase 2.6: Project Cleanup — إعادة تحليل كامل** — 120 ملف، 3 تعارضات، 2 ديون جديدة | 2026-06-28 |
| **Phase 2.7: Orphan Modules Resolution** — 6 ملفات A، 3 patches مدمجة، 30,955 حرف محرّر | 2026-06-28 |
| **Phase 3: Worker Manager & Routing Refactor** — 5 وحدات جديدة، 4 patches، 42 PATCH_REGISTRY | 2026-06-28 |

---

## 3. مهام حرجة (C) — قبل التوسع

| # | المهمة | المرحلة | الخطورة |
|---|---|---|---|
| ~~C-01~~ | ~~استخراج Session Engine → engine/ layer~~ | ~~Phase 2~~ | ✅ **مكتمل 2026-06-28** |
| C-02 | graceful shutdown handler (SIGTERM → save → exit) | Phase 5 | 🔴 |
| C-03 | atomic JSON writes لـ bot-data/ | Phase 12 | 🔴 |
| C-04 | تنظيف + أرشفة 35 ملف patch-*.mjs في PATCH_REGISTRY | بعد Phase 5 | 🟠 |

---

## 4. عالية الأولوية (H)

| # | المهمة | السبب |
|---|---|---|
| H-01 | استخراج Worker Manager → dist/worker-manager.mjs | يتحكم في كل جلسات المستخدمين |
| H-02 | استخراج Keepalive Service | خدمة حرجة يجب اختبارها مستقلة |
| H-03 | نسخ احتياطية يومية تلقائية | حالياً: يدوي فقط |
| H-04 | إصلاح BUG-002: إزالة mongoose أو تهيئته | يلوّث السجلات |
| ~~H-05~~ | ~~حذف: bootstrap.mjs, fix-syntax.*, fix-tiktok-dup.mjs~~ | ✅ **مكتمل 2026-06-28** |

---

## 5. متوسطة الأولوية (M)

| # | المهمة |
|---|---|
| M-01 | استخراج Message Router → dist/message-router.mjs |
| M-02 | استخراج Callback Dispatcher |
| M-03 | استخراج Daily Report Service |
| M-04 | LRU Cache لـ inMemoryDB |
| M-05 | تحديث المكتبة المسببة لـ BUG-001 (url.parse) |
| M-06 | pagination لقوائم المستخدمين في Developer Panel |

---

## 6. منخفضة الأولوية (L)

| # | المهمة |
|---|---|
| L-01 | metrics endpoint: GET /api/metrics |
| L-02 | نظام انتهاء صلاحية النقاط |
| L-03 | ذاكرة محادثة AI دائمة |
| L-04 | rate limiting على HTTP endpoints |
| L-05 | تشفير credentials في bot-data/sessions/ |
| L-06 | export CSV للمستخدمين |
| L-07 | إحصائيات نمو أسبوعية |

---

## 7. الأخطاء المعروفة (Bugs)

| # | الخطأ | الخطورة | الحالة |
|---|---|---|---|
| BUG-001 | url.parse() deprecated في bundle | 🔴 | معلّق |
| BUG-002 | MongoDB unavailable عند كل تشغيل | ⚠️ | لم يُصلَح |
| ~~BUG-003~~ | ~~bootstrap.mjs قديم في الجذر~~ | ℹ️ | ✅ **محذوف 2026-06-28** |
| BUG-NEW-001 | dist/bridge+schedule+security موجودة لكن غير متصلة | ⚠️ | Phase 3 |
| BUG-NEW-002 | 3 patches جديدة غير مسجلة في PATCH_REGISTRY | ⚠️ | Phase 3 |

---

## 8. المخاطر الرئيسية (Risks)

| # | الخطر | الاحتمال | الأثر |
|---|---|---|---|
| R-01 | تلف bot-data/*.json عند crash | متوسط | كارثي |
| R-02 | انهيار dist/index.mjs | منخفض | توقف تام |
| R-03 | نفاد RAM مع نمو الجلسات | متوسط | توقف Replit |
| R-04 | انتهاء صلاحية GITHUB_TOKEN | متوسط | فشل النسخ |
| R-05 | Node.js يُوقف url.parse() | منخفض | crash محتمل |
| R-06 | حذف patch-*.mjs قبل Phase 5 | مرتفع | فقدان منطق |
| R-UNCONNECT-001 | 3 وحدات dist/ يتيمة لا تُفعَّل أبداً | منخفض | هدر + التباس |

---

## 9. مؤشرات الأداء المستهدفة

| المعيار | الهدف | الحالة |
|---|---|---|
| وقت startup | < 30 ثانية | 🟡 ~45-60 ثانية |
| RAM خامل | < 200MB | ✅ ~150-180MB |
| جلسات متزامنة | 1,000 | 🟡 غير مختبر |
| استقرار 24/7 | لا توقف | ✅ Watchdog |
| استعادة جلسات | 100% | ✅ hourly reconnect |

---

## 10. المرحلة التالية: Phase 3

**الهدف:** `dist/worker-manager.mjs` — استخراج Worker Manager  
**يبدأ عندما:** engine/ مستقر في بيئة الإنتاج (راقب Heartbeat لأسبوع)  
**المدة المتوقعة:** 3-4 ساعات عمل  
**المرجع:** `/alsmanu6/REFACTOR_PLAN.md` Phase 3 (تفاصيل كاملة)

---

## 11. Phase 2 — ما تم ✅

```
✅ engine/lifecycle.mjs       — State Machine (8 حالات)
✅ engine/session-storage.mjs — فحص + عزل ملفات JSON
✅ engine/queue.mjs           — Async Queue بأولوية
✅ engine/worker-tracker.mjs  — تتبع صحة كل جلسة
✅ engine/health-monitor.mjs  — HTTP polling + فحص ملفات
✅ engine/heartbeat.mjs       — نبضة 30s + كشف جمود
✅ engine/reconnect-manager.mjs — Backoff مستقل لكل جلسة
✅ engine/recovery-manager.mjs  — عزل + إعادة تشغيل آمن
✅ engine/session-manager.mjs   — تنسيق مركزي
✅ engine/index.mjs             — startEngine() entry point
✅ core/logger.mjs — إضافة logErr() غير الفادح
✅ infrastructure/process-manager.mjs — autoRestart + callbacks
✅ bootstrap/index.mjs — تكامل Session Engine كامل
```
