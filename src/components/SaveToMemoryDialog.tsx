/**
 * Dialog for saving selected brainstorm text to project memory.
 * Calls the LLM draft action for pre-filling, then shows CreateEntryForm.
 */

import { useState, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { CreateEntryForm } from "@/components/memory/CreateEntryForm"

interface SaveToMemoryDialogProps {
  projectId: Id<"projects">
  selectedText: string
  schemaTypes: Array<{ name: string; color: string; icon: string }>
  onSave: (args: {
    projectId: Id<"projects">
    type: string
    title: string
    content: string
    tags: string[]
  }) => Promise<unknown>
  onClose: () => void
}

export function SaveToMemoryDialog({
  projectId,
  selectedText,
  schemaTypes,
  onSave,
  onClose,
}: SaveToMemoryDialogProps) {
  const draftMemoryEntry = useAction(api.memoryDraft.draftMemoryEntry)
  const [isDrafting, setIsDrafting] = useState(true)
  const [draft, setDraft] = useState<{
    type: string
    title: string
    content: string
    tags: string[]
    duplicateWarning?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchDraft() {
      try {
        const result = await draftMemoryEntry({ projectId, selectedText })
        if (!cancelled) {
          setDraft(result)
          setIsDrafting(false)
        }
      } catch {
        if (!cancelled) {
          setDraft({
            type: schemaTypes[0]?.name ?? "note",
            title: selectedText.slice(0, 60).split("\n")[0],
            content: selectedText,
            tags: [],
          })
          setError("Could not generate draft. Fill in manually.")
          setIsDrafting(false)
        }
      }
    }
    fetchDraft()
    return () => { cancelled = true }
  }, [projectId, selectedText, draftMemoryEntry, schemaTypes])

  if (isDrafting) {
    return (
      <div className="border border-border rounded-lg p-4 bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">Drafting memory entry...</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-yellow-600">{error}</p>
      )}
      {draft?.duplicateWarning && (
        <p className="text-xs text-blue-600">Note: {draft.duplicateWarning}</p>
      )}
      <CreateEntryForm
        projectId={projectId}
        types={schemaTypes}
        onSubmit={onSave}
        onCancel={onClose}
        initialValues={draft ?? undefined}
      />
    </div>
  )
}
