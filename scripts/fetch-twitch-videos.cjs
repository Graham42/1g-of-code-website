#!/usr/bin/env node
/**
 * fetch-twitch-videos.cjs
 *
 * Fetches video information from the 1gOfCode Twitch channel using Playwright.
 * Outputs structured data that can be used to create episode markdown files.
 *
 * ## Usage
 *
 *   node scripts/fetch-twitch-videos.cjs
 *
 * ## Output
 *
 * Prints JSON to stdout with an array of video objects:
 *
 *   [
 *     {
 *       "videoId": "2681376783",
 *       "url": "https://www.twitch.tv/videos/2681376783",
 *       "title": "Snake Game + Claude Code | Learning AI-Powered Dev Live",
 *       "thumbnail": "https://static-cdn.jtvnw.net/cf_vods/...",
 *       "duration": "1:01:29",
 *       "views": "16",
 *       "relativeDate": "5 days ago",
 *       "estimatedDate": "2026-01-26"
 *     },
 *     ...
 *   ]
 *
 * ## For Claude Code Agents
 *
 * To create a new episode file from this data:
 *
 * 1. Run this script and parse the JSON output
 * 2. For each video that doesn't have a corresponding episode file:
 *    - Create `src/content/episodes/{estimatedDate}.md`
 *    - Use this frontmatter template:
 *
 *      ---
 *      title: "{title}"
 *      date: {estimatedDate}
 *      tags: ["claude-code", "ai"]  # adjust based on title/content
 *      twitchUrl: "{url}"
 *      thumbnail: "{localThumbnail}"
 *      ---
 *
 *      ## Episode Notes
 *
 *      [Add episode summary here]
 *
 *      ### Topics Covered
 *
 *      - [Topic 1]
 *      - [Topic 2]
 *
 *      ### Resources
 *
 *      - [Resource Name](url)
 *
 * 3. Check existing episodes in src/content/episodes/ to avoid duplicates
 *    by comparing video URLs or dates
 *
 * ## Requirements
 *
 * - Playwright must be installed: npm install
 * - Chromium browser must be installed: npx playwright install chromium
 *
 * ## Notes
 *
 * - Twitch pages are JavaScript-rendered, so we use Playwright to scrape
 * - Dates are estimated from relative times ("5 days ago", "Last month")
 * - The script scrolls to load all videos, but very old videos may not appear
 * - Thumbnails are 320x180 by default; change dimensions in URL if needed
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { chromium } = require('@playwright/test')

const CHANNEL_URL = 'https://www.twitch.tv/1gOfCode/videos?filter=all&sort=time'

/**
 * Estimates an actual date from Twitch's relative date strings
 * @param {string} relativeDate - e.g., "5 days ago", "Last month", "2 weeks ago"
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function estimateDateFromRelative(relativeDate) {
  const now = new Date()
  const lower = relativeDate.toLowerCase().trim()

  // Match patterns like "5 days ago", "2 weeks ago", etc.
  const match = lower.match(
    /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/
  )

  if (match) {
    const amount = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 'second':
      case 'minute':
      case 'hour':
        // Same day
        break
      case 'day':
        now.setDate(now.getDate() - amount)
        break
      case 'week':
        now.setDate(now.getDate() - amount * 7)
        break
      case 'month':
        now.setMonth(now.getMonth() - amount)
        break
      case 'year':
        now.setFullYear(now.getFullYear() - amount)
        break
    }
  } else if (lower === 'yesterday') {
    now.setDate(now.getDate() - 1)
  } else if (lower === 'last week') {
    now.setDate(now.getDate() - 7)
  } else if (lower === 'last month') {
    now.setMonth(now.getMonth() - 1)
  } else if (lower === 'last year') {
    now.setFullYear(now.getFullYear() - 1)
  }
  // If no match, returns today's date

  return now.toISOString().split('T')[0]
}

/**
 * Extracts video ID from a Twitch video URL
 * @param {string} url - Twitch video URL
 * @returns {string|null} Video ID or null
 */
function extractVideoId(url) {
  const match = url.match(/\/videos\/(\d+)/)
  return match ? match[1] : null
}

