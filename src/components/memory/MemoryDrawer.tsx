import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { springs } from "@/lib/motion"
import { useMemory } from "@/hooks/useMemory"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ChevronUp, ChevronDown, X, Search, Pin, Plus, Pencil, Trash2, Tag } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { parseTags } from "@/lib/tags"
import { CreateEntryForm } from "./CreateEntryForm"

interface MemoryDrawerProps {
  projectId: Id<"projects"> | undefined
  sessionId: Id<"sessions"> | undefined
  pinnedMemories?: Id<"memoryEntries">[]
  sessionTags?: string[]
}

export function MemoryDrawer({ projectId, sessionId, pinnedMemories, sessionTags }: MemoryDrawerProps) {
  const [state, setState] = useState<"collapsed" | "peek" | "full">("collapsed")
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  // Task 9: create form state
  const [isCreating, setIsCreating] = useState(false)

  // Task 10: edit/delete state
  const [editingId, setEditingId] = useState<Id<"memoryEntries"> | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"memoryEntries"> | null>(null)
  const [editType, setEditType] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editTags, setEditTags] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Task 12: session tags editing
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [tagsInput, setTagsInput] = useState("")
  const [isSavingTags, setIsSavingTags] = useState(false)

  const memory = useMemory(projectId, sessionId)
  const pinnedSet = useMemo(
    () => new Set(pinnedMemories ?? []),
    [pinnedMemories]
  )

  const totalEntries = memory.entries.length
  const hasSchema = !!memory.schema

  // Filter entries for full view
  const filteredEntries = useMemo(() => {
    let filtered = memory.entries
    if (typeFilter) {
      filtered = filtered.filter((e) => e.type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [memory.entries, typeFilter, searchQuery])

  // Type summary for peek view
  const typeSummary = useMemo(() => {
    if (!memory.schema?.types) return []
    return memory.schema.types.map((t) => ({
      ...t,
      count: memory.countsByType[t.name] ?? 0,
    }))
  }, [memory.schema, memory.countsByType])

  // Don't render if no project linked
  if (!projectId) return null

  // Task 10: start editing an entry
  const startEditing = (entry: { _id: Id<"memoryEntries">; type: string; title: string; content: string; tags: string[] }) => {
    setEditingId(entry._id)
    setEditType(entry.type)
    setEditTitle(entry.title)
    setEditContent(entry.content)
    setEditTags(entry.tags.join(", "))
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  const saveEditing = async (entryId: Id<"memoryEntries">) => {
    if (!editTitle.trim() || isSaving) return
    setIsSaving(true)
    try {
      await memory.updateEntry({
        id: entryId,
        type: editType,
        title: editTitle.trim(),
        content: editContent.trim(),
        tags: parseTags(editTags),
      })
      setEditingId(null)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingId || isDeleting) return
    setIsDeleting(true)
    try {
      await memory.removeEntry({ id: deletingId })
      setDeletingId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  // Task 12: session tags save
  const saveSessionTags = async () => {
    if (!memory.updateSessionTags || isSavingTags) return
    setIsSavingTags(true)
    try {
      await memory.updateSessionTags(parseTags(tagsInput))
      setIsEditingTags(false)
    } finally {
      setIsSavingTags(false)
    }
  }

  // Task 11: Schema setup content
  const renderSchemaSetup = () => (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <h3 className="text-sm font-medium mb-2">Set up memory types for this project</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Choose a starter template to define what types of memory entries you can create.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {(memory.schemaTemplates ?? []).map((template) => (
          <Button
            key={template.name}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => memory.createSchemaFromTemplate({ projectId: projectId!, templateName: template.name })}
          >
            {template.name} ({template.typeCount} types)
          </Button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Collapsed bar */}
      {state === "collapsed" && (
        <motion.div
          initial={{ y: 48 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 h-10 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-center cursor-pointer z-30 hover:bg-accent/50 transition-colors"
          onClick={() => setState("peek")}
        >
          <ChevronUp className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {hasSchema
              ? `${totalEntries} memor${totalEntries === 1 ? "y" : "ies"}`
              : "Set up memory"}
          </span>
        </motion.div>
      )}

      {/* Peek / Full drawer */}
      <AnimatePresence>
        {(state === "peek" || state === "full") && (
          <>
            {/* Backdrop (full only) */}
            {state === "full" && (
              <motion.div
                className="fixed inset-0 bg-black/20 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setState("collapsed")}
              />
            )}

            {/* Drawer */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-xl z-40 flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0, height: state === "peek" ? 200 : "50vh" }}
              exit={{ y: "100%" }}
              transition={springs.smooth}
            >
              {/* Handle bar + controls */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Memory ({totalEntries})
                  </span>
                  {/* Task 9: + button to create entry (only when schema exists) */}
                  {hasSchema && state === "full" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsCreating(!isCreating)}
                      title="Create memory entry"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {state === "peek" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("full")}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  )}
                  {state === "full" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("peek")}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("collapsed")}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Task 11: Schema setup — shown when no schema exists */}
              {!hasSchema && (state === "peek" || state === "full") && renderSchemaSetup()}

              {/* Peek: type summary (only with schema) */}
              {hasSchema && state === "peek" && (
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {typeSummary.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => {
                        setTypeFilter(t.name)
                        setState("full")
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-accent/50 transition-colors"
                      style={{ borderColor: t.color + "40" }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">({t.count})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full: search + filter + entry list (only with schema) */}
              {hasSchema && state === "full" && (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Search + filter bar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search memories..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
                      />
                    </div>
                    {/* Type filter pills */}
                    <div className="flex gap-1 overflow-x-auto">
                      <button
                        onClick={() => setTypeFilter(null)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                          !typeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                      >
                        All
                      </button>
                      {typeSummary.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => setTypeFilter(typeFilter === t.name ? null : t.name)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                            typeFilter === t.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t.icon} {t.name} ({t.count})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Task 12: Session tags section */}
                  {memory.updateSessionTags && (
                    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border shrink-0">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {!isEditingTags ? (
                        <>
                          <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                            {(sessionTags ?? []).length > 0 ? (
                              (sessionTags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No session tags</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={() => {
                              setTagsInput((sessionTags ?? []).join(", "))
                              setIsEditingTags(true)
                            }}
                          >
                            Edit tags
                          </Button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="Tags (comma-separated)"
                            className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={() => setIsEditingTags(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={saveSessionTags}
                            disabled={isSavingTags}
                          >
                            {isSavingTags ? "..." : "Save"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Entry list */}
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                    {/* Task 9: Create entry form */}
                    {isCreating && memory.schema?.types && (
                      <CreateEntryForm
                        projectId={projectId!}
                        types={memory.schema.types}
                        onSubmit={(args) => memory.createEntry(args)}
                        onCancel={() => setIsCreating(false)}
                      />
                    )}

                    {filteredEntries.map((entry) => {
                      const isEditing = editingId === entry._id

                      if (isEditing) {
                        // Task 10: Inline editing form
                        return (
                          <div
                            key={entry._id}
                            className="rounded-lg border border-primary/50 p-3 space-y-2 bg-card"
                          >
                            <div className="flex gap-2">
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value)}
                                className="rounded border border-input bg-background px-2 py-1 text-xs"
                              >
                                {(memory.schema?.types ?? []).map((t) => (
                                  <option key={t.name} value={t.name}>
                                    {t.icon} {t.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                                autoFocus
                              />
                            </div>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none"
                            />
                            <input
                              type="text"
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              placeholder="Tags (comma-separated)"
                              className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs"
                                onClick={() => saveEditing(entry._id)}
                                disabled={!editTitle.trim() || isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </div>
                        )
                      }

                      // Normal entry card with edit/delete actions
                      return (
                        <div
                          key={entry._id}
                          className="group rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                                  {entry.type}
                                </span>
                                <span className="text-sm font-medium truncate">
                                  {entry.title}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {entry.content}
                              </p>
                              {entry.tags.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {entry.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-accent"
                                      onClick={() => setSearchQuery(tag)}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Action icons: pin, edit, delete */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              {/* Task 10: Edit button */}
                              <button
                                onClick={() => startEditing(entry)}
                                className="p-1 rounded hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit entry"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {/* Task 10: Delete button */}
                              <button
                                onClick={() => setDeletingId(entry._id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {/* Pin button */}
                              {memory.togglePin && (
                                <button
                                  onClick={() => memory.togglePin!(entry._id)}
                                  className={cn(
                                    "p-1 rounded hover:bg-accent",
                                    pinnedSet.has(entry._id) ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                                  )}
                                  title={pinnedSet.has(entry._id) ? "Unpin" : "Pin to this session"}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {filteredEntries.length === 0 && !isCreating && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        {searchQuery || typeFilter ? "No matching entries" : "No memory entries yet"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Task 10: Delete confirmation dialog */}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null) }}
        title="Delete memory entry?"
        description="This memory entry will be permanently deleted. Any sessions that pin it will be updated."
        onConfirm={confirmDelete}
        destructive
        loading={isDeleting}
      />
    </>
  )
}
