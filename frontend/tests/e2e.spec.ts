import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录门户" }).click();
  await expect(page.getByRole("banner")).toBeVisible();
}

test("IT workspace, module configuration and responsive preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin", process.env.E2E_ADMIN_PASSWORD!);
  await page.goto("/it");
  await expect(
    page.getByRole("heading", { name: "构建你的企业工作空间" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../.data/screenshots/it-desktop.png",
    fullPage: true,
  });
  await page.goto("/it/pages/home");
  await expect(
    page.getByRole("heading", { name: "页面与模块", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "添加模块", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /通知公告/ })
    .click();
  await page.getByLabel("模块标题", { exact: true }).fill("临时预览公告");
  await expect(
    page
      .locator(".preview-canvas")
      .getByRole("heading", { name: "临时预览公告" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "手机预览", exact: true }).click();
  await expect(page.locator(".preview-canvas")).toHaveClass(/phone/);
  await page.screenshot({
    path: "../.data/screenshots/page-builder.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "版本历史" })).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/恢复后保存为草稿/),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  expect(errors).toEqual([]);
});

test("business editor can save and publish, ordinary reader cannot enter back office", async ({
  page,
  browser,
}) => {
  await login(page, "alice", process.env.E2E_EDITOR_PASSWORD!);
  await page.goto("/work/new");
  await page.getByLabel("内容类型", { exact: true }).selectOption("notice");
  await page.getByLabel("标题 *", { exact: true }).fill("浏览器验证公告");
  await page
    .getByLabel("摘要", { exact: true })
    .fill("由真实 React 表单发布的测试公告。");
  await page
    .getByRole("textbox", { name: "内容正文" })
    .fill("后台与前台通过真实 .NET 接口连接。");
  await page.getByRole("button", { name: "发布内容", exact: true }).click();
  await expect(page.getByText("内容已发布，前台已更新")).toBeVisible();
  await expect(page.getByText("线上已有发布版本")).toBeVisible();
  const context = await browser.newContext();
  const reader = await context.newPage();
  await login(reader, "reader", process.env.E2E_EDITOR_PASSWORD!);
  await reader.goto("/library");
  await expect(
    reader.getByRole("heading", { name: "浏览器验证公告" }),
  ).toBeVisible();
  await reader.goto("/work");
  await expect(reader.getByText("没有此工作空间的访问权限")).toBeVisible();
  await context.close();
});

test("mobile portal, navigation and real survey submission", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "bob", process.env.E2E_EDITOR_PASSWORD!);
  await expect(page.getByRole("button", { name: "打开菜单" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../.data/screenshots/portal-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "打开菜单" }).click();
  await page.getByRole("link", { name: "内容中心", exact: true }).click();
  await page.getByRole("heading", { name: "工作门户使用体验调查" }).click();
  await page.getByRole("radio", { name: "企业新闻" }).check();
  await page.getByLabel("体验评分").fill("4");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "确认并提交问卷" }).click();
  await expect(
    page.getByRole("heading", { name: "感谢你的参与" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("site themes preview privately, publish to readers and restore custom colours", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Reuse HTTP-test sessions so additional theme checks do not exhaust the login rate limit.
  const sessions = JSON.parse(process.env.E2E_THEME_COOKIES!);
  await page.context().addCookies(sessions.admin);
  await page.goto("/it/settings");
  await expect(page.getByRole("radio")).toHaveCount(10);
  const original = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".app-shell")!).getPropertyValue(
      "--green",
    ),
  );
  // All palettes can be previewed without changing published state.
  for (const name of [
    "春 · 花信",
    "夏 · 海风",
    "秋 · 拾光",
    "冬 · 晴雪",
    "圣诞 · 冬青",
    "新年 · 瑞彩",
    "元宵 · 灯华",
    "万圣 · 夜游",
    "黑白 · 肃静",
  ]) {
    await page.getByRole("radio", { name, exact: true }).check();
    await expect(page.getByRole("radio", { name, exact: true })).toBeChecked();
  }
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.querySelector(".app-shell")!).getPropertyValue(
        "--green",
      ),
    ),
  ).toBe(original);
  await page.getByRole("radio", { name: "夏 · 海风", exact: true }).check();
  await expect(page.locator(".theme-preview")).toHaveAttribute(
    "data-theme",
    "summer",
  );
  const context = await browser.newContext();
  const reader = await context.newPage();
  await context.addCookies(sessions.reader);
  await reader.goto("/");
  await expect(reader.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "custom",
  );
  await page.getByRole("button", { name: "保存并发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("全站主题已更新");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "summer",
  );
  await reader.reload();
  await expect(reader.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "summer",
  );
  await expect(reader.locator(".portal-module")).toHaveCount(6);
  const accents = await reader
    .locator(".portal-module")
    .evaluateAll((modules) =>
      modules.map((m) =>
        getComputedStyle(m).getPropertyValue("--accent").trim(),
      ),
    );
  expect(new Set(accents).size).toBe(3);
  await reader.screenshot({
    path: "../.data/screenshots/theme-summer-portal.png",
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../.data/screenshots/theme-settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("radio", { name: "黑白 · 肃静", exact: true }).check();
  await page.getByRole("button", { name: "保存并发布", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "monochrome",
  );
  await reader.reload();
  await expect(reader.locator("html")).toHaveCSS("filter", "grayscale(1)");
  // Filtering must not turn the fixed navigation into a scrolling element.
  await reader.evaluate(() => window.scrollTo(0, 500));
  expect(
    await reader
      .locator(".sidebar")
      .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
  ).toBe(0);
  await page.screenshot({
    path: "../.data/screenshots/theme-monochrome-mobile.png",
    fullPage: true,
  });
  await page.getByRole("radio", { name: "自选主题色", exact: true }).check();
  await page.getByLabel("主题色", { exact: true }).fill("#ffffff");
  await page.getByRole("button", { name: "保存并发布", exact: true }).click();
  await expect(page.locator("html")).toHaveCSS("filter", "none");
  await reader.reload();
  await expect(reader.locator(".app-shell")).toHaveAttribute(
    "data-theme",
    "custom",
  );
  expect(
    await reader.evaluate(() =>
      getComputedStyle(document.querySelector(".app-shell")!)
        .getPropertyValue("--green")
        .trim(),
    ),
  ).not.toBe("#ffffff");
  // Custom mode recovers the saved module palette instead of overwriting configuration.
  const response = await reader.request.get("/api/portal/pages/home");
  const portal = await response.json();
  expect(
    await reader
      .locator(".portal-module")
      .first()
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--accent").trim(),
      ),
  ).toBe(portal.modules[0].config.accent);
  await context.close();
  expect(errors).toEqual([]);
});
