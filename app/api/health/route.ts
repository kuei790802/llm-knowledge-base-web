import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { config } from '@/lib/config'
import { getVaultDomains } from '@/lib/vault'

export async function GET() {
  const status = {
    vault: {
      path: config.vaultPath,
      accessible: false,
      claudeMdExists: false,
    },
    domains: [] as string[],
    timestamp: new Date().toISOString(),
  }

  try {
    await fs.access(config.vaultPath)
    status.vault.accessible = true

    const claudeMdPath = path.join(config.vaultPath, 'CLAUDE.md')
    try {
      await fs.access(claudeMdPath)
      status.vault.claudeMdExists = true
    } catch { /* ok */ }

    status.domains = await getVaultDomains()
  } catch { /* vault not accessible */ }

  const healthy = status.vault.accessible
  return NextResponse.json(status, { status: healthy ? 200 : 503 })
}
