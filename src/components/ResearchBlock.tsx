import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ResearchBlockProps {
  blockId: Id<"blocks">
  sessionId: Id<"sessions">
  content: string
  researchSource?: "web" | "local"
  researchPath?: string
}

export function ResearchBlock({ blockId, sessionId, content, researchSource, researchPath }: ResearchBlockProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localContent, setLocalContent] = useState(content)
  const [source, setSource] = useState<"web" | "local">(researchSource ?? "web")
  const [localPath, setLocalPath] = useState(researchPath ?? "")

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

  const handleSourceChange = async (newSource: "web" | "local") => {
    if (newSource === source) return
    setSource(newSource)
    await updateBlock({ id: blockId, researchSource: newSource })
  }

  const handlePathChange = async (value: string) => {
    setLocalPath(value)
    await updateBlock({ id: blockId, researchPath: value })
  }

  const prevContentRef = useRef(content)
  useEffect(() => {
    if (prevContentRef.current.trim() && !content.trim()) {
      // content just went from filled to empty (result cleared) — reset local editing state
      setLocalContent("")
    }
    prevContentRef.current = content
  }, [content])

  useEffect(() => {
    setSource(researchSource ?? "web")
  }, [researchSource])

  useEffect(() => {
    setLocalPath(researchPath ?? "")
  }, [researchPath])

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
        <p className="text-xs text-muted-foreground">
          Source: {researchSource === "local" ? `Local (${researchPath})` : "Web"}
        </p>
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
      {/* Source toggle */}
      <div className="flex gap-1">
        <Button
          variant={source === "web" ? "default" : "outline"}
          size="sm"
          className="h-6 text-xs"
          onClick={() => handleSourceChange("web")}
          aria-pressed={source === "web"}
        >
          Web
        </Button>
        <Button
          variant={source === "local" ? "default" : "outline"}
          size="sm"
          className="h-6 text-xs"
          onClick={() => handleSourceChange("local")}
          aria-pressed={source === "local"}
        >
          Local
        </Button>
      </div>

      {/* Path input for local source */}
      {source === "local" && (
        <Input
          type="text"
          className="h-8 text-sm"
          placeholder="/path/to/docs"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          onBlur={(e) => handlePathChange(e.target.value)}
        />
      )}

      {/* Spec textarea */}
      <textarea
        className="w-full min-h-24 text-sm border rounded p-2 resize-y bg-background"
        placeholder="Describe what to research and what format the output should take..."
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
        onBlur={(e) => handleContentChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={isStarting || !localContent.trim() || (source === "local" && !localPath.trim())}
        >
          {isStarting ? "Starting..." : "Run Research"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
