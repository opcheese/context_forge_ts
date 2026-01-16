import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../convex/_generated/dataModel"

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

// Block type options (simple for now)
const BLOCK_TYPES = ["NOTE", "CODE", "SYSTEM", "USER", "ASSISTANT"] as const

// Add block form
function AddBlockForm() {
  const [content, setContent] = useState("")
  const [type, setType] = useState<string>("NOTE")
  const createBlock = useMutation(api.blocks.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    await createBlock({ content: content.trim(), type })
    setContent("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
  createdAt,
}: {
  id: Id<"blocks">
  content: string
  type: string
  createdAt: number
}) {
  const removeBlock = useMutation(api.blocks.remove)

  const handleDelete = async () => {
    await removeBlock({ id })
  }

  const timeAgo = formatTimeAgo(createdAt)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {type}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Delete
        </Button>
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

// Block list
function BlockList() {
  const blocks = useQuery(api.blocks.list)

  if (blocks === undefined) {
    return <div className="text-muted-foreground">Loading...</div>
  }

  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No blocks yet. Add one above!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <BlockCard
          key={block._id}
          id={block._id}
          content={block.content}
          type={block.type}
          createdAt={block.createdAt}
        />
      ))}
    </div>
  )
}

// Main blocks demo
function BlocksDemo() {
  const blocks = useQuery(api.blocks.list)

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Blocks</h2>
        <p className="text-muted-foreground mt-1">
          Create and manage content blocks. Real-time sync with Convex.
        </p>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-medium mb-3">Add New Block</h3>
        <AddBlockForm />
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">All Blocks</h3>
          <span className="text-sm text-muted-foreground">
            {blocks?.length ?? 0} blocks
          </span>
        </div>
        <BlockList />
      </div>
    </section>
  )
}

// Main app layout
function App() {
  const { isDark, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">
            ContextForge
          </h1>
          <Button variant="outline" onClick={toggle}>
            {isDark ? "Light" : "Dark"}
          </Button>
        </div>

        <BlocksDemo />
      </div>
    </div>
  )
}

export default App
