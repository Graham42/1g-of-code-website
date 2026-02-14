# Accessibility Testing Implementation Plan

## Overview

This document provides a comprehensive plan for implementing automated accessibility testing for the 1g of Code website. The plan uses a layered approach combining axe-core scanning, keyboard navigation testing, accessibility tree validation, and computed style checks.

**Goals:**

- Achieve 75-80% automation coverage for accessibility testing
- Catch regressions before they reach production
- Provide fast feedback in CI/CD pipeline
- Minimize manual testing burden while maintaining quality

**Technologies:**

- @axe-core/playwright - Automated WCAG rule scanning
- Playwright - Keyboard testing, accessibility tree validation, computed styles
- Existing Playwright infrastructure (already configured)

---

## Phase 1: Dependencies and Setup

### 1.1 Install Dependencies

**Package to install:**

```bash
npm install --save-dev @axe-core/playwright
```

**Why:**

- @axe-core/playwright integrates the industry-standard axe-core accessibility scanner with Playwright
- Detects ~57% of WCAG issues automatically
- Zero configuration needed, works out of the box
- Actively maintained by Deque Systems (accessibility experts)

**What NOT to install:**

- No additional browser drivers needed (already have Playwright)
- No separate axe-core package (playwright version includes it)
- No screenshot comparison tools yet (using computed styles first)

### 1.2 Test Organization Structure

**Create new directory structure:**

```
tests/
├── accessibility/
│   ├── axe-scans.spec.ts           # Layer 1: Axe-core scanning all pages
│   ├── keyboard-navigation.spec.ts  # Layer 2: Keyboard interaction tests
│   ├── accessibility-tree.spec.ts   # Layer 3: A11y tree validation
│   └── focus-indicators.spec.ts     # Layer 4: Focus state computed styles
├── episodes.spec.ts                 # (existing)
├── home.spec.ts                     # (existing)
├── navigation.spec.ts               # (existing)
├── responsive.spec.ts               # (existing)
└── theme.spec.ts                    # (existing)
```

**Why this structure:**

- Separates accessibility tests from functional tests
- Each layer has distinct purpose and failure modes
- Easy to run accessibility suite separately (`npx playwright test tests/accessibility`)
- Clear ownership for different test types

### 1.3 Update package.json Scripts

**Add new npm scripts:**

```json
{
  "test:a11y": "playwright test tests/accessibility",
  "test:a11y:ui": "playwright test tests/accessibility --ui",
  "test:a11y:axe": "playwright test tests/accessibility/axe-scans.spec.ts",
  "test:a11y:keyboard": "playwright test tests/accessibility/keyboard-navigation.spec.ts"
}
```

**Why:**

- Convenient shortcuts for running accessibility tests
- Allows running specific test layers during development
- Clear naming for CI/CD integration

### 1.4 Playwright Configuration Updates (Optional)

**No changes needed to playwright.config.ts** - Current configuration already suitable:

- ✓ baseURL configured
- ✓ Screenshots on failure enabled
- ✓ Chromium and Firefox configured (good cross-browser coverage)
- ✓ Parallel execution enabled

**Future consideration:**

- Could add a dedicated "a11y" project with specific viewport/color scheme if needed
- For now, use existing projects

---

## Phase 2: Layer 1 - Axe-Core Scanning

### 2.1 Create axe-scans.spec.ts

**Purpose:**
Scan all pages for automated WCAG violations using axe-core.

**Pages to scan:**

1. Home page (/)
2. Episodes listing (/episodes/)
3. Individual episode pages (/episodes/2026-01-05, /episodes/2026-01-19, etc.)
4. About page (/about/)
5. 404 page (/404)

**Test structure:**

- One test per page type
- Use AxeBuilder from @axe-core/playwright
- Assert zero violations
- Configure axe to check against WCAG 2.1 Level AA

**What this catches:**

- Color contrast violations (4.5:1 for text, 3:1 for large text)
- Missing alt text on images
- Invalid ARIA attributes
- Missing form labels
- Incorrect heading hierarchy
- Missing page language
- Duplicate IDs
- Invalid HTML structure
- Missing landmark regions

**Implementation details:**

**Basic structure for each test:**

1. Navigate to page
2. Wait for page to be fully loaded (important for dynamic content)
3. Run axe scan with AxeBuilder
4. Assert violations array is empty
5. On failure, log detailed violation information (selector, help text, impact)

