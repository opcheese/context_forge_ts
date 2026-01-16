import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../convex/_generated/dataModel"

// Zone types
const ZONES = ["PERMANENT", "STABLE", "WORKING"] as const
type Zone = (typeof ZONES)[number]

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

// Simple theme toggle hook
function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}

// Block type options
const BLOCK_TYPES = ["NOTE", "CODE", "SYSTEM", "USER", "ASSISTANT"] as const

// Add block form
function AddBlockForm({ defaultZone = "WORKING" }: { defaultZone?: Zone }) {
  const [content, setContent] = useState("")
  const [type, setType] = useState<string>("NOTE")
  const [zone, setZone] = useState<Zone>(defaultZone)
  const createBlock = useMutation(api.blocks.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    await createBlock({ content: content.trim(), type, zone })
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

// Single block card
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

  const handleDelete = async () => {
    await removeBlock({ id })
  }

  const handleMove = async (targetZone: Zone) => {
    await moveBlock({ id, zone: targetZone })
  }

  const timeAgo = formatTimeAgo(createdAt)
  const otherZones = ZONES.filter((z) => z !== zone)

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {type}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Delete
        </Button>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">
        {content}
      </p>
      <div className="flex gap-1">
        {otherZones.map((z) => (
          <Button
            key={z}
            variant="outline"
            size="sm"
            onClick={() => handleMove(z)}
            className="h-6 px-2 text-xs"
          >
            → {ZONE_INFO[z].label}
          </Button>
        ))}
      </div>
    </div>
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

// Zone column
function ZoneColumn({ zone }: { zone: Zone }) {
  const blocks = useQuery(api.blocks.listByZone, { zone })
  const info = ZONE_INFO[zone]

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">{info.label}</h3>
        <p className="text-xs text-muted-foreground">{info.description}</p>
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {blocks === undefined ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : blocks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
            No blocks
          </div>
        ) : (
          blocks.map((block) => (
            <BlockCard
              key={block._id}
              id={block._id}
              content={block.content}
              type={block.type}
              zone={block.zone}
              createdAt={block.createdAt}
            />
          ))
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground text-center">
        {blocks?.length ?? 0} blocks
      </div>
    </div>
  )
}

// Three-zone layout
function ZoneLayout() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {ZONES.map((zone) => (
        <div
          key={zone}
          className="rounded-lg border border-border bg-card p-4 flex flex-col"
        >
          <ZoneColumn zone={zone} />
        </div>
      ))}
    </div>
  )
}

// Main app layout
function App() {
  const { isDark, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">ContextForge</h1>
          <Button variant="outline" onClick={toggle}>
            {isDark ? "Light" : "Dark"}
          </Button>
        </div>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Block</h2>
          <AddBlockForm />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Context Zones</h2>
          <ZoneLayout />
        </section>
      </div>
    </div>
  )
}

export default App
