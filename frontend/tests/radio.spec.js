import { test, expect } from "@playwright/test";

test("six local tracks play, pause and seek with the record", async ({ page, request }) => {
  await page.goto("/catalog");
  const audio = page.locator("audio");
  await audio.evaluate(a => { a.muted = true; });
  await expect.poll(() => audio.evaluate(a => a.duration)).toBeGreaterThan(30);
  await page.getByRole("button", { name: "Воспроизвести", exact: true }).click();
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(0);
  const disc = page.getByRole("slider", { name: "Перемотать песню пластинкой" });
  await disc.scrollIntoViewIfNeeded();
  const box = await disc.boundingBox();
  const before = await audio.evaluate(a => a.currentTime);
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .8, {steps: 12});
  await page.mouse.up();
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(before + 5);
  await expect.poll(() => audio.evaluate(a => a.paused)).toBe(false);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await disc.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBe(0);
  for (let i = 0; i < 6; i++) {
    await page.locator(".real-playlist button").nth(i).click();
    await expect.poll(() => audio.evaluate(a => Number.isFinite(a.duration) && a.duration > 30 && !a.paused)).toBe(true);
  }
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.locator("#radio").screenshot({path:"test-results/radio.png"});
  const partial = await request.get("/audio/ribs.mp3", {headers:{Range:"bytes=100-199"}});
  expect(partial.status()).toBe(206);
  expect((await partial.body()).length).toBe(100);
  const invalid = await request.get("/audio/ribs.mp3", {headers:{Range:"bytes=999999999-"}});
  expect(invalid.status()).toBe(416);
  await page.getByRole("combobox", {name:"Жанр",exact:true}).selectOption("Рок");
  await expect(page.locator(".catalog .album").first()).toBeVisible();
  await page.locator(".catalog").screenshot({path:"test-results/catalog-filters.png"});
  await page.locator(".header-actions").screenshot({path:"test-results/header-heart.png"});
});
