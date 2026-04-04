import { NextRequest, NextResponse } from 'next/server'
import { buildFileTree, domainToWikiPath } from '@/lib/vault'

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const wikiPath = domainToWikiPath(domain)

  try {
    const tree = await buildFileTree(wikiPath)
    return NextResponse.json({ wikiPath, tree })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