**For episode pages:**

- Need to test at least 2 different episodes (verify template works)
- Use actual episode slugs from content/episodes/\*.md
- Don't need to test ALL episodes (template is same), 2-3 is sufficient

**Axe configuration:**

- Target WCAG 2.1 Level AA (industry standard)
- Include best-practices (catches common issues beyond WCAG)
- Exclude experimental rules (reduce false positives)

**Expected violations to fix before tests pass:**

- Likely none - codebase already has good accessibility practices
- Possible: some contrast issues in code blocks or specific color combinations
- Possible: missing alt text on episode thumbnails

### 2.2 Handling Dynamic Content

**Challenge:**
Axe scans the page as it exists at scan time. For components with multiple states (theme toggle, mobile menu), need to test different states.

**Strategy for multi-state components:**

**Theme Toggle:**

- Test in all three states: light, dark, system
- Axe scan can verify icons have aria-hidden="true"
- Verify button has accessible name in each state

**Mobile Menu:**

- Test both closed and open states
- When open, verify menu items are accessible
- When closed, verify hidden content is properly hidden (display:none or aria-hidden)

**Implementation approach:**

1. Test default state first (quick check)
2. Add separate tests for alternate states
3. Example: "home page in dark mode" as separate test

---

## Phase 3: Layer 2 - Keyboard Navigation Testing

### 3.1 Create keyboard-navigation.spec.ts

**Purpose:**
Verify all interactive elements are keyboard accessible and focus order is logical.

**What to test:**

#### 3.1.1 Basic Keyboard Accessibility

**Tab Order Test:**

1. Start at home page
2. Press Tab repeatedly, tracking which elements receive focus
3. Verify order matches expected logical flow
4. Verify no elements are skipped
5. Verify all interactive elements can be reached

**Expected tab order for header (desktop):**

1. Skip link (becomes visible on focus)
2. Logo link
3. Home nav link
4. Episodes nav link
5. About nav link
6. Twitch link
7. Theme toggle button

**Expected tab order for header (mobile, width: 375px):**

1. Skip link
2. Logo link
3. Theme toggle button
4. Nav toggle button (hamburger)
5. (When menu open): Nav links in order

**Implementation approach:**

- Use `page.keyboard.press('Tab')` to move focus
- Use `page.locator(':focus')` to get currently focused element
- Compare to expected element
- Build helper function to get tab order programmatically

#### 3.1.2 Skip Link Functionality

**Test: Skip link works correctly**

1. Navigate to home page
2. Press Tab once (should focus skip link)
3. Verify skip link is visible (not display:none, not off-screen)
4. Press Enter
5. Verify focus moved to #main-content
6. Verify main content is now in viewport

**Why important:**

- Critical for screen reader users to bypass navigation
- Already implemented in BaseLayout.astro:258-272
- Easy to accidentally break with CSS changes

**Implementation notes:**

- Check computed styles to verify visibility on focus
- Use `page.locator('#main-content').evaluate(el => el === document.activeElement)` to verify focus

#### 3.1.3 Theme Toggle Keyboard Operation

**Test: Theme toggle works with keyboard**

1. Navigate to page
2. Tab to theme toggle button
3. Verify it receives visible focus
4. Press Enter
5. Verify theme changes (check data-theme attribute)
6. Verify aria-label updates
7. Press Space (alternate activation key)
8. Verify theme changes again

**Why important:**

- Custom interactive element (not default browser behavior)
- Must support both Enter and Space for buttons
- Already implemented but should be tested to prevent regression

**Edge case to test:**

- Tab to theme toggle
- Press Escape (should NOT activate, should do nothing)
- Press random keys like 'a' or 'x' (should NOT activate)

#### 3.1.4 Mobile Menu Keyboard Operation

**Test: Mobile menu is keyboard accessible**

1. Set viewport to mobile size (375x667)
2. Tab to hamburger button
3. Press Enter to open menu
4. Verify aria-expanded="true"
5. Verify menu is visible
6. Press Tab - focus should move into menu
7. Tab through all menu items
8. Press Escape
9. Verify menu closes (aria-expanded="false")
10. Verify focus returns to hamburger button

**Why important:**

- Complex interactive component with focus management
- Common source of keyboard traps
- Already has good implementation (Header.astro:62-97) but needs testing

