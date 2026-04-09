'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  onClose: () => void
  onCreated: (domainName: string) => void
}

export default function NewDomainModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        onCreated(name.trim())
      } else {
        setError(data.error || 'Failed to create domain')
      }
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Knowledge Domain</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="domain-name">
              Domain Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="domain-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cryptography, Machine Learning"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate() }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain-desc">Description (optional)</Label>
            <Textarea
              id="domain-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What knowledge goes in this domain?"
              rows={3}
              className="resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? 'Creating...' : 'Create Domain'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
