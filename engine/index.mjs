/**
 * engine/index.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: نقطة الدخول الرئيسية لطبقة Session Engine.
 *
 * يُهيِّئ جميع مكونات المحرك ويُنسِّق بينها:
 *   SessionStorage → WorkerTracker → ReconnectManager →
 *   RecoveryManager → HealthMonitor → Heartbeat → SessionManager
 *
 * الاستخدام من bootstrap:
 *   import { startEngine } from "../engine/index.mjs";
 *   const engine = await startEngine({ baseDir, childProcess, config });
 *
 * تعتمد على: engine/*.mjs, core/logger.mjs
 * Exports: startEngine, SessionEngine
 */

import { ok, inf, wrn, logErr, section } from "../core/logger.mjs";
import { WorkerTracker }               from "./worker-tracker.mjs";
import { ReconnectManager }            from "./reconnect-manager.mjs";
import { RecoveryManager }             from "./recovery-manager.mjs";
import { HealthMonitor }               from "./health-monitor.mjs";
import { Heartbeat }                   from "./heartbeat.mjs";
import { SessionManager }              from "./session-manager.mjs";
import { Queue }                       from "./queue.mjs";
import { reportStorageHealth }         from "./session-storage.mjs";

const DEFAULT_PORT           = 5000;
const HEARTBEAT_INTERVAL_MS  = 30_000;  // 30 ثانية
const HEAVY_OPS_CONCURRENCY  = 2;

export class SessionEngine {
  tracker;
  reconnect;
  recovery;
  monitor;
  heartbeat;
  sessionManager;
  queue;

  #baseDir;
  #childProcess;
  #running = false;

  constructor({ baseDir, childProcess, port = DEFAULT_PORT }) {
    this.#baseDir      = baseDir;
    this.#childProcess = childProcess;

    // ── إنشاء المكونات ────────────────────────────────────────
    this.tracker = new WorkerTracker();

    this.reconnect = new ReconnectManager({
      onMaxRetries: (userId) => {
        wrn(`🆘 ${userId}: استُنفِدت محاولات إعادة الاتصال — تصعيد للـ RecoveryManager`);
      },
    });

    this.recovery = new RecoveryManager({
      baseDir,
      tracker: this.tracker,
      onRestart: async (reason) => {
        wrn(`🔁 RecoveryManager: طلب إعادة تشغيل — ${reason}`);
        if (this.#childProcess) {
          this.#childProcess.kill("SIGTERM");
        }
      },
    });

    this.monitor = new HealthMonitor({
      baseDir,
      port,
      childProcess,
      onUnhealthy: (reason) => {
        this.recovery.handleUnhealthyBot(reason).catch(e =>
          logErr(`RecoveryManager خطأ: ${e.message}`)
        );
      },
      onSessionCorrupt: (corrupted) => {
        this.recovery.handleCorruptedSessions(corrupted).catch(e =>
          logErr(`عزل الجلسات خطأ: ${e.message}`)
        );
      },
    });

    this.heartbeat = new Heartbeat({
      monitor:    this.monitor,
      tracker:    this.tracker,
      intervalMs: HEARTBEAT_INTERVAL_MS,
    });

    this.sessionManager = new SessionManager({
      baseDir,
      tracker:   this.tracker,
      reconnect: this.reconnect,
      recovery:  this.recovery,
    });

    this.queue = new Queue({
      maxConcurrent: HEAVY_OPS_CONCURRENCY,
      maxRetries:    1,
      retryDelay:    2_000,
    });
  }

  /**
   * يُحدِّث مرجع العملية الفرعية (عند إعادة التشغيل).
   * @param {object} proc
   */
  setChildProcess(proc) {
    this.#childProcess = proc;
    this.monitor.setChildProcess(proc);
    this.recovery.setChildProcess(proc);
  }

  /** @returns {boolean} */
  isRunning() {
    return this.#running;
  }

  /**
   * تقرير الحالة الفورية.
   * @returns {Promise<object>}
   */
  async getStatus() {
    const report = await this.sessionManager.getHealthReport();
    return {
      ...report,
      heartbeat: this.heartbeat.getStatus(),
      queue:     this.queue.getStats(),
      monitor:   this.monitor.getStatus(),
    };
  }

  /** تُستدعى داخلياً من startEngine() لضبط حالة التشغيل. */
  _markRunning() {
    this.#running = true;
  }

  /** يوقف جميع المكونات بأمان. */
  stop() {
    this.heartbeat.stop();
    this.queue.clear();
    this.#running = false;
    inf("🛑 Session Engine توقف");
  }
}

/**
 * يُهيِّئ ويُشغِّل Session Engine الكامل.
 *
 * @param {object} options
 * @param {string} options.baseDir
 * @param {object} [options.childProcess]
 * @param {number} [options.port=5000]
 * @returns {Promise<SessionEngine>}
 */
export async function startEngine({ baseDir, childProcess = null, port = DEFAULT_PORT }) {
  section("Session Engine");

  const engine = new SessionEngine({ baseDir, childProcess, port });

  // ── 1. فحص وتقرير صحة التخزين ────────────────────────────
  inf("📦 فحص ملفات الجلسات المحفوظة...");
  const storageScan = await reportStorageHealth(baseDir);

  // ── 2. تهيئة SessionManager (يعزل التالفة تلقائياً) ─────
  await engine.sessionManager.initialize();

  // ── 3. تشغيل Heartbeat ───────────────────────────────────
  engine.heartbeat.start();

  engine._markRunning();

  ok(`✅ Session Engine جاهز — ${storageScan.valid} جلسة سليمة`);

  if (storageScan.corrupted.length > 0) {
    wrn(`⚠️ ${storageScan.corrupted.length} جلسة تالفة عُزِلت قبل التشغيل`);
  }

  return engine;
}
