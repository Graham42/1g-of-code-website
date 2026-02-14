import { test, expect, type Page } from '@playwright/test'

/**
 * Layer 4: Focus Indicator Testing
 *
 * Purpose: Verify all interactive elements have visible focus indicators using computed styles.
 * This ensures keyboard users can see where they are on the page.
 */

/**
 * Helper function to get focus styles for the currently focused element
 */
async function getFocusStyles(page: Page) {
  return await page.evaluate(() => {
    const el = document.activeElement
    if (!el) return null

    const computed = window.getComputedStyle(el)
    return {
      outlineWidth: computed.outlineWidth,
      outlineStyle: computed.outlineStyle,
      outlineColor: computed.outlineColor,
      outlineOffset: computed.outlineOffset,
      boxShadow: computed.boxShadow,
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
    }
  })
}

/**
 * Helper function to check if element has a visible focus indicator
 */
function hasFocusIndicator(styles: any): boolean {
  if (!styles) return false

  const hasOutline =
    styles.outlineWidth !== '0px' &&
    styles.outlineStyle !== 'none' &&
    !styles.outlineColor.includes('rgba(0, 0, 0, 0)') &&
    !styles.outlineColor.includes('transparent')

  const hasBoxShadow =
    styles.boxShadow !== 'none' &&
    !styles.boxShadow.includes('rgba(0, 0, 0, 0)')

  return hasOutline || hasBoxShadow
}

test.describe('Focus Indicators', () => {
  test('all interactive elements should have visible focus indicators', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get all interactive elements within the site (exclude Playwright UI, Astro dev tools, etc.)
    // Use data-testid to scope to site wrapper
    const siteWrapper = page.getByTestId('site-wrapper')
    const interactiveElements = await siteWrapper
      .locator('a, button, input, select, textarea')
      .all()

    const visibleElements = []

    for (const element of interactiveElements) {
      const isVisible = await element.isVisible()
      if (isVisible) {
        visibleElements.push(element)
      }
    }

    expect(visibleElements.length).toBeGreaterThan(0)

    for (const element of visibleElements) {
      // Focus the element
      await element.focus()

      // Get computed styles
      const styles = await getFocusStyles(page)

      // Get element info for debugging
      const tagName = await element.evaluate((el) => el.tagName)
      const className = await element.evaluate((el) => el.className)
      const id = await element.evaluate((el) => el.id)

      // Verify it has a focus indicator
      const hasIndicator = hasFocusIndicator(styles)

      // Provide better error message showing which element failed
      if (!hasIndicator) {
        console.error(
          `Element missing focus indicator: ${tagName}${id ? '#' + id : ''}${className ? '.' + className.split(' ').join('.') : ''}`
        )
        console.error('Styles:', styles)
      }

      expect(hasIndicator).toBe(true)
    }
  })

  test('theme toggle should have visible focus indicator', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const themeToggle = page.getByTestId('theme-toggle')
    await themeToggle.focus()

    const styles = await getFocusStyles(page)

    expect(hasFocusIndicator(styles)).toBe(true)

    // Check outline offset (should be at least 1px, design uses 2px)
    const offset = parseInt(styles!.outlineOffset)
    expect(offset).toBeGreaterThanOrEqual(1)
  })

  test('nav links should have visible focus indicators', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const navLinks = await page.locator('.nav-link').all()

    expect(navLinks.length).toBeGreaterThan(0)

    for (const link of navLinks) {
      const isVisible = await link.isVisible()
      if (!isVisible) continue

      await link.focus()
      const styles = await getFocusStyles(page)

      expect(hasFocusIndicator(styles)).toBe(true)
    }
  })

  test('logo link should have visible focus indicator', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const logo = page.getByTestId('site-logo')
    await logo.focus()

    const styles = await getFocusStyles(page)

    expect(hasFocusIndicator(styles)).toBe(true)
  })

  test('skip link should have visible focus indicator', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const skipLink = page.getByTestId('skip-link')
    await skipLink.focus()

    const styles = await getFocusStyles(page)

    expect(hasFocusIndicator(styles)).toBe(true)
  })

  test('mobile nav toggle should have visible focus indicator', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const navToggle = page.getByTestId('nav-toggle')
    await navToggle.focus()

    const styles = await getFocusStyles(page)

    expect(hasFocusIndicator(styles)).toBe(true)
  })

  test('focus indicators should be visible in light mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Set theme to light mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-setting', 'light')
      document.documentElement.setAttribute('data-theme', 'light')
    })

    await page.waitForTimeout(100)

    // Test a few key elements
    const elements = ['.theme-toggle', '.site-logo', '.nav-link']

    for (const selector of elements) {
      const element = page.locator(selector).first()
      const isVisible = await element.isVisible()

      if (isVisible) {
        await element.focus()
        const styles = await getFocusStyles(page)

        expect(hasFocusIndicator(styles)).toBe(true)
      }
    }
  })

  test('focus indicators should be visible in dark mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Set theme to dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-setting', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    await page.waitForTimeout(100)

    // Test a few key elements
    const elements = ['.theme-toggle', '.site-logo', '.nav-link']

    for (const selector of elements) {
      const element = page.locator(selector).first()
      const isVisible = await element.isVisible()

      if (isVisible) {
        await element.focus()
        const styles = await getFocusStyles(page)

        expect(hasFocusIndicator(styles)).toBe(true)
      }
    }
  })

  test('focus indicators should have sufficient offset', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const interactiveElements = await page.locator('a, button').all()

    for (const element of interactiveElements) {
      const isVisible = await element.isVisible()
      if (!isVisible) continue

      await element.focus()
      const styles = await getFocusStyles(page)

      if (hasFocusIndicator(styles) && styles!.outlineWidth !== '0px') {
        // Check outline offset is at least 1px
        const offset = parseInt(styles!.outlineOffset)
        expect(offset).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('focus indicators should work on episode cards', async ({ page }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const episodeLinks = await page.locator('article a').all()

    if (episodeLinks.length > 0) {
      for (let i = 0; i < Math.min(3, episodeLinks.length); i++) {
        const link = episodeLinks[i]
        await link.focus()
        const styles = await getFocusStyles(page)

        expect(hasFocusIndicator(styles)).toBe(true)
      }
    }
  })

  test('focus should be visible on mobile navigation links when menu is open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open mobile menu by pressing Enter on nav toggle using data-testid
    const navToggle = page.getByTestId('nav-toggle')
    await navToggle.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)

    // Tab to first nav link
    await page.keyboard.press('Tab')
    await page.waitForTimeout(50)

    // Check focus indicator on first link
    const styles = await getFocusStyles(page)
    const hasIndicator = hasFocusIndicator(styles)

    // Provide better error message
    if (!hasIndicator) {
      const focusedEl = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tag: el?.tagName,
          text: el?.textContent?.trim().substring(0, 50),
        }
      })
      console.error(`Focused element missing indicator:`, focusedEl)
      console.error('Styles:', styles)
    }

    expect(hasIndicator).toBe(true)
  })
})
