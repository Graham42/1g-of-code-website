# Episode Content Pipeline

How episodes go from Twitch VODs to optimized pages on the site.

## Data Flow

```
Twitch Helix API
  -> scripts/fetch-twitch-videos.cjs (API fetch + thumbnail download + episode file sync)
  -> src/content/episodes/{date}.md (frontmatter + notes)
  -> src/assets/episodes/{date}.jpg (1280x720 source image)
  -> Astro build (generates AVIF/WebP/JPEG at multiple widths)
  -> dist/ (static HTML with <picture> srcset)
```

## Fetching Videos

`scripts/fetch-twitch-videos.cjs` fetches VOD data from the Twitch Helix API. It:

1. Authenticates with the Twitch API using client credentials (from `.env`)
2. Looks up the channel's user ID via `GET /helix/users`
3. Fetches past broadcast VODs via `GET /helix/videos`, paginating until complete
4. Converts dates to Eastern Time (America/New_York, handles EST/EDT automatically)
5. Downloads 1280x720 thumbnails to `src/assets/episodes/` (skips if file exists)
6. Creates `src/content/episodes/{date}.md` for any video without an existing file
7. Updates the frontmatter of existing episode files where API data has changed

All progress and diagnostics go to stderr. Run with:

```bash
node scripts/fetch-twitch-videos.cjs
```

Optional flags:

- `--after YYYY-MM-DD` — only process videos created after this date (exclusive); stops paginating early since the API returns newest-first
- `--before YYYY-MM-DD` — only process videos created before this date (exclusive)
- `--force` — re-download thumbnails even if the file already exists

### Requirements

- `.env` file in project root:
  ```
  TWITCH_CLIENT_ID=your_client_id_here
  TWITCH_CLIENT_SECRET=your_client_secret_here
  ```
- Register an app at https://dev.twitch.tv/console — set OAuth Redirect URL to `http://localhost`
- Node.js (no version constraint for credential loading)

## Episode Files

Episode markdown files live in `src/content/episodes/{date}.md` where `date` is the Eastern Time date of the stream (YYYY-MM-DD).

The script creates new files with a `Show notes coming soon!` placeholder body and syncs these frontmatter fields on every run:

- `title` — stream title from Twitch
- `date` — stream start time as a full ISO 8601 datetime in Eastern Time (e.g. `'2026-01-26T17:00:00-05:00'`)
- `twitchUrl` — VOD URL
- `thumbnail` — relative path to the local 1280x720 JPEG

These fields are never touched by the script and can be freely edited:

- `tags` — topic tags for the episode
- `youtubeUrl` — YouTube mirror URL (optional)
- The markdown body (show notes, resources, etc.)
- Any other custom frontmatter fields

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

1. Run `node scripts/fetch-twitch-videos.cjs` — the episode file and thumbnail are created automatically
2. Edit `src/content/episodes/{date}.md` to add show notes, adjust tags, etc.
3. `npm run build` generates all optimized image variants
