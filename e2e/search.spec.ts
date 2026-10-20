// Search view smoke tests (PRD §5 US-3, US-4, US-9; FR-6, FR-9, FR-10). All /api/* mocked.
import { cardHandles, expect, makeVideo, requestedPlatforms, response, test } from "./fixtures";
import type { Page } from "@playwright/test";

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search a keyword or #hashtag" });
const cards = (page: Page) => page.locator("main ul > li > a");

/** The summary is shown as a visible chip and announced in the polite live region. */
async function expectSummary(page: Page, text: string) {
  await expect(page.getByRole("paragraph").filter({ hasText: text })).toHaveText(text);
  await expect(page.getByRole("status").filter({ hasText: text })).toHaveText(text);
}

test.describe("Search", () => {
  test("US-3 #hashtag search updates URL, title, heading and summary", async ({ page, api }) => {
    await page.goto("/");
    await expect(page.getByRole("tabpanel").getByRole("link")).toHaveCount(3);

    await searchBox(page).fill("  #fitness  ");
    await expect(page.getByText("Hashtag search")).toBeVisible();
    await searchBox(page).press("Enter");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “#fitness”");
    await expect(page).toHaveTitle("#fitness — TrendScope");
    await expect(page).toHaveURL(/\?q=%23fitness&sort=views$/);
    await expectSummary(page, "#fitness · TikTok, Instagram, YouTube · 6 results");
    await expect(cards(page)).toHaveCount(6);
    await expect(searchBox(page)).toHaveValue("#fitness");

    const call = api.callsTo("/api/search").at(-1)!;
    expect(call.searchParams.get("q")).toBe("#fitness");
    expect(call.searchParams.has("platforms")).toBe(false); // all platforms = server default
  });

  test("US-3 keyword search via the Search button; blank query does nothing", async ({ page, api }) => {
    await page.goto("/");
    await searchBox(page).fill("   ");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on TikTok");
    expect(api.callsTo("/api/search")).toHaveLength(0);

    await searchBox(page).fill("street food");
    await expect(page.getByText("Hashtag search")).toHaveCount(0);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “street food”");
    await expect(page).toHaveURL(/q=street\+food/);
  });

  test("US-4 platform checkboxes restrict the platforms param; the last one can't be unchecked", async ({ page, api }) => {
    await page.goto("/");
    const tiktok = page.getByRole("checkbox", { name: "TikTok" });
    const instagram = page.getByRole("checkbox", { name: "Instagram" });
    const youtube = page.getByRole("checkbox", { name: "YouTube" });
    await expect(tiktok).toBeChecked();
    await expect(instagram).toBeChecked();
    await expect(youtube).toBeChecked();

    await instagram.uncheck();
    await searchBox(page).fill("cats");
    await searchBox(page).press("Enter");
    await expect(page).toHaveURL(/platforms=tiktok,youtube/);
    await expectSummary(page, "cats · TikTok, YouTube · 4 results");
    expect(api.callsTo("/api/search").at(-1)!.searchParams.get("platforms")).toBe("tiktok,youtube");

    // Changing platforms on the results view re-runs the search and updates the URL.
    await youtube.uncheck();
    await expect(page).toHaveURL(/platforms=tiktok(&|$)/);
    await expectSummary(page, "cats · TikTok · 2 results");
    expect(api.callsTo("/api/search").at(-1)!.searchParams.get("platforms")).toBe("tiktok");
    const handles = await cardHandles(page);
    expect(handles.every((h) => h.startsWith("tiktok_"))).toBe(true);

    // Only TikTok left: its checkbox is locked.
    await expect(tiktok).toBeChecked();
    await expect(tiktok).toBeDisabled();
    await expect(instagram).toBeEnabled();
    await tiktok.click({ force: true });
    await expect(tiktok).toBeChecked();
    await expect(page).toHaveURL(/platforms=tiktok(&|$)/);
  });

  test("FR-10 Load more sends cursor.<platform> and appends results", async ({ page, api }) => {
    api.search = (url) => {
      const platforms = requestedPlatforms(url);
      if (!url.searchParams.has("cursor.tiktok") && !url.searchParams.has("cursor.youtube")) {
        return {
          body: response(
            platforms.map((p) => makeVideo({ platform: p, id: `${p}-p1`, author: { handle: `${p}_page1` } })),
            { cursors: { tiktok: "tt-cursor-2", youtube: "yt-cursor-2" } },
          ),
        };
      }
      return {
        body: response(
          platforms.map((p) => makeVideo({ platform: p, id: `${p}-p2`, author: { handle: `${p}_page2` } })),
          { cursors: {} },
        ),
      };
    };
    await page.goto("/?q=dance");
    await expect(cards(page)).toHaveCount(3);

    await page.getByRole("button", { name: "Load more" }).click();
    await expect(cards(page)).toHaveCount(5);
    await expectSummary(page, "dance · TikTok, Instagram, YouTube · 5 results");

    const next = api.callsTo("/api/search").at(-1)!;
    expect(next.searchParams.get("q")).toBe("dance");
    expect(next.searchParams.get("platforms")).toBe("tiktok,youtube");
    expect(next.searchParams.get("cursor.tiktok")).toBe("tt-cursor-2");
    expect(next.searchParams.get("cursor.youtube")).toBe("yt-cursor-2");
    expect(next.searchParams.has("cursor.instagram")).toBe(false);

    const handles = await cardHandles(page);
    expect(handles).toEqual(expect.arrayContaining(["tiktok_page1", "instagram_page1", "youtube_page1", "tiktok_page2", "youtube_page2"]));
    // No further cursors: the button goes away.
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  });

  test("US-9 Back and the Trending button return to the trending view", async ({ page }) => {
    await page.goto("/?platform=youtube");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on YouTube");

    await searchBox(page).fill("cats");
    await searchBox(page).press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “cats”");

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on YouTube");
    await expect(page).not.toHaveURL(/q=/);
    await expect(searchBox(page)).toHaveValue("");

    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “cats”");

    await page.getByRole("button", { name: "Trending" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trending on YouTube");
    await expect(page).toHaveURL(/platform=youtube/);
    await expect(page).not.toHaveURL(/q=/);
  });

  test("US-9 a shared ?q= URL loads the search directly", async ({ page, api }) => {
    await page.goto("/?q=%23cooking&platforms=youtube&sort=likes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “#cooking”");
    await expect(page).toHaveTitle("#cooking — TrendScope");
    await expect(searchBox(page)).toHaveValue("#cooking");
    await expect(page.getByLabel("Sort by")).toHaveValue("likes");
    await expect(page.getByRole("checkbox", { name: "YouTube" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "TikTok" })).not.toBeChecked();
    await expectSummary(page, "#cooking · YouTube · 2 results");

    expect(api.callsTo("/api/trending")).toHaveLength(0);
    const calls = api.callsTo("/api/search");
    expect(calls).toHaveLength(1);
    expect(calls[0].searchParams.get("q")).toBe("#cooking");
    expect(calls[0].searchParams.get("platforms")).toBe("youtube");
  });

  test("US-7 search empty state; suggested hashtag runs a search", async ({ page, api }) => {
    api.search = (url) => (url.searchParams.get("q") === "zzzz" ? { body: response([]) } : { body: response([makeVideo()]) });
    await page.goto("/?q=zzzz");
    await expect(page.getByRole("heading", { name: "No results for “zzzz”" })).toBeVisible();

    await page.getByRole("button", { name: "Search #travel" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “#travel”");
    await expect(page).toHaveURL(/q=%23travel/);
    await expect(cards(page)).toHaveCount(1);
  });

  test("US-3 suggested hashtag on the trending empty state runs a search", async ({ page, api }) => {
    api.trending = () => ({ body: response([]) });
    await page.goto("/");
    await page.getByRole("button", { name: "Search #fitness" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “#fitness”");
    await expect(page).toHaveURL(/q=%23fitness/);
    expect(api.callsTo("/api/search").at(-1)!.searchParams.get("q")).toBe("#fitness");
  });

  test("US-7 search error state with Retry", async ({ page, api }) => {
    let fail = true;
    api.search = () => (fail ? { status: 400, body: { error: "Query must be 1–100 characters." } } : { body: response([makeVideo()]) });
    await page.goto("/?q=oops");
    await expect(page.getByRole("alert")).toContainText("Couldn't load results");
    await expect(page.getByRole("alert")).toContainText("Query must be 1–100 characters.");
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(cards(page)).toHaveCount(1);
  });
});
