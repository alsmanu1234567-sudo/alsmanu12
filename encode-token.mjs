#!/usr/bin/env node
/**
 * encode-token.mjs — أداة تشفير أي توكن لوضعه في config.json
 * استخدام: node encode-token.mjs ghp_xxxxxxxxxxxxxx
 * ثم انسخ الناتج إلى config.json كـ GITHUB_TOKEN_ENC
 *
 * الخوارزمية: AES-256-CBC مع مفتاح مشتق بـ SHA-256
 * التوكن لا يظهر أبداً في الملفات — فقط النسخة المشفرة
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const KEY_PHRASE = "WaBotKey2024!";

function deriveKey() {
  return createHash("sha256").update(KEY_PHRASE).digest();
}

function encode(raw) {
  const iv  = randomBytes(16);
  const key = deriveKey();
  const c   = createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([c.update(raw, "utf8"), c.final()]);
  return iv.toString("hex") + ":" + enc.toString("base64");
}

function decode(encoded) {
  // دعم الصيغة القديمة (XOR+base64 — بدون ":")
  if (!encoded.includes(":")) {
    return Buffer.from(encoded, "base64")
      .map((b, i) => b ^ KEY_PHRASE.charCodeAt(i % KEY_PHRASE.length))
      .toString("utf8");
  }
  const [ivHex, encB64] = encoded.split(":");
  const iv  = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encB64, "base64");
  const d   = createDecipheriv("aes-256-cbc", deriveKey(), iv);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const token = process.argv[2];
if (!token) {
  console.log(`
استخدام:
  node encode-token.mjs YOUR_GITHUB_TOKEN

مثال:
  node encode-token.mjs ghp_xxxxxxxxxxxx

الناتج: ضع القيمة في config.json كالتالي:
  {
    "GITHUB_TOKEN_ENC": "ENCODED_VALUE_HERE"
  }

الخوارزمية: AES-256-CBC (تشفير قوي جداً)
`);
  process.exit(1);
}

const encoded = encode(token);
const verify  = decode(encoded);

if (verify !== token) {
  console.error("❌ خطأ في التشفير — الناتج لا يطابق الأصل");
  process.exit(1);
}

console.log("\n✅ التشفير نجح! (AES-256-CBC)\n");
console.log("أضف هذا إلى config.json:");
console.log(JSON.stringify({ GITHUB_TOKEN_ENC: encoded }, null, 2));
console.log("\n⚠️  لا ترفع config.json إلى GitHub — أضفه إلى .gitignore\n");
