# Code Review Guidelines

## Overview

This document outlines code review practices for the 1g of Code project, with emphasis on accessibility, maintainability, and quality.

## Manual Code Review Checklist

### Accessibility

When reviewing changes that affect UI:

- [ ] Interactive elements have keyboard handlers (Enter/Space for custom buttons)
- [ ] New buttons/links have accessible names (aria-label or text content)
- [ ] ARIA attributes used correctly and sparingly (prefer semantic HTML)
- [ ] Focus management handled for modals, menus, dialogs
- [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- [ ] Focus indicators visible on all interactive elements
- [ ] Heading hierarchy maintained (no skipped levels)
- [ ] Images have alt text (descriptive or empty for decorative)
- [ ] Forms have proper labels associated with inputs
- [ ] Dynamic content changes announced to screen readers (live regions when needed)

### Code Quality

- [ ] Code follows existing patterns and conventions
- [ ] No unnecessary complexity or over-engineering
- [ ] Tests added for new functionality
- [ ] No security vulnerabilities (XSS, injection, etc.)
- [ ] Performance considered (lazy loading, code splitting where appropriate)
- [ ] Mobile responsive (tested at various viewport sizes)

### Astro-Specific

- [ ] Components use scoped styles where possible
- [ ] Client-side JavaScript minimized (prefer static generation)
- [ ] Proper use of Astro.props types
- [ ] Image optimization using Astro's image component when applicable

## Automated Code Review with AI Agents

### Current State

AI-powered code review can supplement manual review by catching common accessibility and quality issues before human review.

### Potential AI Agent Review Capabilities

An AI agent could automatically review pull requests for:

#### Accessibility Concerns

- **Keyboard Accessibility**: Detect new interactive elements without keyboard event handlers
- **ARIA Usage**: Flag incorrect or unnecessary ARIA attributes
- **Semantic HTML**: Suggest semantic elements over div/span with roles
- **Focus Management**: Identify modals/overlays without focus trapping
- **Accessible Names**: Find buttons/links without text or aria-label
- **Color Contrast**: Analyze new CSS for potential contrast issues
- **Heading Structure**: Verify heading hierarchy isn't broken

#### Code Quality

- **Complexity Analysis**: Flag overly complex functions or components
- **Pattern Consistency**: Ensure new code follows existing patterns
- **Dead Code**: Identify unused imports, variables, or functions
- **Type Safety**: Check TypeScript usage and type coverage
- **Performance**: Identify potential performance issues (large bundles, render blocking)

#### Testing Coverage

- **Missing Tests**: Flag new features without corresponding tests
- **Test Quality**: Suggest improvements to test coverage and assertions
- **Accessibility Tests**: Recommend specific a11y tests for new UI components

### Implementation Considerations

**Benefits:**

- Catches issues before manual review, saving reviewer time
- Provides learning opportunities for contributors
- Consistent application of standards
- Can run on every commit/PR automatically

**Limitations:**

- AI cannot fully understand context or user intent
- May suggest changes that don't fit project goals
- Requires human judgment to accept/reject suggestions
- Should augment, not replace, human code review

**Recommended Approach:**

1. Start with specific, well-defined checks (accessibility, patterns)
2. Configure AI agent to comment on PRs, not auto-commit
3. Track false positives and refine over time
4. Use as educational tool for team learning
5. Keep human review as final gate

### Tools to Explore

- **GitHub Copilot Workspace** - AI-powered code review suggestions
- **Custom AI Agents** - Using Claude or similar to review code against project-specific guidelines
- **Danger.js + AI** - Automated PR checks enhanced with AI analysis
- **Prettier + ESLint** - Automated code formatting and linting (non-AI baseline)

### Future Enhancements

As AI code review tools mature, consider:

- Automatic accessibility test generation for new components
- Suggested fixes for common issues (not just detection)
- Learning from accepted/rejected suggestions to improve accuracy
- Integration with accessibility tree analysis
- Automatic compliance documentation generation

## Review Process

### For Reviewers

1. Run automated checks first (CI/CD, linting, tests)
2. Review AI agent feedback (when implemented)
3. Manual review using checklists above
4. Test locally for complex changes
5. Verify accessibility with keyboard navigation
6. Check responsive design at multiple screen sizes

### For Authors

Before requesting review:

1. Self-review using these guidelines
2. Run tests locally (`npm test`)
3. Test keyboard navigation manually
4. Verify changes in both light and dark themes
5. Check responsive behavior (mobile, tablet, desktop)
6. Add tests for new functionality
7. Update documentation if needed

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Astro Documentation](https://docs.astro.build/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
