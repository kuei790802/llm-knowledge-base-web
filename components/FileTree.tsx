'use client'

import { useState } from 'react'
import { ChevronRight, Folder, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TreeNode } from '@/lib/vault'

interface Props {
  nodes: TreeNode[]
  onSelect: (node: TreeNode) => void
  selectedPath?: string
  depth?: number
}

function NodeItem({ node, onSelect, selectedPath, depth = 0 }: { node: TreeNode; onSelect: (n: TreeNode) => void; selectedPath?: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isSelected = node.path === selectedPath
  const isMd = node.name.endsWith('.md')

  if (node.isDirectory) {
    return (
      <div>
        <button
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 hover:bg-accent rounded-sm text-sm text-foreground"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight className={cn(
            "h-3 w-3 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90"
          )} />
          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map(child => (
              <NodeItem
                key={child.path}
                node={child}
                onSelect={onSelect}
                selectedPath={selectedPath}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!isMd) return null

  return (
    <button
      className={cn(
        "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-sm text-sm transition-colors",
        isSelected
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      onClick={() => onSelect(node)}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
    </button>
  )
}

export default function FileTree({ nodes, onSelect, selectedPath, depth = 0 }: Props) {
  if (nodes.length === 0) {
    return <p className="text-xs text-muted-foreground px-3 py-2">No files found</p>
  }

  return (
    <div className="space-y-0.5">
      {nodes.map(node => (
        <NodeItem
          key={node.path}
          node={node}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={depth}
        />
      ))}
    </div>
  )
}
