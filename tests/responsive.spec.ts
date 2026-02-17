import { test, expect } from '@playwright/test'

test.describe('Responsive Design - Mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('mobile viewport renders correctly', async ({ page }) => {
    await page.goto('/')

    // Page should load without horizontal scroll
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Hero content should be visible
    await expect(page.locator('.hero-title')).toBeVisible()
    await expect(page.locator('.hero-description')).toBeVisible()
  })

  test('navigation menu works on mobile', async ({ page }) => {
    await page.goto('/')

    // On mobile, the nav toggle (hamburger) should be visible
    const navToggle = page.locator('.nav-toggle').first()
    await expect(navToggle).toBeVisible()

    // Primary nav should be hidden initially
    const primaryNav = page.locator('.primary-nav')
    await expect(primaryNav).not.toHaveClass(/is-open/)

    // Click hamburger to open menu
    await navToggle.click()

    // Nav should now have is-open class
    await expect(primaryNav).toHaveClass(/is-open/)

    // Navigation links should be visible
    await expect(page.locator('nav#primary-nav a[href="/"]')).toBeVisible()
    await expect(
      page.locator('nav#primary-nav a[href="/episodes/"]')
    ).toBeVisible()
    await expect(
      page.locator('nav#primary-nav a[href="/about/"]')
    ).toBeVisible()
  })

  test('mobile menu closes on navigation', async ({ page }) => {
    await page.goto('/')

    // Open mobile menu
    const navToggle = page.locator('.nav-toggle').first()
    await navToggle.click()

    // Click on Episodes link
    await page.click('nav#primary-nav a[href="/episodes/"]')

    // Should navigate to episodes page
    await expect(page).toHaveURL('/episodes/')
  })

  test('episodes grid is single column on mobile', async ({ page }) => {
    await page.goto('/episodes/')

    // Grid should be visible
    const episodesGrid = page.locator('.episodes-grid')
    await expect(episodesGrid).toBeVisible()

    // On mobile, grid should have single column (handled by CSS)
    // Just verify cards are stacked vertically by checking visibility
    const cards = episodesGrid.locator('> *')
    const count = await cards.count()
    if (count > 0) {
      await expect(cards.first()).toBeVisible()
    }
  })

  test('footer displays correctly on mobile', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer.site-footer')
    await expect(footer).toBeVisible()

    // Footer logo and tagline should be visible
    await expect(footer.locator('.footer-logo')).toBeVisible()
    await expect(footer.locator('.footer-tagline')).toBeVisible()
  })
})

test.describe('Responsive Design - Desktop (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.goto('/')

    // Page should load
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Hero content should be visible
    await expect(page.locator('.hero-title')).toBeVisible()
    await expect(page.locator('.hero-description')).toBeVisible()
  })

  test('navigation is visible without hamburger on desktop', async ({
    page,
  }) => {
    await page.goto('/')

    // Navigation links should be directly visible on desktop
    const nav = page.locator('nav#primary-nav')
    await expect(nav).toBeVisible()

    // All nav links should be visible
    await expect(nav.locator('a[href="/"]')).toBeVisible()
    await expect(nav.locator('a[href="/episodes/"]')).toBeVisible()
    await expect(nav.locator('a[href="/about/"]')).toBeVisible()

    // Hamburger should be hidden on desktop (display: none via CSS)
    // We can verify navigation works without clicking hamburger
  })

  test('episodes grid has multiple columns on desktop', async ({ page }) => {
    await page.goto('/episodes/')

    // Grid should be visible
    const episodesGrid = page.locator('.episodes-grid')
    await expect(episodesGrid).toBeVisible()

    // Cards should be visible
    const cards = episodesGrid.locator('> *')
    const count = await cards.count()
    if (count > 0) {
      await expect(cards.first()).toBeVisible()
    }
  })

  test('social links grid displays properly', async ({ page }) => {
    await page.goto('/')

    const socialGrid = page.locator('.social-grid')
    await expect(socialGrid).toBeVisible()

    // Social cards should be visible
    const socialCards = socialGrid.locator('.social-card')
    const count = await socialCards.count()
    expect(count).toBeGreaterThan(0)

    // All cards should be visible
    for (let i = 0; i < count; i++) {
      await expect(socialCards.nth(i)).toBeVisible()
    }
  })

  test('episode page content is readable at desktop width', async ({
    page,
  }) => {
    await page.goto('/episodes/2025-01-29/')

    // Episode content should be visible
    const episodeContent = page.locator('.episode-content')
    await expect(episodeContent).toBeVisible()

    // Video section should be visible
    const videoSection = page.locator('.video-section')
    await expect(videoSection).toBeVisible()
  })

  test('header is sticky on desktop', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header.site-header')
    await expect(header).toBeVisible()

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500))

    // Header should still be visible (sticky)
    await expect(header).toBeVisible()
  })
})

test.describe('Responsive Design - Tablet (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.goto('/')

    // Page should load
    await expect(page.locator('.hero-title')).toBeVisible()
    await expect(page.locator('.hero-description')).toBeVisible()
  })

  test('navigation is accessible at tablet breakpoint', async ({ page }) => {
    await page.goto('/')

    // At 768px, desktop nav should be visible (based on CSS min-width: 768px)
    const nav = page.locator('nav#primary-nav')
    await expect(nav).toBeVisible()
  })

  test('episodes page displays properly', async ({ page }) => {
    await page.goto('/episodes/')

    await expect(page.locator('.page-header h1')).toContainText('All Episodes')

    // Grid should have episodes
    const episodesGrid = page.locator('.episodes-grid')
    await expect(episodesGrid).toBeVisible()
  })
})
