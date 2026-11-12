/**
 * engine/heartbeat.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: ضبان دوري (Heartbeat) يفحص صحة النظام بشكل منتظم.
 *
 * يعمل بفاصل زمني قابل للتكوين.
 * يستدعي health-monitor.checkAll() في كل دورة.
 * يُبلِّغ عن الجلسات المجمدة / المنفصلة.
 *
 * تعتمد على: core/logger.mjs, engine/health-monitor.mjs
 * Exports: Heartbeat
 */

import { inf, wrn } from "../core/logger.mjs";

const DEFAULT_INTERVAL_MS   = 30_000;   // 30 ثانية
const STALE_THRESHOLD_MS    = 10 * 60 * 1000; // 10 دقائق بدون نشاط = مشبوه

export class Heartbeat {
  #monitor;
  #tracker;
  #intervalMs;
  #timer       = null;
  #tickCount   = 0;
  #startTime   = null;
  #running     = false;

  /**
   * @param {object} options
   * @param {HealthMonitor} options.monitor
   * @param {WorkerTracker} options.tracker
   * @param {number}        [options.intervalMs=30000]
   */
  constructor({ monitor, tracker, intervalMs = DEFAULT_INTERVAL_MS }) {
    this.#monitor    = monitor;
    this.#tracker    = tracker;
    this.#intervalMs = intervalMs;
  }

  /** يبدأ دورة الـ Heartbeat. */
  start() {
    if (this.#running) return;
    this.#running   = true;
    this.#startTime = Date.now();
    inf(`💓 Heartbeat بدأ — فاصل: ${this.#intervalMs / 1000}s`);
    this.#schedule();
  }

  /** يوقف الـ Heartbeat. */
  stop() {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    inf("💓 Heartbeat توقف");
  }

  /** تنفيذ دورة فحص واحدة فورياً (للاختبار). */
  async pulse() {
    return this.#tick();
  }

  /** @returns {{ running, tickCount, uptimeSec, intervalMs }} */
  getStatus() {
    return {
      running:    this.#running,
      tickCount:  this.#tickCount,
      uptimeSec:  this.#startTime ? Math.floor((Date.now() - this.#startTime) / 1000) : 0,
      intervalMs: this.#intervalMs,
    };
  }

  // ── داخلي ──────────────────────────────────────────────────────
  #schedule() {
    this.#timer = setInterval(() => this.#tick(), this.#intervalMs);
    // تشغيل فوري بعد 5 ثوانٍ من البداية (انتظار تهيئة البوت)
    setTimeout(() => this.#tick(), 5_000);
  }

  async #tick() {
    if (!this.#running) return;
    this.#tickCount++;

    try {
      const result = await this.#monitor.checkAll();

      // فحص الجلسات المجمدة
      if (this.#tracker) {
        const stale = this.#tracker.getStale(STALE_THRESHOLD_MS);
        if (stale.length > 0) {
          wrn(`⏱️ Heartbeat: ${stale.length} جلسة مجمدة (لا نشاط > ${STALE_THRESHOLD_MS / 60000} دقيقة)`);
          for (const s of stale) {
            wrn(`  • ${s.userId}: آخر نشاط ${Math.floor((Date.now() - s.lastActivity) / 1000)}s`);
          }
        }
      }

      // سجل دوري كل 10 دورات
      if (this.#tickCount % 10 === 0) {
        const stats = this.#tracker?.getStats() ?? {};
        inf(`💓 Heartbeat #${this.#tickCount} — صحة: ${result.healthy ? "✅" : "❌"}` +
            (stats.total ? ` | جلسات: ${stats.connected}/${stats.total} متصل` : ""));
      }

      return result;
    } catch (e) {
      wrn(`Heartbeat #${this.#tickCount} خطأ: ${e.message}`);
    }
  }
}