**Additional test: Click outside to close**

1. Open menu with keyboard
2. Tab past menu items to next focusable element (theme toggle)
3. Verify menu closes (current implementation closes on click outside)
4. Note: This may need enhancement - clicking outside is not the same as tabbing outside

#### 3.1.5 No Keyboard Traps

**Test: Can tab through entire page without getting stuck**

1. Navigate to page
2. Tab through ALL elements until focus cycles back to browser chrome
3. Count number of tab stops
4. Shift+Tab backward through all elements
5. Verify same elements in reverse order
6. Verify no infinite loops
7. Verify focus never gets stuck

**Implementation approach:**

- Track focused elements in array
- Detect when focus cycles (returns to first element or browser chrome)
- Verify count matches expected interactive elements
- Timeout after reasonable number of tabs (e.g., 50) to catch infinite loops

#### 3.1.6 No Positive Tabindex Values

**Test: No elements have positive tabindex**

1. Query all elements with tabindex attribute
2. Filter to those with positive values (tabindex="1", tabindex="2", etc.)
3. Assert list is empty

**Why:**

- Positive tabindex is anti-pattern (disrupts natural tab order)
- Should only use tabindex="0" (normal order) or tabindex="-1" (programmatic focus only)
- Easy to accidentally introduce

**Implementation:**

```typescript
const positiveTabindex = await page
  .locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')
  .all()
expect(positiveTabindex.length).toBe(0)
```

### 3.2 Keyboard Shortcuts Testing

**Test: Escape key closes overlays**

- Open mobile menu → Press Escape → Verify closed
- (Future: modals, dropdowns, etc.)

**Test: Arrow keys work where expected**

- Currently no arrow key interactions
- Document this for future components (tabs, carousels, etc.)

### 3.3 Helper Functions to Create

**getTabOrder(page):**

- Tabs through entire page
- Returns array of selectors in focus order
- Used to compare against expected order

**focusElement(page, selector):**

- Focuses element by selector
- Verifies focus actually moved
- Returns focused element

**verifyFocusVisible(page, selector):**

- Focuses element
- Checks computed styles for outline/box-shadow
- Verifies focus indicator is visible

---

## Phase 4: Layer 3 - Accessibility Tree Validation

### 4.1 Create accessibility-tree.spec.ts

**Purpose:**
Validate what screen readers will "see" without running actual screen readers.

**What to test:**

#### 4.1.1 Landmark Structure

**Test: Page has proper landmark regions**

1. Get accessibility tree snapshot
2. Verify presence of landmarks:
   - `banner` (header with site-header class)
   - `navigation` (nav with id="primary-nav")
   - `main` (main with id="main-content")
   - `contentinfo` (footer with site-footer class)

**Why:**

- Screen readers use landmarks for navigation
- "Navigate by landmark" is common screen reader feature
- HTML5 semantic elements automatically create landmarks

**Implementation approach:**

```typescript
const snapshot = await page.accessibility.snapshot()
const landmarks = findLandmarks(snapshot) // helper function
expect(landmarks).toContain('banner')
expect(landmarks).toContain('navigation')
expect(landmarks).toContain('main')
expect(landmarks).toContain('contentinfo')
```

**Helper function needed:**

- `findLandmarks(snapshot)` - Recursively walk tree finding role="banner", role="navigation", etc.

#### 4.1.2 Interactive Elements Have Accessible Names

**Test: All buttons and links have accessible names**

1. Get accessibility tree snapshot
2. Find all nodes with role="button" or role="link"
3. For each, verify `name` property exists and is non-empty
4. Verify name is descriptive (not just "button" or "link")

**Elements to specifically verify:**

**Theme toggle button:**

- Role: "button"
- Name: Should include current state ("Light mode (click for dark)")
- Name should update when theme changes

**Nav toggle (hamburger):**

- Role: "button"
- Name: "Toggle navigation menu" (from aria-label)
- State: aria-expanded should be reflected

**Logo link:**

- Role: "link"
- Name: "1g of Code - Home" (from aria-label)

**Nav links:**

- Role: "link"
- Name: "Home", "Episodes", "About" (from text content)
- Current page should have additional state (aria-current="page")

**Twitch link:**

- Role: "link"
- Name: "Watch on Twitch" (from aria-label)

**Implementation approach:**

