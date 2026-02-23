#!/usr/bin/env node
/**
 * fetch-twitch-videos.cjs
 *
 * Fetches VODs from the 1gOfCode Twitch channel and creates or updates episode
 * markdown files in src/content/episodes/ and thumbnails in src/assets/episodes/.
 *
 * ## Setup
 *
 * Create `.env` in the project root with your Twitch app credentials:
 *
 *   TWITCH_CLIENT_ID=your_client_id_here
 *   TWITCH_CLIENT_SECRET=your_client_secret_here
 *
 * Register an app at https://dev.twitch.tv/console to get credentials.
 * Set OAuth Redirect URL to `https://localhost` (required but not used).
 *
 * ## Usage
 *
 *   node scripts/fetch-twitch-videos.cjs [--after YYYY-MM-DD] [--before YYYY-MM-DD] [--force]
 *
 * ## Date Filtering
 *
 * `--after YYYY-MM-DD`  — include only videos created after this date (exclusive).
 *   Stops paginating early when a video on or before this date is encountered,
 *   since the API returns videos newest-first.
 *
 * `--before YYYY-MM-DD` — include only videos created before this date (exclusive).
 *   Requires full pagination; filter applied client-side.
 *
 * Both flags can be combined to select a date range.
 *
 * ## Output
 *
 * For each video (date is Eastern Time, America/New_York):
 * - Downloads thumbnail to `src/assets/episodes/{date}.jpg` (skips if exists, unless --force)
 * - Creates `src/content/episodes/{date}.md` if it doesn't exist, with frontmatter and
 *   a "Show notes coming soon!" placeholder body
 * - Updates the frontmatter of `src/content/episodes/{date}.md` if it already exists
 *   (title, date, twitchUrl, thumbnail are synced; tags and body content are preserved)
 *
 * ## Requirements
 *
 * - `.env` file in project root with TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
 *
 * ## Notes
 *
 * - Dates are exact (from Twitch API `created_at` field), not estimated
 * - All past VODs are fetched via pagination (not limited to a visible page)
 * - Thumbnails are downloaded at 1280x720
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const CHANNEL_LOGIN = '1gofcode'

/**
 * Reads a .env file and returns key-value pairs without touching process.env.
 * Credentials stay scoped to local variables instead of the global environment.
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function readEnvFile(filePath) {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(
          (line) => line.includes('=') && !line.trimStart().startsWith('#')
        )
        .map((line) => {
          const eq = line.indexOf('=')
          return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

/**
 * Makes an HTTPS GET request and returns parsed JSON
 * @param {string} url
 * @param {{ headers?: Record<string, string> }} [options]
 * @returns {Promise<unknown>}
 */
function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
            return
          }
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`))
          }
        })
      })
      .on('error', reject)
  })
}

/**
 * Makes an HTTPS POST request with form-encoded body and returns parsed JSON
 * @param {string} url
 * @param {Record<string, string>} body
 * @returns {Promise<unknown>}
 */
function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const postData = new URLSearchParams(body).toString()
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
            return
          }
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

/**
 * Returns the date/time parts for a UTC timestamp in Eastern Time (America/New_York).
 * @param {string} utcTimestamp
 * @returns {{ year: string, month: string, day: string, hour: string, minute: string, second: string }}
 */
function getEasternParts(utcTimestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcTimestamp))
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  // Some implementations return "24" for midnight with hour12:false; normalise to "00"
  if (p.hour === '24') p.hour = '00'
  return p
}

/**
 * Converts a UTC timestamp to a YYYY-MM-DD date string in Eastern Time (America/New_York).
 * @param {string} utcTimestamp - e.g. "2026-01-26T22:00:00Z"
 * @returns {string} e.g. "2026-01-26"
 */
function toEasternDate(utcTimestamp) {
  const { year, month, day } = getEasternParts(utcTimestamp)
  return `${year}-${month}-${day}`
}

/**
 * Converts a UTC timestamp to a full ISO 8601 datetime string in Eastern Time,
 * with the correct UTC offset (-05:00 EST / -04:00 EDT).
 * e.g. "2026-01-26T22:00:00Z" -> "2026-01-26T17:00:00-05:00"
 * @param {string} utcTimestamp
 * @returns {string}
 */
function toEasternDateTime(utcTimestamp) {
  const date = new Date(utcTimestamp)
  const { year, month, day, hour, minute, second } =
    getEasternParts(utcTimestamp)
  // Compute offset by comparing the reconstructed Eastern "wall clock" time to UTC
  const easternWallMs = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  ).getTime()
  const offsetMinutes = (easternWallMs - date.getTime()) / 60000
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMinutes)
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0')
  const om = String(absMin % 60).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${oh}:${om}`
}

