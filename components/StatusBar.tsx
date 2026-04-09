'use client'

import { useState, useEffect } from 'react'
import { Activity, FolderOpen, Plus } from 'lucide-react'
import CLISelector from './CLISelector'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface HealthData {
  vault: { path: string; accessible: boolean; claudeMdExists: boolean }
  domains: string[]
}

interface Props {
  domain: string
  onDomainChange: (d: string) => void
  onNewDomain: () => void
  provider: string
  onProviderChange: (id: string) => void
}

export default function StatusBar({ domain, onDomainChange, onNewDomain, provider, onProviderChange }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => { setHealth(data); setError(false) })
      .catch(() => setError(true))
  }, [])

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-[hsl(var(--panel-header))] text-sm border-b">
      {/* Vault status */}
      <div className="flex items-center gap-1.5 text-xs">
        <Activity className={`h-3 w-3 ${health?.vault.accessible ? 'text-green-500' : 'text-destructive'}`} />
        <span className="text-muted-foreground">
          {health?.vault.accessible ? 'Vault OK' : error ? 'Unreachable' : '...'}
        </span>
      </div>

      {health?.vault.path && (
        <span className="hidden sm:inline text-xs text-muted-foreground/50 truncate max-w-[200px]" title={health.vault.path}>
          {health.vault.path}
        </span>
      )}

      <CLISelector provider={provider} onProviderChange={onProviderChange} />

      <div className="flex-1" />

      {/* Domain selector */}
      <div className="flex items-center gap-1.5">
        <FolderOpen className="h-3 w-3 text-muted-foreground" />
        <Select value={domain} onValueChange={onDomainChange}>
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs border-0 bg-transparent shadow-none focus:ring-0 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {health?.domains.map(d => (
              <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
            ))}
            {(!health?.domains.length) && <SelectItem value={domain} className="text-xs">{domain}</SelectItem>}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewDomain} title="Add new domain">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ThemeToggle />
    </div>
  )
}
