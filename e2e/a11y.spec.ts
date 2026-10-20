// Accessibility checks (PRD §10 Accessibility: WCAG 2.1 AA, keyboard navigation, visible focus,
// contrast in light and dark themes; §10 Responsiveness). All /api/* mocked.
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, makeVideo, response, test } from "./fixtures";

type Scheme = "light" | "dark";

async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1).join(" ").trim()}`),
    }));
  expect(serious, `${label}: serious/critical axe violations`).toEqual([]);
}

async function expectTheme(page: Page, scheme: Scheme) {
  if (scheme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
}

const PASSWORD_HEALTH = { status: "ok", apiKeyConfigured: true, passwordProtected: true, time: "2026-10-20T00:00:00.000Z" };

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test(`US-1 trending grid has no serious/critical violations (${scheme})`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
      await expectTheme(page, scheme);
      await expectNoSeriousAxeViolations(page, `trending ${scheme}`);
    });

    test(`US-3 search results (with partial-failure notice) have no serious/critical violations (${scheme})`, async ({ page, api }) => {
      api.search = () => ({
        body: response(
          [
            makeVideo({ platform: "tiktok", id: "t1" }),
            makeVideo({ platform: "instagram", id: "i1", stats: { views: 5 } }),
            makeVideo({ platform: "youtube", id: "y1", caption: "" }),
          ],
          { errors: [{ platform: "instagram", message: "Instagram returned partial results." }], cursors: { tiktok: "next" } },
        ),
      });
      await page.goto("/?q=%23fitness");
      await expect(page.locator("main ul > li > a")).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
      await page.getByRole("searchbox").fill("#fitness"); // shows the "Hashtag search" chip
      await expectTheme(page, scheme);
      await expectNoSeriousAxeViolations(page, `search ${scheme}`);
    });

    test(`§9.4 password form (incl. error message) has no serious/critical violations (${scheme})`, async ({ page, api }) => {
      api.health = () => ({ body: PASSWORD_HEALTH });
      api.trending = () => ({ status: 401, body: { error: "Password required" } });
      await page.goto("/");
      await page.getByLabel("Password", { exact: true }).fill("nope");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("alert")).toHaveText("Incorrect password. Please try again.");
      await expectTheme(page, scheme);
      await expectNoSeriousAxeViolations(page, `password ${scheme}`);
    });

    test(`US-7 empty, error and setup states have no serious/critical violations (${scheme})`, async ({ page, api }) => {
      api.health = () => ({ body: { ...PASSWORD_HEALTH, apiKeyConfigured: false, passwordProtected: false } });
      api.trending = (url) =>
        url.searchParams.get("platform") === "youtube"
          ? { status: 429, headers: { "Retry-After": "30" }, body: {} }
          : { body: response([]) };
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "No trending videos right now" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Setup needed" })).toBeVisible();
      await expectNoSeriousAxeViolations(page, `empty ${scheme}`);

      await page.getByRole("tab", { name: "YouTube" }).click();
      await expect(page.getByRole("alert")).toContainText("Too many requests");
      await expectNoSeriousAxeViolations(page, `error ${scheme}`);
    });
  });
}

test("§10 theme toggle switches to dark and the page stays clean under axe", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
  const toggle = page.getByRole("button", { name: /^Theme: / });
  await expect(toggle).toHaveAccessibleName("Theme: System. Switch to Light");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Theme: Light. Switch to Dark");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Theme: Dark. Switch to System");
  await expectTheme(page, "dark");
  expect(await page.evaluate(() => localStorage.getItem("trendscope.theme"))).toBe("dark");
  // Let colour transitions (transition-colors, 150ms) settle before measuring contrast.
  await page.waitForTimeout(400);
  await expectNoSeriousAxeViolations(page, "trending dark via toggle");

  // Preference persists across reloads.
  await page.reload();
  await expectTheme(page, "dark");
});

/** Presses Tab until `target` is focused (fails after `max` presses). */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`Tab never reached ${target.toString()}`);
}

/** Visible focus indicator: a Tailwind ring (box-shadow) or a real outline. */
async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  const style = await target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { boxShadow: cs.boxShadow, outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth) };
  });
  const hasRing = style.boxShadow !== "none" && style.boxShadow !== "";
  const hasOutline = style.outlineStyle !== "none" && style.outlineWidth > 0;
  expect(hasRing || hasOutline, `focus indicator on ${target.toString()}: ${JSON.stringify(style)}`).toBe(true);
}

test.describe("Keyboard-only navigation (§10)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`Tab reaches search, tabs, selects and the first card with visible focus (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);

      // First stop is the skip link, which becomes visible on focus.
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();

      const stops: Locator[] = [
        page.getByRole("searchbox", { name: "Search a keyword or #hashtag" }),
        page.getByRole("checkbox", { name: "TikTok" }),
        page.getByRole("tab", { name: "TikTok", selected: true }),
        page.getByLabel("Region"),
        page.getByLabel("Sort by"),
        page.getByRole("tabpanel").getByRole("link").first(),
      ];
      for (const stop of stops) {
        await tabTo(page, stop);
        await expectVisibleFocus(stop);
      }

      // Unselected tabs are skipped by Tab (roving tabindex): one Tab from the selected tab leaves the tablist.
      const selectedTab = page.getByRole("tab", { name: "TikTok", selected: true });
      await selectedTab.focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("tab", { name: "Instagram" })).not.toBeFocused();
      await expect(page.getByLabel("Region")).toBeFocused();

      // Sort can be changed with the keyboard alone.
      await page.getByLabel("Sort by").focus();
      await page.keyboard.press("ArrowDown");
      await expect(page).toHaveURL(/sort=likes/);
    });
  }

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tab", { name: "TikTok", selected: true })).toBeFocused();
  });

  test("US-3 keyboard-only search: type, Enter, then reach Load more", async ({ page, api }) => {
    api.search = () => ({ body: response([makeVideo(), makeVideo()], { cursors: { tiktok: "c2" } }) });
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Search a keyword or #hashtag" });
    await tabTo(page, box);
    await page.keyboard.type("#music");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “#music”");
    const more = page.getByRole("button", { name: "Load more" });
    await tabTo(page, more);
    await expectVisibleFocus(more);
  });
});

