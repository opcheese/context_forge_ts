import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"

interface ResearchBlockProps {
  blockId: Id<"blocks">
  sessionId: Id<"sessions">
  content: string
}

export function ResearchBlock({ blockId, sessionId, content }: ResearchBlockProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateBlock = useMutation(api.blocks.update)
  const startResearch = useMutation(api.research.startResearch)
  const cancelGeneration = useMutation(api.generations.cancel)

  // Subscribe to active generation — shows streaming progress while running
  const latestGen = useQuery(api.generations.getLatestForSession, { sessionId })
  const isRunning = latestGen?.status === "streaming"
  const streamingText = isRunning ? latestGen.text : null

  const handleRun = async () => {
    setIsStarting(true)
    setError(null)
    try {
      await startResearch({ sessionId })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start research")
    } finally {
      setIsStarting(false)
    }
  }

  const handleCancel = async () => {
    if (latestGen?._id) await cancelGeneration({ generationId: latestGen._id })
  }

  const handleContentChange = async (value: string) => {
    await updateBlock({ id: blockId, content: value })
  }

  // Running — show streaming progress
  if (isRunning) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground animate-pulse">Researching...</p>
        {streamingText && (
          <div className="text-sm whitespace-pre-wrap opacity-70">{streamingText}</div>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    )
  }

  // Has result — show content with Re-run option
  if (content.trim()) {
    return (
      <div className="space-y-2">
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={isStarting}
        >
          Re-run Research
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Empty — spec editing mode
  return (
    <div className="space-y-2">
      <textarea
        className="w-full min-h-24 text-sm border rounded p-2 resize-y bg-background"
        placeholder="Describe what to research and what format the output should take..."
        defaultValue={content}
        onBlur={(e) => handleContentChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={isStarting || !content.trim()}
        >
          {isStarting ? "Starting..." : "Run Research"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
