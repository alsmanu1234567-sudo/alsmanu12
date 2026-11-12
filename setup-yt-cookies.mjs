#!/usr/bin/env node
/**
 * setup-yt-cookies.mjs — مساعد إنشاء ملف YouTube cookies
 * 
 * استخدام: node setup-yt-cookies.mjs
 * 
 * يشرح لك كيف تصدّر cookies من متصفحك وتضعها هنا.
 */

import { writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

console.log(`
╔══════════════════════════════════════════════════════╗
║          إعداد YouTube Cookies للبوت                 ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  المشكلة: يوتيوب يحجب التنزيل من السيرفرات المشتركة ║
║  الحل: تصدير cookies من متصفحك (مجاني - 5 دقائق)    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝

خطوات التثبيت:
━━━━━━━━━━━━━━

1. ثبّت إضافة المتصفح على جهازك:
   • Chrome/Edge: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   • Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/

2. افتح youtube.com في متصفحك وسجّل دخولك

3. انقر على أيقونة الإضافة واختر:
   "Export cookies for this tab" أو "Current Site"

4. احفظ الملف باسم: yt-cookies.txt

5. انقل الملف إلى هذا المجلد:
   ${join(__dirname, 'yt-cookies.txt')}

6. شغّل الاختبار مجدداً:
   node test-yt-new.mjs 2 2 أغنية

━━━━━━━━━━━━━━

ملاحظة: الـ cookies تبقى صالحة عدة أشهر.
لا تشارك الملف مع أحد (يحتوي على بيانات حسابك).
`);

// تحقق إذا الملف موجود
try {
  await readFile(join(__dirname, 'yt-cookies.txt'));
  console.log('✅ ملف yt-cookies.txt موجود! سيستخدمه البوت تلقائياً.');
} catch {
  console.log('⚠️  ملف yt-cookies.txt غير موجود. اتبع الخطوات أعلاه.');
}