test.describe("Responsive (§10)", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  async function expectNoHorizontalScroll(page: Page, label: string) {
    const dims = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
    }));
    expect(dims.scroll, `${label}: ${JSON.stringify(dims)}`).toBeLessThanOrEqual(dims.client);
    expect(dims.bodyScroll, `${label}: ${JSON.stringify(dims)}`).toBeLessThanOrEqual(dims.client);
  }

  test("360px trending view has no horizontal scroll and a single-column grid", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByRole("tabpanel").getByRole("link");
    await expect(cards).toHaveCount(3);
    await expectNoHorizontalScroll(page, "trending 360px");
    const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    expect(a && b && b.y > a.y && Math.abs(b.x - a.x) < 1).toBe(true);
  });

  test("360px search view with a 100-char unbroken query and a long caption has no horizontal scroll", async ({ page, api }) => {
    const longWord = "x".repeat(100);
    api.search = () => ({
      body: response([makeVideo({ caption: "y".repeat(300), author: { handle: "z".repeat(60) } })], {
        errors: [{ platform: "youtube", message: `YouTube failed for ${"w".repeat(80)}` }],
      }),
    });
    await page.goto(`/?q=${longWord}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(longWord);
    await expect(page.locator("main ul > li > a")).toHaveCount(1);
    await expectNoHorizontalScroll(page, "search 360px");
  });

  test("360px password form has no horizontal scroll", async ({ page, api }) => {
    api.trending = () => ({ status: 401, body: {} });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "This app is password protected" })).toBeVisible();
    await expectNoHorizontalScroll(page, "password 360px");
  });
});
