/**
 * engine/reconnect-manager.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: جدولة وإدارة محاولات إعادة الاتصال لكل جلسة.
 *
 * ميزات:
 *  • Exponential backoff مستقل لكل جلسة
 *  • حد أقصى للمحاولات قبل التصعيد
 *  • إلغاء المؤقت عند الاتصال الناجح
 *  • إحصائيات تفصيلية
 *
 * تعتمد على: core/logger.mjs
 * Exports: ReconnectManager
 */

import { inf, wrn } from "../core/logger.mjs";

// تأخيرات Exponential backoff بالمللي ثانية
const BACKOFF_DELAYS = [5_000, 15_000, 30_000, 60_000, 120_000];
const MAX_ATTEMPTS   = 5;

export class ReconnectManager {
  /** @type {Map<string, ReconnectEntry>} */
  #entries  = new Map();
  #onMaxRetries; // callback(userId) — عند الوصول للحد الأقصى

  /**
   * @param {object} [options]
   * @param {Function} [options.onMaxRetries] — يُستدعى عند استنفاد المحاولات
   */
  constructor({ onMaxRetries = null } = {}) {
    this.#onMaxRetries = onMaxRetries;
  }

  /**
   * يجدول محاولة إعادة اتصال لجلسة.
   * إذا وصلنا للحد الأقصى، يُستدعى onMaxRetries.
   *
   * @param {string}   userId
   * @param {Function} reconnectFn — async دالة تُنفَّذ لإعادة الاتصال
   * @returns {boolean} هل جُدِّلت المحاولة؟
   */
  schedule(userId, reconnectFn) {
    const entry = this.#getOrCreate(userId);

    // إلغاء المؤقت السابق
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
      wrn(`⛔ ${userId}: استُنفِدت ${MAX_ATTEMPTS} محاولات — تصعيد`);
      entry.status = "max_retries";
      if (this.#onMaxRetries) this.#onMaxRetries(userId);
      return false;
    }

    const delay = BACKOFF_DELAYS[entry.attempts] ?? BACKOFF_DELAYS.at(-1);
    entry.attempts++;
    entry.status     = "scheduled";
    entry.scheduledAt = Date.now();

    wrn(`🔄 ${userId}: إعادة اتصال #${entry.attempts} بعد ${delay / 1000}s`);

    entry.timer = setTimeout(async () => {
      if (!this.#entries.has(userId)) return;
      const e = this.#entries.get(userId);
      e.status    = "running";
      e.lastStart = Date.now();

      try {
        await reconnectFn(userId);
        // نجاح — يُسجَّل عبر markConnected()
      } catch (err) {
        wrn(`❌ ${userId}: فشلت إعادة الاتصال #${e.attempts}: ${err.message}`);
        e.status = "failed";
        // إعادة الجدولة تلقائياً
        this.schedule(userId, reconnectFn);
      }
    }, delay);

    this.#entries.set(userId, entry);
    return true;
  }

  /**
   * يُلغي مؤقت إعادة الاتصال لجلسة (عند الاتصال الناجح).
   * @param {string} userId
   */
  cancel(userId) {
    const entry = this.#entries.get(userId);
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.status   = "idle";
    entry.attempts = 0; // إعادة عداد المحاولات
    inf(`✅ ${userId}: إعادة الاتصال نجحت — تصفير العداد`);
  }

  /** @param {string} userId — إعادة تعيين العداد فقط بدون إلغاء المؤقت. */
  reset(userId) {
    const entry = this.#getOrCreate(userId);
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer    = null;
    entry.attempts = 0;
    entry.status   = "idle";
    this.#entries.set(userId, entry);
  }

  /** @param {string} userId */
  remove(userId) {
    const entry = this.#entries.get(userId);
    if (entry?.timer) clearTimeout(entry.timer);
    this.#entries.delete(userId);
  }

  /** @returns {object[]} */
  getAll() {
    return Array.from(this.#entries.entries()).map(([userId, e]) => ({
      userId,
      attempts: e.attempts,
      status:   e.status,
    }));
  }

  /** @returns {{ pending, running, max_retries }} */
  getStats() {
    const all = Array.from(this.#entries.values());
    return {
      pending:    all.filter(e => e.status === "scheduled").length,
      running:    all.filter(e => e.status === "running").length,
      max_retries: all.filter(e => e.status === "max_retries").length,
      total:      all.length,
    };
  }

  // ── داخلي ──────────────────────────────────────────────────────
  #getOrCreate(userId) {
    if (!this.#entries.has(userId)) {
      this.#entries.set(userId, {
        userId, attempts: 0, status: "idle",
        timer: null, scheduledAt: null, lastStart: null,
      });
    }
    return this.#entries.get(userId);
  }
}
