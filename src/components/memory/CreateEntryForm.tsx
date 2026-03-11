/**
 * Form for creating a new memory entry.
 * Shows type select, title, content, and comma-separated tags.
 */

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { parseTags } from "@/lib/tags"
import type { Id } from "../../../convex/_generated/dataModel"

interface CreateEntryFormProps {
  projectId: Id<"projects">
  types: Array<{ name: string; color: string; icon: string }>
  onSubmit: (args: {
    projectId: Id<"projects">
    type: string
    title: string
    content: string
    tags: string[]
  }) => Promise<unknown>
  onCancel: () => void
}

export function CreateEntryForm({ projectId, types, onSubmit, onCancel }: CreateEntryFormProps) {
  const [type, setType] = useState(types[0]?.name ?? "")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        projectId,
        type,
        title: title.trim(),
        content: content.trim(),
        tags: parseTags(tagsInput),
      })
      // Reset form on success
      setTitle("")
      setContent("")
      setTagsInput("")
      onCancel()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1 text-xs"
        >
          {types.map((t) => (
            <option key={t.name} value={t.name}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content..."
        rows={3}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none"
      />
      <input
        type="text"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Tags (comma-separated)"
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
      />
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 px-3 text-xs" disabled={!title.trim() || isSubmitting}>
          {isSubmitting ? "Creating..." : "Create"}
        </Button>
      </div>
    </form>
  )
}
