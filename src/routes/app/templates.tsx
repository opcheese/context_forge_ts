/**
 * Template Library page - Browse and manage saved templates.
 */

import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id, Doc } from "../../../convex/_generated/dataModel"

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Template card component
function TemplateCard({
  template,
  onDelete,
  onEdit,
}: {
  template: Doc<"templates">
  onDelete: () => void
  onEdit: () => void
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Count blocks by zone
  const zoneCounts = template.blocks.reduce(
    (acc, block) => {
      acc[block.zone] = (acc[block.zone] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimeAgo(template.createdAt)}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-md bg-muted">
          {template.blocks.length} blocks
        </span>
        {zoneCounts.PERMANENT && (
          <span className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            PERMANENT: {zoneCounts.PERMANENT}
          </span>
        )}
        {zoneCounts.STABLE && (
          <span className="text-xs px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            STABLE: {zoneCounts.STABLE}
          </span>
        )}
        {zoneCounts.WORKING && (
          <span className="text-xs px-2 py-1 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            WORKING: {zoneCounts.WORKING}
          </span>
        )}
      </div>

      {/* Expandable details */}
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs h-7"
        >
          {expanded ? "Hide Details" : "Show Details"}
        </Button>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Blocks Preview:
              </div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {template.blocks.map((block, index) => (
                  <div
                    key={index}
                    className="text-xs p-2 rounded-md bg-muted/50 flex items-start gap-2"
                  >
                    <span className="font-mono text-muted-foreground shrink-0">
                      [{block.zone}]
                    </span>
                    <span className="truncate">{block.content.slice(0, 100)}...</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {showConfirmDelete ? (
          <>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Confirm Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirmDelete(true)}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

// Edit template dialog (metadata only - to edit blocks, load and overwrite)
function EditTemplateDialog({
  template,
  isOpen,
  onClose,
}: {
  template: Doc<"templates">
  isOpen: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? "")
  const [isLoading, setIsLoading] = useState(false)

  const updateTemplate = useMutation(api.templates.update)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await updateTemplate({
        id: template._id,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Template</h2>
        <p className="text-sm text-muted-foreground mb-4">
          To edit blocks, apply this template to a session, make changes, then save as template to overwrite.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Main template library page
function TemplatesPage() {
  const templates = useQuery(api.templates.list)
  const removeTemplate = useMutation(api.templates.remove)
  const [editingTemplate, setEditingTemplate] = useState<Doc<"templates"> | null>(null)

  const handleDelete = async (id: Id<"templates">) => {
    await removeTemplate({ id })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Template Library</h1>
        <p className="text-muted-foreground mt-1">
          Reusable session configurations for your workflows
        </p>
      </div>

      {templates === undefined ? (
        <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <h3 className="text-lg font-medium mb-2">No templates yet</h3>
          <p className="text-muted-foreground mb-4">
            Save your current session as a template to create reusable configurations.
          </p>
          <p className="text-sm text-muted-foreground">
            Use the "Save Template" button in the header when you have a session ready.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              onDelete={() => handleDelete(template._id)}
              onEdit={() => setEditingTemplate(template)}
            />
          ))}
        </div>
      )}

      {editingTemplate && (
        <EditTemplateDialog
          template={editingTemplate}
          isOpen={true}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute("/app/templates")({
  component: TemplatesPage,
})
