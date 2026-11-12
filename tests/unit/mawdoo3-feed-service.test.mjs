import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearMawdoo3Cache,
  findNextMawdoo3Article,
  matchesMawdoo3Topic,
  parseMawdoo3Listing,
} from "../../dist/services/groups/mawdoo3-feed-service.mjs";

test("Mawdoo3 listing parser keeps only unique same-site article links", () => {
  const html = `
    <a href="/أجمل_القصص_القصيرة">عنوان</a>
    <a href="https://mawdoo3.com/أجمل_القصص_القصيرة?ref=home">مكرر</a>
    <a href="https://evil.example/قصة_حب">خارج الموقع</a>
    <a href="/خاص:أجدد_الصفحات">صفحة خاصة</a>
    <a href="/نكتة_مضحكة">نكتة</a>
  `;
  const items = parseMawdoo3Listing(html);
  assert.deepEqual(items, [
    { title: "أجمل القصص القصيرة", url: "https://mawdoo3.com/%D8%A3%D8%AC%D9%85%D9%84_%D8%A7%D9%84%D9%82%D8%B5%D8%B5_%D8%A7%D9%84%D9%82%D8%B5%D9%8A%D8%B1%D8%A9" },
    { title: "نكتة مضحكة", url: "https://mawdoo3.com/%D9%86%D9%83%D8%AA%D8%A9_%D9%85%D8%B6%D8%AD%D9%83%D8%A9" },
  ]);
});

test("Mawdoo3 accepts the public bedtime-story link format", () => {
  const url = "https://mawdoo3.com/%D9%82%D8%B5%D8%B5_%D8%A7%D8%B7%D9%81%D8%A7%D9%84_%D9%82%D8%A8%D9%84_%D8%A7%D9%84%D9%86%D9%88%D9%85";
  assert.deepEqual(
    parseMawdoo3Listing(`<a href="${url}">قصص اطفال قبل النوم</a>`),
    [{ title: "قصص اطفال قبل النوم", url }]
  );
});

test("Mawdoo3 topic matching distinguishes stories, love stories, and jokes", () => {
  assert.equal(matchesMawdoo3Topic("أجمل القصص القصيرة", "قصص"), true);
  assert.equal(matchesMawdoo3Topic("قصة حب جميلة", "قصص حب"), true);
  assert.equal(matchesMawdoo3Topic("أجمل نكت مضحكة", "نكات"), true);
  assert.equal(matchesMawdoo3Topic("ثمان سنن مستحبة قبل العيد", "قصص حب"), false);
});

test("Mawdoo3 fetch selects a fresh matching title and link only", async () => {
  clearMawdoo3Cache();
  const html = `
    <a href="/قصة_حب_أولى">الأولى</a>
    <a href="/قصة_حب_ثانية">الثانية</a>
  `;
  const fetchImpl = async () => new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  const first = await findNextMawdoo3Article("قصص حب", { fetchImpl });
  const second = await findNextMawdoo3Article("قصص حب", {
    fetchImpl,
    seenUrls: [first.url],
  });
  assert.notEqual(first.url, second.url);
  assert.deepEqual(Object.keys(first).sort(), ["title", "url"]);
  await assert.rejects(
    findNextMawdoo3Article("قصص حب", {
      fetchImpl,
      seenUrls: [first.url, second.url],
    }),
    /غير مكرر/
  );
  clearMawdoo3Cache();
});
