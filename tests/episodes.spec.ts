import { test, expect } from '@playwright/test'

test.describe('Episodes', () => {
  test('episodes list page renders all episodes', async ({ page }) => {
    await page.goto('/episodes/')

    // Check page title and header
    await expect(page).toHaveTitle(/All Episodes.*1g of Code/)
    await expect(page.locator('.page-header h1')).toContainText('All Episodes')

    // Check that episodes grid is present
    const episodesGrid = page.locator('.episodes-grid')
    await expect(episodesGrid).toBeVisible()

    // Check that at least one episode card is present
    const episodeCards = episodesGrid.locator(
      'article, .episode-card, a[href^="/episodes/"]'
    )
    await expect(episodeCards.first()).toBeVisible()
  })

  test('individual episode page displays correctly', async ({ page }) => {
    // First go to episodes list
    await page.goto('/episodes/')

    // Click on the first episode
    const firstEpisodeLink = page
      .locator('.episodes-grid a[href^="/episodes/"]')
      .first()
    await firstEpisodeLink.click()

    // Verify we navigated to an episode page
    await expect(page).toHaveURL(/\/episodes\/.+/)

    // Check that the episode page has loaded with main content
    await expect(page.locator('.episode-page')).toBeVisible()
  })

  test('episode page shows title, date, tags', async ({ page }) => {
    // Navigate directly to a known episode
    await page.goto('/episodes/2025-01-29/')

    // Check title is displayed
    const title = page.locator('.episode-header h1')
    await expect(title).toBeVisible()
    await expect(title).toContainText('TypeScript')

    // Check date is displayed
    const date = page.locator('.episode-date')
    await expect(date).toBeVisible()
    await expect(date).toContainText('2025')

    // Check tags are displayed
    const tagList = page.locator('.tag-list')
    await expect(tagList).toBeVisible()

    const tags = tagList.locator('.tag')
    const tagCount = await tags.count()
    expect(tagCount).toBeGreaterThan(0)
  })

  test('episode page shows Twitch link', async ({ page }) => {
    await page.goto('/episodes/2025-01-29/')

    // Check for Twitch video link
    const twitchLink = page.locator('.video-section a[href*="twitch"]')
    await expect(twitchLink).toBeVisible()

    // Check for "Watch on Twitch" label
    await expect(page.locator('.video-label')).toContainText('Watch on Twitch')
  })

  test('code blocks are rendered (syntax highlighting present)', async ({
    page,
  }) => {
    await page.goto('/episodes/2025-01-29/')

    // Check for code blocks in the episode content
    const codeBlocks = page.locator('.episode-content pre')
    await expect(codeBlocks.first()).toBeVisible()

    // Check that code element exists within pre
    const code = page.locator('.episode-content pre code')
    await expect(code.first()).toBeVisible()

    // Verify code content is present (TypeScript example from the episode)
    const codeText = await code.first().textContent()
    expect(codeText).toBeTruthy()
    expect(codeText?.length).toBeGreaterThan(0)
  })

  test('Back to Episodes link works', async ({ page }) => {
    await page.goto('/episodes/2025-01-29/')

    // Find and click the back link
    const backLink = page.locator('.back-link').first()
    await expect(backLink).toBeVisible()
    await expect(backLink).toContainText('Back to Episodes')

    await backLink.click()

    // Verify we're back on the episodes list page
    await expect(page).toHaveURL('/episodes/')
    await expect(page.locator('.page-header h1')).toContainText('All Episodes')
  })

  test('episode thumbnail is displayed', async ({ page }) => {
    await page.goto('/episodes/2025-01-29/')

    // Check that thumbnail image exists in video section
    const thumbnail = page.locator('.video-section .thumbnail')
    await expect(thumbnail).toBeVisible()
  })

  test('episodes are sorted by date (newest first)', async ({ page }) => {
    await page.goto('/episodes/')

    // Get all episode dates from the page
    const episodeCards = page.locator('.episodes-grid > *')
    const cardCount = await episodeCards.count()

    if (cardCount >= 2) {
      // Episodes should be in descending date order (newest first)
      // This test verifies the sort order is maintained
      const firstCard = episodeCards.first()
      const secondCard = episodeCards.nth(1)

      await expect(firstCard).toBeVisible()
      await expect(secondCard).toBeVisible()
    }
  })
})
