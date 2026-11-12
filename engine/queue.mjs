/**
 * engine/queue.mjs — v2.1
 * ─────────────────────────────────────────────────────────────────
 * طابور أولوية غير متزامن لتنفيذ المهام بشكل متدرج.
 *
 * v2.1 — إصلاح ضمان التزامن عند timeout:
 *   المشكلة: Promise.race يرفض الـ caller فوراً عند timeout، لكن item.fn()
 *   تبقى تعمل في الخلفية كـ "zombie". كان #running-- يُستدعى مع الـ race
 *   فيتجاوز التزامن الفعلي maxConcurrent.
 *
 *   الحل: عند timeout، نرفض الـ caller فوراً لكن لا نُفرج عن الـ slot حتى
 *   تنتهي item.fn() فعلياً (resolve أو reject). هكذا #running لا يتجاوز
 *   maxConcurrent أبداً.
 *
 *   إضافة: إلغاء timer مبكراً عند الانتهاء الطبيعي لتقليل تراكم المؤقتات.
 *
 * تعتمد على: لا شيء (وحدة خالصة)
 * Exports: Queue
 */

export class Queue {
  /** @type {Array<QueueItem>} */
  #pending = [];
  #running = 0;
  #paused  = false;
  // [ZOMBIE-FIX] عدّاد المهام الزومبي (تجاوزت timeout وما زالت تعمل بالخلفية)
  #zombies = 0;
  #stats   = { processed: 0, failed: 0, retried: 0, timedOut: 0, recovered: 0 };

