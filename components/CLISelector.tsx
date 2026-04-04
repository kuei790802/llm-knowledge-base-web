'use client'

import { useState, useEffect, useRef } from 'react'

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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/cli')
      .then(r => r.json())
      .then(data => setProviders(data.providers))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = providers.find(p => p.id === provider)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600"
      >
        <span className="text-gray-500">CLI:</span>
        <span>{current?.name || provider}</span>
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => {
                if (p.installed) {
                  onProviderChange(p.id)
                  setOpen(false)
                }
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 ${
                p.id === provider ? 'bg-gray-700' : ''
              } ${!p.installed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={p.installed ? 'text-green-400' : 'text-gray-500'}>
                  {p.installed ? '●' : '○'}
                </span>
                <span className="text-gray-200 font-medium">{p.name}</span>
                {p.id === provider && (
                  <span className="ml-auto text-blue-400 text-[10px]">active</span>
                )}
              </div>
              {!p.installed && (
                <div className="ml-5 mt-1 text-gray-500">
                  Install: <code className="text-gray-400">{p.installInstructions}</code>
                </div>
              )}
              {p.installed && !p.authenticated && (
                <div className="ml-5 mt-1 text-yellow-500/70">
                  {p.authInstructions}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
