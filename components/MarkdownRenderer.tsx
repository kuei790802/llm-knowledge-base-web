'use client'

import { useMemo } from 'react'
import { marked } from 'marked'

interface Props {
  content: string
}

// Convert Obsidian [[wikilinks]] to spans (read-only, no navigation yet)
function preprocessObsidian(md: string): string {
  return md
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => {
      const label = alias || link
      return `<span class="wikilink" title="${link}">${label}</span>`
    })
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
      className={[
        'prose prose-sm dark:prose-invert max-w-none',
        // Headings
        'prose-headings:text-foreground',
        // Code blocks
        'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border',
        // Inline code
        'prose-code:text-pink-600 dark:prose-code:text-pink-400',
        'prose-code:bg-pink-50 dark:prose-code:bg-pink-950/30',
        'prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
        // Links
        'prose-a:text-primary',
        // Wikilinks
        '[&_.wikilink]:text-primary [&_.wikilink]:underline [&_.wikilink]:underline-offset-2 [&_.wikilink]:cursor-pointer',
        // Callouts
        '[&_.callout]:border-l-4 [&_.callout]:rounded-r [&_.callout]:border-primary/40 [&_.callout]:bg-primary/5 [&_.callout]:p-3 [&_.callout]:my-3 [&_.callout]:not-italic',
        '[&_.callout-warning]:border-amber-400 [&_.callout-warning]:bg-amber-50 dark:[&_.callout-warning]:bg-amber-950/20',
        '[&_.callout-danger]:border-red-400 [&_.callout-danger]:bg-red-50 dark:[&_.callout-danger]:bg-red-950/20',
        '[&_.callout-summary]:border-green-400 [&_.callout-summary]:bg-green-50 dark:[&_.callout-summary]:bg-green-950/20',
        // Tables
        'prose-th:text-foreground prose-td:text-foreground/80',
        // HR
        'prose-hr:border-border',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
