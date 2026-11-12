/**
 * engine/lifecycle.mjs
 * ─────────────────────────────────────────────────────────────────
 * المسؤولية: تعريف حالات الجلسة وآلة الحالة (State Machine).
 *
 * دورة حياة الجلسة:
 *   UNKNOWN → DETECTED → CONNECTING → CONNECTED
 *                ↓            ↓            ↓
 *           CORRUPTED   DISCONNECTED  DISCONNECTED
 *                ↓            ↓
 *           TERMINATED   RECOVERING → CONNECTED / TERMINATED
 *
 * تعتمد على: لا شيء (وحدة خالصة)
 * Exports: SessionState, canTransition, createSessionRecord, transitionState
 */

export const SessionState = Object.freeze({
  UNKNOWN:      "unknown",       // لم يُكتشف بعد
  DETECTED:     "detected",      // ملف creds.json موجود وصالح
  CONNECTING:   "connecting",    // جارٍ الاتصال بـ Baileys
  CONNECTED:    "connected",     // متصل ويستقبل رسائل
  DISCONNECTED: "disconnected",  // منفصل — ينتظر إعادة اتصال
  RECOVERING:   "recovering",    // جارٍ محاولة الإصلاح / إعادة الاتصال
  CORRUPTED:    "corrupted",     // ملفات session تالفة أو ناقصة
  TERMINATED:   "terminated",    // أُنهي نهائياً (logged out / max retries)
});

const TRANSITIONS = new Map([
  // UNKNOWN → أي حالة مكتشفة
  [SessionState.UNKNOWN,      [SessionState.DETECTED,     SessionState.CORRUPTED,    SessionState.TERMINATED]],
  // DETECTED → قد يكون متصلاً مسبقاً (اكتشاف عند startup) أو يبدأ الاتصال
  [SessionState.DETECTED,     [SessionState.CONNECTING,   SessionState.CONNECTED,    SessionState.CORRUPTED,    SessionState.TERMINATED]],
  [SessionState.CONNECTING,   [SessionState.CONNECTED,    SessionState.DISCONNECTED, SessionState.CORRUPTED]],
  [SessionState.CONNECTED,    [SessionState.DISCONNECTED, SessionState.TERMINATED]],
  [SessionState.DISCONNECTED, [SessionState.RECOVERING,   SessionState.CONNECTING,   SessionState.TERMINATED]],
  [SessionState.RECOVERING,   [SessionState.CONNECTED,    SessionState.DISCONNECTED, SessionState.CORRUPTED,    SessionState.TERMINATED]],
  [SessionState.CORRUPTED,    [SessionState.DETECTED,     SessionState.TERMINATED]],
  [SessionState.TERMINATED,   []],
]);

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return TRANSITIONS.get(from)?.includes(to) ?? false;
}

/**
 * يُنشئ سجل جلسة أولياً.
 * @param {string} userId
 * @returns {object}
 */
export function createSessionRecord(userId) {
  const now = Date.now();
  return {
    userId,
    state:             SessionState.UNKNOWN,
    lastActivity:      null,
    lastMessage:       null,
    lastPing:          null,
    lastReconnect:     null,
    reconnectAttempts: 0,
    errors:            [],
    createdAt:         now,
    updatedAt:         now,
    lastError:         null,
  };
}

/**
 * يُحدِّث حالة سجل الجلسة مع التحقق من صحة الانتقال.
 * إذا كان الانتقال غير مسموح، يُعيد السجل بدون تعديل.
 *
 * @param {object} record
 * @param {string} newState
 * @param {string|null} [reason]
 * @returns {object}
 */
export function transitionState(record, newState, reason = null) {
  if (!canTransition(record.state, newState)) return record;
  return {
    ...record,
    state:     newState,
    updatedAt: Date.now(),
    ...(reason !== null && { lastError: reason }),
  };
}

/**
 * يُعيد تسمية نصية للحالة (للسجلات).
 * @param {string} state
 * @returns {string}
 */
export function describeState(state) {
  const labels = {
    [SessionState.UNKNOWN]:      "غير معروف",
    [SessionState.DETECTED]:     "مكتشف",
    [SessionState.CONNECTING]:   "جارٍ الاتصال",
    [SessionState.CONNECTED]:    "متصل ✅",
    [SessionState.DISCONNECTED]: "منفصل",
    [SessionState.RECOVERING]:   "جارٍ الإصلاح",
    [SessionState.CORRUPTED]:    "تالف ❌",
    [SessionState.TERMINATED]:   "منتهٍ",
  };
  return labels[state] ?? state;
}
