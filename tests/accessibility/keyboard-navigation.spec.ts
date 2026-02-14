import { test, expect } from '@playwright/test';

/**
 * Layer 2: Keyboard Navigation Testing
 *
 * Purpose: Verify all interactive elements are keyboard accessible and focus order is logical.
 * This ensures users who rely on keyboard navigation can use the site effectively.
 */

import { type Page } from '@playwright/test';

/**
 * Helper function to get the current focused element's selector
 */
async function getFocusedElementInfo(page: Page) {
  return await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;

    const tagName = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const className = el.className ? `.${el.className.split(' ').join('.')}` : '';
    const ariaLabel = el.getAttribute('aria-label') || '';

    return {
      selector: `${tagName}${id}${className}`,
      tagName,
      id: el.id,
      className: el.className,
      ariaLabel,
      textContent: el.textContent?.trim().substring(0, 50)
    };
  });
}

/**
 * Helper function to verify an element has visible focus
 */
async function verifyFocusVisible(page: Page, elementInfo: any) {
  const styles = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;

    const computed = window.getComputedStyle(el);
    return {
      outlineWidth: computed.outlineWidth,
      outlineStyle: computed.outlineStyle,
      outlineColor: computed.outlineColor,
      boxShadow: computed.boxShadow,
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity
    };
  });

  const isVisible = styles!.display !== 'none' &&
                   styles!.visibility !== 'hidden' &&
                   parseFloat(styles!.opacity) > 0;

  const hasOutline = styles!.outlineWidth !== '0px' &&
                    styles!.outlineStyle !== 'none';

  const hasBoxShadow = styles!.boxShadow !== 'none';

  expect(isVisible).toBe(true);
  expect(hasOutline || hasBoxShadow).toBe(true);
}

