import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { config, resolveVaultPath } from '@/lib/config'
import { readVaultFile, writeWikiFile, listVaultDir, domainToWikiPath, domainToRawPath } from '@/lib/vault'
import { buildSystemPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'
export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey })

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the vault. Use this to read wiki articles, _index.md, _WORKFLOW.md, raw files, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. ONLY files inside a wiki/ directory are allowed. Use this to create or update wiki articles and _index.md.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file (must be inside wiki/)' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and subdirectories in a directory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: { type: 'string', description: 'Absolute path to the directory' },
      },
      required: ['directory'],
    },
  },
]

interface ToolInput {
  path?: string
  content?: string
  directory?: string
}

async function executeTool(name: string, input: ToolInput): Promise<string> {
  try {
    if (name === 'read_file') {
      if (!input.path) throw new Error('path is required')
      const content = await readVaultFile(input.path)
      return content
    }

    if (name === 'write_file') {
      if (!input.path || input.content === undefined) throw new Error('path and content are required')
      await writeWikiFile(input.path, input.content)
      return `Successfully wrote ${input.path}`
    }

    if (name === 'list_files') {
      if (!input.directory) throw new Error('directory is required')
      const entries = await listVaultDir(input.directory)
      return entries
        .map(e => `${e.isDirectory ? '[DIR]' : '[FILE]'} ${e.path}`)
        .join('\n')
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `ERROR: ${msg}`
  }
}

export async function POST(req: NextRequest) {
  // Access token check (skip if not configured)
  if (config.accessToken) {
    const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== config.accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  const { message, domain, mode } = await req.json() as {
    message: string
    domain: string
    mode: 'compile' | 'qa' | 'lint' | 'chat'
  }

  if (!message || !domain) {
    return new Response(JSON.stringify({ error: 'message and domain are required' }), { status: 400 })
  }

  // Load system context
  const claudeMdPath = resolveVaultPath('CLAUDE.md')
  const wikiPath = domainToWikiPath(domain)
  const workflowPath = path.join(wikiPath, '_WORKFLOW.md')
  const indexPath = path.join(wikiPath, '_index.md')

  let claudeMd = ''
  let workflowMd = ''
  let indexMdFull = ''

  try { claudeMd = await readVaultFile(claudeMdPath) } catch { claudeMd = '(CLAUDE.md not found)' }
  try { workflowMd = await readVaultFile(workflowPath) } catch { workflowMd = '(_WORKFLOW.md not found)' }
  try {
    if (mode === 'compile' || mode === 'lint') {
      indexMdFull = await readVaultFile(indexPath)
    }
  } catch { /* ok, first compile */ }

  const systemPrompt = buildSystemPrompt({
    claudeMd,
    workflowMd,
    indexMdFull: mode === 'compile' || mode === 'lint' ? indexMdFull : undefined,
    indexMdSummary: mode === 'qa' ? indexMdFull.slice(0, 4000) : undefined,
    vaultPath: config.vaultPath,
    domain,
  })

  // SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: message }
        ]

        // Agentic loop: keep going until end_turn
        while (true) {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 8192,
            system: systemPrompt,
            tools: TOOLS,
            messages,
          })

          // Stream text content blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              // Stream text word by word for better UX
              send('text', { text: block.text })
            } else if (block.type === 'tool_use') {
              send('tool_start', { name: block.name, input: block.input })
            }
          }

          if (response.stop_reason === 'end_turn') {
            send('done', { stop_reason: 'end_turn' })
            break
          }

          if (response.stop_reason === 'tool_use') {
            // Execute all tool calls
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const block of response.content) {
              if (block.type === 'tool_use') {
                const result = await executeTool(block.name, block.input as ToolInput)
                send('tool_result', { name: block.name, result: result.slice(0, 500) })
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                })
              }
            }

            // Append assistant + tool results to messages
            messages.push({ role: 'assistant', content: response.content })
            messages.push({ role: 'user', content: toolResults })
            continue
          }

          // Any other stop reason — stop
          send('done', { stop_reason: response.stop_reason })
          break
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send('error', { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
