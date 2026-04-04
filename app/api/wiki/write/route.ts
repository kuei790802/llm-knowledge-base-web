import { NextRequest, NextResponse } from 'next/server'
import { writeWikiFile } from '@/lib/vault'
import { config } from '@/lib/config'

// POST /api/wiki/write
// Body: { path: string, content: string }
// Restricted: path must be inside wiki/
export async function POST(req: NextRequest) {
  // Access token check
  if (config.accessToken) {
    const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== config.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { path: filePath, content } = await req.json() as { path?: string; content?: string }

  if (!filePath || content === undefined) {
    return NextResponse.json({ error: 'path and content are required' }, { status: 400 })
  }

  try {
    await writeWikiFile(filePath, content)
    return NextResponse.json({ success: true, path: filePath })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 403 })
  }
}
