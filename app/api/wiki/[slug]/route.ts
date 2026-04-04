import { NextRequest, NextResponse } from 'next/server'
import { readVaultFile } from '@/lib/vault'

// GET /api/wiki/[slug]?path=<absolute_path>
// Read-only: returns the content of a single wiki file
export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  try {
    const content = await readVaultFile(filePath)
    return NextResponse.json({ path: filePath, content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 404 })
  }
}
