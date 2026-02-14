import { test, expect } from '@playwright/test'

/**
 * Layer 3: Accessibility Tree Validation
 *
 * Purpose: Validate what screen readers will "see" without running actual screen readers.
 * This tests the semantic structure and ARIA implementation using Playwright's role-based
 * locators instead of the deprecated accessibility.snapshot() API.
 */

test.describe('Accessibility Tree Validation', () => {
  test('page should have proper landmark regions', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify presence of required landmarks using role locators
    await expect(page.getByRole('banner')).toBeVisible() // header

    // There may be multiple navigation landmarks (primary nav + footer nav)
    const navs = await page.getByRole('navigation').all()
    expect(navs.length).toBeGreaterThan(0)

    await expect(page.getByRole('main')).toBeVisible() // main content
    await expect(page.getByRole('contentinfo')).toBeVisible() // footer
  })

  test('all buttons should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const buttons = await page.getByRole('button').all()

    expect(buttons.length).toBeGreaterThan(0)

    for (const button of buttons) {
      // Check if button has accessible name (text content or aria-label)
      const accessibleName = await button.evaluate((el) => {
        // Get accessible name from text content, aria-label, or aria-labelledby
        return (
          el.getAttribute('aria-label') ||
          el.textContent?.trim() ||
          (el.getAttribute('aria-labelledby')
            ? document
                .getElementById(el.getAttribute('aria-labelledby')!)
                ?.textContent?.trim()
            : '')
        )
      })

      expect(accessibleName).toBeTruthy()
      expect(accessibleName).not.toBe('button')
      expect(accessibleName!.length).toBeGreaterThan(0)
    }
  })

  test('all links should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const links = await page.getByRole('link').all()

    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      // Check if link has accessible name
      const accessibleName = await link.evaluate((el) => {
        return (
          el.getAttribute('aria-label') ||
          el.textContent?.trim() ||
          (el.getAttribute('aria-labelledby')
            ? document
                .getElementById(el.getAttribute('aria-labelledby')!)
                ?.textContent?.trim()
            : '')
        )
      })

      expect(accessibleName).toBeTruthy()
      expect(accessibleName).not.toBe('link')
      expect(accessibleName!.length).toBeGreaterThan(0)
    }
  })

  test('theme toggle button should have descriptive accessible name', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find theme toggle button by data-testid
    const themeToggle = page.getByTestId('theme-toggle')
    await expect(themeToggle).toBeVisible()

    const accessibleName = await themeToggle.evaluate((el) => {
      return (
        el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        (el.getAttribute('aria-labelledby')
          ? document
              .getElementById(el.getAttribute('aria-labelledby')!)
              ?.textContent?.trim()
          : '')
      )
    })

    expect(accessibleName).toBeTruthy()
    expect(accessibleName!.toLowerCase()).toMatch(/mode|theme/)
    // Name should describe current state or action
    expect(accessibleName!.length).toBeGreaterThan(5)
  })

  test('nav toggle should have accessible name and state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const navToggle = page.getByTestId('nav-toggle')
    await expect(navToggle).toBeVisible()

    const accessibleName = await navToggle.evaluate((el) => {
      return el.getAttribute('aria-label') || el.textContent?.trim() || ''
    })

    expect(accessibleName).toBeTruthy()
    expect(accessibleName.toLowerCase()).toMatch(/navigation|menu/)

    // Check for aria-expanded attribute
    const ariaExpanded = await navToggle.getAttribute('aria-expanded')
    expect(ariaExpanded).toBeDefined()
    expect(['true', 'false']).toContain(ariaExpanded)
  })

  test('logo link should have accessible name', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const logoLink = page.getByTestId('site-logo')
    await expect(logoLink).toBeVisible()

    const accessibleName = await logoLink.evaluate((el) => {
      return (
        el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        (el.getAttribute('aria-labelledby')
          ? document
              .getElementById(el.getAttribute('aria-labelledby')!)
              ?.textContent?.trim()
          : '')
      )
    })

    expect(accessibleName).toBeTruthy()
    expect(
      accessibleName!.toLowerCase().includes('1g of code') ||
        accessibleName!.toLowerCase().includes('home')
    ).toBe(true)
  })

  test('heading hierarchy should be valid', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get all headings in document order
    const levels = await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      )
      return headings.map((h) => parseInt(h.tagName.substring(1)))
    })

    // Should have at least one heading
    expect(levels.length).toBeGreaterThan(0)

    // Should have exactly one h1
    const h1Count = levels.filter((l) => l === 1).length
    expect(h1Count).toBe(1)

    // Check for skipped levels (shouldn't jump from h1 to h3, etc.)
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i]
      const previousLevel = levels[i - 1]

      // Can go up by 1, stay the same, or go down any amount
      const diff = currentLevel - previousLevel

      if (diff > 0) {
        expect(diff).toBeLessThanOrEqual(1)
      }
    }
  })

  test('episodes page should have valid heading hierarchy', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const levels = await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      )
      return headings.map((h) => parseInt(h.tagName.substring(1)))
    })

    expect(levels.length).toBeGreaterThan(0)

    const h1Count = levels.filter((l) => l === 1).length
    expect(h1Count).toBe(1)
  })

  test('individual episode page should have valid heading hierarchy', async ({
    page,
  }) => {
    await page.goto('/episodes/2026-01-05')
    await page.waitForLoadState('networkidle')

    const levels = await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      )
      return headings.map((h) => parseInt(h.tagName.substring(1)))
    })

    expect(levels.length).toBeGreaterThan(0)

    const h1Count = levels.filter((l) => l === 1).length
    expect(h1Count).toBe(1)
  })

  test('lists should be properly structured', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const lists = await page.getByRole('list').all()

    // Should have at least one list (navigation)
    expect(lists.length).toBeGreaterThan(0)

    // Check each list has list items as children
    for (const list of lists) {
      const listItems = await list.locator('li, [role="listitem"]').count()
      // Lists should have at least one item
      if ((await list.isVisible()) && listItems === 0) {
        // If no li elements, might be using role="listitem" explicitly
        const hasListItemRole = await list.locator('[role="listitem"]').count()
        expect(hasListItemRole).toBeGreaterThan(0)
      }
    }
  })

  test('nav toggle should communicate expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const navToggle = page.getByTestId('nav-toggle')

    // Get initial state (closed)
    const initialExpanded = await navToggle.getAttribute('aria-expanded')
    expect(initialExpanded).toBe('false')

    // Open menu
    await navToggle.click()
    await page.waitForTimeout(100)

    // Get state after opening
    const openExpanded = await navToggle.getAttribute('aria-expanded')
    expect(openExpanded).toBe('true')
  })

  test('current page should be indicated in navigation', async ({ page }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    // Check for current page indication via aria-current
    const currentLink = await page.locator('[aria-current="page"]').first()
    const exists = (await currentLink.count()) > 0

    expect(exists).toBe(true)
  })

  test('decorative icons should be hidden from screen readers', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check that icons with aria-hidden are actually hidden
    const hiddenIcons = await page.locator('[aria-hidden="true"]').all()

    // Should have some decorative elements (theme icons, hamburger, etc.)
    expect(hiddenIcons.length).toBeGreaterThan(0)

    // Verify that decorative SVG icons inside buttons have aria-hidden
    // (Some SVGs might be meaningful and not have aria-hidden, which is fine)
    const decorativeSvgsCount = await page
      .locator('button svg[aria-hidden="true"], a svg[aria-hidden="true"]')
      .count()

    // Should have at least some decorative SVGs (theme toggle icons, social icons, etc.)
    expect(decorativeSvgsCount).toBeGreaterThan(0)
  })

  test('mobile menu content should be accessible when open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open menu using data-testid
    const navToggle = page.getByTestId('nav-toggle')
    await navToggle.click()
    await page.waitForTimeout(100)

    // Find navigation links within the nav menu
    // Use data-testid pattern for nav links
    const homeLink = page.getByTestId('nav-link-home')
    const episodesLink = page.getByTestId('nav-link-episodes')
    const aboutLink = page.getByTestId('nav-link-about')

    // Count visible links
    const navLinks = [homeLink, episodesLink, aboutLink]

    // Count how many are visible
    const visibleCount = await Promise.all(
      navLinks.map((link) => link.isVisible())
    ).then((results) => results.filter((v) => v).length)

    // Should have at least 2 visible navigation links when menu is open
    expect(visibleCount).toBeGreaterThanOrEqual(2)
  })

  test('mobile menu content should not be in tree when closed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Ensure menu is closed using data-testid
    const navToggle = page.getByTestId('nav-toggle')
    const expanded = await navToggle.getAttribute('aria-expanded')

    if (expanded === 'true') {
      await navToggle.click()
      await page.waitForTimeout(100)
    }

    // Check if primary-nav (the menu container) is hidden using data-testid
    const primaryNav = page.getByTestId('primary-nav')
    const isHidden = await primaryNav.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        parseFloat(computed.opacity) === 0
      )
    })

    // When properly hidden, the menu should not be accessible
    expect(isHidden).toBe(true)
  })
})
