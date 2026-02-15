# Episode Content Pipeline

How episodes go from Twitch VODs to optimized pages on the site.

## Data Flow

```
Twitch channel page
  -> scripts/fetch-twitch-videos.cjs (Playwright scrape + thumbnail download)
  -> src/content/episodes/{date}.md (frontmatter + notes)
  -> src/assets/episodes/{date}.jpg (1280x720 source image)
  -> Astro build (generates AVIF/WebP/JPEG at multiple widths)
  -> dist/ (static HTML with <picture> srcset)
```

## Fetching Videos

`scripts/fetch-twitch-videos.cjs` scrapes the Twitch channel videos page using Playwright (Twitch is fully JS-rendered, no API used). It:

1. Navigates to the channel's videos page and scrolls to load all entries
2. Extracts metadata (title, duration, views, relative date) by walking the DOM
3. Converts relative dates ("5 days ago") to ISO dates — these are estimates, not exact
4. Downloads 1280x720 thumbnails to `src/assets/episodes/` (skips if file exists)
5. Outputs JSON to stdout with a `localThumbnail` path for each video

Output goes to stdout (JSON), progress/diagnostics to stderr. Run with:

```bash
node scripts/fetch-twitch-videos.cjs
```

Requires Playwright + Chromium: `npm install && npx playwright install chromium`

## Content Schema

Defined in `src/content/config.ts`. The `thumbnail` field uses Astro's `image()` schema helper, which validates that the referenced file exists at build time and provides `ImageMetadata` to components.

```
title: string
date: Date
tags: string[]
twitchUrl: string
thumbnail: image()       # relative path to src/assets/episodes/{date}.jpg
youtubeUrl?: string
```

Episode frontmatter references the local image by relative path:

```yaml
thumbnail: ../../assets/episodes/2026-01-26.jpg
```

## Responsive Image Optimization

Components use Astro's `<Picture>` instead of `<img>`. At build time, Astro generates multiple format/size variants from each 1280x720 source JPEG. No runtime cost.

**EpisodeCard** (`src/components/EpisodeCard.astro`):

- Widths: 320, 640, 960
- Sizes: `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw`
- Matches the 1/2/3-column grid breakpoints in the episodes grid

**Episode detail page** (`src/pages/episodes/[slug].astro`):

- Widths: 640, 960, 1280
- Sizes: `(max-width: 800px) 100vw, 800px`
- `loading="eager"` since it's above the fold

Both emit `<picture>` elements with `<source>` tags for AVIF, WebP, and JPEG fallback. Browser selects the best format and size based on viewport, DPR, and connection.

## Adding a New Episode

1. Run `node scripts/fetch-twitch-videos.cjs` — thumbnail is downloaded automatically
2. Create `src/content/episodes/{date}.md` using the frontmatter template in the script's doc comment
3. Set `thumbnail` to the `localThumbnail` value from the script output
4. `npm run build` generates all optimized image variants
