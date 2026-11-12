/**
 * engine/health-monitor.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: مراقبة صحة العملية الرئيسية (dist/index.mjs) عبر:
 *  1. استطلاع HTTP /healthz
 *  2. فحص استجابة العملية الفرعية
 *  3. مراقبة ملفات الجلسات للتغييرات
 *
 * تعتمد على: core/logger.mjs, engine/session-storage.mjs
 * Exports: HealthMonitor
 */

import { wrn, inf, err } from "../core/logger.mjs";
import { scanAllSessions } from "./session-storage.mjs";

const DEFAULT_PORT           = 5000;
const HTTP_TIMEOUT_MS        = 8_000;
const MAX_CONSECUTIVE_FAILS  = 3;

export class HealthMonitor {
  #port;
  #baseDir;
  #childProcess;
  #consecutiveFails = 0;
  #lastCheckTime    = null;
  #lastResponse     = null;
  #onUnhealthy;     // callback(reason)
  #onSessionCorrupt; // callback(corrupted[])

  /**
   * @param {object} options
   * @param {string}   options.baseDir
   * @param {number}   [options.port=5000]
   * @param {object}   [options.childProcess]
   * @param {Function} [options.onUnhealthy]
   * @param {Function} [options.onSessionCorrupt]
   */
  constructor({ baseDir, port = DEFAULT_PORT, childProcess = null,
                onUnhealthy = null, onSessionCorrupt = null }) {
    this.#port             = port;
    this.#baseDir          = baseDir;
    this.#childProcess     = childProcess;
    this.#onUnhealthy      = onUnhealthy;
    this.#onSessionCorrupt = onSessionCorrupt;
  }

  /** يُحدِّث مرجع العملية الفرعية. */
  setChildProcess(proc) {
    this.#childProcess = proc;
  }

  // ── فحص HTTP ────────────────────────────────────────────────
  async checkHttp() {
    const url = `http://localhost:${this.#port}/healthz`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const res  = await fetch(url, { signal: controller.signal });
      const body = res.ok ? await res.json().catch(() => ({})) : null;
      clearTimeout(timer);
      this.#lastResponse = { ok: res.ok, status: res.status, body, ts: Date.now() };

      if (!res.ok) {
        // HTTP 4xx/5xx يُعدّ فشلاً — البوت قد يكون في حالة خطأ
        this.#consecutiveFails++;
        return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      }

      this.#consecutiveFails = 0;
      return { ok: true, status: res.status, body };
    } catch (e) {
      clearTimeout(timer);
      this.#consecutiveFails++;
      const reason = e.name === "AbortError" ? "HTTP timeout" : e.message;
      this.#lastResponse = { ok: false, error: reason, ts: Date.now() };
      return { ok: false, error: reason };
    }
  }

  // ── فحص العملية الفرعية ─────────────────────────────────────
  checkProcess() {
    if (!this.#childProcess) return { alive: true, reason: "no-ref" };
    const alive = this.#childProcess.exitCode === null;
    return {
      alive,
      pid:      this.#childProcess.pid,
      exitCode: this.#childProcess.exitCode,
    };
  }

  // ── فحص ملفات الجلسات ───────────────────────────────────────
  async checkSessions() {
    try {
      const scan = await scanAllSessions(this.#baseDir);
      if (scan.corrupted.length > 0 && this.#onSessionCorrupt) {
        this.#onSessionCorrupt(scan.corrupted);
      }
      return scan;
    } catch {
      return { total: 0, valid: 0, corrupted: [], all: [] };
    }
  }

  // ── فحص شامل ────────────────────────────────────────────────
  async checkAll() {
    this.#lastCheckTime    = Date.now();
    const [httpRes, procRes, sessRes] = await Promise.all([
      this.checkHttp(),
      Promise.resolve(this.checkProcess()),
      this.checkSessions(),
    ]);

    const healthy = httpRes.ok && procRes.alive;

    if (!healthy) {
      let reason = [];
      if (!httpRes.ok)    reason.push(`HTTP: ${httpRes.error ?? "فشل"}`);
      if (!procRes.alive) reason.push(`Process: exitCode=${procRes.exitCode}`);
      const msg = reason.join(" | ");
      wrn(`⚠️ صحة البوت: ${msg} (فشل متتالي: ${this.#consecutiveFails})`);

      if (this.#consecutiveFails >= MAX_CONSECUTIVE_FAILS && this.#onUnhealthy) {
        this.#onUnhealthy(msg);
      }
    }

    return { healthy, http: httpRes, process: procRes, sessions: sessRes,
             consecutiveFails: this.#consecutiveFails };
  }

  /** @returns {{ lastCheckTime, lastResponse, consecutiveFails }} */
  getStatus() {
    return {
      lastCheckTime:    this.#lastCheckTime,
      lastResponse:     this.#lastResponse,
      consecutiveFails: this.#consecutiveFails,
    };
  }
}
