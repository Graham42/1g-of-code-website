#!/usr/bin/env bun
// 1g of Code — Live Overlay Sync Server
// Zero npm dependencies — pure Node.js http module
// Usage: bun overlays/server.ts [port]
//        PORT=4000 bun overlays/server.ts

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.argv[2] || process.env.PORT || '3000', 10)
const DIR = __dirname

// Load .env from overlays directory
try {
  process.loadEnvFile(path.join(DIR, '.env'))
} catch {}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_TOKEN = process.env.TWITCH_TOKEN
const TWITCH_BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID
const TWITCH_OK = !!(TWITCH_CLIENT_ID && TWITCH_TOKEN && TWITCH_BROADCASTER_ID)

let lastState: unknown = null
const sseClients = new Set<http.ServerResponse>()

// ── Follow timestamp persistence ─────────────────────────
const FOLLOW_STATE_PATH = path.join(DIR, 'follow-state.json')
let lastFollowAt: string | null = null

try {
  const raw = fs.readFileSync(FOLLOW_STATE_PATH, 'utf8')
  lastFollowAt = JSON.parse(raw).lastFollowAt ?? null
} catch {}

function saveLastFollowAt(isoString: string) {
  lastFollowAt = isoString
  fs.writeFileSync(FOLLOW_STATE_PATH, JSON.stringify({ lastFollowAt: isoString }))
}

// ── Follow deduplication (24h per user) ──────────────────
const recentFollowers = new Map<string, number>()
const FOLLOW_DEDUP_MS = 24 * 60 * 60 * 1000
const followClients = new Set<http.ServerResponse>()
const subscribeClients = new Set<http.ServerResponse>()
const alertClients = new Set<http.ServerResponse>()
const raidClients = new Set<http.ServerResponse>()

// ── SSE broadcast ─────────────────────────────────────────
function broadcast(data: unknown) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

function broadcastFollow(username: string) {
  const msg = `data: ${JSON.stringify({ type: 'follow', username })}\n\n`
  for (const res of followClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

function broadcastSubscribe(username: string) {
  const msg = `data: ${JSON.stringify({ type: 'subscribe', username })}\n\n`
  for (const res of subscribeClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

function broadcastAlert(type: string, username: string) {
  const msg = `data: ${JSON.stringify({ type, username })}\n\n`
  for (const res of alertClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

function broadcastRaid(username: string, viewers: number) {
  const msg = `data: ${JSON.stringify({ type: 'raid', username, viewers })}\n\n`
  for (const res of raidClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

// ── Twitch EventSub ───────────────────────────────────────
let twitchWs: WebSocket | null = null
let twitchReconnTimer: ReturnType<typeof setTimeout> | null = null
let twitchKaTimer: ReturnType<typeof setTimeout> | null = null
let twitchKaSecs = 10

function resetTwitchKeepalive() {
  clearTimeout(twitchKaTimer ?? undefined)
  twitchKaTimer = setTimeout(
    () => {
      console.warn('  [twitch] Keepalive timeout — reconnecting')
      if (twitchWs) twitchWs.close()
    },
    (twitchKaSecs + 10) * 1000
  )
}

async function twitchSubscribeFollow(sessionId: string) {
  const res = await fetch(
    'https://api.twitch.tv/helix/eventsub/subscriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TWITCH_TOKEN}`,
        'Client-Id': TWITCH_CLIENT_ID!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.follow',
        version: '2',
        condition: {
          broadcaster_user_id: TWITCH_BROADCASTER_ID,
          moderator_user_id: TWITCH_BROADCASTER_ID,
        },
        transport: { method: 'websocket', session_id: sessionId },
      }),
    }
  )
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
}

async function twitchSubscribeRaid(sessionId: string) {
  const res = await fetch(
    'https://api.twitch.tv/helix/eventsub/subscriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TWITCH_TOKEN}`,
        'Client-Id': TWITCH_CLIENT_ID!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.raid',
        version: '1',
        condition: {
          to_broadcaster_user_id: TWITCH_BROADCASTER_ID,
        },
        transport: { method: 'websocket', session_id: sessionId },
      }),
    }
  )
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
}

async function twitchSubscribeSubscriptions(sessionId: string) {
  const res = await fetch(
    'https://api.twitch.tv/helix/eventsub/subscriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TWITCH_TOKEN}`,
        'Client-Id': TWITCH_CLIENT_ID!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.subscribe',
        version: '1',
        condition: {
          broadcaster_user_id: TWITCH_BROADCASTER_ID,
        },
        transport: { method: 'websocket', session_id: sessionId },
      }),
    }
  )
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
}