```typescript
const snapshot = await page.accessibility.snapshot()
const buttons = findByRole(snapshot, 'button')
buttons.forEach((button) => {
  expect(button.name).toBeTruthy()
  expect(button.name).not.toBe('button') // Not just default
})
```

#### 4.1.3 Heading Hierarchy

**Test: Headings form logical hierarchy**

1. Get accessibility tree snapshot
2. Extract all heading nodes (role="heading")
3. Each has level property (1-6)
4. Verify no skipped levels (h1 → h2 → h3, not h1 → h3)
5. Verify only one h1 per page

**Expected structure for home page:**

- h1: "1g of Code" (hero title)
- h2+: Section headings

**Expected structure for episodes page:**

- h1: "All Episodes"
- h2: Episode titles (in episode cards)

**Expected structure for individual episode:**

- h1: Episode title
- h2: Section headings within episode content

**Implementation approach:**

```typescript
const headings = findByRole(snapshot, 'heading')
const levels = headings.map((h) => h.level)

// Only one h1
const h1Count = levels.filter((l) => l === 1).length
expect(h1Count).toBe(1)

// No skipped levels
for (let i = 1; i < levels.length; i++) {
  const diff = levels[i] - levels[i - 1]
  expect(diff).toBeLessThanOrEqual(1) // Can go up 1 or stay same or go down any amount
}
```

#### 4.1.4 List Structure

**Test: Lists are properly structured**

1. Get accessibility tree snapshot
2. Find nodes with role="list"
3. Verify children have role="listitem"

**Lists in the site:**

- Navigation links (nav-list in Header.astro has role="list")
- Episode listing (grid of episodes)
- Footer links

**Why:**

- Screen readers announce "list of X items"
- Helps users understand structure
- CSS can remove bullets while maintaining semantic list

**Note on current implementation:**
Header.astro:21 explicitly sets role="list" on nav-list because global CSS (BaseLayout.astro:248-251) sets `list-style: none` which can remove implicit list semantics in Safari.

#### 4.1.5 ARIA State Communication

**Test: Interactive elements communicate state**

**Theme toggle:**

- After opening, verify button reflects current theme in accessible name
- No aria-expanded (not needed for this pattern)

**Nav toggle:**

- When closed: aria-expanded="false"
- When open: aria-expanded="true"
- Both states should be reflected in accessibility tree

**Current page in navigation:**

- Active nav link should have aria-current="page"
- Should be announced as "current page" by screen readers

**Implementation:**

```typescript
// Open mobile menu
await page.click('.nav-toggle')
const navToggle = await page.accessibility.snapshot({ selector: '.nav-toggle' })
expect(navToggle.expanded).toBe(true)

// Close menu
await page.keyboard.press('Escape')
const navToggleClosed = await page.accessibility.snapshot({
  selector: '.nav-toggle',
})
expect(navToggleClosed.expanded).toBe(false)
```

#### 4.1.6 Hidden Content

**Test: Decorative elements are hidden from screen readers**

**Icons with aria-hidden="true":**

- SVG icons in theme toggle (sun, moon, system icons)
- Twitch icon in header
- Hamburger icon (the visual bars)

**Verify these do NOT appear in accessibility tree:**

```typescript
const snapshot = await page.accessibility.snapshot()
// Should not find nodes for decorative icons
// Only the buttons/links containing them should appear
```

**Mobile menu when closed:**

- When display:none or hidden, should not be in accessibility tree
- When visible, should be in tree

### 4.2 Helper Functions to Create

**findLandmarks(snapshot):**

- Recursively walk accessibility tree
- Return array of landmark roles found

**findByRole(snapshot, role):**

- Recursively walk tree
- Return all nodes with matching role

**getHeadingStructure(snapshot):**

- Find all headings
- Return array of levels in document order

**hasAccessibleName(node):**

- Check if node has name property
- Verify it's non-empty and meaningful

---

## Phase 5: Layer 4 - Focus Indicator Testing

### 5.1 Create focus-indicators.spec.ts

**Purpose:**
Verify all interactive elements have visible focus indicators using computed styles.

**Why computed styles instead of screenshots:**

- More reliable across environments (no font rendering differences)
- Faster execution
- Clearer failure messages
- Works consistently in CI/CD
- Can check specific CSS properties

**What to test:**

#### 5.1.1 Global Focus Indicator Test

