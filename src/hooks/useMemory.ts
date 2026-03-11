/**
 * Hook for memory drawer state and operations.
 *
 * Provides queries and mutations for memory entries + session pins.
 * Requires a projectId (memory is project-scoped).
 */

import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export function useMemory(
  projectId: Id<"projects"> | undefined,
  sessionId: Id<"sessions"> | undefined
) {
  // Schema
  const schema = useQuery(
    api.memorySchemas.getByProject,
    projectId ? { projectId } : "skip"
  )
  const schemaTemplates = useQuery(api.memorySchemas.listTemplates)
  const createSchemaFromTemplate = useMutation(api.memorySchemas.createFromTemplate)
  const updateSchemaTypes = useMutation(api.memorySchemas.updateTypes)

  // Entries
  const entries = useQuery(
    api.memoryEntries.listByProject,
    projectId ? { projectId } : "skip"
  )
  const createEntry = useMutation(api.memoryEntries.create)
  const updateEntry = useMutation(api.memoryEntries.update)
  const removeEntry = useMutation(api.memoryEntries.remove)

  // Entry counts by type (for peek state)
  const countsByType = useQuery(
    api.memoryEntries.countsByType,
    projectId ? { projectId } : "skip"
  )

  // Session pins
  const togglePin = useMutation(api.sessions.toggleMemoryPin)
  const updateSessionTags = useMutation(api.sessions.updateSessionTags)

  return {
    // Schema
    schema,
    schemaTemplates,
    createSchemaFromTemplate,
    updateSchemaTypes,
    // Entries
    entries: entries ?? [],
    createEntry,
    updateEntry,
    removeEntry,
    countsByType: countsByType ?? {},
    // Session
    togglePin: sessionId
      ? (entryId: Id<"memoryEntries">) => togglePin({ sessionId, entryId })
      : undefined,
    updateSessionTags: sessionId
      ? (tags: string[]) => updateSessionTags({ sessionId, tags })
      : undefined,
  }
}
