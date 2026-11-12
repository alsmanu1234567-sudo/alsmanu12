# WhatsApp Bot Pro v8.0 — خطة إعادة الهيكلة الشاملة

> **المرجع الرسمي لخطة التطوير.**
> اقرأ ARCHITECTURE.md و PROJECT_RULES.md قبل البدء في أي مرحلة.
> آخر تحديث: 2026-06-28

---

## الحالة الراهنة

| المكوّن | الحالة |
|---|---|
| Bootstrap Layer | ✅ مكتمل — startup.mjs + bootstrap/ |
| Core Layer | ✅ مكتمل — logger, config, health |
| Infrastructure Layer | ✅ مكتمل — patch, package, binary, process |
| Utils Layer | ✅ مكتمل — token-codec, platform |
| Engine Layer (dist/) | ⚠️ قابل للتحسين — مضمّن في bundle |
| Modules Layer (dist/*.mjs) | ⚠️ مستخرجة جزئياً — 11 وحدة |
| Engine Services | ❌ غير مستخرجة — مضمّنة في index.mjs |
| Testing | ❌ غير رسمي — فقط test-*.mjs يدوية |
| Monitoring | ⚠️ أساسي — Watchdog + Daily Report |

---

## مبادئ عامة لجميع المراحل

1. **لا تغيّر سلوكاً دون اختبار** — قارن النتيجة قبل وبعد
2. **طبّق قاعدة واحدة في كل commit** — سهّل التتبع
3. **احتفظ بنقطة تراجع** — checkpoint قبل كل مرحلة
4. **اختبر البوت بعد كل استخراج** — راجع السجلات
5. **وثّق القرارات المعمارية** — أضف تعليقاً في رأس الملف

---

## Phase 1 — Bootstrap Layer ✅ مكتملة

**الهدف:** تحويل startup.mjs من 286 سطر مختلطة إلى 8 أسطر نقية.

**الملفات:**
- `startup.mjs` ← entry point نقي
- `bootstrap/index.mjs` ← المنسّق
- `core/logger.mjs`, `core/config.mjs`, `core/health.mjs`
- `infrastructure/patch-manager.mjs`, `package-manager.mjs`, `binary-manager.mjs`, `process-manager.mjs`
- `utils/token-codec.mjs`, `utils/platform.mjs`

**شروط الاكتمال:** ✅ تحقق جميعها
- [x] startup.mjs أقل من 15 سطراً
- [x] كل ملف له مسؤولية واحدة
- [x] البوت يعمل بعد إعادة الهيكلة
- [x] السجلات تُظهر "Startup v4"

---

## Phase 2 — Session Engine

**الهدف:** استخراج `baileys-session.ts` من داخل `dist/index.mjs` إلى وحدة مستقلة `dist/session-engine.mjs`.

**الدوافع:**
- Session Manager = أكبر وأهم وحدة في النظام (حوالي 2,700 سطر)
- تحتوي على: QR، pairing، reconnect، credentials، events
- عزلها يسهّل الاختبار والصيانة بشكل كبير

**الملفات المتأثرة:**
- `dist/session-engine.mjs` ← جديد (يُستخرج من index.mjs)
- `dist/index.mjs` ← يُضاف import بديل للاستخدام الداخلي

**المخاطر:**
- ⚠️ الكود المستخرج يستخدم وحدات داخلية مُهيَّأة في index.mjs
- ⚠️ ترتيب التهيئة حسّاس (init_logger → init_database → init_baileys_session)

**طريقة الاختبار:**
1. شغّل البوت واختبر ربط رقم جديد بـ QR
2. شغّل البوت واختبر ربط رقم بـ pairing code
3. أعد التشغيل وتحقق من استعادة الجلسات

**شروط الاكتمال:**
- [ ] `dist/session-engine.mjs` موجود ومُصدَّر بشكل صحيح
- [ ] QR يعمل
- [ ] Pairing يعمل
- [ ] Reconnect يعمل بعد إعادة التشغيل
- [ ] لا أخطاء في السجلات

---

## Phase 3 — Worker Manager

**الهدف:** استخراج `workers.ts` إلى `dist/worker-manager.mjs`.

**الدوافع:**
- Worker Manager يتحكم في دورة حياة كل جلسة واتسآب
- يحتوي على: health check، reconnect callbacks، global reconnect
- عزله يسمح بتطوير استراتيجيات reconnect مستقلة

**الملفات المتأثرة:**
- `dist/worker-manager.mjs` ← جديد
- `dist/index.mjs` ← استبدال الاستخدام الداخلي

**المخاطر:**
- ⚠️ `WorkerManager` singleton — يجب ضمان مثيل واحد
- ⚠️ يعتمد على `inMemoryDB` الداخلية

**طريقة الاختبار:**
1. اربط جلسة، افصلها، تحقق من إعادة الاتصال
2. راجع `workerManager.getAllWorkers()` عبر Dev Panel

**شروط الاكتمال:**
- [ ] `dist/worker-manager.mjs` يُصدَّر `WorkerManager`
- [ ] `workerManager.getStats()` يُعيد بيانات صحيحة
- [ ] إعادة الاتصال التلقائية تعمل

---

## Phase 4 — Message Router

**الهدف:** استخراج `messages.ts` و `callbacks.ts` إلى وحدات توجيه مستقلة.

**الدوافع:**
- Message Router = نقطة مرور كل رسالة تيليجرام — يجب أن تكون قابلة للقراءة
- Callback Dispatcher يُشغّل الأزرار — معقد جداً في حالته الحالية
- الفصل يجعل إضافة أوامر جديدة أبسط

**الملفات الجديدة:**
- `dist/message-router.mjs` ← توجيه رسائل تيليجرام
- `dist/callback-dispatcher.mjs` ← توجيه ضغطات الأزرار

**المخاطر:**
- ⚠️ الـ router يعتمد على state management الداخلي
- ⚠️ الأزرار كثيرة جداً (50+ prefix) — خطأ واحد يكسر ميزة

**طريقة الاختبار:**
- اختبر أمر /start, /help, /download
- اختبر ضغط كل زر رئيسي في القائمة

**شروط الاكتمال:**
- [ ] جميع الأوامر الموثّقة تعمل
- [ ] جميع أزرار القائمة الرئيسية تعمل
- [ ] لا أخطاء "handler not found"

---

## Phase 5 — Keepalive & Daily Report

**الهدف:** استخراج `keepalive.ts` و `daily-report.ts` إلى وحدات خدمة مستقلة.

**الملفات الجديدة:**
- `dist/keepalive-service.mjs`
- `dist/daily-report-service.mjs`

**الدوافع:**
- Background tasks يجب أن تكون قابلة للتشغيل/الإيقاف مستقلة
- تسهيل تغيير وقت التقرير أو إضافة مؤشرات جديدة

**شروط الاكتمال:**
- [ ] Watchdog يُعيد التشغيل عند تجميد البوت
- [ ] Daily Report يُرسَل عند الساعة 6ص
- [ ] يمكن تعطيل كل خدمة مستقلة دون التأثير على الأخرى

---

## Phase 6 — Developer Module Hardening

**الهدف:** تعزيز `dist/developer.mjs` ببنية أوضح.

**الدوافع:**
- لوحة المطوّر تحتوي 40+ أمر — صعبة القراءة
- كل إجراء developer يجب أن يكون قابلاً للتدقيق (auditable)

**الملفات المتأثرة:**
- `dist/developer.mjs` ← إعادة تنظيم داخلية

**المستهدفات:**
- تقسيم handler الرئيسي إلى sub-handlers بمسؤوليات واضحة
- إضافة audit log لكل إجراء حساس

**شروط الاكتمال:**
- [ ] God Panel يعمل كاملاً
- [ ] كل أمر مُصنَّف (users / sessions / economy / system)

---

## Phase 7 — GitHub Backup System

**الهدف:** بناء نظام نسخ احتياطي موثوق ومُجدوَل.

**الملفات الجديدة:**
- `dist/backup-service.mjs` ← نسخ/استعادة/جدولة

**الميزات المطلوبة:**
- نسخ تلقائية يومية
- استعادة بنقرة واحدة
- التحقق من سلامة النسخة (checksum)
- الاحتفاظ بآخر 7 نسخ فقط

**المخاطر:**
- ⚠️ GITHUB_TOKEN قد تنتهي صلاحيته
- ⚠️ حجم bot-data/ قد يكبر مع الوقت

**شروط الاكتمال:**
- [ ] نسخة يومية تعمل في الخلفية
- [ ] الاستعادة تعمل في أقل من 30 ثانية
- [ ] إشعار للمطوّر بنجاح/فشل كل عملية

---

## Phase 8 — Groups Module Enhancement

**الهدف:** توسيع `dist/groups.mjs` بميزات إدارة متقدمة.

**المستهدفات:**
- تصفية المجموعات (بالاسم، النشاط، الحجم)
- إرسال جماعي لمجموعات متعددة
- جدولة رسائل للمجموعات

**شروط الاكتمال:**
- [ ] قائمة المجموعات مُصنَّفة
- [ ] الإرسال الجماعي مع rate limiting
- [ ] لا ban بسبب الإرسال السريع

---

## Phase 9 — Users Management System

**الهدف:** بناء نظام إدارة مستخدمين قابل للتوسع.

**الملفات الجديدة:**
- `dist/user-service.mjs` ← CRUD كامل للمستخدمين

**المستهدفات:**
- pagination في قوائم المستخدمين
- فلترة (بالباقة، النشاط، الجلسات)
- export قائمة المستخدمين (CSV/JSON)
- إحصائيات نمو يومية/أسبوعية

**شروط الاكتمال:**
- [ ] `getUsers({ tier, active, page })` يعمل
- [ ] تقرير نمو أسبوعي

---

## Phase 10 — Points System 2.0

**الهدف:** تطوير `dist/points.mjs` لنظام اقتصاد متكامل.

**المستهدفات:**
- إضافة نقاط عند كل تفاعل (رسالة واتسآب مُرسَلة)
- نظام انتهاء صلاحية النقاط (points expiry)
- سجل معاملات قابل للتدقيق
- إشعار عند الوصول لحد معين

**شروط الاكتمال:**
- [ ] getBalance فوري (O(1))
- [ ] سجل معاملات مع pagination
- [ ] لا يمكن إنفاق أكثر من الرصيد

---

## Phase 11 — AI System Upgrade

**الهدف:** تطوير `dist/ai.mjs` لنظام AI متقدم.

**المستهدفات:**
- ذاكرة محادثة دائمة (تُحفظ بين الجلسات)
- دعم multimodal (صور، صوت)
- تحديد نموذج لكل باقة (mizaj → gpt-3.5, pro → gpt-4o)
- rate limiting ذكي

**المخاطر:**
- ⚠️ تكلفة OpenAI تصعد مع الاستخدام
- ⚠️ ذاكرة المحادثة تأكل RAM

**شروط الاكتمال:**
- [ ] ذاكرة المحادثة تعمل بعد إعادة التشغيل
- [ ] كل باقة تستخدم النموذج المناسب
- [ ] تقرير تكلفة يومي للمطوّر

---

## Phase 12 — Performance Optimization

**الهدف:** ضمان الأداء مع 1000+ مستخدم متزامن.

**المستهدفات:**
- استبدال in-memory Map بـ LRU cache مع حد للحجم
- دعم MongoDB كاملاً (حالياً اختياري)
- تحميل lazy للوحدات (dynamic import عند الحاجة فقط)
- Queueing للعمليات الثقيلة (تنزيل، ضغط، إرسال)

**المخاطر:**
- ⚠️ المستخدمون الحاليون يجب أن تُحفظ بياناتهم عند الترحيل

**شروط الاكتمال:**
- [ ] RAM لا يتجاوز 512MB مع 500 مستخدم نشط
- [ ] Response time تيليجرام < 500ms
- [ ] قائمة الانتظار لا تتجاوز 100 عملية

---

## Phase 13 — Monitoring & Observability

**الهدف:** بناء نظام مراقبة احترافي.

**المستهدفات:**
- metrics endpoint: GET /metrics (Prometheus format)
- لوحة صحة النظام في Dev Panel
- تنبيهات فورية عند: انهيار جلسة، ارتفاع RAM، وقت استجابة بطيء
- uptime tracking لكل جلسة واتسآب

**الملفات الجديدة:**
- `dist/metrics-service.mjs`

**شروط الاكتمال:**
- [ ] /metrics يُعيد بيانات قابلة للرسم
- [ ] Developer يتلقى تنبيهاً في 5 دقائق من أي مشكلة

---

## Phase 14 — Testing Infrastructure

**الهدف:** بناء framework اختبار رسمي.

**الملفات الجديدة:**
- `tests/unit/token-codec.test.mjs`
- `tests/unit/config.test.mjs`
- `tests/integration/session-lifecycle.test.mjs`
- `tests/integration/message-flow.test.mjs`

**المستهدفات:**
- تغطية > 80% لطبقات core/ و utils/ و infrastructure/
- اختبارات integration لدورة حياة الجلسة
- CI يمنع merge أي كود يكسر الاختبارات

**المخاطر:**
- ⚠️ اختبار Baileys صعب (يحتاج جلسة حقيقية أو mock)

**شروط الاكتمال:**
- [ ] `npm test` يعمل ويطبع نتائج
- [ ] 0 اختبارات فاشلة قبل كل إصدار

---

## Phase 15 — Production Hardening

**الهدف:** تجهيز النظام للإنتاج الكامل.

**المستهدفات:**
- تشفير جميع البيانات الحساسة في bot-data/
- rate limiting على جميع واجهات HTTP
- graceful shutdown (حفظ البيانات قبل الإغلاق)
- تدوير السجلات (log rotation) تلقائياً
- health check endpoint يستجيب في < 100ms
- توثيق API كامل بـ OpenAPI

**شروط الاكتمال:**
- [ ] لا بيانات تُفقد عند إعادة التشغيل المفاجئة
- [ ] جميع secrets مشفّرة (ليس plaintext)
- [ ] البوت يُشفر 30 يوماً بدون تدخل يدوي

---

## سجلّ الإصلاحات الطارئة (Hotfixes) على dist/index.mjs

> وفق القاعدة Q1.2: يُمنع التعديل المباشر على `dist/index.mjs` إلا عبر آلية
> patch-manager أو كإصلاح طارئ (hotfix) موثّق هنا. الإصلاحات التالية طُبّقت
> مباشرة لأنها أخطاء إنتاجية حرجة، مع توثيقها هنا كما تشترط القاعدة.

- **2026-07-08 — تنظيف رقم الهاتف في `/mg` و`!sticker`:** الرقم كان يُرفض إن
  احتوى مسافات (مثل `+966 50 123 4567`) رغم قبول العلامة `+` أصلاً. أُضيف
  `.replace(/[\s\-()]/g, "")` قبل فحص الـ regex في كلا الموضعين.
- **2026-07-08 — إصلاح خلط الجلسات عند ربط أكثر من رقم واتساب:** كان
  `activeSock`/`_fwSock` يُشتقّان من `inMemoryDB.sessions.get(userId)` (آخر رقم
  رُبط) بدل استخدام سوكت الجلسة التي استقبلت الرسالة فعلياً — هذا كان يُسكت
  ميزات "رسائلي" على الرقم الأول بمجرد ربط رقم ثانٍ، ويُرسل كل التحويلات عبر
  آخر رقم فقط. أصبحت الأولوية الآن لسوكت الجلسة المحلي. كما أصبحت
  `getMyMsgsSettings` تُستدعى بصيغة جديدة (`getMyMsgsSettingsForNumber` في
  `dist/my-msgs.mjs`) تقرأ إعدادات الرقم المستقبِل فعلياً بدل "الرقم النشط"
  العام في تيليجرام.
- **2026-07-08 — ربط قواعد التحويل برقم واتساب محدد:** أُضيفت آلية اختيار رقم
  واتساب قبل إنشاء أي قاعدة تحويل جديدة في `dist/forward.mjs` (`registerForwardSock`
  + `numberPickerKb`)، بحيث تُجلب المجموعات من جلسة الرقم المختار حصراً، وتشترك
  القنوات المختارة تلقائياً على ذلك الرقم إن لم تكن مشتركة، وتُخزَّن القاعدة
  بحقل `sourceNumber` للتحقق وقت التنفيذ. القواعد القديمة بلا `sourceNumber`
  تبقى تعمل كالسابق (توافق عكسي).

---

## ملخص الحالة والأولويات

```
الحالة:
  ✅ Phase 1  — Bootstrap          (مكتمل)
  🔄 Phase 2  — Session Engine     (التالي)
  📋 Phase 3  — Worker Manager
  📋 Phase 4  — Message Router
  📋 Phase 5  — Keepalive & Reports
  📋 Phase 6  — Developer Module
  📋 Phase 7  — GitHub Backup
  📋 Phase 8  — Groups Enhancement
  📋 Phase 9  — Users Management
  📋 Phase 10 — Points 2.0
  📋 Phase 11 — AI Upgrade
  📋 Phase 12 — Performance
  📋 Phase 13 — Monitoring
  📋 Phase 14 — Testing
  📋 Phase 15 — Production Hardening

الأولويات القصوى (يجب إتمامها قبل توسع الجمهور):
  Phase 2 → Phase 5 → Phase 7 → Phase 12 → Phase 13

الأولويات المتوسطة:
  Phase 3 → Phase 4 → Phase 6 → Phase 9 → Phase 10

الأولويات طويلة المدى:
  Phase 8 → Phase 11 → Phase 14 → Phase 15
```
