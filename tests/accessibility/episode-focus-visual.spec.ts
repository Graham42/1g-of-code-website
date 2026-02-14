import { test, expect } from '@playwright/test';

/**
 * Visual test for episode link focus indicators
 *
 * This test verifies that episode links have clearly visible focus indicators
 * by checking the actual computed styles and colors.
 */

test.describe('Episode Link Focus Visibility', () => {
  test('episode links should have highly visible focus indicators in light mode', async ({ page }) => {
    await page.goto('/episodes/');
    await page.waitForLoadState('networkidle');

    const episodeLink = page.locator('.episode-link').first();
    await episodeLink.focus();

    const styles = await episodeLink.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        outlineWidth: computed.outlineWidth,
        outlineStyle: computed.outlineStyle,
        outlineColor: computed.outlineColor,
        outlineOffset: computed.outlineOffset,
      };
    });

    // Should have visible outline
    expect(styles.outlineWidth).not.toBe('0px');
    expect(styles.outlineStyle).not.toBe('none');

    // Log the actual color for debugging
    console.log('Episode link focus outline color:', styles.outlineColor);
    console.log('Episode link focus outline width:', styles.outlineWidth);
    console.log('Episode link focus outline offset:', styles.outlineOffset);
  });

  test('episode links should have highly visible focus indicators in dark mode', async ({ page }) => {
    await page.goto('/episodes/');
    await page.waitForLoadState('networkidle');

    // Set dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-setting', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await page.waitForTimeout(100);

    const episodeLink = page.locator('.episode-link').first();
    await episodeLink.focus();

    const styles = await episodeLink.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        outlineWidth: computed.outlineWidth,
        outlineStyle: computed.outlineStyle,
        outlineColor: computed.outlineColor,
        outlineOffset: computed.outlineOffset,
        backgroundColor: computed.backgroundColor,
      };
    });

    // Should have visible outline
    expect(styles.outlineWidth).not.toBe('0px');
    expect(styles.outlineStyle).not.toBe('none');

    // Log the actual color for debugging
    console.log('Dark mode episode link focus outline color:', styles.outlineColor);
    console.log('Dark mode episode link background:', styles.backgroundColor);
  });

  test('episode links on home page should have visible focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find episode links on home page (in "Latest Episodes" section)
    const episodeLinks = await page.locator('.episode-link').all();

    if (episodeLinks.length > 0) {
      const firstLink = episodeLinks[0];
      await firstLink.focus();

      const styles = await firstLink.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outlineWidth: computed.outlineWidth,
          outlineStyle: computed.outlineStyle,
          outlineColor: computed.outlineColor,
          outlineOffset: computed.outlineOffset,
        };
      });

      expect(styles.outlineWidth).not.toBe('0px');
      expect(styles.outlineStyle).not.toBe('none');

      console.log('Home page episode link focus outline:', styles);
    }
  });
});
