# Local Thumbnails with Responsive Image Loading

**Status:** Planned
**Date:** 2026-02-14
**Feature Type:** Performance & Quality Enhancement

## Context

The site currently relies on Twitch's CDN for episode thumbnails, loading low-resolution 320x180 images via basic `<img>` tags. This creates several issues:
- **External dependency**: Thumbnails could break if Twitch changes CDN URLs
- **Low quality**: 320x180 is inadequate for modern high-DPI displays
- **No optimization**: Single image size for all devices wastes bandwidth on mobile
- **No modern formats**: Missing AVIF/WebP support means larger file sizes

By downloading high-resolution thumbnails locally (1280x720) and using Astro's built-in image optimization, we can:
- **Control quality**: 4x resolution improvement with modern format compression
- **Optimize delivery**: Automatically serve appropriate sizes and formats per device
- **Improve performance**: AVIF format delivers ~50-70% file size reduction vs JPEG
- **Handle bandwidth**: Browsers automatically select optimal quality based on viewport, pixel density, and connection speed

## Implementation Approach

### 1. Download High-Resolution Thumbnails

**Modify:** `scripts/fetch-twitch-videos.cjs`

Add logic to:
- Download 1280x720 thumbnails (change URL from `thumb0-320x180.jpg` to `thumb0-1280x720.jpg`)
- Save to `src/assets/episodes/{YYYY-MM-DD}.jpg` (matches episode markdown filename)
- Use Node.js `https` or `fetch` for downloads
- Create `src/assets/episodes/` directory if it doesn't exist
- Include local path in JSON output

Example transformation:
```javascript
const fs = require('fs')
const path = require('path')
const https = require('https')

async function downloadThumbnail(url, outputPath) {
  const highResUrl = url.replace(/thumb0-\d+x\d+\.jpg/, 'thumb0-1280x720.jpg')
  return new Promise((resolve, reject) => {
    https.get(highResUrl, (response) => {
      const fileStream = fs.createWriteStream(outputPath)
      response.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })
    }).on('error', reject)
  })
}

// In main execution:
const assetsDir = path.join(__dirname, '../src/assets/episodes')
fs.mkdirSync(assetsDir, { recursive: true })

for (const video of videos) {
  const filename = `${video.estimatedDate}.jpg`
  const outputPath = path.join(assetsDir, filename)

  if (!fs.existsSync(outputPath)) {
    await downloadThumbnail(video.thumbnail, outputPath)
    console.error(`✓ Downloaded ${filename}`)
  }

  video.localThumbnail = `../../assets/episodes/${filename}`
}
```

### 2. Update Content Schema for Image Imports

**Modify:** `src/content/config.ts`

Change from string URL to image import:
```typescript
import { defineCollection, z } from 'astro:content'

const episodes = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    twitchUrl: z.string(),
    thumbnail: image(), // Changed from twitchThumbnail: z.string()
    youtubeUrl: z.string().optional(),
  }),
})

export const collections = { episodes }
```

**Update all episode frontmatter** (4 files in `src/content/episodes/`):
```yaml
# Before:
twitchThumbnail: 'https://static-cdn.jtvnw.net/...'

# After:
thumbnail: ../../assets/episodes/2026-01-26.jpg
```

### 3. Replace Images with Astro's Picture Component

**Why Picture Component:**
- Automatically generates AVIF, WebP, and JPEG variants
- Creates multiple sizes with `widths` parameter
- Adds proper `srcset` and `sizes` attributes
- Browsers automatically select best format and size

#### 3a. Update EpisodeCard Component

**Modify:** `src/components/EpisodeCard.astro`

```astro
---
import { Picture } from 'astro:assets'
import type { ImageMetadata } from 'astro'

interface Props {
  title: string
  date: Date | string
  tags: string[]
  thumbnail: ImageMetadata  // Changed from twitchThumbnail: string
  slug: string
}

const { title, date, tags, thumbnail, slug } = Astro.props
// ... rest unchanged
---

<article class="episode-card">
  <a href={episodeUrl} class="episode-link" aria-labelledby={`episode-title-${slug}`}>
    <div class="thumbnail-wrapper">
      <Picture
        src={thumbnail}
        widths={[320, 640, 960]}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        formats={['avif', 'webp', 'jpeg']}
        alt=""
        class="thumbnail"
        loading="lazy"
        decoding="async"
      />
      <!-- overlay unchanged -->
    </div>
    <!-- content unchanged -->
  </a>
</article>
```

