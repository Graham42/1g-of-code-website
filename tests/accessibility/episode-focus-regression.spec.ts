import { test, expect } from '@playwright/test'

/**
 * Regression tests for episode link focus indicators
 *
 * These tests prevent regressions of the overflow:hidden clipping bug
 * where the focus outline was invisible because the parent container
 * clipped it.
 */

test.describe('Episode Focus Indicator Regression Tests', () => {
  test('episode card should not have overflow hidden that clips the outline', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const episodeCard = page.locator('.episode-card').first()

    const cardStyles = await episodeCard.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        overflow: computed.overflow,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
      }
    })

    // Episode card should NOT have overflow:hidden
    // This would clip the focus outline with outline-offset
    expect(cardStyles.overflow).not.toBe('hidden')
    expect(cardStyles.overflowX).not.toBe('hidden')
    expect(cardStyles.overflowY).not.toBe('hidden')
  })

  test('episode link focus outline should be fully visible (not clipped)', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const episodeLink = page.locator('.episode-link').first()
    await episodeLink.focus()

    // Get both the link and its parent card styles
    const styles = await episodeLink.evaluate((el) => {
      const linkComputed = window.getComputedStyle(el)
      const cardComputed = window.getComputedStyle(el.closest('.episode-card')!)

      return {
        link: {
          outlineWidth: linkComputed.outlineWidth,
          outlineStyle: linkComputed.outlineStyle,
          outlineOffset: linkComputed.outlineOffset,
        },
        card: {
          overflow: cardComputed.overflow,
          position: cardComputed.position,
        },
      }
    })

    // Link should have visible outline
    expect(styles.link.outlineWidth).not.toBe('0px')
    expect(styles.link.outlineStyle).not.toBe('none')

    // If there's an outline offset, the card must not have overflow:hidden
    const outlineOffset = parseInt(styles.link.outlineOffset)
    if (outlineOffset > 0) {
      expect(styles.card.overflow).not.toBe('hidden')
    }
  })

  test('episode link focus outline should be visible in both light and dark modes', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark']) {
      await page.goto('/episodes/')
      await page.waitForLoadState('networkidle')

      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.setAttribute('data-theme-setting', 'dark')
          document.documentElement.setAttribute('data-theme', 'dark')
        })
        await page.waitForTimeout(100)
      }

      const episodeLink = page.locator('.episode-link').first()
      await episodeLink.focus()

      const styles = await episodeLink.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          outlineWidth: computed.outlineWidth,
          outlineStyle: computed.outlineStyle,
          outlineColor: computed.outlineColor,
          outlineOffset: computed.outlineOffset,
        }
      })

      // Should have visible outline in both themes
      expect(styles.outlineWidth).not.toBe('0px')
      expect(styles.outlineStyle).toBe('solid')
      expect(styles.outlineColor).not.toContain('rgba(0, 0, 0, 0)')

      // Should have offset (proves it's not clipped)
      const offset = parseInt(styles.outlineOffset)
      expect(offset).toBeGreaterThan(0)

      // Log colors for visual verification
      console.log(`${theme} mode outline color:`, styles.outlineColor)
    }
  })

  test('thumbnail should still have overflow hidden for image clipping', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const thumbnailWrapper = page.locator('.thumbnail-wrapper').first()

    const wrapperStyles = await thumbnailWrapper.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        overflow: computed.overflow,
        borderRadius: computed.borderRadius,
      }
    })

    // Thumbnail wrapper SHOULD have overflow:hidden to clip the image
    expect(wrapperStyles.overflow).toBe('hidden')

    // And should have border-radius for rounded corners
    expect(wrapperStyles.borderRadius).not.toBe('0px')
  })

  test('focus outline should be visible on episode cards on home page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const episodeLinks = await page.locator('.episode-link').all()

    if (episodeLinks.length > 0) {
      const firstLink = episodeLinks[0]
      await firstLink.focus()

      const hasFocusIndicator = await firstLink.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        const hasOutline =
          computed.outlineWidth !== '0px' && computed.outlineStyle !== 'none'
        const hasBoxShadow = computed.boxShadow !== 'none'

        return hasOutline || hasBoxShadow
      })

      expect(hasFocusIndicator).toBe(true)
    }
  })

  test('focus outline offset should not be clipped by parent containers', async ({
    page,
  }) => {
    await page.goto('/episodes/')
    await page.waitForLoadState('networkidle')

    const episodeLink = page.locator('.episode-link').first()
    await episodeLink.focus()

    // Check all ancestor elements don't have overflow:hidden
    const ancestorOverflows = await episodeLink.evaluate((el) => {
      const ancestors = []
      let current = el.parentElement

      while (current && current !== document.body) {
        const computed = window.getComputedStyle(current)
        if (computed.overflow === 'hidden') {
          ancestors.push({
            className: current.className,
            overflow: computed.overflow,
          })
        }
        current = current.parentElement
      }

      return ancestors
    })

    // Only the thumbnail-wrapper should have overflow:hidden
    // The episode-card and other ancestors should not
    const hasClippingAncestor = ancestorOverflows.some(
      (ancestor) => !ancestor.className.includes('thumbnail-wrapper')
    )

    expect(hasClippingAncestor).toBe(false)
  })
})
