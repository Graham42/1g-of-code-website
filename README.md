# 1g of Code

Companion website for the [1g of Code Twitch channel](https://twitch.tv/1gOfCode) — a show about coding and building with AI for beginners, hosted by Graham (experienced software engineer) and Kipper (common knowledge perspective).

## Quick Start

```bash
npm install
npm run dev
```

The site will be running at `http://localhost:4321`.

## Project Structure

```
src/
├── content/
│   └── episodes/           # Episode markdown files (YYYY-MM-DD.md)
├── pages/
│   ├── index.astro         # Home page
│   ├── about.astro         # About page
│   └── episodes/
│       ├── index.astro     # Episode listing
│       └── [slug].astro    # Individual episode pages
├── components/             # Reusable UI components
└── layouts/
    └── BaseLayout.astro    # Main page layout
```

## Adding Episodes

### Fetching Video Info from Twitch

Use the fetch script to get video metadata from the Twitch channel:

```bash
npm run fetch-videos
```

This outputs JSON with video details (title, URL, thumbnail, date) that can be used to create episode files. See `scripts/fetch-twitch-videos.cjs` for detailed usage instructions.

### Creating Episode Files

Create a new markdown file in `src/content/episodes/` named with the episode date:

```
src/content/episodes/2026-02-05.md
```

### Frontmatter

```yaml
---
title: 'Episode Title'
date: 2026-02-05
tags: [topic1, topic2]
twitchUrl: 'https://www.twitch.tv/videos/...'
twitchThumbnail: 'https://static-cdn.jtvnw.net/...'
youtubeUrl: 'https://www.youtube.com/watch?v=...' # optional
---
```

### Content Structure

Episodes typically include:

- **Episode Notes** — Summary and key takeaways
- **Topics Covered** — Bullet list of what was discussed
- **Code Examples** — Fenced code blocks with language syntax
- **Resources** — Links to tools, docs, and references

Code blocks automatically get syntax highlighting:

````markdown
```typescript
const greeting: string = 'Hello, world!'
```
````

## Development

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start dev server at `localhost:4321` |
| `npm run build`        | Build for production to `./dist/`    |
| `npm run preview`      | Preview production build locally     |
| `npm test`             | Run Playwright E2E tests             |
| `npm run test:ui`      | Run tests with interactive UI        |
| `npm run fetch-videos` | Fetch video info from Twitch channel |

### First-Time Setup

After `npm install`, install Playwright browsers:

```bash
npx playwright install chromium firefox
```

## Testing

The project uses Playwright for end-to-end testing. Tests cover:

- Page rendering and navigation
- Episode listing and detail pages
- Code block syntax highlighting
- Responsive layouts (mobile, tablet, desktop)
- Theme toggle functionality

Run tests:

```bash
npm test              # Headless
npm run test:ui       # Interactive mode
```

## Styling

The site uses CSS custom properties for theming with light/dark mode support. Theme preference is persisted in localStorage and respects system preferences as a fallback.

Key design decisions:

- Mobile-first responsive design
- Scoped component styles (no external CSS framework)
- Minimal client-side JavaScript

## Deployment

The site deploys to Netlify automatically. Configuration is in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 24

## Feedback & Contributions

Have questions, ideas, or found a bug? [Open an issue on GitHub](https://github.com/graham42/1g-of-code/issues).

## Tech Stack

- [Astro](https://astro.build) — Static site framework
- [Playwright](https://playwright.dev) — E2E testing
- [Netlify](https://netlify.com) — Hosting