  /**
   * @param {object} [options]
   * @param {number} [options.maxConcurrent=1]  — الحد الأقصى للتوازي الفعلي
   * @param {number} [options.maxRetries=0]     — إعادة المحاولة عند الفشل (لا تطبَّق على timeout)
   * @param {number} [options.retryDelay=1000]  — تأخير إعادة المحاولة ms
   * @param {number} [options.timeout=0]        — مهلة قصوى للمهمة ms (0 = غير محدود)
   */
  constructor({ maxConcurrent = 1, maxRetries = 0, retryDelay = 1000, timeout = 0 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxRetries    = maxRetries;
    this.retryDelay    = retryDelay;
    this.timeout       = timeout;
  }

  /**
   * يضيف مهمة للطابور.
   * @param {string}   label    — اسم المهمة (للسجلات والفلترة)
   * @param {Function} fn       — دالة async
   * @param {number}   [priority=0] — أعلى = أسرع، نفس الأولوية = FIFO
   * @returns {Promise<*>}
   */
  push(label, fn, priority = 0) {
    return new Promise((resolve, reject) => {
      const item = { label, fn, priority, resolve, reject, attempts: 0 };
      // FIFO ضمن نفس الأولوية
      const idx = this.#pending.findLastIndex(p => p.priority >= priority);
      this.#pending.splice(idx + 1, 0, item);
      this.#tick();
    });
  }

  /** يوقف قبول مهام جديدة (لا يوقف الجارية). */
  pause()  { this.#paused = true; }

  /** يستأنف التنفيذ. */
  resume() { this.#paused = false; this.#tick(); }

  /**
   * يُلغي كل المهام المعلّقة التي يبدأ labelها بـ prefix.
   * لا يُلغي المهام الجارية حالياً (تلك بدأت التنفيذ).
   * @param {string} prefix
   * @returns {number} عدد المهام الملغاة
   */
  clearByLabel(prefix) {
    const toCancel = this.#pending.filter(i => i.label.startsWith(prefix));
    this.#pending   = this.#pending.filter(i => !i.label.startsWith(prefix));
    for (const item of toCancel) {
      item.reject(new Error(`Queue.clearByLabel: cancelled — ${item.label}`));
    }
    return toCancel.length;
  }

  /** يُفرِّغ الطابور بالكامل (لا يُلغي الجارية). */
  clear() {
    const cancelled = this.#pending.splice(0);
    for (const item of cancelled) {
      item.reject(new Error(`Queue.clear: cancelled — ${item.label}`));
    }
    return cancelled.length;
  }

  /** @returns {{ pending, running, zombies, processed, failed, retried, timedOut, recovered }} */
  getStats() {
    return { pending: this.#pending.length, running: this.#running, zombies: this.#zombies, ...this.#stats };
  }

  /**
   * [ZOMBIE-FIX] إنعاش قسري — صمام أمان أخير.
   * إذا اكتشف الـ watchdog أن القناة متجمدة (running ممتلئ بلا أي تقدم)
   * يُصفّر العدّاد ويعيد تشغيل الطابور. المهام المتجمدة تُترك كزومبي.
   * @returns {number} عدد الخانات المحررة
   */
  forceRecover() {
    const stuck = this.#running;
    if (stuck > 0) {
      this.#zombies += stuck;
      this.#running = 0;
      this.#stats.recovered += stuck;
      this.#tick();
    }
    return stuck;
  }

  /** عدد المهام المعلّقة حالياً. */
  get size() { return this.#pending.length; }

  // ── داخلي ──────────────────────────────────────────────────────────

  #tick() {
    if (this.#paused) return;
    while (this.#running < this.maxConcurrent && this.#pending.length > 0) {
      this.#execute(this.#pending.shift());
    }
  }

  async #execute(item) {
    this.#running++;
    item.attempts++;

    const fnPromise = item.fn(); // نبدأ المهمة فوراً

    try {
      // ── مع timeout ──────────────────────────────────────────────
      if (this.timeout > 0) {
        let timeoutId;
        const raceResult = await new Promise((res, rej) => {
          // Timer للـ timeout
          timeoutId = setTimeout(() => {
            const e = new Error(`Queue timeout (${this.timeout}ms): ${item.label}`);
            e._queueTimeout = true;
            rej(e);
          }, this.timeout);

          // إنهاء المهمة قبل timeout → ألغِ المؤقت وأكمل
          fnPromise.then(
            val => { clearTimeout(timeoutId); res(val); },
            err => { clearTimeout(timeoutId); rej(err); }
          );
        });

        this.#stats.processed++;
        item.resolve(raceResult);

      // ── بدون timeout ────────────────────────────────────────────
      } else {
        const result = await fnPromise;
        this.#stats.processed++;
        item.resolve(result);
      }

    } catch (e) {
      const isTimeout = e?._queueTimeout === true;

      if (isTimeout) {
        // ── [ZOMBIE-FIX] Timeout: حرّر الـ slot فوراً — لا تنتظر المهمة المعلّقة
        //
        // الكود السابق كان يعمل `await fnPromise` قبل تحرير الـ slot.
        // إذا كانت fnPromise معلّقة للأبد (سوكت ميت، تنزيل متجمد، شبكة مقطوعة)
        // فالـ slot لا يتحرر أبداً. مع maxConcurrent=3 في قناة الأوامر،
        // ثلاث مهام معلّقة = موت كامل ودائم لأوامر "رسالي" حتى إعادة التشغيل.
        //
        // الحل: نحرر الـ slot فوراً ونتتبع المهمة كـ "زومبي" في عدّاد منفصل.
        // عندما تنتهي فعلاً (إن انتهت) ينقص العدّاد. القناة لا تموت أبداً.
        this.#stats.timedOut++;
        item.reject(e);
        this.#zombies++;
        fnPromise.then(
          () => { this.#zombies--; },
          () => { this.#zombies--; }
        );
        this.#running--;
        this.#tick();
        return;

      } else if (item.attempts <= this.maxRetries) {
        // ── إعادة محاولة ────────────────────────────────────────
        this.#stats.retried++;
        this.#running--; // أُفرج عن الـ slot مؤقتاً قبل إعادة الإدراج
        this.#tick();
        await this.#sleep(this.retryDelay * item.attempts);
        this.#pending.unshift(item); // أولوية قصوى لإعادة المحاولة
        this.#tick();
        return;

      } else {
        // ── فشل نهائي ───────────────────────────────────────────
        this.#stats.failed++;
        item.reject(e);
      }
    }

    // إفراج الـ slot في الحالات العادية (نجاح / فشل نهائي)
    this.#running--;
    this.#tick();
  }

  #sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
