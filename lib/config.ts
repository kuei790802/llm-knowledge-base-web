import path from 'path'

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const config = {
  vaultPath: required('VAULT_PATH'),
  defaultDomain: process.env.DEFAULT_DOMAIN || '',
  accessToken: process.env.ACCESS_TOKEN || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cliProvider: process.env.CLI_PROVIDER || 'claude',
}

export function resolveVaultPath(...parts: string[]): string {
  return path.resolve(config.vaultPath, ...parts)
}