/**
 * Parses a YYYY-MM-DD date argument from process.argv
 * @param {string} flag - e.g. "--after" or "--before"
 * @returns {string|null} Date string or null if flag not present
 */
function parseDateArg(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  const val = process.argv[idx + 1]
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    console.error(`Error: ${flag} requires a date in YYYY-MM-DD format`)
    process.exit(1)
  }
  return val
}

/**
 * Gets an app access token using the client credentials grant
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<string>} Bearer token
 */
async function getAccessToken(clientId, clientSecret) {
  const data = await httpsPost('https://id.twitch.tv/oauth2/token', {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })
  return data.access_token
}

/**
 * Gets the Twitch user ID for a channel login name
 * @param {string} login - e.g. "1gofcode"
 * @param {string} clientId
 * @param {string} token
 * @returns {Promise<string>} Twitch user ID
 */
async function getUserId(login, clientId, token) {
  const data = await httpsGet(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    { headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` } }
  )
  if (!data.data || data.data.length === 0) {
    throw new Error(`User not found: ${login}`)
  }
  return data.data[0].id
}

/**
 * Fetches past broadcast VODs for a user, paginating through results.
 * When `afterDate` is provided, stops paginating as soon as a video on or
 * before that date is encountered (API returns newest-first).
 * @param {string} userId
 * @param {string} clientId
 * @param {string} token
 * @param {{ afterDate?: string|null }} [options]
 * @returns {Promise<object[]>} Raw Helix video objects
 */
async function fetchAllVideos(userId, clientId, token, { afterDate } = {}) {
  const videos = []
  let cursor = null
  do {
    const url =
      `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(userId)}&type=archive&first=100` +
      (cursor ? `&after=${encodeURIComponent(cursor)}` : '')
    const data = await httpsGet(url, {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
    })
    if (afterDate && data.data.length > 0) {
      const oldestOnPage = data.data[data.data.length - 1]
      if (toEasternDate(oldestOnPage.created_at) <= afterDate) {
        // This is the last useful page — take only qualifying videos and stop
        videos.push(
          ...data.data.filter((v) => toEasternDate(v.created_at) > afterDate)
        )
        break
      }
    }
    videos.push(...data.data)
    cursor = data.pagination?.cursor || null
  } while (cursor)
  return videos
}

/**
 * Parses Twitch's duration format into H:MM:SS display format
 * @param {string} twitchDuration - e.g. "1h1m29s", "45m10s", "30s"
 * @returns {string} e.g. "1:01:29", "45:10", "0:30"
 */
function parseDuration(twitchDuration) {
  const match = twitchDuration.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
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

/**
 * Wraps a string in YAML double quotes, escaping any interior double quotes.
 * @param {string} str
 * @returns {string} e.g. "It's a title"
 */
function yamlDoubleQuote(str) {
  return `"${str.replace(/"/g, '\\"')}"`
}

/**
 * Sets a key in a YAML frontmatter string to a new value (replaces the line if it
 * exists, appends if it doesn't).
 * @param {string} yaml - The frontmatter body (between the --- delimiters)
 * @param {string} key
 * @param {string} value - Already-serialized YAML value (quoted string, bare path, etc.)
 * @returns {string}
 */
function setYamlField(yaml, key, value) {
  const pattern = new RegExp(`^${key}:.*$`, 'm')
  const line = `${key}: ${value}`
  return pattern.test(yaml) ? yaml.replace(pattern, line) : `${yaml}\n${line}`
}

/**
 * Creates a new episode markdown file with frontmatter and a placeholder body.
 * @param {string} filePath
 * @param {object} video - Transformed video object with localThumbnail set
 */
function createEpisodeFile(filePath, video) {
  const content = [
    '---',
    `title: ${yamlDoubleQuote(video.title)}`,
    `date: "${video.startedAtEastern}"`,
    `tags: ["claude-code", "ai"]`,
    `twitchUrl: ${yamlDoubleQuote(video.url)}`,
    `thumbnail: ${video.localThumbnail}`,
    '---',
    '',
    'Show notes coming soon!',
    '',
  ].join('\n')
  fs.writeFileSync(filePath, content)
}

/**
 * Updates the frontmatter of an existing episode markdown file.
 * Syncs title, date, twitchUrl, and thumbnail from the API; tags and body are preserved.
 * @param {string} filePath
 * @param {object} video - Transformed video object with localThumbnail set
 * @returns {'updated'|'unchanged'|'skipped'}
 */
