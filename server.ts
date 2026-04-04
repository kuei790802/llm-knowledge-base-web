import 'dotenv/config'
import { createServer, IncomingMessage } from 'http'
import { parse } from 'url'
import path from 'path'
import { execSync } from 'child_process'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import chokidar from 'chokidar'

// ── Config ──────────────────────────────────────────────────────────
const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)
const VAULT_PATH = process.env.VAULT_PATH
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''

if (!VAULT_PATH) {
  console.error('ERROR: VAULT_PATH is not set. Run setup.sh or create .env')
  process.exit(1)
}

// ── Next.js ─────────────────────────────────────────────────────────
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ── Global state ────────────────────────────────────────────────────
let activePty: pty.IPty | null = null
let activeWs: WebSocket | null = null

function killActiveSession() {
  if (activePty) {
    try { activePty.kill() } catch { /* already dead */ }
    activePty = null
  }
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    activeWs.close(4000, 'Replaced by new session')
  }
  activeWs = null
}

// ── Auth check ──────────────────────────────────────────────────────
function checkAuth(req: IncomingMessage): boolean {
  if (!ACCESS_TOKEN) return true
  const url = new URL(req.url!, `http://${req.headers.host}`)
  return url.searchParams.get('token') === ACCESS_TOKEN
}

// ── Boot ────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // ── Terminal WebSocket (/ws/terminal) ─────────────────────────────
  const termWss = new WebSocketServer({ noServer: true })

  termWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!checkAuth(req)) {
      ws.close(4001, 'Unauthorized')
      return
    }

    // Kill any previous session
    killActiveSession()
    activeWs = ws

    // Default terminal size; client sends resize on connect
    let cols = 120
    let rows = 40

    // Resolve claude CLI path (node-pty's posix_spawnp may not find it in PATH)
    let claudePath = process.env.CLAUDE_PATH || ''
    if (!claudePath) {
      try {
        claudePath = execSync('which claude', { encoding: 'utf-8' }).trim()
      } catch {
        claudePath = 'claude'  // fallback
      }
    }
    console.log(`[terminal] Using claude at: ${claudePath}`)

    const ptyProcess = pty.spawn(claudePath, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: VAULT_PATH,
      env: process.env as Record<string, string>,
    })
    activePty = ptyProcess

    console.log(`[terminal] claude started (pid ${ptyProcess.pid}), cwd: ${VAULT_PATH}`)

    // PTY → WebSocket (binary frames)
    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(Buffer.from(data, 'utf-8'), { binary: true })
      }
    })

    // PTY exit → notify client
    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[terminal] claude exited (code ${exitCode})`)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'process-exit', code: exitCode }))
      }
      activePty = null
    })

    // WebSocket → PTY
    // IMPORTANT: In the ws library, data is always Buffer regardless of text/binary frame.
    // Use the isBinary flag (not Buffer.isBuffer) to distinguish.
    ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        // Binary frame = terminal keyboard input
        ptyProcess.write(data.toString())
      } else {
        // Text frame = JSON control message
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'resize' && msg.cols && msg.rows) {
            ptyProcess.resize(Math.max(1, msg.cols), Math.max(1, msg.rows))
          }
        } catch {
          // Fallback: treat as terminal input
          ptyProcess.write(data.toString())
        }
      }
    })

    ws.on('close', () => {
      console.log('[terminal] WebSocket closed')
      if (activePty === ptyProcess) {
        try { ptyProcess.kill() } catch { /* ok */ }
        activePty = null
        activeWs = null
      }
    })

    ws.on('error', (err) => {
      console.error('[terminal] WebSocket error:', err.message)
    })
  })

  // ── Wiki watcher WebSocket (/ws/wiki-watch) ──────────────────────
  const wikiWss = new WebSocketServer({ noServer: true })
  const wikiClients = new Set<WebSocket>()

  wikiWss.on('connection', (ws: WebSocket) => {
    wikiClients.add(ws)
    ws.on('close', () => wikiClients.delete(ws))
  })

  // Watch wiki directories for changes
  const wikiGlob = path.join(VAULT_PATH, '**', 'wiki', '**', '*.md')
  const watcher = chokidar.watch(wikiGlob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  })

  watcher.on('all', () => {
    const msg = JSON.stringify({ type: 'files-changed' })
    wikiClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg)
      }
    })
  })

  // ── WebSocket upgrade routing ─────────────────────────────────────
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!, true)

    if (pathname === '/ws/terminal') {
      termWss.handleUpgrade(req, socket, head, (ws) => {
        termWss.emit('connection', ws, req)
      })
    } else if (pathname === '/ws/wiki-watch') {
      wikiWss.handleUpgrade(req, socket, head, (ws) => {
        wikiWss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  // ── Start ─────────────────────────────────────────────────────────
  server.listen(port, hostname, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║     LLM Knowledge Base — Running          ║
╠═══════════════════════════════════════════╣
║  Local:   http://localhost:${port}            ║
║  Network: http://${hostname}:${port}            ║
║  Vault:   ${VAULT_PATH.slice(0, 35).padEnd(35)}║
╚═══════════════════════════════════════════╝
    `)
  })

  // ── Cleanup on exit ───────────────────────────────────────────────
  function cleanup() {
    console.log('\n[server] Shutting down...')
    killActiveSession()
    watcher.close()
    server.close()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
})
