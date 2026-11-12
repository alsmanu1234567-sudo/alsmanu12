/**
 * engine/session-manager.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: الإدارة المركزية لجميع جلسات واتسآب.
 *
 * يُنسِّق بين:
 *  • session-storage  — قراءة/تحقق ملفات الجلسات
 *  • worker-tracker   — تتبع حالة كل جلسة
 *  • reconnect-manager — جدولة إعادة الاتصال
 *  • recovery-manager  — معالجة الأعطال
 *
 * تعتمد على: engine/*.mjs, core/logger.mjs
 * Exports: SessionManager
 */

import { inf, wrn }       from "../core/logger.mjs";
import { SessionState }   from "./lifecycle.mjs";
import { scanAllSessions } from "./session-storage.mjs";

export class SessionManager {
  #storage;
  #tracker;
  #reconnect;
  #recovery;
  #baseDir;
  #initialized = false;

  /**
   * @param {object} deps
   * @param {string}           deps.baseDir
   * @param {object}           deps.tracker    — WorkerTracker instance
   * @param {object}           deps.reconnect  — ReconnectManager instance
   * @param {object}           deps.recovery   — RecoveryManager instance
   */
  constructor({ baseDir, tracker, reconnect, recovery }) {
    this.#baseDir  = baseDir;
    this.#tracker  = tracker;
    this.#reconnect = reconnect;
    this.#recovery  = recovery;
  }

  /**
   * التهيئة الأولية: مسح الجلسات المحفوظة وتحميلها في الـ tracker.
   * @returns {Promise<ScanResult>}
   */
  async initialize() {
    inf("🔍 SessionManager: فحص الجلسات المحفوظة...");
    const scan = await scanAllSessions(this.#baseDir);

    // تسجيل الجلسات السليمة
    for (const info of scan.all) {
      if (info.valid) {
        this.#tracker.register(info.userId, SessionState.DETECTED);
      } else {
        this.#tracker.register(info.userId, SessionState.CORRUPTED);
        this.#tracker.addError(info.userId, info.error);
      }
    }

    // عزل الجلسات التالفة
    if (scan.corrupted.length > 0) {
      wrn(`⚠️ ${scan.corrupted.length} جلسة تالفة — جارٍ العزل...`);
      await this.#recovery.handleCorruptedSessions(scan.corrupted);
    }

    this.#initialized = true;
    inf(`✅ SessionManager: ${scan.valid} جلسة جاهزة`);
    return scan;
  }

  /**
   * يُحدِّث حالة جلسة عند الاتصال (يُستدعى من إشارات HTTP أو Heartbeat).
   * @param {string} userId
   */
  markConnected(userId) {
    this.#tracker.markConnected(userId);
    this.#reconnect.cancel(userId);
  }

  /**
   * يُسجِّل انفصال جلسة ويُجدِّل إعادة الاتصال.
   * @param {string}   userId
   * @param {string}   [reason]
   * @param {Function} [reconnectFn]
   */
  markDisconnected(userId, reason = null, reconnectFn = null) {
    this.#tracker.markDisconnected(userId, reason);
    if (reconnectFn) {
      this.#reconnect.schedule(userId, reconnectFn);
    }
  }

  /** يُسجِّل نشاط جلسة (رسالة / حدث). */
  markActivity(userId) {
    this.#tracker.markActivity(userId);
  }

  /**
   * تقرير كامل بحالة جميع الجلسات.
   * @returns {object}
   */
  async getHealthReport() {
    const trackerStats = this.#tracker.getStats();
    const reconnStats  = this.#reconnect.getStats();
    const recovStats   = this.#recovery.getStats();
    const storageScan  = await scanAllSessions(this.#baseDir);

    return {
      initialized:  this.#initialized,
      sessions:     trackerStats,
      reconnect:    reconnStats,
      recovery:     recovStats,
      storage:      {
        total:     storageScan.total,
        valid:     storageScan.valid,
        corrupted: storageScan.corrupted.length,
      },
      generatedAt:  new Date().toISOString(),
    };
  }

  /**
   * @returns {object[]} تفاصيل جميع الجلسات المتتبَّعة
   */
  getAllSessions() {
    return this.#tracker.getAll();
  }

  /**
   * @param {string} userId
   * @returns {object|null}
   */
  getSession(userId) {
    return this.#tracker.get(userId);
  }

  /** @returns {{ connected, disconnected, recovering, total }} */
  getQuickStats() {
    return this.#tracker.getStats();
  }
}
