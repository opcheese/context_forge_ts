/**
 * Custom session dropdown with delete support.
 * Replaces the simple <select> to allow session deletion from the UI.
 */

import { useState, useRef, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Trash2, ChevronDown } from "lucide-react"

interface SessionDropdownProps {
  sessions: Doc<"sessions">[]
  currentSessionId: Id<"sessions"> | null
  onSelectSession: (id: Id<"sessions">) => void
  onCreateSession: () => void
  onSessionDeleted: (deletedId: Id<"sessions">, remaining: Doc<"sessions">[]) => void
  isLoading?: boolean
}

export function SessionDropdown({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onSessionDeleted,
  isLoading,
}: SessionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Doc<"sessions"> | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const removeSession = useMutation(api.sessions.remove)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentSession = sessions.find((s) => s._id === currentSessionId)
  const displayName = currentSession?.name
    ?? (currentSessionId ? `Session ${currentSessionId.slice(-6)}` : "Select session...")

  const handleDelete = async () => {
    if (!sessionToDelete) return

    setIsDeleting(true)
    try {
      const deletedId = sessionToDelete._id
      await removeSession({ id: deletedId })
      const remaining = sessions.filter((s) => s._id !== deletedId)
      onSessionDeleted(deletedId, remaining)
      setSessionToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteTargetName = sessionToDelete?.name
    ?? (sessionToDelete ? `Session ${sessionToDelete._id.slice(-6)}` : "")

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
      >
        <span className="max-w-[200px] truncate">{displayName}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 rounded-lg border border-border bg-background shadow-lg z-50">
          <div className="max-h-60 overflow-y-auto p-1.5">
            {sessions.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                No sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session._id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent group ${
                    session._id === currentSessionId ? "bg-accent/50" : ""
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(session._id)
                      setIsOpen(false)
                    }}
                    className="flex-1 text-left text-sm truncate pr-2"
                  >
                    {session.name ?? `Session ${session._id.slice(-6)}`}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSessionToDelete(session)
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity shrink-0"
                    title="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Create new session button */}
          <div className="border-t border-border p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onCreateSession()
                setIsOpen(false)
              }}
              className="w-full justify-start text-xs"
            >
              + New Session
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
        title="Delete this session?"
        description={`"${deleteTargetName}" and all its blocks will be permanently deleted.`}
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  )
}
