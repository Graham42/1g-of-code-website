#!/usr/bin/env bun
// Claude Code Alert Server — 1g of Code stream overlay
// Port 3001 (separate from overlays server on 3000)
// Usage: bun claude-alerts/server.ts [port]

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.argv[2] || process.env.PORT || '3001', 10)

const claudeClients = new Set<http.ServerResponse>()

function broadcast(data: unknown) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of claudeClients) {
    try {
      res.write(msg)
    } catch {}
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
}

function serveFile(filePath: string, res: http.ServerResponse) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'text/html; charset=utf-8',
    })
    res.end(data)
  })
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // ── Static pages ─────────────────────────────────────────────
  if (method === 'GET' && url === '/') {
    serveFile(path.join(__dirname, 'admin.html'), res)
    return
  }
  if (method === 'GET' && url === '/overlay') {
    serveFile(path.join(__dirname, 'overlay.html'), res)
    return
  }
  if (method === 'GET' && url === '/playground') {
    serveFile(path.join(__dirname, 'playground.html'), res)
    return
  }

  // ── SSE stream for overlay ────────────────────────────────────
  if (method === 'GET' && url === '/claude-events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    claudeClients.add(res)
    console.log(`  [sse] Client connected (${claudeClients.size} total)`)

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(ping)
      claudeClients.delete(res)
      console.log(`  [sse] Client disconnected (${claudeClients.size} total)`)
    })
    return
  }

  // ── Receive notification from Claude Code hook ────────────────
  if (method === 'POST' && url === '/claude/notify') {
    let body
    try {
      body = await readBody(req)
      const data = JSON.parse(body)
      const type = data.hook_event_name || data.type || 'Stop'
      const sessionId = (data.session_id || data.session || '').slice(0, 8)
      const cwd = data.cwd || ''
      const projectName = cwd ? path.basename(cwd) : ''
      const payload = { type, sessionId, projectName, ts: Date.now() }
      console.log(
        `  [notify] ${type} · ${sessionId || '?'} · ${projectName || cwd || 'unknown'}`
      )
      broadcast(payload)
    } catch {
      res.writeHead(400)
      res.end('Bad JSON')
      return
    }
    res.writeHead(200)
    res.end('ok')
    return
  }

  // ── Simulate endpoints (admin testing) ───────────────────────
  if (method === 'POST' && url === '/simulate/stop') {
    let sessionId = 'test01',
      projectName = 'my-project',
      mute = false
    try {
      const data = JSON.parse(await readBody(req))
      sessionId = data.sessionId || sessionId
      projectName = data.projectName || projectName
      mute = !!data.mute
    } catch {}
    const payload = {
      type: 'Stop',
      sessionId,
      projectName,
      mute,
      ts: Date.now(),
    }
    console.log(
      `  [admin] Simulated Stop · ${sessionId}${mute ? ' · muted' : ''}`
    )
    broadcast(payload)
    res.writeHead(200)
    res.end('ok')
    return
  }

  if (method === 'POST' && url === '/simulate/notification') {
    let sessionId = 'test02',
      projectName = 'my-project',
      mute = false
    try {
      const data = JSON.parse(await readBody(req))
      sessionId = data.sessionId || sessionId
      projectName = data.projectName || projectName
      mute = !!data.mute
    } catch {}
    const payload = {
      type: 'Notification',
      sessionId,
      projectName,
      mute,
      ts: Date.now(),
    }
    console.log(
      `  [admin] Simulated Notification · ${sessionId}${mute ? ' · muted' : ''}`
    )
    broadcast(payload)
    res.writeHead(200)
    res.end('ok')
    return
  }

  // ── Proxy sounds from overlays/sounds ────────────────────────
  if (method === 'GET' && url?.startsWith('/sounds/')) {
    const file = path.basename(url.slice('/sounds/'.length))
    serveFile(path.join(__dirname, '..', 'overlays', 'sounds', file), res)
    return
  }

  // ── Butler voice snippets ─────────────────────────────────────
  if (method === 'GET' && url?.startsWith('/butler-sounds/')) {
    const file = decodeURIComponent(
      path.basename(url.slice('/butler-sounds/'.length))
    )
    serveFile(path.join(__dirname, 'sounds', file), res)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  Claude Code Alert Server — 1g of Code')
  console.log('  ──────────────────────────────────────')
  console.log(`  Admin      →  http://localhost:${PORT}/`)
  console.log(`  Overlay    →  http://localhost:${PORT}/overlay`)
  console.log(`  Playground →  http://localhost:${PORT}/playground`)
  console.log('')
  console.log(
    `  OBS: Browser Source → http://localhost:${PORT}/overlay  (1920×1080)`
  )
  console.log('')
  console.log(`  Hook endpoint: POST http://localhost:${PORT}/claude/notify`)
  console.log('')
})