async function fetchTwitchVideos() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Navigate to videos page
    await page.goto(CHANNEL_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Wait for content to load
    await page.waitForTimeout(3000)

    // Dismiss any popups
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)

    // Scroll to load more videos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await page.waitForTimeout(1500)
    }

    // Collect thumbnail URLs from network/page
    const thumbnails = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img')
      const results = []
      imgs.forEach((img) => {
        const src = img.src
        if (src && src.includes('cf_vods') && src.includes('thumb')) {
          results.push(src)
        }
      })
      return results
    })

    // Collect video metadata from the page
    const videoData = await page.evaluate(() => {
      const results = []
      const seen = new Set()

      // Find video links with their containers
      // Use querySelectorAll on links that have the filter param (these are in the video list, not the featured carousel)
      const videoLinks = document.querySelectorAll(
        'a[href*="/videos/"][href*="filter="]'
      )

      videoLinks.forEach((link) => {
        const url = link.href

        // Clean URL (remove query params for deduplication)
        const cleanUrl = url.split('?')[0]
        if (seen.has(cleanUrl)) return
        seen.add(cleanUrl)

        // Skip if not a video URL
        if (!cleanUrl.includes('/videos/')) return

        // Find the containing card element by walking up the DOM
        let container = link.parentElement
        for (let i = 0; i < 8 && container; i++) {
          const text = container.innerText || ''
          // Stop when we find a container that has views and duration info
          if (text.includes('views') && text.match(/\d+:\d+/)) {
            break
          }
          container = container.parentElement
        }

        const containerText = container?.innerText || ''

        // Skip the featured "Check out this..." preview - it has different markup
        if (containerText.includes('Check out this')) {
          return
        }

        // Extract metadata from container text
        // Typical format: "Title\n\nChannel\n\nCategory\n\nDuration\nViews\nDate"
        const lines = containerText.split('\n').filter((l) => l.trim())

        // Find title - usually the first substantive line or from a specific element
        const titleEl = container?.querySelector(
          'h3, [data-a-target="preview-card-title-link"], p[title]'
        )
        let title =
          titleEl?.textContent?.trim() || titleEl?.getAttribute('title') || ''

        // If no title found, try first line that's not the channel name or category
        if (!title && lines.length > 0) {
          title =
            lines.find(
              (l) =>
                !l.includes('1gOfCode') &&
                !l.includes('Software and Game') &&
                l.length > 10 &&
                !l.match(/^\d+:\d+/) &&
                !l.match(/^\d+\s*views/)
            ) || lines[0]
        }

        // Find duration (format: H:MM:SS or MM:SS)
        const durationMatch = containerText.match(
          /(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})/
        )
        const duration = durationMatch ? durationMatch[1] : ''

        // Find views
        const viewsMatch = containerText.match(/(\d+)\s*views/i)
        const views = viewsMatch ? viewsMatch[1] : ''

        // Find relative date
        const dateMatch = containerText.match(
          /(yesterday|\d+\s+\w+\s+ago|last\s+\w+)/i
        )
        const relativeDate = dateMatch ? dateMatch[1] : ''

        if (title && title !== 'stream' && !title.includes('Check out this')) {
          results.push({
            url: cleanUrl,
            title: title.substring(0, 200),
            duration,
            views,
            relativeDate,
          })
        }
      })

      return results
    })

    // Match thumbnails to videos (they appear in the same order)
    const videos = videoData.map((video, index) => {
      const videoId = extractVideoId(video.url)
      return {
        videoId,
        url: video.url,
        title: video.title,
        thumbnail: thumbnails[index] || '',
        duration: video.duration,
        views: video.views,
        relativeDate: video.relativeDate,
        estimatedDate: estimateDateFromRelative(video.relativeDate),
      }
    })

    return videos
  } finally {
    await browser.close()
  }
}

/**
 * Downloads a high-resolution thumbnail from Twitch's CDN
 * @param {string} url - Original thumbnail URL (any resolution)
 * @param {string} outputPath - Local file path to save the image
 * @returns {Promise<void>}
 */
function downloadThumbnail(url, outputPath) {
  const highResUrl = url.replace(/thumb0-\d+x\d+\.jpg/, 'thumb0-1280x720.jpg')
  return new Promise((resolve, reject) => {
    https
      .get(highResUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${highResUrl}`))
          return
        }
        const fileStream = fs.createWriteStream(outputPath)
        response.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })
      })
      .on('error', reject)
  })
}

// Main execution
;(async () => {
  try {
    const videos = await fetchTwitchVideos()

    // Download high-res thumbnails locally
    const assetsDir = path.join(__dirname, '../src/assets/episodes')
    fs.mkdirSync(assetsDir, { recursive: true })

    for (const video of videos) {
      if (!video.thumbnail) continue
      const filename = `${video.estimatedDate}.jpg`
      const outputPath = path.join(assetsDir, filename)

      if (!fs.existsSync(outputPath)) {
        await downloadThumbnail(video.thumbnail, outputPath)
        console.error(`✓ Downloaded ${filename}`)
      } else {
        console.error(`• Skipped ${filename} (already exists)`)
      }

      video.localThumbnail = `../../assets/episodes/${filename}`
    }

    // Output as formatted JSON
    console.log(JSON.stringify(videos, null, 2))

    // Also output a summary to stderr so it doesn't interfere with JSON parsing
    console.error(`\n✓ Found ${videos.length} video(s) from 1gOfCode channel\n`)
  } catch (error) {
    console.error('Error fetching videos:', error.message)
    process.exit(1)
  }
})()
