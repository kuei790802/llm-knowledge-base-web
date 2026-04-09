'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-[hsl(var(--panel-header))]">
        <div className="flex items-center gap-2">
          {view === 'article' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setView('tree')}
              title="Back to file tree"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="text-sm font-medium text-foreground">
            {view === 'tree' ? `Wiki — ${domain}` : selectedName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={refreshTree}
          title="Refresh"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'tree' ? (
          <div className="py-2">
            {treeLoading ? (
              <p className="text-xs text-muted-foreground px-3 py-2">Loading...</p>
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
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <MarkdownRenderer content={content} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
