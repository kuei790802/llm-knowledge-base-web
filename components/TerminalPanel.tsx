'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

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
  const exitedRef = useRef(false)   // use ref to avoid stale closure in callbacks
  const maxReconnects = 3

  const [connected, setConnected] = useState(false)
  const [exited, setExited] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [qaMode, setQaMode] = useState(false)
  const [qaInput, setQaInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5',
          selectionBackground: '#33467c',
        },
        cursorBlink: true,
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(containerRef.current)
      // Defer initial fit so the container has rendered dimensions
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
      // Send init message with provider and terminal size
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
        // Binary frame: PTY output
        term.write(new Uint8Array(event.data))
      } else {
        // Text frame: control message
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
      // Only auto-reconnect if claude didn't intentionally exit
      if (!exitedRef.current && reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++
        term.write(`\r\n\x1b[33m[Disconnected. Reconnecting (${reconnectCountRef.current}/${maxReconnects})...]\x1b[0m\r\n`)
        reconnectTimerRef.current = setTimeout(connectWs, 2000)
      }
    }

    // Terminal keyboard input → WebSocket as binary frame
    const inputDisposable = term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    // Resize observer — debounced via sendResize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      sendResize(ws, term)
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Cleanup for this connection
    return () => {
      inputDisposable.dispose()
      resizeObserver.disconnect()
    }
  }, [accessToken, provider])

  // Connect/reconnect when provider changes
  useEffect(() => {
    let mounted = true
    // Close existing connection before starting new one
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
    let cleanup: (() => void) | undefined
    cleanup = connectWs()

    return () => {
      mounted = false
      cleanup?.()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      // Only close WS and dispose terminal on real unmount (not Strict Mode fake unmount)
      setTimeout(() => {
        if (!mounted) {
          wsRef.current?.close()
          termRef.current?.dispose()
          termRef.current = null
        }
      }, 0)
    }
  }, [provider]) // eslint-disable-line react-hooks/exhaustive-deps

  function sendCommand(cmd: string) {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(new TextEncoder().encode(cmd))
    }
  }

  function handleReconnect() {
    exitedRef.current = false
    reconnectCountRef.current = 0
    setExited(false)
    connectWs()
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <button
          onClick={() => sendCommand(`compile ${domain}\n`)}
          disabled={!connected}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Compile
        </button>
        <button
          onClick={() => sendCommand(`lint ${domain}\n`)}
          disabled={!connected}
          className="px-3 py-1 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lint
        </button>
        <button
          onClick={() => setQaMode(!qaMode)}
          className={`px-3 py-1 text-sm rounded ${qaMode ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Q&A {qaMode ? '(ON)' : '(OFF)'}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
        >
          {uploadingFile ? 'Uploading...' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        <span className={`ml-auto text-xs ${connected ? 'text-green-600' : 'text-red-500'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      {/* Q&A input bar */}
      {qaMode && (
        <div className="flex gap-2 px-3 py-2 bg-purple-50 border-b border-purple-200">
          <input
            type="text"
            value={qaInput}
            onChange={e => setQaInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && qaInput.trim()) {
                sendCommand(`qa ${domain}: ${qaInput}\n`)
                setQaInput('')
              }
            }}
            placeholder="Type your question..."
            className="flex-1 border border-purple-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={() => { if (qaInput.trim()) { sendCommand(`qa ${domain}: ${qaInput}\n`); setQaInput('') } }}
            disabled={!qaInput.trim() || !connected}
            className="px-4 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      )}

      {/* Terminal container */}
      <div className="flex-1 relative bg-[#1a1b26] overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 p-1" />

        {/* Session ended overlay */}
        {exited && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="text-center">
              <p className="text-gray-300 mb-3">Session ended.</p>
              <button
                onClick={handleReconnect}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
