import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useGenerate, type Provider } from "@/hooks/useGenerate"
import { useClaudeGenerate } from "@/hooks/useClaudeGenerate"
import type { Id } from "../../convex/_generated/dataModel"

interface GeneratePanelProps {
  sessionId: Id<"sessions">
}

interface ProviderHealth {
  ollama: { ok: boolean; error?: string } | null
  claude: { ok: boolean; error?: string; version?: string } | null
}

// Check provider health on mount
function useProviderHealth() {
  const [health, setHealth] = useState<ProviderHealth>({
    ollama: null,
    claude: null,
  })

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
        const baseUrl = convexUrl
          ? convexUrl.replace(":3210", ":3211")
          : "http://127.0.0.1:3211"

        const response = await fetch(`${baseUrl}/api/health`)
        const data = (await response.json()) as ProviderHealth
        setHealth(data)
      } catch (err) {
        console.error("Failed to check provider health:", err)
        setHealth({
          ollama: { ok: false, error: "Failed to check" },
          claude: { ok: false, error: "Failed to check" },
        })
      }
    }

    checkHealth()
    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return health
}

// Provider status indicator
function ProviderStatus({
  name,
  status,
}: {
  name: string
  status: { ok: boolean; error?: string; version?: string } | null
}) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        {name}...
      </span>
    )
  }

  if (status.ok) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-green-600"
        title={status.version}
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        {name}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-destructive"
      title={status.error || `${name} not available`}
    >
      <span className="w-2 h-2 rounded-full bg-destructive" />
      {name}
    </span>
  )
}

export function GeneratePanel({ sessionId }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [showSystem, setShowSystem] = useState(false)
  const [provider, setProvider] = useState<Provider>("ollama")
  const health = useProviderHealth()

  // Use Ollama hook (HTTP streaming)
  const ollamaHook = useGenerate({
    sessionId,
    provider: "ollama",
    onComplete: () => {
      setPrompt("") // Clear prompt on success
    },
  })

  // Use Claude hook (Convex reactive streaming)
  const claudeHook = useClaudeGenerate({
    sessionId,
    onComplete: () => {
      setPrompt("") // Clear prompt on success
    },
  })

  // Select the active hook based on provider
  const { generate, isGenerating, streamedText, error, stop } =
    provider === "claude" ? claudeHook : ollamaHook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    await generate(prompt.trim(), systemPrompt.trim() || undefined)
  }

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (prompt.trim() && !isGenerating && isProviderAvailable) {
        generate(prompt.trim(), systemPrompt.trim() || undefined)
      }
    }
  }

  // Check if selected provider is available
  const isProviderAvailable =
    provider === "ollama" ? health.ollama?.ok : health.claude?.ok

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Generate</h2>
          {/* Provider status indicators */}
          <div className="flex items-center gap-2">
            <ProviderStatus name="Ollama" status={health.ollama} />
            <ProviderStatus name="Claude" status={health.claude} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSystem(!showSystem)}
        >
          {showSystem ? "Hide" : "Show"} System Prompt
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provider selection */}
        <div>
          <label
            htmlFor="provider-select"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Provider
          </label>
          <select
            id="provider-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isGenerating}
          >
            <option value="ollama" disabled={!health.ollama?.ok}>
              Ollama (Local){health.ollama?.ok ? "" : " - offline"}
            </option>
            <option value="claude" disabled={!health.claude?.ok}>
              Claude Code (Subscription){health.claude?.ok ? "" : " - offline"}
            </option>
          </select>
        </div>

        {showSystem && (
          <div>
            <label
              htmlFor="system-prompt"
              className="block text-sm font-medium mb-1 text-foreground"
            >
              System Prompt (optional)
            </label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Override or add to system instructions..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              disabled={isGenerating}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="user-prompt"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Prompt
          </label>
          <textarea
            id="user-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to generate? (Ctrl+Enter to submit)"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            disabled={isGenerating}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={!prompt.trim() || isGenerating || !isProviderAvailable}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
          {isGenerating && (
            <Button type="button" variant="outline" onClick={stop}>
              Stop
            </Button>
          )}
        </div>
      </form>

      {/* Streaming output */}
      {(streamedText || isGenerating) && (
        <div className="mt-4 p-4 rounded-md bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {isGenerating
                ? `Generating with ${provider === "claude" ? "Claude" : "Ollama"}...`
                : "Generated (auto-saved to Working)"}
            </span>
            {isGenerating && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Streaming
              </span>
            )}
          </div>
          <div className="text-sm whitespace-pre-wrap font-mono">
            {streamedText || (
              <span className="text-muted-foreground">
                Waiting for response...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
