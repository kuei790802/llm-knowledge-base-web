'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { Send, Upload, Play, Search, Terminal as TerminalIcon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Terminal always uses a dark theme — CLI tools emit hardcoded RGB colors
// designed for dark backgrounds (24-bit true color), so a light terminal
// would render their output invisible. Same approach as VS Code's terminal.
const TERM_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#1a1b26',        // hidden by default (matches background)
  cursorAccent: '#c0caf5',  // visible when advanced mode is on
  selectionBackground: '#33467c',
  black: '#414868', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
  blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#c0caf5',
  brightBlack: '#565f89', brightRed: '#f7768e', brightGreen: '#9ece6a',
  brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff', brightWhite: '#c0caf5',
}

interface Props {
  domain: string
  provider: string
  accessToken?: string
}

export default function TerminalPanel({ domain, provider, accessToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitedRef = useRef(false)
  const maxReconnects = 3

  const [connected, setConnected] = useState(false)
  const [exited, setExited] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [input, setInput] = useState('')
  const [advancedMode, setAdvancedMode] = useState(false)
  const advancedModeRef = useRef(false)
  const isComposingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Send resize to server (debounced via requestAnimationFrame)
  const pendingResizeRef = useRef<number | null>(null)
  function sendResize(ws: WebSocket, term: Terminal) {
    if (pendingResizeRef.current !== null) {
      cancelAnimationFrame(pendingResizeRef.current)
    }
    pendingResizeRef.current = requestAnimationFrame(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })
  }

  const connectWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    // Initialize xterm only once
    if (!termRef.current && containerRef.current) {
      const term = new Terminal({
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.2,
        theme: TERM_THEME,
        cursorBlink: false,
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(containerRef.current)
      requestAnimationFrame(() => fitAddon.fit())
      termRef.current = term
      fitAddonRef.current = fitAddon
    }

    const term = termRef.current!
    const fitAddon = fitAddonRef.current!

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const tokenParam = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
    const wsUrl = `${proto}//${window.location.host}/ws/terminal${tokenParam}`

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setExited(false)
      exitedRef.current = false
      reconnectCountRef.current = 0
      requestAnimationFrame(() => {
        fitAddon.fit()
        ws.send(JSON.stringify({
          type: 'init',
          provider,
          cols: term.cols,
          rows: term.rows,
        }))
      })
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type === 'ready') {
            setConnected(true)
          } else if (msg.type === 'process-exit') {
            exitedRef.current = true
            setExited(true)
            term.write(`\r\n\x1b[33m[Process exited with code ${msg.code}]\x1b[0m\r\n`)
          } else if (msg.type === 'error') {
            term.write(`\r\n\x1b[31m[Error: ${msg.message}]\x1b[0m\r\n`)
          }
        } catch {
          term.write(event.data as string)
        }
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (wsRef.current !== ws) return
      if (!exitedRef.current && reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++
        term.write(`\r\n\x1b[33m[Disconnected. Reconnecting (${reconnectCountRef.current}/${maxReconnects})...]\x1b[0m\r\n`)
        reconnectTimerRef.current = setTimeout(connectWs, 2000)
      }
    }

    // Terminal keyboard input -> WebSocket (only in advanced mode)
    const inputDisposable = term.onData((data: string) => {
      if (advancedModeRef.current && ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      sendResize(ws, term)
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      inputDisposable.dispose()
      resizeObserver.disconnect()
    }
  }, [accessToken, provider])

  // Connect/reconnect when provider changes
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    setConnected(false)

    if (!isFirstMount.current && termRef.current) {
      termRef.current.clear()
      termRef.current.write(`\x1b[36m[Switching to ${provider}...]\x1b[0m\r\n`)
    }
    isFirstMount.current = false

    const cleanup = connectWs()

    return () => {
      cleanup?.()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }
  }, [provider]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dispose terminal on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      termRef.current?.dispose()
      termRef.current = null
    }
  }, [])

  function sendCommand(cmd: string) {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(new TextEncoder().encode(cmd))
    }
  }

  // Send text then Enter separately so CLI treats Enter as "submit"
  function submitToTerminal(text: string) {
    sendCommand(text)
    setTimeout(() => sendCommand('\r'), 50)
  }

  function handleReconnect() {
    exitedRef.current = false
    reconnectCountRef.current = 0
    setExited(false)
    connectWs()
  }

  function toggleAdvancedMode() {
    const next = !advancedModeRef.current
    advancedModeRef.current = next
    setAdvancedMode(next)
    if (termRef.current) {
      termRef.current.options.cursorBlink = next
      termRef.current.options.theme = {
        ...termRef.current.options.theme,
        cursor: next ? TERM_THEME.cursorAccent : TERM_THEME.background,
      }
    }
    if (next) termRef.current?.focus()
    else chatInputRef.current?.focus()
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true)
    const form = new FormData()
    form.append('domain', domain)
    form.append('file', file)
    try {
      const res = await fetch('/api/raw', { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        termRef.current?.write(`\r\n\x1b[32m[Uploaded ${data.name} to raw/]\x1b[0m\r\n`)
      } else {
        termRef.current?.write(`\r\n\x1b[31m[Upload failed: ${data.error}]\x1b[0m\r\n`)
      }
    } catch {
      termRef.current?.write(`\r\n\x1b[31m[Upload failed]\x1b[0m\r\n`)
    } finally {
      setUploadingFile(false)
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
    >
      {/* Command bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-[hsl(var(--panel-header))] flex-wrap">
        <Button
          onClick={() => submitToTerminal(`compile ${domain}`)}
          disabled={!connected}
          size="sm"
          className="h-7 text-xs"
        >
          <Play className="h-3 w-3" />
          Compile
        </Button>
        <Button
          onClick={() => submitToTerminal(`lint ${domain}`)}
          disabled={!connected}
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
        >
          <Search className="h-3 w-3" />
          Lint
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
        >
          <Upload className="h-3 w-3" />
          {uploadingFile ? 'Uploading...' : 'Upload'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-destructive'}`} />
          <span className="text-xs text-muted-foreground">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Terminal container — always dark (CLI tools use hardcoded RGB for dark bg) */}
      <div className="flex-1 relative bg-[#1a1b26] overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 p-1" />

        {/* Session ended overlay */}
        {exited && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
            <div className="text-center">
              <p className="text-muted-foreground mb-3 text-sm">Session ended.</p>
              <Button onClick={handleReconnect} size="sm">
                <RefreshCw className="h-3.5 w-3.5" />
                Reconnect
              </Button>
            </div>
          </div>
        )}

        {/* Advanced mode toggle */}
        <Button
          onClick={toggleAdvancedMode}
          size="sm"
          variant={advancedMode ? 'default' : 'ghost'}
          className={cn(
            "absolute bottom-2 right-2 z-10 h-6 text-[11px] opacity-60 hover:opacity-100 transition-opacity",
            !advancedMode && "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <TerminalIcon className="h-3 w-3" />
          Terminal{advancedMode ? ' ON' : ''}
        </Button>
      </div>

      {/* Chat input bar */}
      <div className="flex gap-2 px-3 py-2 border-t bg-muted/30">
        <Input
          ref={chatInputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onCompositionStart={() => { isComposingRef.current = true }}
          onCompositionEnd={() => { isComposingRef.current = false }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !isComposingRef.current && input.trim() && connected) {
              submitToTerminal(input)
              setInput('')
            }
          }}
          placeholder="輸入指令或問題... / Type a command or question..."
          className="flex-1 h-9 text-sm"
          disabled={!connected}
        />
        <Button
          onClick={() => { if (input.trim() && connected) { submitToTerminal(input); setInput('') } }}
          disabled={!input.trim() || !connected}
          size="icon"
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
