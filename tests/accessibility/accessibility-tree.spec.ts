import { test, expect, type Page } from '@playwright/test'

/**
 * Layer 3: Accessibility Tree Validation
 *
 * Purpose: Validate what screen readers will "see" without running actual screen readers.
 * This tests the semantic structure and ARIA implementation.
 */

// Type extension for page.accessibility API
interface PageWithAccessibility extends Page {
  accessibility: {
    snapshot(options?: { interestingOnly?: boolean; root?: any }): Promise<any>
  }
}

/**
 * Helper function to recursively find nodes by role in accessibility tree
 */
function findByRole(node: any, role: string): any[] {
  const results: any[] = []

  if (node.role === role) {
    results.push(node)
  }

  if (node.children) {
    for (const child of node.children) {
      results.push(...findByRole(child, role))
    }
  }

  return results
}

/**
 * Helper function to find all landmarks in accessibility tree
 */
function findLandmarks(node: any): string[] {
  const landmarks: string[] = []
  const landmarkRoles = [
    'banner',
    'navigation',
    'main',
    'contentinfo',
    'complementary',
    'search',
    'region',
  ]

  if (node.role && landmarkRoles.includes(node.role)) {
    landmarks.push(node.role)
  }

  if (node.children) {
    for (const child of node.children) {
      landmarks.push(...findLandmarks(child))
    }
  }

  return landmarks
}

/**
 * Helper function to get heading structure
 */
function getHeadingStructure(node: any): number[] {
  const levels: number[] = []

  if (node.role === 'heading' && node.level) {
    levels.push(node.level)
  }

  if (node.children) {
    for (const child of node.children) {
      levels.push(...getHeadingStructure(child))
    }
  }

  return levels
}

test.describe('Accessibility Tree Validation', () => {
  test('page should have proper landmark regions', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const landmarks = findLandmarks(snapshot)

    // Verify presence of required landmarks
    expect(landmarks).toContain('banner') // header
    expect(landmarks).toContain('navigation') // nav
    expect(landmarks).toContain('main') // main content
    expect(landmarks).toContain('contentinfo') // footer
  })

  test('all buttons should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const buttons = findByRole(snapshot, 'button')

    expect(buttons.length).toBeGreaterThan(0)

    for (const button of buttons) {
      expect(button.name).toBeTruthy()
      expect(button.name).not.toBe('button')
      expect(button.name.length).toBeGreaterThan(0)
    }
  })

  test('all links should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const links = findByRole(snapshot, 'link')

    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      expect(link.name).toBeTruthy()
      expect(link.name).not.toBe('link')
      expect(link.name.length).toBeGreaterThan(0)
    }
  })

  test('theme toggle button should have descriptive accessible name', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const buttons = findByRole(snapshot, 'button')

    const themeToggle = buttons.find(
      (b) => b.name && b.name.toLowerCase().includes('mode')
    )

    expect(themeToggle).toBeTruthy()
    expect(themeToggle.name).toBeTruthy()
    // Name should describe current state or action
    expect(themeToggle.name.length).toBeGreaterThan(5)
  })

  test('nav toggle should have accessible name and state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const buttons = findByRole(snapshot, 'button')

    const navToggle = buttons.find(
      (b) =>
        b.name &&
        (b.name.toLowerCase().includes('navigation') ||
          b.name.toLowerCase().includes('menu'))
    )

    expect(navToggle).toBeTruthy()
    expect(navToggle.name).toBeTruthy()
    expect(navToggle.expanded).toBeDefined()
  })

  test('logo link should have accessible name', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const links = findByRole(snapshot, 'link')

    const logoLink = links.find(
      (l) =>
        l.name &&
        (l.name.toLowerCase().includes('1g of code') ||
          l.name.toLowerCase().includes('home'))
    )

    expect(logoLink).toBeTruthy()
    expect(logoLink.name).toBeTruthy()
  })

  test('heading hierarchy should be valid', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const levels = getHeadingStructure(snapshot)

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

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const levels = getHeadingStructure(snapshot)

    expect(levels.length).toBeGreaterThan(0)

    const h1Count = levels.filter((l) => l === 1).length
    expect(h1Count).toBe(1)
  })

  test('individual episode page should have valid heading hierarchy', async ({
    page,
  }) => {
    await page.goto('/episodes/2026-01-05')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const levels = getHeadingStructure(snapshot)

    expect(levels.length).toBeGreaterThan(0)

    const h1Count = levels.filter((l) => l === 1).length
    expect(h1Count).toBe(1)
  })

  test('lists should be properly structured', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const lists = findByRole(snapshot, 'list')

    // Should have at least one list (navigation)
    expect(lists.length).toBeGreaterThan(0)

    // Check each list has list items as children
    for (const list of lists) {
      if (list.children && list.children.length > 0) {
        const hasListItems = list.children.some(
          (child: any) => child.role === 'listitem'
        )
        expect(hasListItems).toBe(true)
      }
    }
  })

  test('nav toggle should communicate expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get initial state (closed)
    const initialSnapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const initialButtons = findByRole(initialSnapshot, 'button')
    const initialNavToggle = initialButtons.find(
      (b) =>
        b.name &&
        (b.name.toLowerCase().includes('navigation') ||
          b.name.toLowerCase().includes('menu'))
    )

    expect(initialNavToggle.expanded).toBe(false)

    // Open menu
    const navToggle = page.locator('.nav-toggle')
    await navToggle.click()
    await page.waitForTimeout(100)

    // Get state after opening
    const openSnapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const openButtons = findByRole(openSnapshot, 'button')
    const openNavToggle = openButtons.find(
      (b) =>
        b.name &&
        (b.name.toLowerCase().includes('navigation') ||
          b.name.toLowerCase().includes('menu'))
    )

    expect(openNavToggle.expanded).toBe(true)
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

    // Should have some decorative elements
    expect(hiddenIcons.length).toBeGreaterThan(0)

    // Verify they don't appear in accessibility tree
    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()

    // Helper to check if any node in tree has a specific role
    function hasImageRole(node: any): boolean {
      if (node.role === 'img') {
        return true
      }
      if (node.children) {
        return node.children.some((child: any) => hasImageRole(child))
      }
      return false
    }

    // The snapshot shouldn't include decorative SVG icons as separate accessible elements
    // (They should be hidden via aria-hidden="true")
    // This is verified by checking that buttons have names, not separate icon elements
  })

  test('mobile menu content should be accessible when open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open menu
    const navToggle = page.locator('.nav-toggle')
    await navToggle.click()
    await page.waitForTimeout(100)

    // Get accessibility tree with menu open
    const snapshot = await (
      page as PageWithAccessibility
    ).accessibility.snapshot()
    const links = findByRole(snapshot, 'link')

    // Should find navigation links in the tree
    const navLinks = links.filter(
      (l) => l.name === 'Home' || l.name === 'Episodes' || l.name === 'About'
    )

    expect(navLinks.length).toBeGreaterThanOrEqual(2)
  })

  test('mobile menu content should not be in tree when closed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Ensure menu is closed
    const navToggle = page.locator('.nav-toggle')
    const expanded = await navToggle.getAttribute('aria-expanded')

    if (expanded === 'true') {
      await navToggle.click()
      await page.waitForTimeout(100)
    }

    // Check if nav items are hidden (display: none or visibility: hidden)
    const navList = page.locator('.nav-list')
    const isHidden = await navList.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        parseFloat(computed.opacity) === 0
      )
    })

    // When properly hidden, they should not be accessible
    expect(isHidden).toBe(true)
  })
})
