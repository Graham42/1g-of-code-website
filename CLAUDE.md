After making code changes, before committing, run `bun run format -- .` and the relevant tests.

## Running tests

All tests are Playwright-based. The dev server starts automatically via `webServer` in playwright.config.ts — no need to run `astro dev` separately.

| Command                      | When to use                                     |
| ---------------------------- | ----------------------------------------------- |
| `bun run test:a11y`          | Any HTML/CSS/component change                   |
| `bun run test:a11y:axe`      | Quick axe-core WCAG scan only                   |
| `bun run test:a11y:keyboard` | Keyboard nav / focus order changes              |
| `bun run test:a11y:focus`    | Focus indicator / overflow changes              |
| `bun run typecheck`          | Any TypeScript change                           |
| `bun run test`               | Full suite (all Playwright tests, all browsers) |

## References

- If the user asks you to update the episodes reference docs/episode-content-pipeline.md
- Branding and design system reference: docs/branding.md
