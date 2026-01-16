/**
 * Block editor page - Edit a single block's content and type.
 */

import { useState, useEffect } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../../convex/_generated/dataModel"

// Block type options
const BLOCK_TYPES = ["NOTE", "CODE", "SYSTEM", "USER", "ASSISTANT"] as const

// Format date for display
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// Block editor component
function BlockEditor({ blockId }: { blockId: Id<"blocks"> }) {
  const navigate = useNavigate()
  const block = useQuery(api.blocks.get, { id: blockId })
  const updateBlock = useMutation(api.blocks.update)
  const removeBlock = useMutation(api.blocks.remove)

  const [content, setContent] = useState("")
  const [type, setType] = useState<string>("NOTE")
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form when block loads
  useEffect(() => {
    if (block) {
      setContent(block.content)
      setType(block.type)
      setIsDirty(false)
    }
  }, [block])

  // Handle content change
  const handleContentChange = (value: string) => {
    setContent(value)
    setIsDirty(value !== block?.content || type !== block?.type)
  }

  // Handle type change
  const handleTypeChange = (value: string) => {
    setType(value)
    setIsDirty(content !== block?.content || value !== block?.type)
  }

  // Save changes
  const handleSave = async () => {
    if (!block || !isDirty) return

    setIsSaving(true)
    try {
      await updateBlock({
        id: blockId,
        content,
        type,
      })
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel and go back
  const handleCancel = () => {
    navigate({ to: "/" })
  }

  // Delete block
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this block?")) return

    await removeBlock({ id: blockId })
    navigate({ to: "/" })
  }

  // Loading state
  if (block === undefined) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading block...
      </div>
    )
  }

  // Not found state
  if (block === null) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Block not found</h2>
        <p className="text-muted-foreground mb-4">
          The block you're looking for doesn't exist or has been deleted.
        </p>
        <Link to="/">
          <Button>Go back to zones</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Block</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(block.createdAt)} · Updated{" "}
            {formatDate(block.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground px-2 py-1 rounded bg-muted">
            {block.zone}
          </span>
        </div>
      </div>

      {/* Editor form */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {/* Type selector */}
        <div>
          <label
            htmlFor="edit-block-type"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Type
          </label>
          <select
            id="edit-block-type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Content textarea */}
        <div>
          <label
            htmlFor="edit-block-content"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Content
          </label>
          <textarea
            id="edit-block-content"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
            placeholder="Enter block content..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {content.length} characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            Delete Block
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {isDirty ? "Discard" : "Back"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dirty indicator */}
      {isDirty && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          You have unsaved changes
        </p>
      )}
    </div>
  )
}

// Route component
function BlockEditorPage() {
  const { blockId } = Route.useParams()
  return <BlockEditor blockId={blockId as Id<"blocks">} />
}

export const Route = createFileRoute("/blocks/$blockId")({
  component: BlockEditorPage,
})
