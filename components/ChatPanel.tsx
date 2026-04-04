'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; result?: string }[]
}

interface Props {
  domain: string
  onCompileComplete?: () => void
}

export default function ChatPanel({ domain, onCompileComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [qaMode, setQaMode] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(messageText: string, mode: 'compile' | 'qa' | 'lint' | 'chat') {
    if (streaming) return

    const userMessage: Message = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    const assistantMessage: Message = { role: 'assistant', content: '', toolCalls: [] }
    setMessages(prev => [...prev, assistantMessage])
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, domain, mode }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // SSE events are separated by double newlines
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue
          const lines = eventBlock.split('\n')
          let eventType = 'message'
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataLine = line.slice(6)
          }
          if (!dataLine) continue
          const data = JSON.parse(dataLine)

          if (eventType === 'text') {
            setMessages(prev => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.content += data.text
              updated[updated.length - 1] = last
              return updated
            })
          } else if (eventType === 'tool_start') {
            setMessages(prev => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.toolCalls = [...(last.toolCalls || []), { name: data.name }]
              updated[updated.length - 1] = last
              return updated
            })
          } else if (eventType === 'done') {
            if ((mode === 'compile') && onCompileComplete) {
              onCompileComplete()
            }
          } else if (eventType === 'error') {
            setMessages(prev => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.content += `\n\n**Error:** ${data.message}`
              updated[updated.length - 1] = last
              return updated
            })
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          const last = { ...updated[updated.length - 1] }
          last.content = `Error: ${(err as Error).message}`
          updated[updated.length - 1] = last
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }

  function handleCompile() {
    const msg = qaMode
      ? `qa ${domain}: ${input}`
      : `compile ${domain}`
    const mode = qaMode ? 'qa' : 'compile'
    if (qaMode && !input.trim()) return
    sendMessage(msg, mode)
  }

  function handleLint() {
    sendMessage(`lint ${domain}`, 'lint')
  }

  function handleSend() {
    if (!input.trim() || streaming) return
    if (qaMode) {
      sendMessage(`qa ${domain}: ${input}`, 'qa')
    } else {
      sendMessage(input, 'chat')
    }
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
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✓ Uploaded **${data.name}** to raw/. Run Compile to integrate it.`,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Upload failed: ${data.error}`,
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Upload failed.',
      }])
    } finally {
      setUploadingFile(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Command bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <button
          onClick={handleCompile}
          disabled={streaming || (qaMode && !input.trim())}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {qaMode ? 'Ask' : 'Compile'}
        </button>
        <button
          onClick={handleLint}
          disabled={streaming}
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
          title="Upload file to raw/"
        >
          {uploadingFile ? 'Uploading...' : '↑ Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        {streaming && (
          <button
            onClick={() => abortRef.current?.abort()}
            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 ml-auto"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="font-medium">LLM Knowledge Base</p>
            <p className="mt-1">Domain: <strong>{domain}</strong></p>
            <p className="mt-3 text-xs">
              Click <strong>Compile</strong> to process raw files → wiki<br />
              Click <strong>Lint</strong> to check wiki health<br />
              Toggle <strong>Q&A</strong> to ask questions<br />
              Drag & drop files to upload to raw/
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {msg.toolCalls.map((tc, j) => (
                    <div key={j} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono">
                      ⚙ {tc.name}
                    </div>
                  ))}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-200">
        {qaMode && (
          <p className="text-xs text-purple-600 mb-1">Q&A mode — type your question and press Ask or Enter</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={qaMode ? 'Type your question...' : 'Chat with Claude or type a KB command...'}
            rows={2}
            className="flex-1 resize-none border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
