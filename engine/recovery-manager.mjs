/**
 * engine/recovery-manager.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: اكتشاف الأعطال وتنفيذ إجراءات الإصلاح المناسبة.
 *
 * إجراءات الإصلاح الممكنة:
 *  1. عزل جلسة تالفة (quarantine)
 *  2. إعادة تشغيل العملية الرئيسية
 *  3. تسجيل الحوادث والانتظار
 *
 * قواعد:
 *  • حد زمني بين إعادات التشغيل (cooldown)
 *  • حد أقصى لإعادات التشغيل في نافذة زمنية
 *  • أي استثناء في الإصلاح لا يوقف البوت
 *
 * تعتمد على: core/logger.mjs, engine/session-storage.mjs
 * Exports: RecoveryManager
 */

import { inf, wrn, logErr } from "../core/logger.mjs";
import { quarantineSession } from "./session-storage.mjs";

const RESTART_COOLDOWN_MS   = 60_000;   // دقيقة بين كل إعادة تشغيل
const MAX_RESTARTS_PER_HOUR = 5;
const ONE_HOUR_MS           = 3_600_000;

export class RecoveryManager {
  #restarts      = [];   // تواريخ إعادات التشغيل الأخيرة
  #lastRestartAt = 0;
  #baseDir;
  #childProcess  = null;
  #onRestart;    // callback() — يُستدعى لإعادة تشغيل العملية
  #tracker;      // WorkerTracker

  /**
   * @param {object} options
   * @param {string}   options.baseDir
   * @param {Function} [options.onRestart]    — callback لإعادة تشغيل العملية
   * @param {object}   [options.tracker]      — WorkerTracker
   */
  constructor({ baseDir, onRestart = null, tracker = null }) {
    this.#baseDir   = baseDir;
    this.#onRestart = onRestart;
    this.#tracker   = tracker;
  }

  setChildProcess(proc) {
    this.#childProcess = proc;
  }

  // ── إصلاح البوت الغير مستجيب ────────────────────────────────
  async handleUnhealthyBot(reason) {
    wrn(`🚨 بوت غير صحيح: ${reason}`);

    if (!this.#canRestart()) {
      wrn("⏳ لا إعادة تشغيل — cooldown نشط أو حُدِّد الحد الأقصى");
      return false;
    }

    inf("🔁 إعادة تشغيل العملية...");
    return this.#doRestart(reason);
  }

  // ── إصلاح جلسة تالفة ────────────────────────────────────────
  async handleCorruptedSessions(corrupted) {
    let fixed = 0;
    for (const info of corrupted) {
      try {
        wrn(`🔒 عزل جلسة تالفة: ${info.userId} — ${info.error}`);
        const ok = await quarantineSession(this.#baseDir, info.userId);
        if (ok) {
          fixed++;
          if (this.#tracker) {
            const { SessionState } = await import("./lifecycle.mjs");
            this.#tracker.setState(info.userId, SessionState.TERMINATED, "تالف — مُعزَل");
          }
        }
      } catch (e) {
        logErr(`فشل عزل ${info.userId}: ${e.message}`);
      }
    }
    if (fixed > 0) inf(`✅ عُزِلت ${fixed}/${corrupted.length} جلسات تالفة`);
    return fixed;
  }

  // ── إحصائيات ────────────────────────────────────────────────
  getStats() {
    const recentRestarts = this.#restarts.filter(t => Date.now() - t < ONE_HOUR_MS);
    return {
      totalRestarts:        this.#restarts.length,
      restartsLastHour:     recentRestarts.length,
      lastRestartAt:        this.#lastRestartAt || null,
      cooldownActive:       !this.#canRestart(),
      msSinceLastRestart:   this.#lastRestartAt ? Date.now() - this.#lastRestartAt : null,
    };
  }

  // ── داخلي ──────────────────────────────────────────────────────
  #canRestart() {
    const recentRestarts = this.#restarts.filter(t => Date.now() - t < ONE_HOUR_MS);
    if (recentRestarts.length >= MAX_RESTARTS_PER_HOUR) {
      logErr(`🛑 حُدِّد الحد الأقصى: ${MAX_RESTARTS_PER_HOUR} إعادة تشغيل/ساعة`);
      return false;
    }
    if (Date.now() - this.#lastRestartAt < RESTART_COOLDOWN_MS) {
      return false;
    }
    return true;
  }

  async #doRestart(reason) {
    this.#lastRestartAt = Date.now();
    this.#restarts.push(this.#lastRestartAt);

    // تنظيف السجل من أكثر من ساعة
    this.#restarts = this.#restarts.filter(t => Date.now() - t < ONE_HOUR_MS * 2);

    try {
      if (this.#onRestart) {
        await this.#onRestart(reason);
        return true;
      } else if (this.#childProcess) {
        this.#childProcess.kill("SIGTERM");
        // process-manager سيُعيد الإطلاق عند exit
        return true;
      }
    } catch (e) {
      logErr(`فشل إعادة التشغيل: ${e.message}`);
    }
    return false;
  }
}
