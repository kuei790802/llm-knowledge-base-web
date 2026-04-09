'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import TerminalPanel from '@/components/TerminalPanel'
import WikiPanel from '@/components/WikiPanel'
import StatusBar from '@/components/StatusBar'
import NewDomainModal from '@/components/NewDomainModal'

const DEFAULT_DOMAIN = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'Anthropic'
const DEFAULT_PROVIDER = process.env.NEXT_PUBLIC_CLI_PROVIDER || 'claude'

export default function HomePage() {
  const [domain, setDomain] = useState(DEFAULT_DOMAIN)
  const [provider, setProvider] = useState(DEFAULT_PROVIDER)
  const [showNewDomain, setShowNewDomain] = useState(false)
  const [mobileView, setMobileView] = useState<'chat' | 'wiki'>('chat')

  const handleDomainCreated = useCallback((newDomain: string) => {
    setDomain(newDomain)
    setShowNewDomain(false)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background">
      <StatusBar
        domain={domain}
        onDomainChange={setDomain}
        onNewDomain={() => setShowNewDomain(true)}
        provider={provider}
        onProviderChange={setProvider}
      />

      {/* Mobile tab toggle */}
      <div className="md:hidden flex border-b">
        <button
          onClick={() => setMobileView('chat')}
          className={cn(
            "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
            mobileView === 'chat'
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          Terminal
        </button>
        <button
          onClick={() => setMobileView('wiki')}
          className={cn(
            "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
            mobileView === 'wiki'
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          Wiki
        </button>
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Terminal — left panel */}
        <div className={cn(
          "flex-col w-full md:w-1/2 bg-[hsl(var(--panel-left))]",
          mobileView === 'chat' ? 'flex' : 'hidden md:flex'
        )}>
          <TerminalPanel domain={domain} provider={provider} />
        </div>

        <Separator orientation="vertical" className="hidden md:block" />

        {/* Wiki — right panel */}
        <div className={cn(
          "flex-col w-full md:w-1/2 bg-[hsl(var(--panel-right))]",
          mobileView === 'wiki' ? 'flex' : 'hidden md:flex'
        )}>
          <WikiPanel domain={domain} />
        </div>
      </div>

      {showNewDomain && (
        <NewDomainModal
          onClose={() => setShowNewDomain(false)}
          onCreated={handleDomainCreated}
        />
      )}
    </div>
  )
}
