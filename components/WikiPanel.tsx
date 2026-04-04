'use client'

import { useState, useEffect, useCallback } from 'react'
import FileTree from './FileTree'
import MarkdownRenderer from './MarkdownRenderer'
import type { TreeNode } from '@/lib/vault'

interface Props {
  domain: string
}

export default function WikiPanel({ domain }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string>()
  const [content, setContent] = useState<string>('')
  const [selectedName, setSelectedName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [view, setView] = useState<'tree' | 'article'>('tree')

  const refreshTree = useCallback(async () => {
    if (!domain) return
    setTreeLoading(true)
    try {
      const res = await fetch(`/api/wiki?domain=${encodeURIComponent(domain)}`)
      const data = await res.json()
      setTree(data.tree || [])
    } catch {
      // ignore
    } finally {
      setTreeLoading(false)
    }
  }, [domain])

  useEffect(() => {
    refreshTree()
  }, [refreshTree])

  // Wiki file watcher — auto-refresh on changes
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/wiki-watch`)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'files-changed') {
          refreshTree()
          // If viewing an article, reload it too
          if (selectedPath) {
            reloadCurrentArticle()
          }
        }
      } catch { /* ignore */ }
    }

    return () => ws.close()
  }, [refreshTree, selectedPath])

  async function reloadCurrentArticle() {
    if (!selectedPath) return
    try {
      const res = await fetch(`/api/wiki/file?path=${encodeURIComponent(selectedPath)}`)
      const data = await res.json()
      setContent(data.content || '')
    } catch { /* ignore */ }
  }

  async function selectFile(node: TreeNode) {
    setSelectedPath(node.path)
    setSelectedName(node.name.replace(/\.md$/, ''))
    setLoading(true)
    setView('article')
    try {
      const res = await fetch(`/api/wiki/file?path=${encodeURIComponent(node.path)}`)
      const data = await res.json()
      setContent(data.content || '')
    } catch {
      setContent('Failed to load file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          {view === 'article' && (
            <button
              onClick={() => setView('tree')}
              className="text-gray-400 hover:text-gray-600 text-xs"
              title="Back to file tree"
            >
              ◀
            </button>
          )}
          <span className="text-sm font-medium text-gray-700">
            {view === 'tree' ? `Wiki — ${domain}` : selectedName}
          </span>
        </div>
        <button
          onClick={refreshTree}
          className="text-xs text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'tree' ? (
          <div className="py-2">
            {treeLoading ? (
              <p className="text-xs text-gray-400 px-3">Loading...</p>
            ) : (
              <FileTree
                nodes={tree}
                onSelect={selectFile}
                selectedPath={selectedPath}
              />
            )}
          </div>
        ) : (
          <div className="p-4">
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <MarkdownRenderer content={content} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
