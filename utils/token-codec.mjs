/**
 * utils/token-codec.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: ترميز وفك ترميز التوكنات المشفرة.
 *
 * تدعم صيغتين:
 *   • XOR + Base64  (الصيغة القديمة — لا تحتوي ":")
 *   • AES-256-CBC   (الصيغة الجديدة — ivHex:cipherBase64)
 *
 * مستقلة تماماً — لا تعتمد على أي وحدة محلية أخرى.
 * تُستخدم في: core/config.mjs، infrastructure/binary-manager.mjs
 */

import { createDecipheriv, createCipheriv, createHash, randomBytes } from "node:crypto";

const SECRET = "WaBotKey2024!";

// ── مشترك: اشتقاق مفتاح AES ──────────────────────────────────
function deriveKey() {
  return createHash("sha256").update(SECRET).digest();
}

// ── فك الترميز ────────────────────────────────────────────────
/**
 * @param {string} encoded — قيمة مشفرة (XOR أو AES)
 * @returns {string} النص الأصلي، أو "" عند الفشل
 */
export function decode(encoded) {
  if (!encoded) return "";

  // الصيغة القديمة: XOR + Base64 (لا يحتوي على ":")
  if (!encoded.includes(":")) {
    try {
      return Buffer.from(encoded, "base64")
        .map((b, i) => b ^ SECRET.charCodeAt(i % SECRET.length))
        .toString("utf8");
    } catch {
      return "";
    }
  }

  // الصيغة الجديدة: AES-256-CBC (ivHex:cipherBase64)
  try {
    const [ivHex, encB64] = encoded.split(":");
    const key = deriveKey();
    const iv  = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encB64, "base64");
    const d   = createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

// ── الترميز ──────────────────────────────────────────────────
/**
 * @param {string} plain — النص الأصلي
 * @returns {string} ivHex:cipherBase64
 */
export function encode(plain) {
  const key = deriveKey();
  const iv  = randomBytes(16);
  const c   = createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return iv.toString("hex") + ":" + enc.toString("base64");
}
