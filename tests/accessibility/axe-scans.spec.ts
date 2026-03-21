import { test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { NodeResult, Result } from 'axe-core'

/**
 * Formats axe-core violations into a human-readable string for test failure messages.
 *
 * Why this exists: when using `expect(violations).toEqual([])` or `.toHaveLength(0)`,
 * Playwright dumps the full raw axe violations array as a JSON diff — often hundreds
 * of lines of deeply nested objects per violation. That output is effectively unreadable.
 *
 * By throwing `new Error(formatViolations(...))` instead, we get only this concise
 * summary with the impact level, rule ID, affected selectors, and a docs link.
 * No raw JSON noise.
 *
 * color-contrast violations are grouped by color pair since many elements often share
 * the same root cause (e.g. a single CSS variable used in many places).
 */
function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return 'No violations'
  const items = violations.map((v) => {
    const nodeLines =
      v.id === 'color-contrast'
        ? formatColorContrastNodes(v.nodes)
        : v.nodes
            .map(
              (n) =>
                `  → ${n.target.join(', ')}: ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`
            )
            .join('\n')
    return `[${v.impact}] ${v.id} — ${v.description} (${v.nodes.length} node${v.nodes.length !== 1 ? 's' : ''})\n  Fix: ${v.help}\n${nodeLines}\n  Docs: ${v.helpUrl}`
  })
  return `Found ${violations.length} accessibility violation(s):\n\n${items.join('\n\n')}`
}

type ColorContrastData = {
  fgColor?: string
  bgColor?: string
  contrastRatio?: number
  expectedContrastRatio?: string
}

function formatColorContrastNodes(nodes: NodeResult[]): string {
  const groups = new Map<
    string,
    { fg: string; bg: string; ratio: string; need: string; selectors: string[] }
  >()

  for (const node of nodes) {
    const d = node.any[0]?.data as ColorContrastData | undefined
    if (!d?.fgColor || !d?.bgColor) continue
    const key = `${d.fgColor}|${d.bgColor}|${d.expectedContrastRatio}`
    if (!groups.has(key)) {
      groups.set(key, {
        fg: d.fgColor,
        bg: d.bgColor,
        ratio: d.contrastRatio?.toFixed(2) ?? '?',
        need: d.expectedContrastRatio ?? '?',
        selectors: [],
      })
    }
    groups.get(key)!.selectors.push(node.target.flat().join(', '))
  }

  const MAX_SHOWN = 3
  return [...groups.values()]
    .map(({ fg, bg, ratio, need, selectors }) => {
      const shown = selectors.slice(0, MAX_SHOWN).join(', ')
      const overflow =
        selectors.length > MAX_SHOWN
          ? `, and ${selectors.length - MAX_SHOWN} more`
          : ''
      const count = `${selectors.length} element${selectors.length !== 1 ? 's' : ''}`
      return `  ${fg} on ${bg} — ratio ${ratio}:1, need ${need} — ${count}: ${shown}${overflow}`
    })
    .join('\n')
}

/**
 * Layer 1: Axe-Core Scanning
 *
 * Purpose: Scan all pages for automated WCAG violations using axe-core.
 * This catches ~57% of WCAG issues automatically including:
 * - Color contrast violations
 * - Missing alt text on images
 * - Invalid ARIA attributes
 * - Missing form labels
 * - Incorrect heading hierarchy
 * - Missing page language
 * - Duplicate IDs
 * - Invalid HTML structure
 * - Missing landmark regions
 */

test.describe('Axe-Core WCAG Scans', () => {
  test('home page should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .exclude(['#playwright-report']) // Exclude playwright UI elements if present
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('episodes listing page should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('individual episode page (2026-01-05) should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/episodes/2026-01-05')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('individual episode page (2026-01-19) should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/episodes/2026-01-19')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('about page should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/about/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('404 page should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/404')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('home page in dark mode should not have accessibility violations', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Set theme to dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-setting', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })

  test('home page with mobile menu open should not have accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open mobile menu
    const navToggle = page.locator('.nav-toggle')
    await navToggle.click()

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    if (accessibilityScanResults.violations.length > 0) {
      throw new Error(formatViolations(accessibilityScanResults.violations))
    }
  })
})
