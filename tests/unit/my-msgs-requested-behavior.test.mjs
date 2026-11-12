import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { myMsgsFeatureSubMenu, myMsgsMenuKeyboard } from "../../dist/my-msgs.mjs";

const bundleUrl = new URL("../../dist/index.mjs", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");

test("retired My Messages features stay out while translation remains available", () => {
  const menu = JSON.stringify(myMsgsMenuKeyboard({}));
  assert.doesNotMatch(
    menu,
    /weather|fortune|prayer|currency|news|الطقس|حظك اليوم|مواقيت الصلاة|تحويل عملة|أخبار/u
  );
  assert.match(menu, /mymsgs_show_translate/u);
});

test("translation replaces the command message instead of posting a new success message", () => {
  assert.match(bundle, /sendMessage\(jid,\s*\{\s*text:\s*translated,\s*edit:\s*msg\.key\s*\}\)/u);
  assert.match(bundle, /sendMessage\(jid,\s*\{\s*text:\s*fbOut,\s*edit:\s*msg\.key\s*\}\)/u);
  assert.doesNotMatch(bundle, /sendMessage\(jid,\s*\{\s*text:\s*prefix\s*\+\s*translated/u);
});

test("profile instructions support /mg me and a number followed by me", () => {
  const submenu = myMsgsFeatureSubMenu(
    { profilePicEnabled: true, profilePicCmd: "/mg" },
    "pic"
  );
  assert.match(submenu.text, /\/mg me/u);
  assert.match(submenu.text, /\/mg \+966501234567 me/u);
  assert.ok(bundle.includes("const _mgMe = _mgArgs.toLowerCase() === 'me';"));
  assert.ok(bundle.includes('_mgArgs.replace(/\\s+me$/i, "")'));
  assert.ok(bundle.includes("updateProfilePicture(myJid, buf)"));
});

test("developer tool remains enabled and restricted to the developer", async () => {
  const source = await readFile(
    new URL("../../dist/handlers/sitegen-handler.mjs", import.meta.url),
    "utf8"
  );
  const menu = JSON.stringify(myMsgsMenuKeyboard({}));
  assert.match(source, /enabled:\s*true/u);
  assert.match(source, /DEVELOPER_ID/u);
  assert.match(menu, /mymsgs_show_sitegen/u);
});
