# تشخيص أمر /حالة عند الرد على "تم ذكرك في حالة"

## المشكلة الأصلية
عند الرد بـ `/حالة` على رسالة إشعار "تم ذكرك في حالة" داخل **محادثة فردية (1:1)** — وليس
مجموعة — كانت الميزة تفشل دائماً في العثور على الحالة المخزّنة مسبقاً في الذاكرة المؤقتة
(`inMemoryDB.statusBuf`)، حتى لو كان البوت قد شاهد الحالة فعلياً.

## السبب الجذري
البحث عن مرسل الحالة كان يعتمد فقط على:

```js
const _mentionSenderJid = ctxInfo?.participant || msg.key?.participant || "";
```

لكن حقل `participant` (سواء في `contextInfo` أو في `msg.key`) **لا يوجد إلا داخل رسائل
المجموعات**. في محادثة فردية، كلا الحقلين يكونان `undefined`، فتصبح `_mentionSenderJid`
سلسلة فاضية `""`، ولا تُطابق أبداً أي إدخال محفوظ في `statusBuf` (المخزَّن بمفتاح جهة
الاتصال الحقيقية). النتيجة: البحث يفشل دائماً في هذا السياق، بصرف النظر عن وجود الحالة
في الذاكرة أو عدمه.

## الإصلاح
أضفنا احتياطاً أخيراً هو `jid` نفسه (الرقم الذي تجري معه المحادثة حالياً) — لأنه في محادثة
فردية، الشخص الذي ذكرك هو بالضبط صاحب هذه المحادثة:

```js
const _mentionSenderJid = ctxInfo?.participant || msg.key?.participant || jid || "";
```

## ملف السجل التشخيصي الجديد
كل استدعاء لأمر `/حالة` على رسالة مقتبسة (سواء نجح أو فشل) يُسجَّل الآن بالكامل في:

```
alsmanu4/data/status-debug.log
```

بصيغة JSONL (سطر JSON واحد لكل محاولة). كل سطر يحتوي على:

- `ts` — الوقت
- `cmd`, `jid`, `userId` — سياق الطلب
- `msgKeyId`, `msgKeyParticipant`, `msgKeyFromMe` — مفتاح رسالة `/حالة` نفسها
- `hasCtxInfo`, `ctxInfo` — سياق الاقتباس الخارجي كما ورد من واتساب
- `rawQuoted` — البنية الخام الكاملة للرسالة المقتبسة (بدون فك التشفير، فقط البنية
  المرسلة من واتساب — تشمل `mediaKey`, `directPath`, `url` إن وُجدت)
- `unwrappedKeys`, `hasInnerCtx`, `innerCtx`, `hasInnerQuotedMsg`, `innerMediaNodeFound`
- `isStatusMentionReceipt`, `mentionEmbeddedMediaFound`
- `mentionSenderJid`, `statusBufTotalEntries`, `mentionBufferMatches`
- `result` — نتيجة نهائية واحدة من: `sent_inner_media_from_wrapped_quote`,
  `sent_media_unwrapped_direct`, `sent_media_raw_quoted_fallback`,
  `sent_from_status_mention_embedded_media`, `sent_from_status_buffer_cache`,
  `sent_quoted_text_direct`, `sent_direct_attached_media`,
  `failed_no_media_in_receipt_and_no_buffer_match` (هذا كان الفشل الأكثر شيوعاً قبل
  الإصلاح), `unsupported_quoted_type`, `failed_no_attached_media_no_quote`, `exception`
- عند الاستثناء: `error`, `stack`

الملف يُدوَّر تلقائياً عند تجاوزه 5MB (يحتفظ بآخر 500 سطر).

## كيف تُستخدم عند تكرار المشكلة
إن استمر فشل الميزة بعد هذا الإصلاح (مثلاً الحالة انتهت صلاحيتها فعلياً على خوادم واتساب،
أو البوت لم يشهد الحالة أثناء نشرها فلم تُخزَّن في `statusBuf` أصلاً)، افتح
`data/status-debug.log` وابحث عن آخر سطر بنفس `jid`/`ts` القريب من وقت التجربة، وابعثه
لتحليل بنية `rawQuoted` الحقيقية القادمة من واتساب — منها يمكن تحديد المسار الصحيح
لاستخراج الوسائط لهذه الحالة تحديداً.

## ملاحظة مهمّة عن الاستضافة
هذا الإصلاح تم في `dist/index.mjs` مباشرة (الملف الذي يُشغَّل فعلياً عبر `node dist/index.mjs`
أو `deploy.mjs`). النسخة الظاهرة في لقطة الشاشة الأصلية من الاستضافة الحالية أقدم من هذا
الإصلاح (رسالة مختلفة النص تماماً) — لذا يجب رفع `dist/index.mjs` المحدَّث إلى مستودع GitHub
المستخدَم في `deploy.mjs` (`OWNER/REPO` بالأعلى فيه)، ثم تشغيل `node deploy.mjs --update`
على السيرفر لتحميل النسخة الجديدة وإعادة تشغيل البوت بها.
