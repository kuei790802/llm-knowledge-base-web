'use client'

import { useMemo } from 'react'
import { marked } from 'marked'

interface Props {
  content: string
}

// Convert Obsidian [[wikilinks]] to spans (read-only, no navigation yet)
function preprocessObsidian(md: string): string {
  return md
    // [[link|alias]] or [[link]]
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => {
      const label = alias || link
      return `<span class="wikilink" title="${link}">${label}</span>`
    })
    // Obsidian callouts: > [!type] → styled blockquote
    .replace(/^> \[!(\w+)\]\s*\n((?:>.*\n?)*)/gm, (_, type, body) => {
      const text = body.replace(/^> ?/gm, '').trim()
      return `<blockquote class="callout callout-${type.toLowerCase()}"><strong>[${type}]</strong><br>${text}</blockquote>\n`
    })
}

export default function MarkdownRenderer({ content }: Props) {
  const html = useMemo(() => {
    const preprocessed = preprocessObsidian(content)
    return marked.parse(preprocessed) as string
  }, [content])

  return (
    <div
      className="prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1 prose-code:rounded [&_.wikilink]:text-blue-600 [&_.wikilink]:underline [&_.wikilink]:cursor-pointer [&_.callout]:border-l-4 [&_.callout]:border-blue-400 [&_.callout]:bg-blue-50 [&_.callout]:p-3 [&_.callout]:my-2 [&_.callout-warning]:border-yellow-400 [&_.callout-warning]:bg-yellow-50 [&_.callout-danger]:border-red-400 [&_.callout-danger]:bg-red-50 [&_.callout-summary]:border-green-400 [&_.callout-summary]:bg-green-50"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
