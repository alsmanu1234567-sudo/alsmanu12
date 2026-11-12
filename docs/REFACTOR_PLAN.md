# REFACTOR_PLAN.md — خطة إعادة الهيكلة (نسخة docs/)
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> هذا ملف مرجعي مُلخَّص — الخطة الكاملة في /alsmanu6/REFACTOR_PLAN.md

---

## ⚠️ ملاحظة
هذا الملف ملخص سريع للخطة. التفاصيل الكاملة والمخاطر وشروط الاكتمال موجودة في:
**`/alsmanu6/REFACTOR_PLAN.md`** — المرجع الرسمي الثاني.

---

## 1. الحالة الراهنة

| المكوّن | الحالة |
|---|---|
| Bootstrap Layer | ✅ مكتمل |
| Core Layer | ✅ مكتمل |
| Infrastructure Layer | ✅ مكتمل |
| Utils Layer | ✅ مكتمل |
| Session Engine (engine/) | ✅ مكتمل — Phase 2 (10 ملفات) |
| Validation & Stress Testing | ✅ مكتمل — Phase 2.5 (74 اختبار 100%) |
| Project Cleanup | ✅ مكتمل — Phase 2.6 (تحليل 113 ملف) |
| Engine Layer (dist/) | ⚠️ مضمّن في bundle |
| Modules Layer (dist/*.mjs) | ⚠️ 16 وحدة مستخرجة |
| Testing | ⚠️ أساسي — tests/validate-engine.mjs فقط |
| Monitoring | ⚠️ أساسي فقط |

---

## 2. مراحل إعادة الهيكلة (15 مرحلة)

| المرحلة | الهدف | الحالة | الأولوية |
|---|---|---|---|
| Phase 1 | Bootstrap Layer | ✅ مكتمل | — |
| Phase 2 | Session Engine → engine/ layer (10 ملفات) | ✅ مكتمل | — |
| Phase 2.5 | Validation & Stress Testing (74 اختبار) | ✅ مكتمل | — |
| Phase 2.6 | Project Cleanup & Technical Debt Removal | ✅ مكتمل | — |
| Phase 3 | Worker Manager + Keepalive + Daily Report + Router/Dispatcher Infra | ✅ مكتمل | — |
| Phase 4 | تفعيل Message Router + Callback Dispatcher (handleMsg/handleCB) | ✅ مكتمل | — |
| Phase 5 | Keepalive + Daily Report Services | 📋 مخطَّط | 🔴 حرج |
| Phase 6 | Developer Module Hardening | 📋 مخطَّط | 🟡 متوسط |
| Phase 7 | GitHub Backup (مجدوَل تلقائياً) | 📋 مخطَّط | 🔴 حرج |
| Phase 8 | Groups Enhancement | 📋 مخطَّط | 🟢 منخفض |
| Phase 9 | Users Management System | 📋 مخطَّط | 🟡 متوسط |
| Phase 10 | Points System 2.0 | 📋 مخطَّط | 🟡 متوسط |
| Phase 11 | AI System Upgrade | 📋 مخطَّط | 🟢 منخفض |
| Phase 12 | Performance Optimization | 📋 مخطَّط | 🔴 حرج |
| Phase 13 | Monitoring & Observability | 📋 مخطَّط | 🔴 حرج |
| Phase 14 | Testing Infrastructure | 📋 مخطَّط | 🟢 منخفض |
| Phase 15 | Production Hardening | 📋 مخطَّط | 🔴 حرج |

---

## 3. الأولويات القصوى (قبل التوسع)

```
Phase 2 → Phase 5 → Phase 7 → Phase 12 → Phase 13
```

---

## 4. Phase 2.6 — Project Cleanup (مكتمل ✅)

**الهدف:** تحليل شامل للمشروع وحذف الملفات الآمنة

**ما تم:**
```
✅ تحليل 113 ملف بـ 6 معايير (Import/Reference/PATCH_REGISTRY/Startup/.replit/Build)
✅ إنشاء docs/CLEANUP_REPORT.md — تقرير تصنيف كامل (🟢/🟡/🔴) لكل ملف
✅ حذف CLEANUP_REPORT.md (الجذر) — الوحيد المصنَّف 🟢
✅ توثيق 11 Technical Debt مع خطة معالجة زمنية
✅ تحديث CHANGELOG.md + TODO.md + REFACTOR_PLAN.md
```

**لم تُحذف (بانتظار مراحلها):**
- 35 patch-*.mjs → بعد Phase 5 (R-06)
- 7 test-*.mjs في الجذر → Phase 14
- patch-stream-dl-fix.mjs (يتيم) → بعد Phase 5

---

## 5. Phase 3 — Worker Manager (التالي)

**الهدف:** استخراج Worker Manager من `dist/index.mjs` إلى `dist/worker-manager.mjs`
**يبدأ عندما:** engine/ مستقر في بيئة الإنتاج (راقب Heartbeat لأسبوع)

---

## 6. المبادئ العامة لجميع المراحل

```
1. وثّق السلوك الحالي قبل أي refactor
2. نفّذ الاستخراج
3. تحقق أن السلوك لم يتغير
4. اختبر البوت بعد كل استخراج
5. لا تنتقل للتالي إلا بعد تأكد عمل السابق
```

---

## 7. Technical Debt المرتبط بالخطة

| TD | الوصف | يُحل في |
|---|---|---|
| TD-001 | dist/index.mjs = 16MB bundle مُكثَّف | Phase 3-5 |
| TD-002 | 35 ملف patch-*.mjs في الجذر | بعد Phase 5 |
| TD-003 | ~23 patch تُطبَّق بصفر تغيير في كل startup | بعد Phase 5 |
| TD-004 | كتابة JSON غير ذرية (خطر تلف البيانات) | Phase 12 |
| TD-005 | لا graceful shutdown | Phase 5 |
| TD-006 | TypeScript source غير متاح | Phase 3 (جزئياً) |
| TD-007 | 7 ملفات test-*.mjs في الجذر (يجب → tests/) | Phase 14 |
| TD-008 | mongoose غير مُهيَّأ (BUG-002) | قريباً |
| TD-009 | IMPORTANT.md يشير إلى alsmanu4/ (اسم قديم) | قريباً |
| TD-010 | patch-stream-dl-fix.mjs — patch يتيم غير مسجَّل | بعد Phase 5 |
| TD-011 | github-sync.mjs يدوي — يجب أتمته | Phase 7 |