function updateEpisodeFile(filePath, video) {
  const original = fs.readFileSync(filePath, 'utf8')
  const match = original.match(/^---\n([\s\S]*?)\n---(\n[\s\S]*)?$/)
  if (!match) {
    console.error(
      `Warning: could not parse frontmatter in ${path.basename(filePath)}, skipping`
    )
    return 'skipped'
  }
  let yaml = match[1]
  const body = match[2] ?? '\n'
  yaml = setYamlField(yaml, 'title', yamlDoubleQuote(video.title))
  yaml = setYamlField(yaml, 'date', `"${video.startedAtEastern}"`)
  yaml = setYamlField(yaml, 'twitchUrl', yamlDoubleQuote(video.url))
  yaml = setYamlField(yaml, 'thumbnail', video.localThumbnail)
  const updated = `---\n${yaml}\n---${body}`
  if (updated === original) return 'unchanged'
  fs.writeFileSync(filePath, updated)
  return 'updated'
}

/**
 * Downloads a high-resolution thumbnail from Twitch's CDN
 * @param {string} url - Original thumbnail URL (any resolution)
 * @param {string} outputPath - Local file path to save the image
 * @returns {Promise<void>}
 */
function downloadThumbnail(url, outputPath) {
  // Upgrade to 1280x720 for both default (thumb0-WxH.jpg) and custom (custom-...-WxH.png) thumbnails
  const highResUrl = url.replace(/(-|\b)(\d+x\d+)(\.\w+)$/, '$11280x720$3')
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
  const env = readEnvFile(path.join(__dirname, '../.env'))
  const clientId = env.TWITCH_CLIENT_ID
  const clientSecret = env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error(
      'Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env'
    )
    console.error(
      'Register an app at https://dev.twitch.tv/console to get credentials.'
    )
    process.exit(1)
  }

  const afterDate = parseDateArg('--after')
  const beforeDate = parseDateArg('--before')

  try {
    console.error('Authenticating with Twitch API...')
    const token = await getAccessToken(clientId, clientSecret)

    console.error(`Fetching user ID for ${CHANNEL_LOGIN}...`)
    const userId = await getUserId(CHANNEL_LOGIN, clientId, token)

    if (afterDate) console.error(`Filtering: after ${afterDate}`)
    if (beforeDate) console.error(`Filtering: before ${beforeDate}`)

    console.error(`Fetching videos for user ${userId}...`)
    const rawVideos = await fetchAllVideos(userId, clientId, token, {
      afterDate,
    })

    // Client-side filter for --before (no early termination possible)
    const filtered = rawVideos.filter((v) => {
      const date = toEasternDate(v.created_at)
      if (afterDate && date <= afterDate) return false
      if (beforeDate && date >= beforeDate) return false
      return true
    })

    // Transform API response to our output shape
    const videos = filtered.map((v) => {
      const date = toEasternDate(v.created_at)
      // thumbnail_url contains %{width}x%{height} template — substitute dimensions
      const thumbnail = v.thumbnail_url.replace(
        '%{width}x%{height}',
        '1280x720'
      )
      return {
        videoId: v.id,
        url: v.url,
        title: v.title,
        thumbnail,
        duration: parseDuration(v.duration),
        views: String(v.view_count),
        date,
        startedAt: v.created_at,
        startedAtEastern: toEasternDateTime(v.created_at),
      }
    })

    // Download high-res thumbnails locally
    const assetsDir = path.join(__dirname, '../src/assets/episodes')
    fs.mkdirSync(assetsDir, { recursive: true })

    const forceDownload = process.argv.includes('--force')

    for (const video of videos) {
      if (!video.thumbnail) continue
      const filename = `${video.date}.jpg`
      const outputPath = path.join(assetsDir, filename)

      if (forceDownload || !fs.existsSync(outputPath)) {
        await downloadThumbnail(video.thumbnail, outputPath)
        console.error(`✓ Downloaded ${filename}`)
      } else {
        console.error(
          `• Skipped ${filename} (already exists, use --force to re-download)`
        )
      }

      video.localThumbnail = `../../assets/episodes/${filename}`
    }

    // Create or update episode markdown files
    const episodesDir = path.join(__dirname, '../src/content/episodes')
    fs.mkdirSync(episodesDir, { recursive: true })

    let created = 0
    let updatedCount = 0
    let unchanged = 0

    for (const video of videos) {
      const filePath = path.join(episodesDir, `${video.date}.md`)
      if (fs.existsSync(filePath)) {
        const result = updateEpisodeFile(filePath, video)
        if (result === 'updated') {
          console.error(`↻ Updated  ${video.date}.md`)
          updatedCount++
        } else if (result === 'unchanged') {
          console.error(`• Unchanged ${video.date}.md`)
          unchanged++
        }
      } else {
        createEpisodeFile(filePath, video)
        console.error(`+ Created  ${video.date}.md`)
        created++
      }
    }

    console.error(
      `\n✓ ${created} created, ${updatedCount} updated, ${unchanged} unchanged` +
        ` (${rawVideos.length} fetched) from ${CHANNEL_LOGIN} channel\n`
    )
  } catch (error) {
    console.error('Error fetching videos:', error.message)
    process.exit(1)
  }
})()
