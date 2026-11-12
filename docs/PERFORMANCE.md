# PERFORMANCE.md — الأداء والقابلية للتوسع
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: TODO.md + REFACTOR_PLAN.md + ARCHITECTURE.md

---

## 1. مؤشرات الأداء الحالية

| المعيار | الهدف | الحالة الحالية |
|---|---|---|
| وقت تشغيل البوت | < 30 ثانية | 🟡 ~45-60 ثانية (بسبب 35 patch) |
| RAM (خامل) | < 200MB | ✅ ~150-180MB |
| RAM (نشط 50 جلسة) | < 512MB | 🟡 غير مقاس |
| استجابة تيليجرام | < 500ms | ✅ طبيعي مع polling |
| جلسات متزامنة | هدف: 1,000 | 🟡 غير مختبر |
| مستخدمون | هدف: 10,000 | 🟡 غير مختبر |
| استقرار 24/7 | لا توقف غير مجدوَل | ✅ Watchdog يُعيد التشغيل |
| استعادة الجلسات | 100% بعد restart | ✅ hourly reconnect |
| حماية من خطأ Module | دائماً | ✅ try-catch في كل handler |

---

## 2. مشاكل الأداء المعروفة

### P-001 — 35 patch عند كل startup (🟡)
```
المشكلة:   35 تعديل تُشغَّل في كل startup
           23 منها تعود بـ "0 تغيير" (مطبّقة مسبقاً)
الأثر:     15-45 ثانية إضافية في وقت البدء
           23 عملية `node patch-*.mjs` لا فائدة منها
الحل:      إلغاء آلية الباتشات بعد Phase 2-5
الأولوية:  C-04 في TODO.md
```

### P-002 — dist/index.mjs = 16MB bundle (🔴)
```
المشكلة:   المحرك الرئيسي حجمه 331,124 سطر / 16MB
           مُجمَّع من TypeScript + npm libraries
الأثر:     وقت تحميل أطول، صعوبة في الصيانة والتحسين
الحل:      استخراج تدريجي (Phases 2-5)
الأولوية:  TD-001 في TODO.md
```

### P-003 — inMemoryDB بدون حد (🟡)
```
المشكلة:   Map<userId, ...> بدون LRU cache أو حد للحجم
الأثر:     RAM يتراكم مع نمو المستخدمين
           مع 10,000 مستخدم: احتمال استنزاف RAM
الحل:      LRU Cache مع حد أقصى للحجم
الأولوية:  M-04 في TODO.md
```

### P-004 — pointsLog مصفوفة غير محدودة (⚠️)
```
المشكلة:   inMemoryDB.pointsLog = Array مُراكَم لا نهاية له
الأثر:     filter() يبطؤ مع نمو السجل
الحل:      pagination + archiving للسجلات القديمة
الأولوية:  Phase 10
```

---

## 3. قيود الأداء المُطبَّقة

### Rate Limiting (القواعد الحالية)

```javascript
// تيليجرام: لا أكثر من 30 رسالة/ثانية
// (Telegram API limit — يُطبَّق داخلياً بـ node-telegram-bot-api)

// واتسآب: لا أكثر من رسالة/2 ثانية لنفس الجهة
// (موثّق في PROJECT_RULES.md Q4.3)

// إعادة الاتصال: 12 ثانية بين كل جلسة
await sleep(12_000); // في startHourlyReconnect

// GitHub رفع: 300ms بين كل ملف
await new Promise(r => setTimeout(r, 300));
```

### العمليات الثقيلة
```javascript
// Q2.5 — أي عملية > 5 ثوانٍ أو > 100MB:
await bot.sendMessage(chatId, "⏳ جارٍ التحميل...");
const result = await downloadVideo(url); // async
await bot.sendMessage(chatId, "✅ تم التحميل");
```

---

## 4. استهلاك الذاكرة (تقدير)

| المكوّن | RAM التقديري |
|---|---|
| dist/index.mjs (Node.js) | ~50-80MB |
| كل جلسة Baileys نشطة | ~5-15MB |
| inMemoryDB (1000 مستخدم) | ~10-30MB |
| bot-data cache | ~5-10MB |
| pino logger | ~5MB |
| مجموع (خامل) | ~150-180MB |
| مجموع (100 جلسة) | ~650-1,180MB |

**حد MAX_RAM_MB:** 600MB (إعداد افتراضي في config.mjs).

---

## 5. أهداف الأداء المستقبلية (Phase 12)

### استبدال inMemoryDB بـ LRU Cache
```javascript
// بدلاً من:
const users = new Map();

// استخدام:
import LRU from 'lru-cache';
const users = new LRU({ max: 5000, ttl: 1000 * 60 * 60 }); // 5000 مستخدم، TTL ساعة
```

### Queue للعمليات الثقيلة
```javascript
// تنزيل، ضغط، إرسال
const downloadQueue = new Queue({ concurrency: 3 });
await downloadQueue.add(() => downloadVideo(url));
```

### تحميل lazy للوحدات
```javascript
// بدلاً من import عند البدء:
const groupsMod = await import('./groups.mjs'); // عند الحاجة فقط
```

### دعم MongoDB كامل
```
MongoDB Atlas (في السحابة) أو MongoDB local:
- الانتقال من JSON → MongoDB لـ users, points, replies
- يحل مشكلة الكتابة غير الذرية
- يُحسّن الأداء مع 10,000+ مستخدم
```

---

## 6. اختبار الضغط (مخطّط)

| الاختبار | المعيار | الحالة |
|---|---|---|
| 100 جلسة متزامنة | RAM < 512MB | ❌ لم يُجرَ |
| 1,000 رسالة/دقيقة | استجابة < 500ms | ❌ لم يُجرَ |
| Reconnect بعد crash | 100% استعادة | 🟡 غير رسمي |
| تنزيل 10 فيديوهات متوازية | لا crash | ❌ لم يُجرَ |

---

## 7. مراقبة الأداء (الحالة الحالية)

```
✅ MAX_RAM_MB=600 → تحذير Watchdog عند الاقتراب
✅ Keepalive Watchdog → إعادة تشغيل عند التجمد
✅ التقرير اليومي 6ص → إحصائيات أساسية
❌ /api/metrics → لم يُنفَّذ (Phase 13)
❌ لوحة مراقبة خارجية → لم تُبنَ
```

---

## 8. توصيات الأداء بالأولوية

| الأولوية | التوصية | الأثر |
|---|---|---|
| 🔴 عاجل | إيقاف 23 patch لا تفعل شيئاً | توفير 20-30 ثانية في startup |
| 🔴 عاجل | LRU Cache لـ inMemoryDB | منع تسرب RAM مع نمو المستخدمين |
| ⚠️ عالي | Queue للتنزيلات | منع تجميد event loop |
| ⚠️ عالي | Pagination في Developer Panel | يتعطل مع 1000+ مستخدم |
| ℹ️ متوسط | lazy loading للوحدات | تقليل وقت البدء |
| ℹ️ متوسط | MongoDB بدلاً من JSON | أداء أفضل + أمان البيانات |

---

## 9. Pending

- [ ] قياس RAM الفعلي مع عدد جلسات حقيقي
- [ ] قياس وقت startup الفعلي (45-60 ثانية تقدير)
- [ ] اختبار ضغط منظّم (100 جلسة)
- [ ] مراقبة حجم pointsLog عبر الزمن
