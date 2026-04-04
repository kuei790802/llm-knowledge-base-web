import { NextResponse } from 'next/server'
import { getProviderStatuses } from '@/lib/cli-providers'

export async function GET() {
  const providers = await getProviderStatuses()
  const defaultProvider = process.env.CLI_PROVIDER || 'claude'
  return NextResponse.json({ providers, default: defaultProvider })
}