function connectTwitch(url = 'wss://eventsub.wss.twitch.tv/ws') {
  if (twitchWs) {
    twitchWs.onclose = null
    twitchWs.close()
  }
  clearTimeout(twitchReconnTimer ?? undefined)
  clearTimeout(twitchKaTimer ?? undefined)

  twitchWs = new WebSocket(url)

  twitchWs.onmessage = async (ev) => {
    let msg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    resetTwitchKeepalive()

    const type = msg?.metadata?.message_type

    if (type === 'session_welcome') {
      twitchKaSecs = msg.payload.session.keepalive_timeout_seconds ?? 10
      resetTwitchKeepalive()
      try {
        await twitchSubscribeFollow(msg.payload.session.id)
        console.log('  [twitch] Subscribed to channel.follow — listening')
      } catch (e) {
        console.error(
          '  [twitch] channel.follow subscribe failed:',
          (e as Error).message
        )
      }
      try {
        await twitchSubscribeSubscriptions(msg.payload.session.id)
        console.log('  [twitch] Subscribed to channel.subscribe — listening')
      } catch (e) {
        console.error(
          '  [twitch] channel.subscribe subscribe failed:',
          (e as Error).message
        )
      }
      try {
        await twitchSubscribeRaid(msg.payload.session.id)
        console.log('  [twitch] Subscribed to channel.raid — listening')
      } catch (e) {
        console.error(
          '  [twitch] channel.raid subscribe failed:',
          (e as Error).message
        )
      }
    }

    if (
      type === 'notification' &&
      msg.metadata?.subscription_type === 'channel.follow'
    ) {
      const username = msg.payload?.event?.user_name ?? 'Someone'
      const lastSeen = recentFollowers.get(username)
      if (lastSeen && Date.now() - lastSeen < FOLLOW_DEDUP_MS) {
        console.log(
          `  [twitch] ♥  ${username} followed (dedup — last seen ${Math.round((Date.now() - lastSeen) / 60000)}m ago, skipping)`
        )
      } else {
        recentFollowers.set(username, Date.now())
        // prune entries older than 24h
        for (const [user, ts] of recentFollowers) {
          if (Date.now() - ts > FOLLOW_DEDUP_MS) recentFollowers.delete(user)
        }
        console.log(`  [twitch] ♥  ${username} followed`)
        saveLastFollowAt(new Date().toISOString())
        broadcastFollow(username)
        broadcastAlert('follow', username)
      }
    }

    if (
      type === 'notification' &&
      msg.metadata?.subscription_type === 'channel.subscribe'
    ) {
      const username = msg.payload?.event?.user_name ?? 'Someone'
      console.log(`  [twitch] ★  ${username} subscribed`)
      broadcastSubscribe(username)
      broadcastAlert('subscribe', username)
    }

    if (
      type === 'notification' &&
      msg.metadata?.subscription_type === 'channel.raid'
    ) {
      const username =
        msg.payload?.event?.from_broadcaster_user_name ?? 'Someone'
      const viewers = msg.payload?.event?.viewers ?? 1
      console.log(`  [twitch] ⚔  ${username} raided with ${viewers} viewers`)
      broadcastRaid(username, viewers)
    }

    if (type === 'session_reconnect') {
      connectTwitch(msg.payload.session.reconnect_url)
    }

    if (type === 'revocation') {
      console.warn(
        '  [twitch] Subscription revoked:',
        msg.payload?.subscription?.status
      )
    }
  }

  twitchWs.onclose = (ev) => {
    clearTimeout(twitchKaTimer ?? undefined)
    if (ev.code !== 1000) {
      console.warn(`  [twitch] Closed (${ev.code}), retrying in 5s`)
      twitchReconnTimer = setTimeout(() => connectTwitch(), 5000)
    }
  }

  twitchWs.onerror = (e) =>
    console.error('  [twitch] Error:', (e as ErrorEvent).message)
}

