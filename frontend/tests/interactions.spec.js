import { test, expect } from "@playwright/test";

test("touch rotates the vinyl and releases capture", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:8010/catalog");
    const disc = page.getByRole("slider", { name: "Повернуть пластинку" });
    await expect(disc).toBeVisible();
    const before = await disc.evaluate((node) =>
      node.style.getPropertyValue("--rotation"),
    );
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 360, y: 260 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 350, y: 330 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      await disc.evaluate((node) => node.style.getPropertyValue("--rotation")),
    ).not.toBe(before);
    await expect(disc).not.toHaveClass(/dragging/);
    await page.screenshot({ path: "test-results/catalog-touch.png" });
  } finally {
    await context.close();
  }
});

test("expanded genres, vinyl drag, keyboard, motion preference and favorites", async ({
  page,
  request,
}) => {
  await page.goto("/catalog");
  const disc = page.getByRole("slider", { name: "Повернуть пластинку" });
  await expect(disc).toBeVisible();
  const rotation = () =>
    disc.evaluate((node) => node.style.getPropertyValue("--rotation"));
  const start = await rotation();
  await expect.poll(rotation).not.toBe(start);
  await page.getByRole("button", { name: "Остановить вращение" }).click();
  await expect(page.getByRole("button", { name: "Продолжить вращение" })).toBeVisible();
  const box = await disc.boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.15);
  await page.mouse.down();
  const beforeDrag = await rotation();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
    steps: 10,
  });
  await page.mouse.up();
  expect(await rotation()).not.toBe(beforeDrag);
  await expect(disc).not.toHaveClass(/dragging/);
  await disc.focus();
  await page.keyboard.press("Home");
  await expect(disc).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("ArrowRight");
  await expect(disc).toHaveAttribute("aria-valuenow", "15");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(disc).toBeVisible();
  await expect(page.getByRole("button", { name: "Остановить вращение" })).toHaveCount(
    0,
  );
  const fixed = await rotation();
  await page.waitForTimeout(200);
  expect(await rotation()).toBe(fixed);

  const state = await (await request.get("/api/state")).json();
  for (const genre of new Set(state.records.map((record) => record.genre))) {
    await page.locator('select[aria-label="\u0416\u0430\u043d\u0440"]').selectOption(genre);
    await expect(page.locator(".catalog .album").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Все пластинки", exact: true }).click();
  await expect(page.locator(".catalog .album")).toHaveCount(24);
  await page.getByRole("button", { name: /Показать ещё/ }).click();
  await expect(page.locator(".catalog .album")).toHaveCount(54);

  const registration = await page.request.post("/api/register", {
    data: {
      name: "Motion test",
      email: "motion@example.com",
      password: "motion-test-password",
      role: "customer",
    },
  });
  expect(registration.ok()).toBe(true);
  await page.reload();
  await page.locator(".heart").first().click();
  await expect(page.locator(".heart").first()).toHaveAttribute("aria-pressed", "true");
  await page.locator(".heart img").first().evaluate(image => image.decode());
  await page.locator(".album").first().screenshot({ path: "test-results/saved-heart.png", animations: "disabled" });
  await page.locator(".genre-tiles.compact").screenshot({ path: "test-results/catalog-genres.png", animations: "disabled" });
  await page.locator(".add").first().click();
  await expect(
    page.getByRole("link", { name: "Корзина (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".heart").first()).toHaveAttribute("aria-pressed", "true");
});
