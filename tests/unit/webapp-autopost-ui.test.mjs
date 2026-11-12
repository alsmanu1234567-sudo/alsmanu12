import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { registerWebApp } from "../../dist/webapp.mjs";

test("group web app exposes auto-post routes and valid Arabic UI script", () => {
  const routes = { get: new Map(), post: new Map() };
  const app = {
    get(path, ...handlers) { routes.get.set(path, handlers); },
    post(path, ...handlers) { routes.post.set(path, handlers); },
  };
  registerWebApp(app);

  for (const route of [
    "/api/fw/groups/autopost/save",
    "/api/fw/groups/autopost/toggle",
    "/api/fw/groups/autopost/delete",
    "/api/fw/groups/autopost/test",
    "/api/fw/groups/autopost/publish",
  ]) {
    assert.equal(routes.post.has(route), true, `missing ${route}`);
  }

  let html = "";
  const [handler] = routes.get.get("/webapp");
  handler({}, {
    setHeader() {},
    end(value) { html = value; },
  });
  assert.match(html, /النشر التلقائي/);
  assert.match(html, /موضوع/);
  assert.match(html, /اختبار الجلب/);
  assert.match(html, /نشر الآن/);

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  assert.ok(scripts.length > 0, "inline app script should be present");
  assert.doesNotThrow(() => new Script(scripts.at(-1)[2]));
});
