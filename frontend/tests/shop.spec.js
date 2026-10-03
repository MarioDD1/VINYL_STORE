import { test, expect } from "@playwright/test";

test("guest, customer checkout and administrator artwork upload", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Хорошая музыка/ })).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  await page.getByRole("link", { name: "Каталог", exact: true }).click();
  await page.getByRole("searchbox").fill("Radiohead");
  await expect(page.locator(".album")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("Radiohead");
  await page.getByRole("link", { name: "Подробнее: Radiohead — In Rainbows" }).click();
  await expect(
    page.getByRole("heading", { name: "In Rainbows", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "In Rainbows", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "В корзину +", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Регистрация", exact: true }).click();
  await dialog.getByLabel("Ваше имя").fill("Покупатель");
  await dialog.getByLabel("Email").fill("react-buyer@example.com");
  await dialog.getByLabel("Пароль", { exact: true }).fill("react-test-password");
  await dialog.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "В корзину +", exact: true }).first().click();
  await page.getByRole("link", { name: /Корзина/ }).click();
  await page.getByRole("button", { name: /Оформить заказ/ }).click();
  await page.getByLabel("Телефон", { exact: true }).fill("+7 999 123 45 67");
  await page
    .getByLabel("Город и адрес для связи")
    .fill("Москва, улица Примерная, дом 10");
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(page.getByRole("heading", { name: /Заказ №.*оформлен/ })).toBeVisible();
  await page.getByRole("link", { name: "Мои заказы" }).click();
  await expect(page.locator(".order")).toHaveCount(1);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Доступ только для администратора" }),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await page.getByRole("button", { name: /Войти/ }).click();
  await dialog.getByRole("button", { name: "Регистрация", exact: true }).click();
  await dialog.getByLabel("Ваше имя").fill("Администратор");
  await dialog.getByLabel("Email").fill("react-admin@example.com");
  await dialog.getByLabel("Пароль", { exact: true }).fill("react-test-password");
  await dialog.getByLabel("Тип аккаунта").selectOption("admin");
  await dialog.getByLabel("Код приглашения").fill("browser-test-invite");
  await dialog.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Добавить пластинку +" }).click();
  await dialog.getByLabel("Исполнитель", { exact: true }).fill("Browser artist");
  await dialog.getByLabel("Название альбома").fill("Browser album");
  await dialog.getByLabel("Описание", { exact: true }).fill("Проверка React и обложек");
  await dialog.getByLabel("Загрузить обложку").setInputFiles({
    name: "arbitrary-name.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog.getByRole("button", { name: "Сохранить пластинку" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Не удалось прочитать изображение",
  );
  // Retry a failed upload without creating a duplicate record.
  await dialog.getByLabel("Загрузить обложку").setInputFiles({
    name: "valid-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAMAjAsK7+PTMRPLhGQd7QJnESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ES53Vg6wNShQF/fRSLfgAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await dialog.getByRole("button", { name: "Сохранить пластинку" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/catalog?q=Browser");
  await expect(page.locator(".album")).toHaveCount(1);
  await expect(page.locator(".album img")).toHaveAttribute("src", /covers\/uploads/);
  await expect
    .poll(() => page.locator(".album img").evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  const forbidden = await request.post("/api/admin/cover/1", { data: "not an image" });
  expect(forbidden.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Хорошая музыка/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