**Test: All interactive elements have focus outlines**

1. Navigate to page
2. Query all interactive elements: `a, button, input, select, textarea, [tabindex="0"]`
3. For each element:
   - Focus it
   - Check computed styles
   - Verify outline or box-shadow exists
   - Verify it's not transparent
   - Verify it's not 0px

**Implementation approach:**

```typescript
const interactiveElements = await page
  .locator('a, button, input, select, textarea, [tabindex="0"]')
  .all()

for (const element of interactiveElements) {
  await element.focus()

  const styles = await element.evaluate((el) => {
    const computed = window.getComputedStyle(el)
    return {
      outlineWidth: computed.outlineWidth,
      outlineStyle: computed.outlineStyle,
      outlineColor: computed.outlineColor,
      boxShadow: computed.boxShadow,
    }
  })

  // Check outline exists OR box-shadow exists
  const hasOutline =
    styles.outlineWidth !== '0px' &&
    styles.outlineStyle !== 'none' &&
    !styles.outlineColor.includes('rgba(0, 0, 0, 0)')

  const hasBoxShadow = styles.boxShadow !== 'none'

  expect(hasOutline || hasBoxShadow).toBe(true)
}
```

**Why check both outline and box-shadow:**

- Some designs use box-shadow instead of outline for aesthetics
- Current implementation uses outline (BaseLayout.astro:242-246)
- Future changes might use box-shadow

#### 5.1.2 Specific Component Focus Tests

**Test: Theme toggle has visible focus**

1. Focus theme toggle
2. Check computed styles
3. Verify outline matches expected (2px solid var(--color-primary))
4. Verify outline-offset is 2px

**Test: Nav links have visible focus**

1. Focus each nav link
2. Verify focus indicator
3. Verify it works in both mobile and desktop layouts

**Test: Logo has visible focus**

1. Focus logo
2. Verify focus indicator with gradient text (can still have outline)

#### 5.1.3 Focus in Both Themes

**Test: Focus indicators visible in light mode**

1. Set theme to light
2. Run focus indicator tests
3. Verify outline color has sufficient contrast against light background

**Test: Focus indicators visible in dark mode**

1. Set theme to dark
2. Run focus indicator tests
3. Verify outline color has sufficient contrast against dark background

**Why important:**

- Focus ring might be visible in one theme but not the other
- var(--color-primary) changes between themes
- Need to verify both

**Implementation approach:**

```typescript
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme-setting', t)
    document.documentElement.setAttribute('data-theme', t)
  }, theme)

  // Run focus tests for this theme
}
```

#### 5.1.4 Focus Offset Test

**Test: Focus indicators have sufficient offset**

1. Focus elements
2. Check outline-offset property
3. Verify it's at least 1px (or 2px per current design)

**Why:**

- Ensures focus ring doesn't overlap with element text/content
- Improves visibility
- Current implementation uses 2px (BaseLayout.astro:244)

#### 5.1.5 Focus Order Visual Verification (Optional Enhancement)

**Test: Focus order matches visual order**

1. Get bounding boxes of all interactive elements
2. Tab through elements
3. Verify focus moves in reading order (left-to-right, top-to-bottom)
4. Catch cases where CSS positioning breaks tab order

**Implementation approach:**

```typescript
const elements = await page.locator('a, button').all()
const positions = await Promise.all(
  elements.map(async (el) => {
    const box = await el.boundingBox()
    return { element: el, top: box.y, left: box.x }
  })
)

// Sort by visual position
const visualOrder = positions.sort((a, b) => {
  if (Math.abs(a.top - b.top) > 10) return a.top - b.top // Different rows
  return a.left - b.left // Same row
})

// Now tab through and verify order matches visualOrder
```

**Note:** This is complex and may have false positives. Consider as future enhancement.

### 5.2 Helper Functions to Create

**getFocusStyles(element):**

- Focus element
- Extract computed outline and box-shadow
- Return object with properties

**hasFocusIndicator(styles):**

- Given computed styles object
- Return boolean: does it have visible focus indicator?

**contrastRatio(color1, color2):**

- Calculate WCAG contrast ratio between two colors
- Used to verify focus indicator has sufficient contrast
- (Complex - may use existing library)

---

## Phase 6: Test Execution and CI/CD Integration

### 6.1 Running Tests Locally

**During development:**

