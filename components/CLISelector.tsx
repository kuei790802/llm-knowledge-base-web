'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Check, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ProviderStatus {
  id: string
  name: string
  installed: boolean
  authenticated: boolean
  installInstructions: string
  authInstructions: string
}

interface Props {
  provider: string
  onProviderChange: (id: string) => void
}

export default function CLISelector({ provider, onProviderChange }: Props) {
  const [providers, setProviders] = useState<ProviderStatus[]>([])

  useEffect(() => {
    fetch('/api/cli')
      .then(r => r.json())
      .then(data => setProviders(data.providers))
      .catch(() => {})
  }, [])

  const current = providers.find(p => p.id === provider)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <span className="opacity-60">CLI:</span>
          <span>{current?.name || provider}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {providers.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => p.installed && onProviderChange(p.id)}
            disabled={!p.installed}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Circle className={`h-2 w-2 fill-current ${p.installed ? 'text-green-500' : 'text-muted-foreground/40'}`} />
                <span className="font-medium">{p.name}</span>
                {p.id === provider && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
              </div>
              {!p.installed && (
                <p className="ml-4 mt-0.5 text-[11px] text-muted-foreground">
                  Install: <code className="text-xs">{p.installInstructions}</code>
                </p>
              )}
              {p.installed && !p.authenticated && (
                <p className="ml-4 mt-0.5 text-[11px] text-amber-500">
                  {p.authInstructions}
                </p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
