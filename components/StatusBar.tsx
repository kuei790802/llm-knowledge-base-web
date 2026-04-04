'use client'

import { useState, useEffect } from 'react'

interface HealthData {
  vault: { path: string; accessible: boolean; claudeMdExists: boolean }
  domains: string[]
}

interface Props {
  domain: string
  onDomainChange: (d: string) => void
  onNewDomain: () => void
}

export default function StatusBar({ domain, onDomainChange, onNewDomain }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => { setHealth(data); setError(false) })
      .catch(() => setError(true))
  }, [])

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-800 text-gray-300 text-xs border-b border-gray-700">
      {/* Vault status */}
      <span className={health?.vault.accessible ? 'text-green-400' : 'text-red-400'}>
        ● {health?.vault.accessible ? 'Vault OK' : error ? 'Vault unreachable' : '...'}
      </span>

      {health?.vault.path && (
        <span className="text-gray-500 truncate max-w-[200px]" title={health.vault.path}>
          {health.vault.path}
        </span>
      )}

      {/* Domain selector */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-gray-500">Domain:</span>
        <select
          value={domain}
          onChange={e => onDomainChange(e.target.value)}
          className="bg-gray-700 text-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
        >
          {health?.domains.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
          {(!health?.domains.length) && <option value={domain}>{domain}</option>}
        </select>
        <button
          onClick={onNewDomain}
          className="px-2 py-0.5 bg-gray-600 text-gray-200 rounded hover:bg-gray-500 text-xs ml-1"
          title="Add new domain"
        >
          + New
        </button>
      </div>
    </div>
  )
}
