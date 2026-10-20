// Trending view smoke tests (PRD §5 US-1, US-2, US-5, US-6, US-7; §9.4 password gate). All /api/* mocked.
import { cardHandles, expect, makeVideo, response, test, trendingFixture } from "./fixtures";
import type { Platform } from "../shared/types";

test.describe("Trending view", () => {
  test("US-1 home renders the trending grid without any input", async ({ page, api }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Trending on TikTok" })).toBeVisible();
    await expect(page).toHaveTitle("Trending on TikTok — TrendScope");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("link")).toHaveCount(3);
    await expect(panel.getByRole("link").first()).toHaveAccessibleName(/^TikTok video by @tiktok_alpha: tiktok alpha\./);
    // URL is canonicalized with defaults (FR-9).
    await expect(page).toHaveURL(/\?platform=tiktok&region=US&sort=views$/);
    // Exactly one trending call, with the TikTok region (FR-3).
    const calls = api.callsTo("/api/trending");
    expect(calls).toHaveLength(1);
    expect(calls[0].searchParams.get("platform")).toBe("tiktok");
    expect(calls[0].searchParams.get("region")).toBe("US");
    await expect(page.getByRole("contentinfo")).toContainText("belong to their respective creators");
  });

  test("US-2 clicking a tab switches platform, heading, URL and request", async ({ page, api }) => {
    await page.goto("/");
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);

    await page.getByRole("tab", { name: "Instagram" }).click();
    await expect(page.getByRole("tab", { name: "Instagram" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "TikTok" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on Instagram");
    await expect(page).toHaveURL(/platform=instagram/);
    await expect(page.getByRole("tabpanel").getByRole("link").first()).toHaveAccessibleName(/^Instagram video by @instagram_alpha/);
    await expect(page.getByText("Region applies to TikTok")).toBeVisible();

    const last = api.callsTo("/api/trending").at(-1)!;
    expect(last.searchParams.get("platform")).toBe("instagram");
    expect(last.searchParams.has("region")).toBe(false);
  });

  test("US-2 arrow, Home and End keys move between tabs with roving focus", async ({ page }) => {
    await page.goto("/");
    const tiktok = page.getByRole("tab", { name: "TikTok" });
    const instagram = page.getByRole("tab", { name: "Instagram" });
    const youtube = page.getByRole("tab", { name: "YouTube" });
    await tiktok.focus();

    await page.keyboard.press("ArrowRight");
    await expect(instagram).toBeFocused();
    await expect(instagram).toHaveAttribute("aria-selected", "true");
    await expect(instagram).toHaveAttribute("tabindex", "0");
    await expect(tiktok).toHaveAttribute("tabindex", "-1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on Instagram");
    await expect(page).toHaveURL(/platform=instagram/);

    await page.keyboard.press("End");
    await expect(youtube).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on YouTube");
    await expect(page).toHaveURL(/platform=youtube/);

    await page.keyboard.press("ArrowRight"); // wraps
    await expect(tiktok).toBeFocused();
    await expect(page).toHaveURL(/platform=tiktok/);

    await page.keyboard.press("ArrowLeft"); // wraps backwards
    await expect(youtube).toBeFocused();

    await page.keyboard.press("Home");
    await expect(tiktok).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on TikTok");
  });

  test("US-5 sort select reorders cards and is kept in the URL", async ({ page, api }) => {
    await page.goto("/");
    await expect.poll(() => cardHandles(page)).toEqual(["tiktok_alpha", "tiktok_bravo", "tiktok_charlie"]);
    const sort = page.getByLabel("Sort by");

    const expected: Record<string, string[]> = {
      likes: ["tiktok_bravo", "tiktok_charlie", "tiktok_alpha"],
      comments: ["tiktok_charlie", "tiktok_alpha", "tiktok_bravo"],
      engagement: ["tiktok_charlie", "tiktok_bravo", "tiktok_alpha"],
      newest: ["tiktok_bravo", "tiktok_alpha", "tiktok_charlie"],
      views: ["tiktok_alpha", "tiktok_bravo", "tiktok_charlie"],
    };
    for (const [key, order] of Object.entries(expected)) {
      await sort.selectOption(key);
      await expect(page).toHaveURL(new RegExp(`sort=${key}`));
      await expect.poll(() => cardHandles(page), { message: `sort=${key}` }).toEqual(order);
    }
    // Sorting is client-side: no extra requests.
    expect(api.callsTo("/api/trending")).toHaveLength(1);
  });

  test("US-5 sort from a shared URL is applied on load", async ({ page }) => {
    await page.goto("/?platform=tiktok&sort=engagement");
    await expect(page.getByLabel("Sort by")).toHaveValue("engagement");
    await expect.poll(() => cardHandles(page)).toEqual(["tiktok_charlie", "tiktok_bravo", "tiktok_alpha"]);
  });

  test("US-6 card links to the original post in a new tab", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("tabpanel").getByRole("link").first();
    await expect(card).toHaveAttribute("href", "https://example.com/tiktok/tiktok_alpha/tiktok-a");
    await expect(card).toHaveAttribute("target", "_blank");
    const rel = (await card.getAttribute("rel")) ?? "";
    expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    await expect(card).toHaveAccessibleName(/opens in a new tab\.$/);
  });

  test("US-6 a video without a safe http(s) URL renders as a non-link card", async ({ page, api }) => {
    api.trending = () => ({
      body: response([
        makeVideo({ id: "ok", author: { handle: "safe" } }),
        makeVideo({ id: "bad", author: { handle: "unsafe" }, url: "javascript:alert(1)" }),
      ]),
    });
    await page.goto("/");
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("tabpanel").getByRole("article")).toContainText("@unsafe");
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  });

  test("US-7 empty state shows suggested hashtags", async ({ page, api }) => {
    api.trending = () => ({ body: response([]) });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "No trending videos right now" })).toBeVisible();
    const suggestions = page.getByRole("list", { name: "Suggested hashtags" });
    await expect(suggestions.getByRole("button")).toHaveCount(5);
    await expect(suggestions.getByRole("button", { name: "Search #fitness" })).toBeVisible();
  });

  test("US-7 error state with Retry recovers", async ({ page, api }) => {
    let fail = true;
    api.trending = (url) =>
      fail
        ? { status: 503, body: { error: "Service temporarily unavailable. Please try again later." } }
        : { body: response(trendingFixture((url.searchParams.get("platform") ?? "tiktok") as Platform)) };
    await page.goto("/");

    const alert = page.getByRole("alert");
    await expect(alert.getByRole("heading", { name: "Couldn't load videos" })).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText("Service temporarily unavailable. Please try again later.");

    fail = false;
    await alert.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("US-7 all-platform failure in a 200 body shows the error state", async ({ page, api }) => {
    api.trending = () => ({ body: response([], { errors: [{ platform: "tiktok", message: "TikTok is unavailable right now." }] }) });
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("TikTok is unavailable right now.");
    await expect(page.getByRole("alert").getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("US-7 / FR-8 partial platform failure shows a notice next to the results", async ({ page, api }) => {
    api.search = () => ({
      body: response(
        [makeVideo({ platform: "tiktok", id: "t1" }), makeVideo({ platform: "youtube", id: "y1" })],
        { errors: [{ platform: "instagram", message: "Instagram is unavailable right now." }] },
      ),
    });
    await page.goto("/?q=cats");
    await expect(page.getByRole("status").filter({ hasText: "Instagram is unavailable right now." })).toBeVisible();
    await expect(page.locator("main ul > li > a")).toHaveCount(2);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("US-7 rate limit (429) shows the retry-after message and is not auto-retried", async ({ page, api }) => {
    api.trending = () => ({ status: 429, headers: { "Retry-After": "42" }, body: { error: "Too many requests" } });
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("Too many requests, try again in 42 seconds.");
    expect(api.callsTo("/api/trending")).toHaveLength(1);
  });

  test("US-7 setup banner appears when the API key is not configured", async ({ page, api }) => {
    api.health = () => ({
      body: { status: "ok", apiKeyConfigured: false, passwordProtected: false, time: "2026-10-20T00:00:00.000Z" },
    });
    await page.goto("/");
    await expect(page.getByRole("status").filter({ hasText: "Setup needed" })).toBeVisible();
  });
});

test.describe("Password gate (§9.4)", () => {
  const PASSWORD = "open-sesame";

  test.beforeEach(({ api }) => {
    api.health = () => ({
      body: { status: "ok", apiKeyConfigured: true, passwordProtected: true, time: "2026-10-20T00:00:00.000Z" },
    });
    api.trending = (url, request) =>
      request.headers()["x-app-password"] === PASSWORD
        ? { body: response(trendingFixture((url.searchParams.get("platform") ?? "tiktok") as Platform)) }
        : { status: 401, body: { error: "Password required" } };
  });

  test("§9.4 401 shows the form; the correct password loads results", async ({ page, api }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "This app is password protected" })).toBeVisible();
    const input = page.getByLabel("Password", { exact: true });
    await expect(input).toBeFocused();

    await input.fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
    expect(page.url()).not.toContain(PASSWORD);
    expect(await page.evaluate(() => sessionStorage.getItem("trendscope.appPassword"))).toBe(PASSWORD);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(PASSWORD);

    // Later requests carry the password header (tab switch).
    await page.getByRole("tab", { name: "YouTube" }).click();
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
    expect(api.callsTo("/api/trending").at(-1)!.searchParams.get("platform")).toBe("youtube");
  });

  test("§9.4 wrong password shows 'Incorrect password', then the right one works", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Password", { exact: true });
    await input.fill("wrong-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toHaveText("Incorrect password. Please try again.");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(await page.evaluate(() => sessionStorage.getItem("trendscope.appPassword"))).toBeNull();

    await input.fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);
  });

  test("§9.4 empty submit asks for the password without a request", async ({ page, api }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "This app is password protected" })).toBeVisible();
    const before = api.callsTo("/api/trending").length;
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toHaveText("Enter the password.");
    expect(api.callsTo("/api/trending")).toHaveLength(before);
  });
});