// ── Static file helper ────────────────────────────────────
const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.html': 'text/html; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
}

function serveFile(filePath: string, res: http.ServerResponse) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath)
    const ct = MIME[ext] ?? 'text/html; charset=utf-8'
    res.writeHead(200, { 'Content-Type': ct })
    res.end(data)
  })
}

// ── Body parser ───────────────────────────────────────────
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

// ── Request handler ───────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { method, url } = req

  // CORS — builder and OBS overlay may be on same origin but allow all for dev
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // GET / → overlay builder
  if (method === 'GET' && url === '/') {
    serveFile(path.join(DIR, 'overlay-builder.html'), res)
    return
  }

  // GET /overlay → OBS overlay receiver
  if (method === 'GET' && url === '/overlay') {
    serveFile(path.join(DIR, 'overlay.html'), res)
    return
  }

  // GET /state → return last known state
  if (method === 'GET' && url === '/state') {
    if (!lastState) {
      res.writeHead(204)
      res.end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(lastState))
    return
  }

  // POST /state → store state and broadcast to SSE clients
  if (method === 'POST' && url === '/state') {
    let body
    try {
      body = await readBody(req)
      lastState = JSON.parse(body)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad JSON')
      return
    }
    broadcast(lastState)
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // GET /events → SSE stream
  if (method === 'GET' && url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    // Send current state immediately if available
    if (lastState) {
      res.write(`data: ${JSON.stringify(lastState)}\n\n`)
    }

    sseClients.add(res)

    // 20-second keepalive pings
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      sseClients.delete(res)
    })
    return
  }

  // GET /admin → admin/test panel
  if (method === 'GET' && url === '/admin') {
    serveFile(path.join(DIR, 'admin.html'), res)
    return
  }

  // POST /simulate/follow → fire a fake follow alert
  if (method === 'POST' && url === '/simulate/follow') {
    let body
    try {
      body = await readBody(req)
      const { username } = JSON.parse(body)
      const name = (username || '').trim() || 'TestUser'
      console.log(`  [admin] Simulated follow: ${name}`)
      broadcastFollow(name)
      broadcastAlert('follow', name)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad JSON')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // POST /simulate/raid → fire a fake raid alert
  if (method === 'POST' && url === '/simulate/raid') {
    let body
    try {
      body = await readBody(req)
      const { username, viewers } = JSON.parse(body)
      const name = (username || '').trim() || 'TestRaider'
      const count = parseInt(viewers) || 42
      console.log(`  [admin] Simulated raid: ${name} (${count} viewers)`)
      broadcastRaid(name, count)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad JSON')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // GET /twitch/missed-followers → followers newer than lastFollowAt
  if (method === 'GET' && url === '/twitch/missed-followers') {
    if (!TWITCH_OK) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Twitch credentials not configured' }))
      return
    }
    try {
      const params = new URLSearchParams({
        broadcaster_id: TWITCH_BROADCASTER_ID!,
        first: '100',
      })
      const r = await fetch(
        `https://api.twitch.tv/helix/channels/followers?${params}`,
        {
          headers: {
            Authorization: `Bearer ${TWITCH_TOKEN}`,
            'Client-Id': TWITCH_CLIENT_ID!,
          },
        }
      )
      if (!r.ok) {
        const text = await r.text()
        res.writeHead(r.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: text }))
        return
      }
      const json = (await r.json()) as {
        data: { user_name: string; followed_at: string }[]
      }
      const since = lastFollowAt ? new Date(lastFollowAt) : null
      const missed = since
        ? json.data.filter((f) => new Date(f.followed_at) > since)
        : json.data
      // Advance the cursor to the newest follower so the next fetch doesn't repeat
      if (missed.length > 0) {
        const newest = missed.reduce((a, b) =>
          a.followed_at > b.followed_at ? a : b
        )
        saveLastFollowAt(newest.followed_at)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ followers: missed, since: lastFollowAt }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: (e as Error).message }))
    }
    return
  }

  // POST /clear-dedup → remove a username (or all) from the follow dedup cache
  if (method === 'POST' && url === '/clear-dedup') {
    let body
    try {
      body = await readBody(req)
      const { username } = JSON.parse(body)
      if (username) {
        recentFollowers.delete(username.trim())
        console.log(`  [admin] Cleared dedup for: ${username.trim()}`)
      } else {
        recentFollowers.clear()
        console.log('  [admin] Cleared all follow dedup entries')
      }
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad JSON')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // POST /simulate/subscribe → fire a fake subscribe alert
  if (method === 'POST' && url === '/simulate/subscribe') {
    let body
    try {
      body = await readBody(req)
      const { username } = JSON.parse(body)
      const name = (username || '').trim() || 'TestUser'
      console.log(`  [admin] Simulated subscribe: ${name}`)
      broadcastSubscribe(name)
      broadcastAlert('subscribe', name)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad JSON')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // GET /raid → full-screen pirate raid alert overlay
  if (method === 'GET' && url === '/raid') {
    serveFile(path.join(DIR, 'raid-alert.html'), res)
    return
  }

  // GET /raid-events → SSE stream for raid alerts
  if (method === 'GET' && url === '/raid-events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    raidClients.add(res)

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      raidClients.delete(res)
    })
    return
  }

  // GET /raid-playground → pirate raid alert design playground
  if (method === 'GET' && url === '/raid-playground') {
    serveFile(path.join(DIR, 'raid-alert-playground.html'), res)
    return
  }

  // GET /alert → combined follow+subscribe alert overlay
  if (method === 'GET' && url === '/alert') {
    serveFile(path.join(DIR, 'alert.html'), res)
    return
  }

  // GET /alert-events → SSE stream for combined alerts
  if (method === 'GET' && url === '/alert-events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    alertClients.add(res)

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      alertClients.delete(res)
    })
    return
  }

  // GET /follow-alert → follow alert overlay
  if (method === 'GET' && url === '/follow-alert') {
    serveFile(path.join(DIR, 'follow-alert.html'), res)
    return
  }

  // GET /subscribe-alert → subscribe alert overlay
  if (method === 'GET' && url === '/subscribe-alert') {
    serveFile(path.join(DIR, 'subscribe-alert.html'), res)
    return
  }

  // GET /follow-events → SSE stream for follow alerts
  if (method === 'GET' && url === '/follow-events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    followClients.add(res)

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      followClients.delete(res)
    })
    return
  }

  // GET /subscribe-events → SSE stream for subscribe alerts
  if (method === 'GET' && url === '/subscribe-events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    subscribeClients.add(res)

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      subscribeClients.delete(res)
    })
    return
  }

  // GET /sounds/:file → serve audio files from the sounds directory
  if (method === 'GET' && url?.startsWith('/sounds/')) {
    const file = path.basename(url.slice('/sounds/'.length))
    serveFile(path.join(DIR, 'sounds', file), res)
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  1g of Code — Live Overlay Sync Server')
  console.log('  ─────────────────────────────────────')
  console.log(`  Builder       →  http://localhost:${PORT}/`)
  console.log(`  Overlay       →  http://localhost:${PORT}/overlay`)
  console.log(`  Alert         →  http://localhost:${PORT}/alert`)
  console.log(`  Follow Alert  →  http://localhost:${PORT}/follow-alert`)
  console.log(`  Sub Alert     →  http://localhost:${PORT}/subscribe-alert`)
  console.log(`  Admin         →  http://localhost:${PORT}/admin`)
  console.log('')
  console.log(
    `  OBS: Browser Source → http://localhost:${PORT}/overlay  (1920×1080)`
  )
  console.log(
    `  OBS: Browser Source → http://localhost:${PORT}/alert  (410×450)`
  )
  console.log(
    `  OBS: Browser Source → http://localhost:${PORT}/raid   (1920×1080, full screen)`
  )
  console.log('')

  if (TWITCH_OK) {
    console.log('  [twitch] Credentials found — connecting to EventSub...')
    connectTwitch()
  } else {
    const missing = [
      'TWITCH_CLIENT_ID',
      'TWITCH_TOKEN',
      'TWITCH_BROADCASTER_ID',
    ].filter((k) => !process.env[k])
    console.log(
      `  [twitch] Not configured — add to .env: ${missing.join(', ')}`
    )
  }
})
