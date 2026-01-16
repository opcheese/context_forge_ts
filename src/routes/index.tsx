/**
 * Home page - Zone layout with blocks.
 */

import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../convex/_generated/dataModel"
import { DroppableZone, SortableBlock, ZONES, type Zone } from "@/components/dnd"
import { useFileDrop } from "@/hooks/useFileDrop"
import { useSession } from "@/contexts/SessionContext"
import { GeneratePanel } from "@/components/GeneratePanel"

// Zone display info
const ZONE_INFO: Record<Zone, { label: string; description: string }> = {
  PERMANENT: {
    label: "Permanent",
    description: "Always included in context",
  },
  STABLE: {
    label: "Stable",
    description: "Included when relevant",
  },
  WORKING: {
    label: "Working",
    description: "Temporary/draft content",
  },
}

// Block type options
const BLOCK_TYPES = ["NOTE", "CODE", "SYSTEM", "USER", "ASSISTANT"] as const

// Add block form
function AddBlockForm({
  sessionId,
  defaultZone = "WORKING",
}: {
  sessionId: Id<"sessions">
  defaultZone?: Zone
}) {
  const [content, setContent] = useState("")
  const [type, setType] = useState<string>("NOTE")
  const [zone, setZone] = useState<Zone>(defaultZone)
  const createBlock = useMutation(api.blocks.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    await createBlock({ sessionId, content: content.trim(), type, zone })
    setContent("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="block-type"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Type
          </label>
          <select
            id="block-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="block-zone"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Zone
          </label>
          <select
            id="block-zone"
            value={zone}
            onChange={(e) => setZone(e.target.value as Zone)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_INFO[z].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label
          htmlFor="block-content"
          className="block text-sm font-medium mb-1 text-foreground"
        >
          Content
        </label>
        <textarea
          id="block-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter block content..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
      </div>
      <Button type="submit" disabled={!content.trim()}>
        Add Block
      </Button>
    </form>
  )
}

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Single block card (content only, wrapped by SortableBlock for DnD)
function BlockCard({
  id,
  content,
  type,
  zone,
  createdAt,
}: {
  id: Id<"blocks">
  content: string
  type: string
  zone: Zone
  createdAt: number
}) {
  const removeBlock = useMutation(api.blocks.remove)
  const moveBlock = useMutation(api.blocks.move)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    await removeBlock({ id })
  }

  const handleMove = async (e: React.MouseEvent, targetZone: Zone) => {
    e.stopPropagation()
    e.preventDefault()
    await moveBlock({ id, zone: targetZone })
  }

  const timeAgo = formatTimeAgo(createdAt)
  const otherZones = ZONES.filter((z) => z !== zone)

  return (
    <div className="rounded-lg border border-border bg-card p-3 select-none">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {type}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="flex gap-1">
          <Link
            to="/blocks/$blockId"
            params={{ blockId: id }}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-6 px-2 text-xs rounded-md border border-input bg-background hover:bg-accent"
          >
            Edit
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        </div>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2 line-clamp-3">
        {content}
      </p>
      <div className="flex gap-1">
        {otherZones.map((z) => (
          <Button
            key={z}
            variant="outline"
            size="sm"
            onClick={(e) => handleMove(e, z)}
            className="h-6 px-2 text-xs"
          >
            → {ZONE_INFO[z].label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// Zone column with droppable area and file drop support
function ZoneColumn({
  sessionId,
  zone,
}: {
  sessionId: Id<"sessions">
  zone: Zone
}) {
  const blocks = useQuery(api.blocks.listByZone, { sessionId, zone })
  const info = ZONE_INFO[zone]

  // File drop handling
  const { isDragOver, dropProps } = useFileDrop({
    sessionId,
    zone,
    onSuccess: (fileName) => console.log(`Added file "${fileName}" to ${zone}`),
    onError: (error) => console.warn(error),
  })

  // Sort blocks by position for display
  const sortedBlocks = blocks
    ? [...blocks].sort((a, b) => a.position - b.position)
    : []

  const blockIds = sortedBlocks.map((b) => b._id)

  return (
    <div className="flex flex-col h-full relative" {...dropProps}>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">{info.label}</h3>
        <p className="text-xs text-muted-foreground">{info.description}</p>
      </div>

      <DroppableZone zone={zone} itemIds={blockIds}>
        <div className="flex-1 space-y-2 min-h-[100px]">
          {blocks === undefined ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sortedBlocks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
              Drop blocks or files here
            </div>
          ) : (
            sortedBlocks.map((block) => (
              <SortableBlock
                key={block._id}
                id={block._id}
                zone={block.zone}
                position={block.position}
              >
                <BlockCard
                  id={block._id}
                  content={block.content}
                  type={block.type}
                  zone={block.zone}
                  createdAt={block.createdAt}
                />
              </SortableBlock>
            ))
          )}
        </div>
      </DroppableZone>

      <div className="mt-3 text-xs text-muted-foreground text-center">
        {blocks?.length ?? 0} blocks
      </div>

      {/* File drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
          <div className="text-center">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-medium text-primary">
              Drop .txt or .md file
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Three-zone layout
function ZoneLayout({ sessionId }: { sessionId: Id<"sessions"> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {ZONES.map((zone) => (
        <div
          key={zone}
          className="rounded-lg border border-border bg-card p-4 flex flex-col"
        >
          <ZoneColumn sessionId={sessionId} zone={zone} />
        </div>
      ))}
    </div>
  )
}

// No session selected message
function NoSessionSelected() {
  const { createSession } = useSession()

  const handleCreate = async () => {
    await createSession("My First Session")
  }

  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-2">No Session Selected</h2>
      <p className="text-muted-foreground mb-4">
        Create a session to start managing your context blocks.
      </p>
      <Button onClick={handleCreate}>Create Session</Button>
    </div>
  )
}

// Home page component
function HomePage() {
  const { sessionId, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    )
  }

  if (!sessionId) {
    return <NoSessionSelected />
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Add New Block</h2>
        <AddBlockForm sessionId={sessionId} />
      </section>

      {/* LLM Generation Panel */}
      <section>
        <GeneratePanel sessionId={sessionId} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Context Zones</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Drag blocks to reorder or move between zones
        </p>
        <ZoneLayout sessionId={sessionId} />
      </section>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