test.describe('Keyboard Navigation', () => {
  test('skip link should be visible on focus and work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Press Tab to focus skip link
    await page.keyboard.press('Tab');

    // Verify skip link is focused
    const focusedInfo = await getFocusedElementInfo(page);
    expect(focusedInfo?.className).toContain('skip-link');

    // Verify skip link is visible when focused
    const skipLink = page.locator('.skip-link');
    const isVisible = await skipLink.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.clip === 'auto' || computed.clip === '';
    });
    expect(isVisible).toBe(true);

    // Press Enter to activate skip link
    await page.keyboard.press('Enter');

    // Verify focus moved to main content
    await page.waitForTimeout(100); // Brief wait for focus to move
    const mainFocused = await page.evaluate(() => {
      return document.activeElement?.id === 'main-content';
    });
    expect(mainFocused).toBe(true);
  });

  test('tab order on desktop should follow logical flow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Expected tab order for header elements
    const expectedOrder = [
      'skip-link',
      'site-logo',    // Logo link
      'nav',          // Navigation (will focus first link inside)
      'twitch-link',  // Twitch button
      'theme-toggle'  // Theme toggle button
    ];

    // Track actual tab order
    const actualOrder: string[] = [];

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const info = await getFocusedElementInfo(page);

      if (!info) break;

      // Determine which element this is
      if (info.className.includes('skip-link')) {
        actualOrder.push('skip-link');
      } else if (info.className.includes('site-logo')) {
        actualOrder.push('site-logo');
      } else if (info.tagName === 'a' && info.className.includes('nav-link')) {
        if (!actualOrder.includes('nav')) actualOrder.push('nav');
      } else if (info.className.includes('twitch-link')) {
        actualOrder.push('twitch-link');
      } else if (info.className.includes('theme-toggle')) {
        actualOrder.push('theme-toggle');
        break; // We've reached the end of the header
      }
    }

    // Verify we got all expected elements
    expect(actualOrder).toContain('skip-link');
    expect(actualOrder).toContain('site-logo');
    expect(actualOrder).toContain('nav');
    expect(actualOrder).toContain('twitch-link');
    expect(actualOrder).toContain('theme-toggle');
  });

  test('tab order on mobile should include nav toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Before opening menu, should only have skip-link, site-logo, and nav-toggle
    const tabOrderBeforeOpen = [];

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const info = await getFocusedElementInfo(page);

      if (!info) break;

      if (info.className.includes('skip-link')) {
        tabOrderBeforeOpen.push('skip-link');
      } else if (info.className.includes('site-logo')) {
        tabOrderBeforeOpen.push('site-logo');
      } else if (info.className.includes('nav-toggle') || info.ariaLabel.includes('navigation')) {
        tabOrderBeforeOpen.push('nav-toggle');
        break;
      }
    }

    expect(tabOrderBeforeOpen).toContain('skip-link');
    expect(tabOrderBeforeOpen).toContain('site-logo');
    expect(tabOrderBeforeOpen).toContain('nav-toggle');

    // Open menu
    const navToggle = page.locator('.nav-toggle');
    await navToggle.click();
    await page.waitForTimeout(100);

    // Verify menu items and buttons are now focusable
    // Focus each element directly to verify they're accessible
    const firstNavLink = page.locator('.nav-link').first();
    await firstNavLink.focus();
    let focused = await firstNavLink.evaluate(el => document.activeElement === el);
    expect(focused).toBe(true);

    const twitchLink = page.locator('.twitch-link');
    await twitchLink.focus();
    focused = await twitchLink.evaluate(el => document.activeElement === el);
    expect(focused).toBe(true);

    const themeToggle = page.locator('.theme-toggle');
    await themeToggle.focus();
    focused = await themeToggle.evaluate(el => document.activeElement === el);
    expect(focused).toBe(true);
  });

  test('buttons should be in mobile menu, not header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify buttons are NOT visible before menu opens
    const twitchLink = page.locator('.twitch-link');
    const themeToggle = page.locator('.theme-toggle');

    expect(await twitchLink.isVisible()).toBe(false);
    expect(await themeToggle.isVisible()).toBe(false);

    // Open menu
    const navToggle = page.locator('.nav-toggle');
    await navToggle.click();
    await page.waitForTimeout(100);

    // Verify buttons ARE visible in opened menu
    expect(await twitchLink.isVisible()).toBe(true);
    expect(await themeToggle.isVisible()).toBe(true);
  });

  test('theme toggle should work with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to theme toggle
    const themeToggle = page.locator('.theme-toggle');
    await themeToggle.focus();

    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme-setting');
    });

    // Press Enter to activate
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // Verify theme changed
    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme-setting');
    });
    expect(newTheme).not.toBe(initialTheme);

    // Press Space to activate again
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    // Verify theme changed again
    const finalTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme-setting');
    });
    expect(finalTheme).not.toBe(newTheme);

    // Verify Escape does NOT activate
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const afterEscape = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme-setting');
    });
    expect(afterEscape).toBe(finalTheme);
  });

  test('mobile menu should be keyboard accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to nav toggle button
    const navToggle = page.locator('.nav-toggle');
    await navToggle.focus();

    // Verify initial state
    const initialExpanded = await navToggle.getAttribute('aria-expanded');
    expect(initialExpanded).toBe('false');

    // Press Enter to open menu
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // Verify menu opened
    const expandedAfterOpen = await navToggle.getAttribute('aria-expanded');
    expect(expandedAfterOpen).toBe('true');

    // Verify menu is visible
    const navList = page.locator('.nav-list');
    const isVisible = await navList.isVisible();
    expect(isVisible).toBe(true);

    // Tab into menu - should land on first nav link
    await page.keyboard.press('Tab');
    const focusedInfo = await getFocusedElementInfo(page);
    // The focused element should be a link inside the nav
    expect(focusedInfo?.tagName).toBe('a');

    // Press Escape to close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Verify menu closed
    const expandedAfterEscape = await navToggle.getAttribute('aria-expanded');
    expect(expandedAfterEscape).toBe('false');
  });

  test('should not have keyboard traps', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const maxTabs = 50;
    const focusedElements: string[] = [];
    let previousFocus = '';

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const info = await getFocusedElementInfo(page);

      if (!info) {
        // Focus left the page (went to browser chrome)
        break;
      }

      const focusKey = `${info.tagName}:${info.id}:${info.className}`;

      // Check if we're cycling back to an element we've seen before
      if (focusedElements.includes(focusKey) && i > 5) {
        // It's ok to cycle back at the end, but not immediately
        const firstIndex = focusedElements.indexOf(focusKey);
        if (i - firstIndex > 3) {
          // We've completed a cycle through the page
          break;
        }
      }

      focusedElements.push(focusKey);
      previousFocus = focusKey;
    }

    // Verify we didn't hit max tabs (which would indicate a trap)
    expect(focusedElements.length).toBeLessThan(maxTabs);

    // Verify we found at least some interactive elements
    expect(focusedElements.length).toBeGreaterThan(3);
  });

  test('should not have positive tabindex values', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const positiveTabindex = await page.locator('[tabindex]').evaluateAll((elements) => {
      return elements.filter((el) => {
        const tabindex = el.getAttribute('tabindex');
        return tabindex && parseInt(tabindex) > 0;
      });
    });

    expect(positiveTabindex.length).toBe(0);
  });

  test('all interactive elements should be focusable', async ({ page }) => {
    // Use desktop viewport to ensure all elements are visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all interactive elements from main content areas (not browser chrome or extensions)
    const interactiveElements = await page.locator('.site-wrapper a, .site-wrapper button, .site-wrapper input, .site-wrapper select, .site-wrapper textarea').all();

    for (const element of interactiveElements) {
      // Skip elements that are not visible
      const isVisible = await element.isVisible();
      if (!isVisible) continue;

      // Skip disabled elements
      const isDisabled = await element.evaluate(el => {
        return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      });
      if (isDisabled) continue;

      // Try to focus element
      await element.focus();

      // Verify it received focus
      const isFocused = await element.evaluate((el) => {
        return document.activeElement === el;
      });

      // Get element info for debugging if test fails
      if (!isFocused) {
        const tagName = await element.evaluate(el => el.tagName);
        const className = await element.evaluate(el => el.className);
        const id = await element.evaluate(el => el.id);
        console.log(`Failed to focus: ${tagName}#${id}.${className}`);
      }

      expect(isFocused).toBe(true);
    }
  });
});
