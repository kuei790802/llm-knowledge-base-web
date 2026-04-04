'use client'

import { useState, useCallback } from 'react'
import TerminalPanel from '@/components/TerminalPanel'
import WikiPanel from '@/components/WikiPanel'
import StatusBar from '@/components/StatusBar'
import NewDomainModal from '@/components/NewDomainModal'

const DEFAULT_DOMAIN = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'Anthropic'

export default function HomePage() {
  const [domain, setDomain] = useState(DEFAULT_DOMAIN)
  const [showNewDomain, setShowNewDomain] = useState(false)
  const [mobileView, setMobileView] = useState<'chat' | 'wiki'>('chat')

  const handleDomainCreated = useCallback((newDomain: string) => {
    setDomain(newDomain)
    setShowNewDomain(false)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar
        domain={domain}
        onDomainChange={setDomain}
        onNewDomain={() => setShowNewDomain(true)}
      />

      {/* Mobile tab toggle */}
      <div className="md:hidden flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 py-2 text-sm font-medium ${mobileView === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Terminal
        </button>
        <button
          onClick={() => setMobileView('wiki')}
          className={`flex-1 py-2 text-sm font-medium ${mobileView === 'wiki' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Wiki
        </button>
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Terminal — left on desktop, conditional on mobile */}
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/2 border-r border-gray-200`}>
          <TerminalPanel domain={domain} />
        </div>

        {/* Wiki — right on desktop, conditional on mobile */}
        <div className={`${mobileView === 'wiki' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/2 bg-white`}>
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
