import fs from 'fs/promises'
import path from 'path'
import { config } from './config'

// Domain → wiki root path mapping (mirrors CLAUDE.md domain shorthand)
export function domainToWikiPath(domain: string): string {
  const map: Record<string, string> = {
    'claude-api': path.join(config.vaultPath, 'Anthropic', 'wiki'),
    'anthropic': path.join(config.vaultPath, 'Anthropic', 'wiki'),
    'pmp': path.join(config.vaultPath, 'PMP', 'wiki'),
    '加密貨幣': path.join(config.vaultPath, '加密貨幣', 'wiki'),
    'crypto': path.join(config.vaultPath, '加密貨幣', 'wiki'),
    '保險bot': path.join(config.vaultPath, '保險Bot專案', 'wiki'),
  }
  const key = domain.toLowerCase()
  return map[key] || path.join(config.vaultPath, domain, 'wiki')
}

export function domainToRawPath(domain: string): string {
  const map: Record<string, string> = {
    'claude-api': path.join(config.vaultPath, 'Anthropic', '00-Inbox'),
    'anthropic': path.join(config.vaultPath, 'Anthropic', '00-Inbox'),
    'pmp': path.join(config.vaultPath, 'PMP', 'raw'),
    '加密貨幣': path.join(config.vaultPath, '加密貨幣', 'raw'),
    'crypto': path.join(config.vaultPath, '加密貨幣', 'raw'),
    '保險bot': path.join(config.vaultPath, '保險Bot專案', 'raw'),
  }
  const key = domain.toLowerCase()
  return map[key] || path.join(config.vaultPath, domain, 'raw')
}

// Security: ensure filePath is inside allowedRoot (prevent path traversal)
function assertWithinRoot(filePath: string, allowedRoot: string): void {
  const resolved = path.resolve(filePath)
  const rootResolved = path.resolve(allowedRoot)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(`Path traversal denied: ${filePath}`)
  }
}

// Read any file within the vault
export async function readVaultFile(filePath: string): Promise<string> {
  assertWithinRoot(filePath, config.vaultPath)
  return fs.readFile(filePath, 'utf-8')
}

// Write ONLY to wiki/ directories
export async function writeWikiFile(filePath: string, content: string): Promise<void> {
  // Must be within the vault
  assertWithinRoot(filePath, config.vaultPath)

  // Must be in a wiki/ subdirectory
  const resolved = path.resolve(filePath)
  if (!resolved.includes(path.sep + 'wiki' + path.sep) && !resolved.endsWith(path.sep + 'wiki')) {
    throw new Error(`Write denied: path must be inside a wiki/ directory`)
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, content, 'utf-8')
}

// List files in a directory (returns relative paths from vaultPath)
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export async function listVaultDir(dirPath: string): Promise<FileEntry[]> {
  assertWithinRoot(dirPath, config.vaultPath)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .filter(e => !e.name.startsWith('.'))
    .map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
}

// Recursively build a file tree
export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
}

export async function buildFileTree(dirPath: string, depth = 0, maxDepth = 4): Promise<TreeNode[]> {
  if (depth > maxDepth) return []
  assertWithinRoot(dirPath, config.vaultPath)

  let entries: FileEntry[]
  try {
    entries = await listVaultDir(dirPath)
  } catch {
    return []
  }

  const nodes: TreeNode[] = []
  for (const entry of entries) {
    const node: TreeNode = {
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
    }
    if (entry.isDirectory) {
      node.children = await buildFileTree(entry.path, depth + 1, maxDepth)
    }
    nodes.push(node)
  }
  return nodes
}

// Get vault domains (directories that have wiki/_WORKFLOW.md)
export async function getVaultDomains(): Promise<string[]> {
  const entries = await fs.readdir(config.vaultPath, { withFileTypes: true })
  const domains: string[] = []
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'Claude Memory') continue
    const workflowPath = path.join(config.vaultPath, e.name, 'wiki', '_WORKFLOW.md')
    try {
      await fs.access(workflowPath)
      domains.push(e.name)
    } catch {
      // no _WORKFLOW.md, skip
    }
  }
  return domains
}

