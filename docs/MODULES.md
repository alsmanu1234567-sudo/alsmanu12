# MODULES.md — وصف تفصيلي لجميع الوحدات
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على تحليل مباشر لملفات dist/*.mjs

---

## 1. نمط الوحدات

كل وحدة في `dist/*.mjs` تتبع نمطاً موحّداً:

```javascript
let _deps = {};
export function setDeps(d) { _deps = { ..._deps, ...d }; }
// ... دوال الوحدة تستخدم _deps
```

الوحدات لا تستورد بعضها مباشرة — كل اعتمادياتها تُمرَّر من `dist/index.mjs` عبر `setDeps()`.

---

## 2. dist/index.mjs — المحرك الرئيسي

| الخاصية | القيمة |
|---|---|
| الحجم | 331,124 سطر / ~16MB |
| النوع | esbuild bundle (TypeScript مُجمَّع) |
| المصدر | src/ TypeScript (غير متاح حالياً — TD-006) |
| التعديل | ممنوع مباشرة — عبر patch-manager فقط |

**المسؤوليات:**
- تهيئة جميع الوحدات وتمرير الاعتماديات
- إدارة Baileys sessions (QR + Pairing)
- WorkerManager: دورة حياة كل جلسة واتسآب
- Keepalive/Watchdog: مراقبة صحة البوت
- إعادة الاتصال الساعية
- التقرير اليومي الساعة 6ص
- خادم Express على PORT=5000
- Telegram polling
- قراءة/كتابة bot-data/*.json
- توجيه الرسائل والأزرار لوحدات dist/*.mjs

**الوحدات المضمّنة (من TypeScript المُجمَّع):**

| الوحدة الأصلية | المسؤولية |
|---|---|
| src/lib/logger.ts | pino logger |
| src/bot/core/database.ts | inMemoryDB + JSON persistence |
| src/bot/core/state.ts | حالات المستخدمين (await input) |
| src/bot/core/constants.ts | TIER_COSTS, TIER_ORDER, LIMITS |
| src/bot/core/keyboards.ts | بناة لوحات مفاتيح Telegram |
| src/bot/core/workers.ts | WorkerManager |
| src/bot/core/number-manager.ts | إدارة الأرقام لكل مستخدم |
| src/bot/core/ai-manager.ts | OpenAI + NVIDIA client wrapper |
| src/bot/core/keepalive.ts | Watchdog heartbeat |
| src/bot/whatsapp/baileys-session.ts | جلسات واتسآب |
| src/bot/handlers/messages.ts | توجيه رسائل تيليجرام |
| src/bot/handlers/callbacks.ts | توجيه callback queries |
| src/bot/core/daily-report.ts | تقرير يومي 6ص |
| src/app.ts | Express app |
| src/routes/health.ts | GET /health |

---

## 3. dist/auto-reply.mjs — الردود التلقائية

| الخاصية | القيمة |
|---|---|
| الحجم | 1,001 سطر |
| فُصل من | dist/index.mjs عبر patch-auto-reply-split.mjs |

**الوظائف الرئيسية:**
- إضافة قاعدة رد تلقائي (نص / صورة / ملصق / ذكاء اصطناعي)
- تعديل وحذف القواعد
- تفعيل/تعطيل الردود لكل رقم
- رد بالذكاء الاصطناعي (يستخدم NVIDIA API key الخاصة بالمستخدم)
- دعم ردود طويلة (multi-part text)

**الاعتماديات من _deps:**
`bot, getUser, saveUser, getState, setState, clearState, inMemoryDB, saveAutoReply, addPoints, mainMenuKeyboard, cancelKeyboard, longTextDoneKeyboard, replyTargetKeyboard, getAiManager, DEVELOPER_ID, getMergedText, clearTextParts`

---

## 4. dist/ai.mjs — الذكاء الاصطناعي

| الخاصية | القيمة |
|---|---|
| الحجم | 85 سطر (wrapper رفيع) |
| فُصل من | dist/index.mjs عبر patch-ai-split.mjs |

**الوظائف الرئيسية:**
- عرض قائمة إعدادات AI
- إضافة مفتاح NVIDIA API (`nvapi-` prefix)
- تفعيل/تعطيل AI للمستخدم
- اختيار النموذج (متعدد النماذج)

**ملاحظة:** المنطق الأساسي في `ai-manager` المضمّن في index.mjs، هذه الوحدة واجهة Telegram فقط.

**الاعتماديات من _deps:**
`bot, getUser, saveUser, setState, cancelKeyboard, aiMenuKeyboard, init_ai_manager, ai_manager_exports`

---

## 5. dist/calls.mjs — المكالمات

| الخاصية | القيمة |
|---|---|
| الحجم | 126 سطر |
| فُصل من | dist/index.mjs عبر patch-calls-split.mjs |

**الوظائف الرئيسية:**
- استقبال المكالمات الواردة على أرقام واتسآب
- إرسال رد تلقائي للمتصلين
- رفض المكالمات (اختياري)

---

## 6. dist/developer.mjs — لوحة المطوّر (God Panel)

| الخاصية | القيمة |
|---|---|
| الحجم | 1,025 سطر |
| الوصول | DEVELOPER_ID فقط (7428421245) |

**الوظائف (40+ أمر):**
- إدارة المستخدمين: عرض، حذف، تعديل باقة
- إدارة الاقتصاد: إضافة/خصم نقاط، تعديل أسعار
- إدارة الجلسات: قطع، إعادة اتصال، god_reconnect
- النسخ الاحتياطي: رفع لـ GitHub، استعادة
- إحصائيات النظام: عدد المستخدمين، الجلسات، RAM
- إرسال إشعارات لجميع المستخدمين
- تعديل حد كل شخص / 8 ساعات

---

## 7. dist/forward.mjs — التحويل

| الخاصية | القيمة |
|---|---|
| الحجم | 783 سطر |
| فُصل من | dist/index.mjs عبر patch-forward-hook.mjs |

**الوظائف الرئيسية:**
- تحويل رسائل واتسآب بين أرقام المستخدم نفسه
- تحديد أرقام المصدر والهدف
- تصفية أنواع الرسائل (نص/وسائط/ستيكر)

---

## 8. dist/groups.mjs — المجموعات

| الخاصية | القيمة |
|---|---|
| الحجم | 112 سطر (أساسي) |
| فُصل من | dist/index.mjs عبر patch-groups-split.mjs |

**الوظائف الحالية:**
- كتم المجموعات / إلغاء الكتم
- طرد أعضاء
- عرض قائمة المجموعات

**ملاحظة:** خطة توسيع في Phase 8 (تصفية + إرسال جماعي مع rate limiting).

---

## 9. dist/my-msgs.mjs — رسائلي

| الخاصية | القيمة |
|---|---|
| الحجم | 428 سطر |
| فُصل من | dist/index.mjs عبر patch-mymsgs-split.mjs |

**الوظائف (12+ ميزة):**
- طقس (Weather API)
- أخبار (News API)
- نكتة عشوائية
- ترجمة (Google Translate)
- مواقيت الصلاة (Prayer times API)
- سعر العملة (Currency API)
- تحويل صورة إلى ستيكر (sharp)
- سبام رسائل (مع rate limiting)
- توقعات الحظ
- بحث Wikipedia
- تاق عشوائي
- تنزيل يوتيوب/تيك توك/أفلام (عبر index.mjs)

---

## 10. dist/persons.mjs — جهات الاتصال

| الخاصية | القيمة |
|---|---|
| الحجم | 195 سطر |
| فُصل من | dist/index.mjs عبر patch-persons-split.mjs |

**الوظائف:**
- عرض قائمة جهات الاتصال
- مزامنة جهات الاتصال من واتسآب
- حذف جهة اتصال
- جلب صورة الحساب (4 استراتيجيات متسلسلة)
- جلب الحالة (fetchStatus — مصفوفة)

---

## 11. dist/points.mjs — نظام النقاط

| الخاصية | القيمة |
|---|---|
| الحجم | 319 سطر |
| فُصل من | dist/index.mjs عبر patch-points-split.mjs |

**الوظائف:**
- عرض الرصيد + آخر 5 معاملات
- عرض باقات الترقية + الأسعار الديناميكية
- شراء الباقة (خصم نقاط)
- تتبع تاريخ المعاملات (inMemoryDB.pointsLog)

**الباقات:**
| الباقة | التكلفة (ديناميكية) | الأرقام المسموحة |
|---|---|---|
| free | مجاني | 1 |
| mizaj | ~2,000 نقطة | 2 |
| pro | ~5,000 نقطة | 3 |
| promax | أعلى | 5 |
| khariq | أعلى | 10 |
| khariqpro | أعلى مستوى | غير محدود |

**الاعتماديات من _deps:**
`bot, getUser, saveUser, inMemoryDB, TIER_NAMES, TIER_ORDER, TIER_COSTS, getDynamicPrice, pointsMenuKeyboard, featuresMenuKeyboard`

---

## 12. dist/reports.mjs — البلاغات

| الخاصية | القيمة |
|---|---|
| الحجم | 98 سطر |
| فُصل من | dist/index.mjs عبر patch-reports-split.mjs |

**الوظائف:**
- استقبال بلاغات المستخدمين (مشاكل/اقتراحات)
- إرسال البلاغ للمطوّر
- تتبع عدد البلاغات لكل مستخدم

---

## 13. dist/status.mjs — الحالات

| الخاصية | القيمة |
|---|---|
| الحجم | 311 سطر |
| فُصل من | dist/index.mjs عبر patch-status-split.mjs |

**الوظائف:**
- عرض حالة واتسآب لجهة اتصال
- جلب صورة الحالة
- استخدام fetchStatus() بشكل صحيح (Array)

---

## 14. وحدات pino (تقنية)

| الوحدة | الحجم | الدور |
|---|---|---|
| pino-file.mjs | 4,350 سطر | transport الملفات |
| pino-pretty.mjs | 3,312 سطر | transport التجميل |
| pino-worker.mjs | 4,706 سطر | worker thread |
| thread-stream-worker.mjs | 228 سطر | thread-stream |

هذه وحدات مُجمَّعة من مكتبة pino الخارجية — لا تعديل عليها.

---

## 15. ملفات الأدوات (CLI Tools)

| الملف | الاستخدام | الوظيفة |
|---|---|---|
| `encode-token.mjs` | `node encode-token.mjs TOKEN` | تشفير توكن بـ AES-256-CBC |
| `github-sync.mjs` | `node github-sync.mjs [--force] [--dry-run]` | رفع المشروع لـ GitHub |
| `deploy.mjs` | `node deploy.mjs [--update]` | تحميل dist/ + تشغيل |
| `setup-yt-cookies.mjs` | `node setup-yt-cookies.mjs` | إعداد كوكيز يوتيوب |
| `stream-dl.mjs` | داخلي | بث YouTube مباشرة لواتسآب |

---

## 16. ملفات التعديلات التاريخية (patch-*.mjs)

35 ملف في PATCH_REGISTRY بالترتيب:

| # | الملف | الوصف |
|---|---|---|
| 1 | patch-cod.mjs | /cod لربط واتسآب |
| 2 | patch-fixes.mjs | إصلاحات cod + تيليجرام |
| 3 | patch-download.mjs | تنزيل vid/song/film/tiktok |
| 4 | patch-loader.mjs | إصلاح ffmpeg + loader.to |
| 5 | patch-mymsgs.mjs | رسائلي: سبام+طقس+ترجمة+أخبار |
| 6 | patch-video-fix.mjs | إصلاح تنزيل vid/song/film |
| 7 | patch-dl-v3.mjs | smartSearch+cobalt-API+y2mate |
| 8 | patch-film-v4.mjs | فيلم v4: downloadMovieSmart |
| 9 | patch-github-token.mjs | GitHub Token management |
| 10 | patch-github-v2.mjs | GitHub Token v2: AES-256 |
| 11 | patch-new-features.mjs | أكواد خاصة + ساحر + /حالة |
| 12 | patch-new-features-2.mjs | زر قائمة + شريط تقدم |
| 13 | patch-fixes-v2.mjs | مزامنة جهات الاتصال |
| 14 | patch-fixes-v3.mjs | عرض حالات + نماذج ذكاء |
| 15 | patch-clone-direct.mjs | نسخ البوت مباشر |
| 16 | patch-del-append.mjs | تتبع ردود البوت للحذف |
| 17 | patch-fix-clone-url.mjs | إصلاح URL النسخ |
| 18 | patch-multi-number.mjs | إصلاح الأرقام المتعددة |
| 19 | patch-all-fixes-v1.mjs | إصلاحات شاملة: بث+ردود+فيديو |
| 20 | patch-bugfix-final.mjs | حد كل شخص / 8 ساعات |
| 21 | patch-stream-dl.mjs | بث YouTube→WhatsApp |
| 22 | patch-stream-dl-v2.mjs | stream-dl v2 |
| 23 | patch-auto-reply-split.mjs | فصل auto-reply.mjs |
| 24 | patch-mymsgs-split.mjs | فصل my-msgs.mjs |
| 25 | patch-status-split.mjs | فصل status.mjs |
| 26 | patch-calls-split.mjs | فصل calls.mjs |
| 27 | patch-reports-split.mjs | فصل reports.mjs |
| 28 | patch-persons-split.mjs | فصل persons.mjs |
| 29 | patch-ai-split.mjs | فصل ai.mjs |
| 30 | patch-groups-split.mjs | فصل groups.mjs |
| 31 | patch-fix-token.mjs | إصلاح التوكن الحرفي |
| 32 | patch-per-user-limit-fix.mjs | حد كل شخص / 8 ساعات |
| 33 | patch-translate-v3.mjs | الترجمة v3 |
| 34 | patch-forward-hook.mjs | ربط forward.mjs |
| 35 | patch-master-fix.mjs | الإصلاح الشامل |

**حالة التطبيق:** 23 من 35 يعودان بـ "0 تغيير" (مطبّقة مسبقاً). الـ 35 تعدّل في كل startup.
