import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('home page loads and displays content', async ({ page }) => {
    await page.goto('/')

    // Check that the page has loaded with main content
    await expect(page).toHaveTitle(/1g of Code/)
    await expect(page.locator('.hero-title')).toContainText('1g of Code')
  })

  test('can navigate to Episodes page', async ({ page }) => {
    await page.goto('/')

    // Click on Episodes link in navigation
    await page.click('a[href="/episodes/"]')

    // Verify we're on the Episodes page
    await expect(page).toHaveURL(/\/episodes\//)
    await expect(page.locator('.page-header h1')).toContainText('All Episodes')
  })

  test('can navigate to About page', async ({ page }) => {
    await page.goto('/')

    // Click on About link in navigation
    await page.click('a[href="/about/"]')

    // Verify we're on the About page
    await expect(page).toHaveURL(/\/about\//)
    await expect(page.locator('.about-page h1')).toContainText(
      'About 1g of Code'
    )
  })

  test('navigation links are present in header', async ({ page }) => {
    await page.goto('/')

    // Check that the header navigation contains all expected links
    const header = page.locator('header.site-header')
    await expect(header).toBeVisible()

    const nav = header.locator('nav#primary-nav')
    await expect(nav.locator('a[href="/"]')).toBeVisible()
    await expect(nav.locator('a[href="/episodes/"]')).toBeVisible()
    await expect(nav.locator('a[href="/about/"]')).toBeVisible()
  })

  test('footer links are present', async ({ page }) => {
    await page.goto('/')

    // Check footer exists
    const footer = page.locator('footer.site-footer')
    await expect(footer).toBeVisible()

    // Check social links in footer
    await expect(
      footer.locator('a[href="https://twitch.tv/1gOfCode"]')
    ).toBeVisible()
    await expect(footer.locator('.footer-logo')).toContainText('1g of Code')
    await expect(footer.locator('.footer-tagline')).toContainText(
      'Coding and building with AI'
    )
  })

  test('logo link navigates to home page', async ({ page }) => {
    // Start on episodes page
    await page.goto('/episodes/')

    // Click the logo to go home
    await page.click('.site-logo')

    // Verify we're on the home page
    await expect(page).toHaveURL('/')
  })
})
