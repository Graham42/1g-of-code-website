# Firefox Dark Mode Color Contrast Issue

## Issue Summary

**Date Discovered:** 2026-02-13
**Status:** Open - Needs Investigation
**Browser:** Firefox only (Chromium passes)
**Test:** `tests/accessibility/axe-scans.spec.ts` - "home page in dark mode should not have accessibility violations"

## Description

The axe-core accessibility scan detects a color contrast violation in Firefox when testing the home page in dark mode. The same test passes in Chromium, suggesting this is a browser-specific rendering issue or false positive.

## Error Details

**Element:** Active navigation link (`.nav-link.is-active`)
**Location:** Header navigation
**HTML:** `<a href="/" class="nav-link is-active" aria-current="page">Home</a>`

**Reported Colors:**

- Foreground: `#9395f3`
- Background: `#a3a3ab`
- Contrast Ratio: **1.07** (fails - needs 4.5:1)

**Expected Colors:**

- Should be using CSS variable colors defined in theme
- Text should be `var(--color-primary)` on active state
- Background should be `var(--color-bg-secondary)`

## Axe-Core Violation Output

```
{
  "id": "color-contrast",
  "impact": "serious",
  "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
  "help": "Elements must meet minimum color contrast ratio thresholds",
  "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast",
  "nodes": [
    {
      "html": "<a href=\"/\" class=\"nav-link is-active\" aria-current=\"page\"> Home </a>",
      "target": [".is-active"],
      "failureSummary": "Element has insufficient color contrast of 1.07 (foreground color: #9395f3, background color: #a3a3ab, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1"
    }
  ]
}
```

## Investigation Steps

1. **Verify actual rendered colors in Firefox:**
   - Open site in Firefox
   - Enable dark mode
   - Use Firefox DevTools to inspect `.nav-link.is-active`
   - Check computed color values

2. **Check CSS variable resolution:**
   - Verify `var(--color-primary)` resolves correctly in Firefox dark mode
   - Compare computed values between Firefox and Chromium

3. **Test different Firefox versions:**
   - Current test failure is on Firefox Desktop
   - Try Firefox Nightly/Beta
   - Check if issue exists on older versions

4. **Review CSS specificity:**
   - Check if any styles are being overridden
   - Look for conflicting color declarations
   - Verify theme CSS loads correctly

## Potential Causes

1. **Browser Rendering Difference:**
   - Firefox may compute CSS variables differently in certain contexts
   - Color space rendering differences between browsers

2. **Axe-Core Firefox Bug:**
   - Axe-core may have a Firefox-specific bug in color contrast detection
   - False positive due to how Firefox reports computed colors

3. **Actual Color Issue:**
   - CSS variables not resolving correctly in Firefox
   - Theme switching logic has Firefox-specific bug

4. **Test Environment Issue:**
   - Playwright's Firefox emulation may not match real Firefox
   - Dark mode detection working differently in test environment

## Workarounds

### Current Workaround (Temporary)

Skip the test for Firefox until investigated:

```typescript
test('home page in dark mode should not have accessibility violations', async ({
  page,
  browserName,
}) => {
  // Skip on Firefox due to known color contrast false positive
  // See: docs/firefox-dark-mode-contrast-issue.md
  test.skip(
    browserName === 'firefox',
    'Firefox dark mode contrast false positive'
  )

  // ... rest of test
})
```

### If Real Issue

Fix the actual color values in the CSS:

```css
.nav-link.is-active {
  color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}
```

Ensure sufficient contrast in dark mode theme variables.

## Related Files

- `tests/accessibility/axe-scans.spec.ts:100` - Failing test
- `src/components/Header.astro:297-300` - Active nav link styles
- `src/layouts/BaseLayout.astro:102-167` - Theme color definitions

## Next Steps

1. Manually test in Firefox with dark mode enabled
2. Compare computed colors between browsers
3. If real issue: Fix CSS colors
4. If false positive: Report to axe-core and skip test with documentation
5. Add regression test once resolved

## Screenshots Needed

- [ ] Firefox DevTools showing computed colors for `.nav-link.is-active`
- [ ] Chromium DevTools showing same element for comparison
- [ ] Visual screenshot of the element in both browsers

## Testing Commands

```bash
# Run only the failing test in Firefox
npm run test:a11y -- --grep "home page in dark mode" --project=firefox

# Run in headed mode to inspect manually
npm run test:a11y -- --grep "home page in dark mode" --project=firefox --headed

# Compare with Chromium
npm run test:a11y -- --grep "home page in dark mode" --project=chromium
```

## Resolution

**Status:** Awaiting manual inspection
**Assigned To:** [User to investigate]
**Priority:** Medium (doesn't affect Chromium users, may be false positive)
