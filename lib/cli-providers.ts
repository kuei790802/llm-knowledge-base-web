import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface CLIProvider {
  id: string
  name: string
  command: string
  configFileName: string
  installInstructions: string
  authInstructions: string
  checkInstalled(): Promise<boolean>
  checkAuth(): Promise<boolean>
  getSpawnArgs(): string[]
  getEnv(): Record<string, string>
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function resolveCommandPath(cmd: string): string {
  try {
    return execSync(`which ${cmd}`, { encoding: 'utf-8' }).trim()
  } catch {
    return cmd
  }
}

const providers: Record<string, CLIProvider> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    configFileName: 'CLAUDE.md',
    installInstructions: 'curl -fsSL https://claude.ai/install.sh | bash',
    authInstructions: 'Run: claude auth login',
    async checkInstalled() { return commandExists('claude') },
    async checkAuth() {
      try {
        execSync('claude auth status', { stdio: 'ignore' })
        return true
      } catch { return false }
    },
    getSpawnArgs() { return [] },
    getEnv() { return {} },
  },

  codex: {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    configFileName: 'AGENTS.md',
    installInstructions: 'npm install -g @openai/codex',
    authInstructions: 'Set OPENAI_API_KEY in .env, or run codex and log in with ChatGPT',
    async checkInstalled() { return commandExists('codex') },
    async checkAuth() {
      return !!process.env.OPENAI_API_KEY
    },
    getSpawnArgs() { return [] },
    getEnv() {
      const env: Record<string, string> = {}
      if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY
      return env
    },
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    configFileName: 'GEMINI.md',
    installInstructions: 'npm install -g @google/gemini-cli',
    authInstructions: 'Run gemini and sign in with Google, or set GEMINI_API_KEY in .env',
    async checkInstalled() { return commandExists('gemini') },
    async checkAuth() {
      // Gemini prompts interactively on first use — always considered "ready"
      return !!process.env.GEMINI_API_KEY || true
    },
    getSpawnArgs() { return [] },
    getEnv() {
      const env: Record<string, string> = {}
      if (process.env.GEMINI_API_KEY) env.GEMINI_API_KEY = process.env.GEMINI_API_KEY
      return env
    },
  },
}

export function getProvider(id: string): CLIProvider {
  const p = providers[id]
  if (!p) throw new Error(`Unknown CLI provider: ${id}`)
  return p
}

export function getAllProviders(): CLIProvider[] {
  return Object.values(providers)
}

export function resolveCommand(command: string): string {
  return resolveCommandPath(command)
}

// Sync CLAUDE.md → AGENTS.md / GEMINI.md so all CLIs can read the instructions
export async function syncConfigFiles(vaultPath: string): Promise<void> {
  const claudeMd = path.join(vaultPath, 'CLAUDE.md')
  if (!fs.existsSync(claudeMd)) return

  const content = fs.readFileSync(claudeMd, 'utf-8')

  for (const provider of getAllProviders()) {
    if (provider.id === 'claude') continue
    if (!await provider.checkInstalled()) continue

    const targetPath = path.join(vaultPath, provider.configFileName)
    // Only write if the file doesn't exist or has different content
    try {
      const existing = fs.readFileSync(targetPath, 'utf-8')
      if (existing === content) continue
    } catch { /* file doesn't exist */ }

    fs.writeFileSync(targetPath, content, 'utf-8')
  }
}

export interface ProviderStatus {
  id: string
  name: string
  installed: boolean
  authenticated: boolean
  installInstructions: string
  authInstructions: string
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = []
  for (const p of getAllProviders()) {
    const installed = await p.checkInstalled()
    const authenticated = installed ? await p.checkAuth() : false
    statuses.push({
      id: p.id,
      name: p.name,
      installed,
      authenticated,
      installInstructions: p.installInstructions,
      authInstructions: p.authInstructions,
    })
  }
  return statuses
}
