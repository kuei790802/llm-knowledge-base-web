import { NextRequest, NextResponse } from 'next/server'
import { listVaultDir, writeRawFile, domainToRawPath } from '@/lib/vault'
import { config } from '@/lib/config'

// GET /api/raw?domain=PMP
// Returns metadata for files in raw/ (no content)
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const rawPath = domainToRawPath(domain)

  try {
    const entries = await listVaultDir(rawPath)
    const files = entries
      .filter(e => !e.isDirectory)
      .map(e => ({ name: e.name, path: e.path }))
    return NextResponse.json({ rawPath, files })
  } catch {
    return NextResponse.json({ rawPath, files: [] })
  }
}

// POST /api/raw
// Body: FormData with `domain` and `file`
export async function POST(req: NextRequest) {
  // Access token check
  if (config.accessToken) {
    const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== config.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const formData = await req.formData()
  const domain = formData.get('domain') as string
  const file = formData.get('file') as File | null

  if (!domain || !file) {
    return NextResponse.json({ error: 'domain and file are required' }, { status: 400 })
  }

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_')

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeRawFile(domain, safeName, buffer)
    return NextResponse.json({ success: true, name: safeName, domain })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
