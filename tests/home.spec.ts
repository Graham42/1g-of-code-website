import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("home page shows latest episodes (up to 5)", async ({ page }) => {
    await page.goto("/");

    // Check for Latest Episodes section
    const latestEpisodesSection = page.locator(".latest-episodes");
    await expect(latestEpisodesSection).toBeVisible();

    // Check section header
    await expect(latestEpisodesSection.locator("h2")).toContainText(
      "Latest Episodes",
    );

    // Check that episode cards are present in the grid
    const episodesGrid = latestEpisodesSection.locator(".episodes-grid");
    await expect(episodesGrid).toBeVisible();

    // Verify there are episodes displayed (up to 5)
    const episodeCards = episodesGrid.locator("> *");
    const cardCount = await episodeCards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(5);
  });

  test("hero section displays show intro", async ({ page }) => {
    await page.goto("/");

    // Check hero section exists
    const heroSection = page.locator(".hero");
    await expect(heroSection).toBeVisible();

    // Check hero title
    const heroTitle = heroSection.locator(".hero-title");
    await expect(heroTitle).toContainText("1g of Code");

    // Check hero tagline
    const heroTagline = heroSection.locator(".hero-tagline");
    await expect(heroTagline).toContainText("Coding and building with AI");

    // Check hero description
    const heroDescription = heroSection.locator(".hero-description");
    await expect(heroDescription).toBeVisible();
    const descText = await heroDescription.textContent();
    expect(descText?.length).toBeGreaterThan(50);

    // Check CTA button
    const ctaButton = heroSection.locator(".cta-button");
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toContainText("Browse Episodes");
  });

  test("social links section is present", async ({ page }) => {
    await page.goto("/");

    // Check social links section exists (use section element to avoid footer conflict)
    const socialSection = page.locator("section.social-links");
    await expect(socialSection).toBeVisible();

    // Check section title
    await expect(socialSection.locator("h2")).toContainText("Connect With Us");

    // Check social grid
    const socialGrid = socialSection.locator(".social-grid");
    await expect(socialGrid).toBeVisible();

    // Check for social cards
    const socialCards = socialGrid.locator(".social-card");
    const cardCount = await socialCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check for Twitch link specifically
    const twitchLink = socialSection.locator(
      'a[href="https://twitch.tv/1gOfCode"]',
    );
    await expect(twitchLink).toBeVisible();
  });

  test("View All Episodes link works", async ({ page }) => {
    await page.goto("/");

    // Find and click View All Episodes link
    const viewAllLink = page.locator(".view-all-link");
    await expect(viewAllLink).toBeVisible();
    await expect(viewAllLink).toContainText("View All Episodes");

    await viewAllLink.click();

    // Verify navigation to episodes page
    await expect(page).toHaveURL("/episodes/");
  });

  test("CTA button navigates to episodes", async ({ page }) => {
    await page.goto("/");

    // Click the CTA button in hero section
    const ctaButton = page.locator(".cta-button");
    await ctaButton.click();

    // Verify navigation to episodes page
    await expect(page).toHaveURL("/episodes/");
  });

  test("page has proper meta title", async ({ page }) => {
    await page.goto("/");

    // Check page title
    await expect(page).toHaveTitle(/1g of Code.*Coding and Building with AI/i);
  });

  test("social cards have correct structure", async ({ page }) => {
    await page.goto("/");

    const socialSection = page.locator("section.social-links");
    const socialCards = socialSection.locator(".social-card");

    // Check first social card has icon and text
    const firstCard = socialCards.first();
    await expect(firstCard.locator(".social-icon")).toBeVisible();
    await expect(firstCard.locator(".social-name")).toBeVisible();
    await expect(firstCard.locator(".social-handle")).toBeVisible();
  });
});