```bash
# Run all accessibility tests
npm run test:a11y

# Run specific layer
npm run test:a11y:axe
npm run test:a11y:keyboard

# Run with UI (interactive debugging)
npm run test:a11y:ui

# Run all tests (including accessibility)
npm test
```

**What to expect:**

- Axe tests: Fast (<5s per page)
- Keyboard tests: Medium (~10s per test)
- A11y tree tests: Fast (<3s per test)
- Focus tests: Medium (~5-10s)
- Total suite: ~1-2 minutes

### 6.2 CI/CD Integration

**Update GitHub Actions workflow (if exists) or create new:**

```yaml
# .github/workflows/test.yml
- name: Run all tests
  run: npm test
# Accessibility tests are included in npm test
# No separate step needed unless you want to:
# - Run a11y tests on every PR
# - Skip functional tests on docs-only changes
# - Generate accessibility report
```

**Recommended: Fail build on accessibility violations**

- Any axe violations = build fails
- Any keyboard trap = build fails
- Missing focus indicators = build fails
- Optional: Generate HTML report of violations

**Store test results:**

- Playwright already generates HTML report
- Store as artifact in CI for review
- Useful for debugging failures

### 6.3 Pre-commit Hooks (Optional)

**Consider adding pre-commit hook:**

```bash
# Using husky or similar
npm run test:a11y:axe # Fast, catches most issues
```

**Pros:**

- Catches issues before commit
- Fast feedback loop

**Cons:**

- Requires dev server running
- Slows down commit process
- May frustrate developers

**Recommendation:** Start without pre-commit hooks, add later if needed.

---

## Phase 7: Handling Failures and Debugging

### 7.1 When Axe Tests Fail

**Axe will provide:**

- Violation rule ID (e.g., "color-contrast")
- Affected element selector
- Help URL with fix instructions
- Impact level (minor, moderate, serious, critical)

**Debugging approach:**

1. Check help URL for explanation
2. Inspect element in browser DevTools
3. Use browser's accessibility inspector
4. Fix issue
5. Re-run test

**Common violations and fixes:**

**Color contrast:**

- Lighten/darken colors
- Check in both themes
- Test tool: Chrome DevTools Accessibility panel

**Missing alt text:**

- Add alt="" for decorative images
- Add descriptive alt="..." for meaningful images
- Episode thumbnails likely need attention

**Invalid ARIA:**

- Remove unnecessary ARIA (prefer semantic HTML)
- Fix typos in ARIA attributes
- Check ARIA authoring practices guide

### 7.2 When Keyboard Tests Fail

**Common issues:**

**Element not focusable:**

- Check tabindex
- Check if element is visible
- Check if element is interactive

**Wrong tab order:**

- Check DOM order (tab order follows DOM, not visual layout)
- Check for positive tabindex values
- Check CSS positioning (floats, absolute, flex order)

**Keyboard trap:**

- Check event handlers
- Check if modal/overlay properly manages focus
- Check if Escape handler is working

**Debugging approach:**

1. Run test with --headed flag to see browser
2. Add --debug flag for step-by-step execution
3. Add `await page.pause()` in test to inspect manually
4. Check element's computed tabindex value

### 7.3 When A11y Tree Tests Fail

**Common issues:**

**Missing accessible name:**

- Add aria-label
- Add text content
- Add aria-labelledby pointing to visible label

**Wrong role:**

- Use semantic HTML (button not div)
- Remove incorrect role attribute
- Check if ARIA role is allowed on element

**Debugging approach:**

1. Use browser DevTools Accessibility panel
2. Inspect element's accessibility properties
3. Check Chrome's "Explore the accessibility tree" feature
4. Compare to working examples

### 7.4 When Focus Tests Fail

**Common issues:**

**Focus indicator removed by CSS:**

- Check for `outline: none` in CSS
- Check for `*:focus { outline: none }`
- Check for specificity issues overriding focus styles

**Focus indicator not visible:**

- Check contrast against background
- Check if z-index is hiding it
- Check if color is transparent

**Debugging approach:**

1. Focus element manually in browser
2. Inspect computed styles
3. Check Sources panel for CSS rules
4. Use "Computed" tab to see which rule is applied

---

## Phase 8: Ongoing Maintenance

### 8.1 When to Update Tests

**Add new tests when:**

