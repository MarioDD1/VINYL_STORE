import { test, expect } from "@playwright/test";

test("Figma screens, local assets and responsive geometry", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const [name, route] of [
      ["home", "/"],
      ["catalog", "/catalog"],
      ["album", "/albums/1"],
      ["cart", "/cart"],
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      if (name === "cart") {
        await page.evaluate(() =>
          localStorage.setItem("vinyl-cart", JSON.stringify({ 1: 2, 2: 1 })),
        );
        await page.reload();
        await expect(page.locator(".cart-line")).toHaveCount(2);
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) => {
            img.loading = "eager";
            return img.decode().catch(() => {});
          }),
        );
      });
      await expect
        .poll(() =>
          page.evaluate(() =>
            [...document.images]
              .filter((img) => !img.complete || !img.naturalWidth)
              .map((img) => img.src),
          ),
        )
        .toEqual([]);
      await page.screenshot({
        path: `test-results/${name}-${width}.png`,
        fullPage: true,
      });
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        )
        .toBe(true);
      const badIcons = await page.locator(".design-icon").evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const box = node.getBoundingClientRect(),
              image = node.querySelector("img").getBoundingClientRect();
            return (
              image.width > box.width + 2 ||
              image.height > box.height + 2 ||
              image.width < 1 ||
              image.height < 1
            );
          })
          .map((node) => node.querySelector("img").src),
      );
      expect(badIcons).toEqual([]);
      if (name === "home" && width === 1920) {
        await page.locator("#genres").screenshot({path: "test-results/genre-icons.png"});
        await page
          .locator(".header-actions")
          .screenshot({ path: "test-results/header-icons.png" });
      }
      await page.screenshot({
        path: `test-results/${name}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
