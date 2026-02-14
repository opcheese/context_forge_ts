/**
 * Block editor page - Edit a single block's content and type.
 */

import { useState, useEffect, useMemo } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  BLOCK_TYPE_METADATA,
  getBlockTypesByCategory,
  CATEGORY_LABELS,
  isValidBlockType,
} from "@/lib/blockTypes"
import ReactMarkdown from "react-markdown"
import gfm from "remark-gfm"
import breaks from "remark-breaks"
import { MarkdownComponents } from "@/components/MarkdownComponents"
import { Puzzle, Upload, Link as LinkIcon, FolderSearch } from "lucide-react"

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
  const [type, setType] = useState<string>("note")
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const blockTypesByCategory = useMemo(() => getBlockTypesByCategory(), [])

  // Initialize form when block loads
  useEffect(() => {
    if (block) {
      setContent(block.content)
      const normalizedType = block.type.toLowerCase()
      setType(isValidBlockType(normalizedType) ? normalizedType : "note")
      setIsDirty(false)
      setIsEditing(false)
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
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel edit mode or go back
  const handleCancel = () => {
    if (isEditing) {
      setContent(block?.content || "")
      setIsEditing(false)
      setIsDirty(false)
    } else {
      navigate({ to: "/app" })
    }
  }

  // Delete block
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this block?")) return

    await removeBlock({ id: blockId })
    navigate({ to: "/app" })
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
        <Link to="/app">
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

      {/* Skill metadata (read-only) */}
      {block.type === "skill" && block.metadata && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-amber-600" />
            <span className="font-medium">{block.metadata.skillName}</span>
            {block.metadata.sourceType === "local" && <FolderSearch className="w-3.5 h-3.5 text-muted-foreground" />}
            {block.metadata.sourceType === "upload" && <Upload className="w-3.5 h-3.5 text-muted-foreground" />}
            {block.metadata.sourceType === "url" && <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {block.metadata.skillDescription && (
            <p className="text-sm text-muted-foreground">{block.metadata.skillDescription}</p>
          )}
          {block.metadata.sourceRef && (
            <p className="text-xs text-muted-foreground font-mono truncate">{block.metadata.sourceRef}</p>
          )}
        </div>
      )}

      {/* Reference-from-skill metadata (read-only) */}
      {block.type === "reference" && block.metadata?.parentSkillName && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-indigo-600" />
            <span className="text-sm">Reference from skill: <span className="font-medium">{block.metadata.parentSkillName}</span></span>
          </div>
          {block.metadata.sourceRef && (
            <p className="text-xs text-muted-foreground font-mono truncate">{block.metadata.sourceRef}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex gap-3 items-center">
          <Button variant="destructive" onClick={handleDelete}>
            Delete Block
          </Button>

          {/* Dirty indicator */}
          {isDirty && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              You have unsaved changes
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {isDirty ? "Discard" : "Back"}
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
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
            {Object.entries(blockTypesByCategory).map(([category, types]) => (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {BLOCK_TYPE_METADATA[t].displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Content display/edit */}
        <div>
          {/* Display mode */}
          {!isEditing && (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[gfm, breaks]}
                components={MarkdownComponents}
              >
                {content || 'No content yet. Click "Edit" to add content.'}
              </ReactMarkdown>
            </div>
          )}

          {/* Edit mode */}
          {isEditing && (
            <textarea
              id="edit-block-content"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-[60vh] min-h-50 max-h-[70dvh] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
              placeholder="Enter block content..."
            />
          )}

          {/* Character count */}
          <p className="mt-1 text-xs text-muted-foreground">
            {content.length} characters
          </p>
        </div>
      </div>
    </div>
  )
}

// Route component
function BlockEditorPage() {
  const { blockId } = Route.useParams()
  return <BlockEditor blockId={blockId as Id<"blocks">} />
}

export const Route = createFileRoute("/app/blocks/$blockId")({
  component: BlockEditorPage,
})