- Adding new interactive components (modals, dropdowns, tabs)
- Adding new pages
- Implementing complex interactions
- Users report accessibility issues

**Update existing tests when:**

- Refactoring components (verify still accessible)
- Changing focus styles globally
- Updating theme colors (verify contrast still passes)
- Updating navigation structure

### 8.2 Quarterly Manual Accessibility Audit

**What automation can't catch:**

- Real screen reader experience
- Content quality (is alt text actually descriptive?)
- Logical reading order (is it sensible?)
- Complex user flows
- Edge cases in assistive tech

**Recommended schedule:**

- Automated tests: Every commit/PR
- Manual testing: Quarterly or before major releases
- User testing: Annually or when adding major features

### 8.3 Keeping Up with WCAG

**WCAG updates:**

- WCAG 2.2 released 2023 (new success criteria)
- WCAG 3.0 in development
- Axe-core updates regularly to support new criteria

**Maintenance plan:**

- Update @axe-core/playwright quarterly
- Review release notes for new rules
- Update tests to cover new criteria
- Check WCAG 2.2 compliance (may need manual checks)

---

## Phase 9: Success Metrics

### 9.1 Coverage Metrics

**Target metrics:**

- ✓ 100% of pages scanned with axe-core
- ✓ 100% of interactive components have keyboard tests
- ✓ 100% of interactive elements have focus indicator tests
- ✓ Zero axe violations in CI
- ✓ Zero keyboard traps
- ✓ All interactive elements have accessible names

### 9.2 Performance Metrics

**Test execution time targets:**

- Full accessibility suite: < 2 minutes
- Axe scans only: < 30 seconds
- Fast feedback for developers

**CI/CD impact:**

- Minimal addition to build time
- Parallelizable with other tests

### 9.3 Quality Metrics

**Accessibility scores:**

- Lighthouse accessibility score: 100
- axe-core violations: 0
- Manual testing checklist: 90%+ completion

---

## Phase 10: Implementation Order

### Recommended implementation sequence:

**Week 1: Foundation**

1. Install @axe-core/playwright
2. Create test directory structure
3. Add npm scripts
4. Create axe-scans.spec.ts
5. Run first scans, fix any violations
6. Get tests passing in CI

**Week 2: Keyboard Testing**

1. Create keyboard-navigation.spec.ts
2. Implement tab order tests
3. Implement skip link tests
4. Implement theme toggle keyboard tests
5. Implement mobile menu keyboard tests
6. Fix any issues found

**Week 3: A11y Tree & Focus**

1. Create accessibility-tree.spec.ts
2. Implement landmark tests
3. Implement accessible name tests
4. Implement heading hierarchy tests
5. Create focus-indicators.spec.ts
6. Implement computed style tests
7. Test in both themes

**Week 4: Polish & Documentation**

1. Write helper functions
2. Document debugging approaches
3. Create manual testing checklist
4. Train team on running tests
5. Add to PR template/checklist

### Minimum Viable Product (MVP)

**If time-constrained, implement in this order:**

**Priority 1 (Week 1):**

- Axe scans on all pages
- Basic keyboard navigation (tab order, skip link)

**Priority 2 (Week 2):**

- Accessible name validation
- Focus indicator computed style tests

**Priority 3 (Later):**

- Full accessibility tree tests
- Advanced keyboard tests
- Visual regression (if needed)

---

## Phase 11: Edge Cases and Special Considerations

### 11.1 Episode Content Accessibility

**Challenge:**
Episode content is markdown, user-generated.

**Tests to add:**

- Verify code blocks have proper labels
- Verify links in content are descriptive
- Verify images in content have alt text
- Verify heading hierarchy in markdown content

**Strategy:**

- Axe will catch most issues
- Add specific test for episode content structure
- Consider adding markdown linting rules

### 11.2 Embedded Content

**Challenge:**
Twitch embeds, YouTube links (future)

**Considerations:**

- Embedded iframes must have title
- Video controls must be keyboard accessible
- Transcripts/captions needed (WCAG AAA)

**Tests:**

- Verify iframe has title attribute
- Verify video player is keyboard accessible (if embedded)

### 11.3 Client-Side Routing

**Current state:**

- Astro uses standard navigation (no client-side routing)
- Page loads are full page loads

**If adding View Transitions (future):**

- Verify focus management during transitions
- Verify announcements to screen readers
- Verify skip link still works

