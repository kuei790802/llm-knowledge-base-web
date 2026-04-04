import { NextRequest, NextResponse } from 'next/server'
import { initDomain } from '@/lib/vault'
import { config } from '@/lib/config'

export async function POST(req: NextRequest) {
  // Access token check
  if (config.accessToken) {
    const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== config.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { name, description } = await req.json() as { name?: string; description?: string }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Sanitize domain name (allow Unicode for Chinese names)
  const safeName = name.trim().replace(/[/\\<>:"|?*]/g, '_')

  try {
    await initDomain(safeName, description?.trim() || '')
    return NextResponse.json({ success: true, name: safeName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