// Upload a file to raw/
export async function writeRawFile(domain: string, filename: string, content: Buffer | string): Promise<void> {
  const rawPath = domainToRawPath(domain)
  assertWithinRoot(rawPath, config.vaultPath)
  await fs.mkdir(rawPath, { recursive: true })
  const dest = path.join(rawPath, filename)
  assertWithinRoot(dest, config.vaultPath)
  if (typeof content === 'string') {
    await fs.writeFile(dest, content, 'utf-8')
  } else {
    await fs.writeFile(dest, content)
  }
}

// Initialize a new domain skeleton
export async function initDomain(domainName: string, description: string): Promise<void> {
  const base = path.join(config.vaultPath, domainName)
  const rawDir = path.join(base, 'raw')
  const wikiDir = path.join(base, 'wiki')
  const qaDir = path.join(wikiDir, 'qa')

  await fs.mkdir(rawDir, { recursive: true })
  await fs.mkdir(qaDir, { recursive: true })

  // raw/README.md
  await fs.writeFile(
    path.join(rawDir, 'README.md'),
    `# ${domainName} Raw — 原始資料收集區\n\n${description}\n\n把還沒整理的原始資料丟進這裡，不需要先整理。\n執行 \`compile ${domainName}\` 後，Claude 會把這裡的內容整合進 \`wiki/\`。\n`
  )

  // wiki/_WORKFLOW.md
  await fs.writeFile(
    path.join(wikiDir, '_WORKFLOW.md'),
    `# Compile & Lint Workflow — ${domainName} Domain\n\n> 這份檔案是 Claude 在執行 \`compile ${domainName}\` 或 \`lint ${domainName}\` 時的規則書。\n\n---\n\n## Source Material\n\n| 角色 | 路徑 |\n|------|------|\n| Raw 新增資料 | \`${domainName}/raw/\` |\n\n---\n\n## Article Quality Standard\n\n每篇 wiki 文章必須具備：\n\n1. **Frontmatter**\n   \`\`\`yaml\n   ---\n   type: wiki-article\n   date: YYYY-MM-DD\n   tags: [${domainName.toLowerCase()}]\n   status: seedling | growing | evergreen\n   source: "[source title or URL]"\n   ---\n   \`\`\`\n\n2. **Summary callout**\n   \`\`\`\n   > [!summary]\n   > 一到兩句話說明這篇文章的核心內容。\n   \`\`\`\n\n3. **Backlinks**\n   \`\`\`\n   ## 關聯資料\n   - [[相關文章]]\n   \`\`\`\n\n---\n\n## Compile Rules\n\n- 直接複製原始內容 → 跳過（需要加工）\n- 重複內容 → 整合到現有文章\n- 新概念 → 建立新文章\n\n---\n\n## Lint Rules\n\n| 規則 | 動作 |\n|------|------|\n| 文章缺少 frontmatter | 標記需補充 |\n| seedling 超過 30 天未更新 | 標記需複習 |\n\n---\n\n## Q&A Filing\n\n- 儲存路徑：\`${domainName}/wiki/qa/\`\n- 檔名格式：\`YYYY-MM-DD-[topic-slug].md\`\n`
  )

  // wiki/_index.md
  const today = new Date().toISOString().slice(0, 10)
  await fs.writeFile(
    path.join(wikiDir, '_index.md'),
    `---\ntype: kb-index\ndomain: ${domainName}\nlast_compiled: ${today}\narticle_count: 0\n---\n\n# ${domainName} Knowledge Base Index\n> Auto-maintained by Claude. Do not edit manually.\n\n## Domain Summary\n${description}\n\n## Concept Glossary\n| Concept | Definition | Primary Article |\n|---------|------------|-----------------|\n\n## Article Registry\n| Article | One-line Summary | Status | Last Updated |\n|---------|-----------------|--------|--------------|\n\n## Concept Connection Map\n\n## Open Gaps\n\n## Compile History\n| Date | Action | Notes |\n|------|--------|-------|\n| ${today} | Domain initialized | Empty vault |\n`
  )

  // qa/.gitkeep
  await fs.writeFile(path.join(qaDir, '.gitkeep'), '')
}