### 11.4 Third-Party Scripts

**Current:**

- Minimal JavaScript
- No analytics, ads, etc.

**If adding:**

- Verify they don't interfere with accessibility
- Verify they don't create keyboard traps
- Test with script blockers (some users block scripts)

---

## Phase 12: Documentation for Developers

### 12.1 README Updates

**Add to main README.md:**

- Link to this implementation plan
- Link to code review guidelines
- Mention accessibility is tested
- Link to manual testing checklist

### 12.2 Contributing Guide

**Add accessibility section:**

- All new interactive components need keyboard tests
- Run `npm run test:a11y` before submitting PR
- Check both light and dark themes
- Verify focus indicators are visible

### 12.3 Component Documentation

**For each new component, document:**

- Expected keyboard interactions
- ARIA patterns used
- Screen reader behavior
- Focus management

---

## Appendix A: Expected Test Count

**axe-scans.spec.ts:** ~6 tests

- Home page scan
- Episodes listing scan
- Individual episode scan (2 episodes)
- About page scan
- 404 page scan
- Dark mode scan (one page as example)

**keyboard-navigation.spec.ts:** ~10 tests

- Skip link works
- Tab order (header, desktop)
- Tab order (header, mobile)
- Theme toggle keyboard
- Mobile menu open/close with keyboard
- Escape closes menu
- No keyboard traps (multiple pages)
- No positive tabindex
- Navigation links keyboard accessible

**accessibility-tree.spec.ts:** ~8 tests

- Landmarks present
- Buttons have accessible names
- Links have accessible names
- Heading hierarchy valid
- Lists properly structured
- Theme toggle state in tree
- Nav toggle expanded state in tree
- Hidden content not in tree

**focus-indicators.spec.ts:** ~6 tests

- All interactive elements have focus indicators
- Theme toggle focus visible
- Nav links focus visible
- Focus visible in light mode
- Focus visible in dark mode
- Focus offset sufficient

**Total:** ~30 automated accessibility tests

**Execution time:** ~1-2 minutes total

**Maintenance:** ~1-2 hours per quarter to update

---

## Appendix B: Resources and References

**Tools:**

- [axe-core documentation](https://github.com/dequelabs/axe-core)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

**Standards:**

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)

**Testing guides:**

- [Keyboard testing guide](https://webaim.org/articles/keyboard/)
- [Screen reader testing guide](https://webaim.org/articles/screenreader_testing/)
- [Focus management patterns](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

---

## Appendix C: Common Questions

**Q: Why not use Lighthouse instead of axe-core?**
A: Lighthouse uses axe-core under the hood. Direct axe integration gives more control and better error messages.

**Q: Should we test with actual screen readers?**
A: Eventually yes, but automated a11y tree testing gets you 60-70% there. Manual screen reader testing quarterly is recommended.

**Q: What about mobile testing?**
A: Current tests use mobile viewports. For touch-specific testing, use Playwright's mobile emulation with touch events.

**Q: How do we test focus on touch devices?**
A: Touch devices don't have visual focus indicators (no cursor). Test with keyboard connected to tablet, or use desktop with responsive mode.

**Q: What if tests are flaky?**
A: Accessibility tests should be stable. If flaky, likely waiting for elements. Add explicit waits before assertions.

**Q: Can we auto-fix violations?**
A: Some violations have automated fixes. Axe can suggest fixes, but human judgment needed. Don't auto-apply fixes without review.

---

## Next Steps for Implementation

**For implementing agent:**

1. **Start with Phase 1:** Install @axe-core/playwright, create directory structure
2. **Implement axe-scans.spec.ts first:** Get quick wins, establish baseline
3. **Fix any violations found:** Before moving to next phase
4. **Implement keyboard tests next:** Most impactful for UX
5. **Add a11y tree and focus tests:** Complete the coverage
6. **Document findings:** Update this plan with any discoveries

**Key principles:**

- Start simple, iterate
- Fix issues as you find them
- Don't skip fixing violations to move faster
- Each test should be independent and parallelizable
- Use descriptive test names
- Add comments explaining "why" for non-obvious tests

**Success criteria:**

- All tests passing
- Zero axe violations
- All interactive elements keyboard accessible
- All focus indicators visible
- Tests run in < 2 minutes
- Tests integrated in CI/CD
