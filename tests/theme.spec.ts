import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('theme toggle button is visible', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')
    await expect(themeToggle).toBeVisible()
  })

  test('default theme setting is system', async ({ page }) => {
    await page.goto('/')

    // Check that data-theme-setting is 'system' by default
    const themeSetting = await page
      .locator('html')
      .getAttribute('data-theme-setting')
    expect(themeSetting).toBe('system')

    // System icon should be visible
    const systemIcon = page.locator('#theme-toggle .system-icon')
    await expect(systemIcon).toBeVisible()
  })

  test('clicking toggle cycles through themes: system → light → dark → system', async ({
    page,
  }) => {
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')
    const html = page.locator('html')

    // Start at system
    await expect(html).toHaveAttribute('data-theme-setting', 'system')

    // Click to go to light
    await themeToggle.click()
    await expect(html).toHaveAttribute('data-theme-setting', 'light')
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('#theme-toggle .sun-icon')).toBeVisible()

    // Click to go to dark
    await themeToggle.click()
    await expect(html).toHaveAttribute('data-theme-setting', 'dark')
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#theme-toggle .moon-icon')).toBeVisible()

    // Click to go back to system
    await themeToggle.click()
    await expect(html).toHaveAttribute('data-theme-setting', 'system')
    await expect(page.locator('#theme-toggle .system-icon')).toBeVisible()
  })

  test('theme preference persists in localStorage', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')

    // Click to set to light
    await themeToggle.click()

    // Check localStorage
    const storedSetting = await page.evaluate(() =>
      localStorage.getItem('theme-setting')
    )
    expect(storedSetting).toBe('light')

    // Reload and verify persistence
    await page.reload()

    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme-setting', 'light')
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('theme persists across navigation', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')

    // Set to dark
    await themeToggle.click() // light
    await themeToggle.click() // dark

    await expect(page.locator('html')).toHaveAttribute(
      'data-theme-setting',
      'dark'
    )

    // Navigate to another page
    await page.goto('/episodes/')

    // Theme should persist
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme-setting',
      'dark'
    )
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('aria-label updates with current theme', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')

    // System mode label
    await expect(themeToggle).toHaveAttribute(
      'aria-label',
      'System mode (click for light)'
    )

    // Click to light
    await themeToggle.click()
    await expect(themeToggle).toHaveAttribute(
      'aria-label',
      'Light mode (click for dark)'
    )

    // Click to dark
    await themeToggle.click()
    await expect(themeToggle).toHaveAttribute(
      'aria-label',
      'Dark mode (click for system)'
    )
  })

  test('system theme respects prefers-color-scheme: dark', async ({ page }) => {
    // Emulate dark color scheme preference
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const html = page.locator('html')

    // Should be system setting with dark effective theme
    await expect(html).toHaveAttribute('data-theme-setting', 'system')
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('system theme respects prefers-color-scheme: light', async ({
    page,
  }) => {
    // Emulate light color scheme preference
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const html = page.locator('html')

    // Should be system setting with light effective theme
    await expect(html).toHaveAttribute('data-theme-setting', 'system')
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('forced light theme ignores system preference', async ({ page }) => {
    // Set system to dark
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')
    const html = page.locator('html')

    // Force light mode
    await themeToggle.click()

    // Should be light despite system preference being dark
    await expect(html).toHaveAttribute('data-theme-setting', 'light')
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('forced dark theme ignores system preference', async ({ page }) => {
    // Set system to light
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const themeToggle = page.locator('#theme-toggle')
    const html = page.locator('html')

    // Force dark mode (system → light → dark)
    await themeToggle.click()
    await themeToggle.click()

    // Should be dark despite system preference being light
    await expect(html).toHaveAttribute('data-theme-setting', 'dark')
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('no flash of wrong theme on page load', async ({ page }) => {
    // Set dark preference and save to localStorage
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('theme-setting', 'dark'))

    // Navigate to a new page and check immediately
    await page.goto('/')

    // The theme should be set before any visual rendering
    // Check that data-theme is set correctly in the initial HTML
    const theme = await page.locator('html').getAttribute('data-theme')
    expect(theme).toBe('dark')
  })

  test('desktop: theme toggle shows icon only (no text)', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/')

    const systemIcon = page.locator('#theme-toggle .system-icon')
    const themeText = page.locator('#theme-toggle .nav-button-text')

    // System icon should be visible by default
    await expect(systemIcon).toBeVisible()

    // Text should not be visible on desktop
    await expect(themeText).not.toBeVisible()
  })

  test('mobile: theme toggle shows icon and text', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Wait for JavaScript to run
    await page.waitForTimeout(500)

    // Open mobile menu
    const navToggle = page.locator('[data-testid="nav-toggle"]')
    await navToggle.click()

    const themeToggle = page.locator('#theme-toggle')
    const systemIcon = page.locator('#theme-toggle .system-icon')
    const themeText = page.locator('#theme-toggle .nav-button-text')

    // Both icon and text should be visible
    await expect(systemIcon).toBeVisible()
    await expect(themeText).toBeVisible()
    await expect(themeText).toHaveText('Theme')
  })
})