**Sizes explanation:**
- Mobile (<640px): 100vw (full width)
- Tablet (640-1024px): 50vw (2-column grid)
- Desktop (>1024px): 33vw (3-column grid)

#### 3b. Update Episode Detail Page

**Modify:** `src/pages/episodes/[slug].astro`

```astro
---
import { Picture } from 'astro:assets'
// ... other imports unchanged
---

<Picture
  src={episode.data.thumbnail}
  widths={[640, 960, 1280]}
  sizes="(max-width: 800px) 100vw, 800px"
  formats={['avif', 'webp', 'jpeg']}
  alt={`Thumbnail for ${episode.data.title}`}
  class="thumbnail"
  loading="eager"
/>
```

**Sizes explanation:**
- Mobile: 100vw (full width)
- Desktop: 800px (container max-width)

Keep `loading="eager"` since this is above-the-fold content.

### 4. How Automatic Quality Selection Works

The browser automatically handles quality/bandwidth optimization:

**Format Selection (AVIF → WebP → JPEG):**
- Modern browsers: Receive AVIF (~50-70% smaller than JPEG)
- Older browsers: Fall back to WebP or JPEG
- No JavaScript required - browser-native feature

**Size Selection (via srcset):**
- Browser considers: viewport width, CSS layout, pixel density (retina displays)
- Example: iPhone 15 Pro (393px viewport, 3x DPR) loads 960w image
- Example: Desktop 1920px viewport in 3-col grid loads 640w image per card

**Network-aware (built into browsers):**
- Save-Data mode: Browser requests smaller variants
- Slow connections: Browser may choose lower resolution
- This happens automatically via srcset - no extra code needed

## Critical Files to Modify

1. **`scripts/fetch-twitch-videos.cjs`** - Add download logic
2. **`src/content/config.ts`** - Change schema to use `image()`
3. **`src/content/episodes/*.md`** (4 files) - Update frontmatter
4. **`src/components/EpisodeCard.astro`** - Use Picture component
5. **`src/pages/episodes/[slug].astro`** - Use Picture component

## Build Output

After `npm run build`, Astro generates:
- 3 formats (AVIF, WebP, JPEG) × 3-4 sizes each = ~10 images per episode
- Example: `dist/_astro/2026-01-26.abc123.avif`, `2026-01-26@640w.def456.webp`, etc.
- All variants include content hash for cache busting

## Verification Steps

**1. Run updated fetch script:**
```bash
npm run fetch-videos
```
Verify thumbnails downloaded to `src/assets/episodes/`

**2. Update episode frontmatter:**
Manually edit 4 episode files or use migration script

**3. Build and verify:**
```bash
npm run build
```
Check build output includes optimized images in `dist/_astro/`

**4. Test locally:**
```bash
npm run preview
```

**5. Visual verification:**
- Browse to episodes page - thumbnails should look sharper
- Check network tab in Chrome DevTools - should see AVIF files
- Check Safari - should see WebP files
- Resize viewport - different sized images should load

**6. Performance verification:**
```bash
npm run test  # Ensure tests still pass
```

Use Lighthouse to verify performance maintained/improved

**7. File size comparison:**
Check network tab:
- Original JPEG 320x180: ~15-25 KB
- New AVIF 640w: ~10-15 KB (smaller file, higher quality!)
- New AVIF 1280w: ~25-35 KB (desktop retina, still competitive)

## Expected Benefits

- **Quality**: 1280x720 source vs 320x180 (4x improvement)
- **File size**: AVIF ~50-70% smaller than equivalent JPEG
- **Performance**: Right-sized images for each device (mobile doesn't download desktop size)
- **Future-proof**: Modern formats with graceful fallbacks
- **No runtime cost**: All optimization happens at build time

## References

- [Astro Image Optimization](https://docs.astro.build/en/guides/images/)
- [MDN: Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [web.dev: Serve responsive images](https://web.dev/articles/serve-responsive-images)
