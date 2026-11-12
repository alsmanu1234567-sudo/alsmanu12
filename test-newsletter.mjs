/**
 * test-newsletter.mjs — اختبار شامل لاستقبال رسائل القنوات
 * node test-newsletter.mjs
 */

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR   = join(__dirname, 'wa-sessions', '7428421245');
const NEWSLETTER = '120363408534017954@newsletter';

const log = (tag, ...a) =>
  console.log(`[${new Date().toISOString()}] [${tag}]`, ...a);

async function run() {
  log('INIT', 'تحميل الجلسة من:', AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version }          = await fetchLatestBaileysVersion();
  log('INIT', 'إصدار Baileys:', version);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['TestBot', 'Chrome', '3.0'],
    logger: {
      level: 'silent',
      trace:()=>{}, debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{}, fatal:()=>{},
      child:()=>({ trace:()=>{}, debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{}, fatal:()=>{}, child:()=>({}) }),
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // ─── كل أحداث البوت ────────────────────────────────────────────────
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    for (const msg of messages) {
      const jid = msg.key?.remoteJid || '';
      const isNL = jid.endsWith('@newsletter');
      const tag  = isNL ? '🟢 NEWSLETTER' : 'MSG';
      const text = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || msg.message?.imageMessage?.caption
                || msg.message?.videoMessage?.caption
                || Object.keys(msg.message || {}).join(',')
                || '(فارغ)';
      log(tag, `type=${type} | jid=${jid} | ${text.slice(0,100)}`);
    }
  });

  sock.ev.on('newsletter.update',       d => log('newsletter.update',       JSON.stringify(d).slice(0,200)));
  sock.ev.on('newsletter.reaction',     d => log('newsletter.reaction',     JSON.stringify(d).slice(0,200)));
  sock.ev.on('newsletter.view',         d => log('newsletter.view',         JSON.stringify(d).slice(0,200)));
  sock.ev.on('messaging-history.set',   ({ messages }) => {
    log('HISTORY', `إجمالي: ${messages.length}`);
    const nls = messages.filter(m => m.key?.remoteJid?.endsWith('@newsletter'));
    log('HISTORY-NL', `رسائل قنوات في التاريخ: ${nls.length}`);
    for (const m of nls) {
      const t = m.message?.conversation || m.message?.extendedTextMessage?.text || '(ميديا)';
      log('HISTORY-NL-MSG', t.slice(0,100));
    }
  });

  // ─── عند الاتصال ───────────────────────────────────────────────────
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    log('CONN', 'state:', connection);

    if (connection !== 'open') {
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        log('CONN', 'انقطع | code:', code);
        if (code !== DisconnectReason.loggedOut) { setTimeout(run, 3000); }
      }
      return;
    }

    log('CONN', '✅ متصل!');

    // 1) follow القناة (مهم — بدونه لا تصل رسائل)
    try {
      await sock.newsletterFollow(NEWSLETTER);
      log('FOLLOW', '✅ تم follow القناة');
    } catch(e) { log('FOLLOW', '⚠️ follow:', e.message); }

    // 2) اشتراك live_updates (مدته 90 ث)
    try {
      const res = await sock.subscribeNewsletterUpdates(NEWSLETTER);
      log('SUB', `✅ اشتراك ناجح | مدة: ${res?.duration} ثانية`);
    } catch(e) { log('SUB', '❌', e.message); }

    // 3) جلب metadata
    try {
      const meta = await sock.newsletterMetadata('jid', NEWSLETTER);
      log('META', `اسم: ${meta?.name} | مشتركون: ${meta?.subscriberCount} | id: ${meta?.id}`);
    } catch(e) { log('META', '❌', e.message); }

    // 4) جلب أحدث 10 رسائل من القناة مباشرةً
    try {
      log('FETCH', 'جار جلب آخر 10 رسائل من القناة...');
      const raw = await sock.newsletterFetchMessages(NEWSLETTER, 10);
      log('FETCH', 'raw result type:', typeof raw, Array.isArray(raw) ? `array[${raw.length}]` : '');
      log('FETCH', 'raw:', JSON.stringify(raw).slice(0, 1000));
    } catch(e) { log('FETCH', '❌ خطأ:', e.message, e.stack?.split('\n')[1]); }

    // 5) تجديد الاشتراك كل 60 ثانية
    const renewInterval = setInterval(async () => {
      try {
        await sock.subscribeNewsletterUpdates(NEWSLETTER);
        log('RENEW', '🔄 تجديد');
      } catch {}
    }, 60_000);

    // 6) توقف بعد 3 دقائق
    setTimeout(() => {
      clearInterval(renewInterval);
      log('DONE', '⏹ انتهى الاختبار');
      process.exit(0);
    }, 3 * 60_000);
  });
}

run().catch(e => { console.error('خطأ فادح:', e); process.exit(1); });
