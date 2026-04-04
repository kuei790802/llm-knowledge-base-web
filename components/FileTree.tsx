'use client'

import { useState } from 'react'
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
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 hover:bg-gray-100 rounded text-sm text-gray-700 font-medium"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-400 text-xs">{expanded ? '▾' : '▸'}</span>
          <span className="text-gray-500 text-xs mr-1">📁</span>
          {node.name}
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

  if (!isMd) return null  // Only show markdown files

  return (
    <button
      className={`flex items-center gap-1 w-full text-left px-2 py-0.5 rounded text-sm ${
        isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-600'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node)}
    >
      <span className="text-gray-400 text-xs mr-1">📄</span>
      <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
    </button>
  )
}

export default function FileTree({ nodes, onSelect, selectedPath, depth = 0 }: Props) {
  if (nodes.length === 0) {
    return <p className="text-xs text-gray-400 px-2 py-1">No files found</p>
  }

  return (
    <div>
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
