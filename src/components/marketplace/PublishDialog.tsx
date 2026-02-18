import { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface PublishDialogProps {
  isOpen: boolean
  onClose: () => void
  type: "template" | "workflow"
  sourceId: Id<"templates"> | Id<"workflows">
  sourceName: string
  sourceDescription?: string
  publishedMarketplaceId?: Id<"marketplace">
  onSuccess?: () => void
}

export function PublishDialog({
  isOpen,
  onClose,
  type,
  sourceId,
  sourceName,
  sourceDescription,
  publishedMarketplaceId,
  onSuccess,
}: PublishDialogProps) {
  const [name, setName] = useState(sourceName)
  const [description, setDescription] = useState(sourceDescription ?? "")
  const [category, setCategory] = useState("")
  const [publishMode, setPublishMode] = useState<"update" | "new">(
    publishedMarketplaceId ? "update" : "new"
  )
  const [isLoading, setIsLoading] = useState(false)

  const categories = useQuery(api.marketplace.listCategories)
  const publishTemplate = useMutation(api.marketplace.publishTemplate)
  const publishWorkflow = useMutation(api.marketplace.publishWorkflow)
  const updateMarketplace = useMutation(api.marketplace.update)
  const published = useQuery(
    api.marketplace.get,
    publishedMarketplaceId ? { id: publishedMarketplaceId } : "skip"
  )
  const { toast } = useToast()

  // Sync form state with marketplace data for updates or source data for new posts
  useEffect(() => {
    if (!isOpen) return

    if (publishMode === "update" && published) {
      setName(published.name ?? sourceName)
      setDescription(published.description ?? "")
      setCategory(published.category ?? (categories?.[0]?.slug ?? ""))
    } else {
      setName(sourceName)
      setDescription(sourceDescription ?? "")
      if (categories?.length) setCategory(categories[0].slug)
    }
  }, [isOpen, publishMode, published, sourceName, sourceDescription, categories])

  // Set default category when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && !category) {
      setCategory(categories[0].slug)
    }
  }, [categories, category])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !category) return

    setIsLoading(true)
    try {
      if (publishMode === "update" && publishedMarketplaceId) {
        await updateMarketplace({
          id: publishedMarketplaceId,
          name: name.trim(),
          description: description.trim(),
          category,
        })
        toast.success("Updated", "Publication updated successfully")
      } else if (type === "template") {
        await publishTemplate({
          templateId: sourceId as Id<"templates">,
          name: name.trim(),
          description: description.trim(),
          category,
        })
        toast.success("Published", `"${name.trim()}" is now in the marketplace`)
      } else {
        await publishWorkflow({
          workflowId: sourceId as Id<"workflows">,
          name: name.trim(),
          description: description.trim(),
          category,
        })
        toast.success("Published", `"${name.trim()}" is now in the marketplace`)
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error("Error", String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">
          {publishedMarketplaceId ? "Update Publication" : "Publish to Marketplace"}
        </h2>

        {/* Update vs New choice (only if previously published) */}
        {publishedMarketplaceId && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPublishMode("update")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                publishMode === "update"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              Update existing
            </button>
            <button
              type="button"
              onClick={() => setPublishMode("new")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                publishMode === "new"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              Publish as new
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pub-name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="pub-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="pub-description" className="block text-sm font-medium mb-1">Description</label>
            <textarea
              id="pub-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Describe what this template/workflow does..."
            />
          </div>

          <div>
            <label htmlFor="pub-category" className="block text-sm font-medium mb-1">Category</label>
            <select
              id="pub-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {categories?.map((cat) => (
                <option key={cat._id} value={cat.slug}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !description.trim() || !category || isLoading}>
              {isLoading ? "Publishing..." : publishMode === "update" ? "Update" : "Publish"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
