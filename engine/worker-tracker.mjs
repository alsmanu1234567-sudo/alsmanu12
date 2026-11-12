/**
 * engine/worker-tracker.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: تتبع صحة كل جلسة واتسآب بشكل مستقل.
 *
 * يحتفظ بسجل لكل جلسة يتضمن:
 *  • lastActivity  — آخر نشاط مرصود
 *  • lastMessage   — آخر رسالة مُعالَجة
 *  • lastPing      — آخر إشارة حياة
 *  • lastReconnect — آخر إعادة اتصال
 *  • reconnectAttempts — عدد محاولات إعادة الاتصال
 *  • status        — الحالة الحالية
 *  • errors        — آخر 10 أخطاء
 *
 * تعتمد على: engine/lifecycle.mjs
 * Exports: WorkerTracker
 */

import { SessionState, createSessionRecord, transitionState } from "./lifecycle.mjs";

export class WorkerTracker {
  /** @type {Map<string, object>} */
  #sessions = new Map();

  /**
   * يُسجِّل جلسة جديدة أو يُعيد تعيين سجلها.
   * @param {string} userId
   * @param {string} [initialState]
   */
  register(userId, initialState = SessionState.UNKNOWN) {
    const record = createSessionRecord(userId);
    record.state = initialState;
    this.#sessions.set(userId, record);
    return record;
  }

  /**
   * يُسجِّل الجلسة إذا لم تكن موجودة، ويُعيدها.
   * @param {string} userId
   */
  getOrCreate(userId) {
    if (!this.#sessions.has(userId)) this.register(userId);
    return this.#sessions.get(userId);
  }

  /**
   * يُحدِّث حالة الجلسة.
   * @param {string} userId
   * @param {string} newState
   * @param {string|null} [reason]
   */
  setState(userId, newState, reason = null) {
    const rec     = this.getOrCreate(userId);
    const updated = transitionState(rec, newState, reason);
    this.#sessions.set(userId, updated);
    return updated;
  }

  /** يُسجِّل نشاطاً (رسالة مستقبَلة / حدث Baileys). */
  markActivity(userId) {
    const rec = this.getOrCreate(userId);
    rec.lastActivity = Date.now();
    rec.lastPing     = Date.now();
  }

  /** يُسجِّل رسالة وُصِلت. */
  markMessage(userId) {
    const rec = this.getOrCreate(userId);
    rec.lastActivity = Date.now();
    rec.lastMessage  = Date.now();
  }

  /** يُسجِّل أن الجلسة أصبحت متصلة. */
  markConnected(userId) {
    const rec = this.getOrCreate(userId);
    rec.lastActivity = Date.now();
    rec.lastPing     = Date.now();
    return this.setState(userId, SessionState.CONNECTED);
  }

  /** يُسجِّل أن الجلسة انفصلت. */
  markDisconnected(userId, reason = null) {
    const rec = this.getOrCreate(userId);
    rec.lastActivity = Date.now();
    return this.setState(userId, SessionState.DISCONNECTED, reason);
  }

  /** يُسجِّل محاولة إعادة اتصال. */
  markReconnecting(userId) {
    const rec = this.getOrCreate(userId);
    rec.lastReconnect      = Date.now();
    rec.reconnectAttempts += 1;
    return this.setState(userId, SessionState.RECOVERING);
  }

  /** يُسجِّل خطأ على الجلسة. */
  addError(userId, errorMsg) {
    const rec = this.getOrCreate(userId);
    rec.errors.unshift(`[${new Date().toISOString()}] ${errorMsg}`);
    if (rec.errors.length > 10) rec.errors.pop();
  }

  /** @param {string} userId */
  get(userId) {
    return this.#sessions.get(userId) ?? null;
  }

  /** @returns {object[]} */
  getAll() {
    return Array.from(this.#sessions.values());
  }

  /** @returns {string[]} */
  getAllUserIds() {
    return Array.from(this.#sessions.keys());
  }

  /**
   * الجلسات التي لم تُظهر نشاطاً منذ X مللي ثانية.
   * @param {number} thresholdMs
   * @returns {object[]}
   */
  getStale(thresholdMs = 5 * 60 * 1000) {
    const cutoff = Date.now() - thresholdMs;
    return this.getAll().filter(r =>
      r.state === SessionState.CONNECTED &&
      r.lastActivity !== null &&
      r.lastActivity < cutoff
    );
  }

  /** @returns {{ total, connected, disconnected, recovering, corrupted }} */
  getStats() {
    const all = this.getAll();
    const count = (state) => all.filter(r => r.state === state).length;
    return {
      total:        all.length,
      connected:    count(SessionState.CONNECTED),
      disconnected: count(SessionState.DISCONNECTED),
      recovering:   count(SessionState.RECOVERING),
      connecting:   count(SessionState.CONNECTING),
      corrupted:    count(SessionState.CORRUPTED),
      terminated:   count(SessionState.TERMINATED),
    };
  }

  /** يحذف سجل جلسة. */
  remove(userId) {
    return this.#sessions.delete(userId);
  }
}
