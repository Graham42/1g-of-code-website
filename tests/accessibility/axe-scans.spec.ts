import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  test('home page should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .exclude(['#playwright-report']) // Exclude playwright UI elements if present
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('episodes listing page should not have accessibility violations', async ({ page }) => {
    await page.goto('/episodes/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('individual episode page (2026-01-05) should not have accessibility violations', async ({ page }) => {
    await page.goto('/episodes/2026-01-05');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('individual episode page (2026-01-19) should not have accessibility violations', async ({ page }) => {
    await page.goto('/episodes/2026-01-19');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('about page should not have accessibility violations', async ({ page }) => {
    await page.goto('/about/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('404 page should not have accessibility violations', async ({ page }) => {
    await page.goto('/404');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('home page in dark mode should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set theme to dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-setting', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('home page with mobile menu open should not have accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const navToggle = page.locator('.nav-toggle');
    await navToggle.click();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
