import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Message, Provider, Zone } from "@/hooks/useBrainstorm"

interface BrainstormDialogProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  isStreaming: boolean
  streamingText: string
  provider: Provider
  onProviderChange: (provider: Provider) => void
  onSendMessage: (content: string) => Promise<void>
  onClearConversation: () => void
  onSaveMessage: (messageId: string, zone: Zone) => Promise<void>
  onRetryMessage: (messageId: string) => Promise<void>
  error: string | null
  providerHealth?: {
    ollama: { ok: boolean } | null
    claude: { ok: boolean } | null
    openrouter: { ok: boolean } | null
  }
  systemPrompt?: string
}

// Simple markdown rendering for assistant messages
function renderMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted p-2 rounded-md overflow-x-auto my-2"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-sm">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-lg mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-xl mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-2xl mt-4 mb-2">$1</h1>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
    // Line breaks
    .replace(/\n/g, '<br />')
}

// Zone selector popover
function ZoneSelector({
  onSelect,
  onCancel,
}: {
  onSelect: (zone: Zone) => void
  onCancel: () => void
}) {
  const zones: { value: Zone; label: string }[] = [
    { value: "WORKING", label: "Working" },
    { value: "STABLE", label: "Stable" },
    { value: "PERMANENT", label: "Permanent" },
  ]

  return (
    <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-md shadow-lg p-2 min-w-[120px]">
      <div className="text-xs text-muted-foreground mb-2 px-2">Save to zone:</div>
      {zones.map((zone) => (
        <button
          key={zone.value}
          onClick={() => onSelect(zone.value)}
          className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent"
        >
          {zone.label}
        </button>
      ))}
      <div className="border-t border-border mt-1 pt-1">
        <button
          onClick={onCancel}
          className="w-full text-left px-2 py-1 text-sm text-muted-foreground rounded hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// Message bubble component
function MessageBubble({
  message,
  onCopy,
  onSave,
  onRetry,
  isStreaming,
}: {
  message: Message
  onCopy: () => void
  onSave: (zone: Zone) => void
  onRetry: () => void
  isStreaming: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [showZoneSelector, setShowZoneSelector] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onCopy()
  }

  const handleSave = (zone: Zone) => {
    setShowZoneSelector(false)
    onSave(zone)
  }

  const isUser = message.role === "user"

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <div className="text-xs font-medium mb-1 opacity-70">
          {isUser ? "You" : "Assistant"}
        </div>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div
            className="text-sm prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowZoneSelector(!showZoneSelector)}
            className={cn(
              "h-6 px-2 text-xs",
              message.savedAsBlockId && "text-green-600"
            )}
          >
            {message.savedAsBlockId ? "Saved" : "Save"}
          </Button>
          {showZoneSelector && (
            <ZoneSelector
              onSelect={handleSave}
              onCancel={() => setShowZoneSelector(false)}
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          disabled={isStreaming}
          className="h-6 px-2 text-xs"
          title={isUser ? "Resend this message" : "Regenerate response"}
        >
          Retry
        </Button>
      </div>
    </div>
  )
}

// Streaming message indicator
function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
        <div className="text-xs font-medium mb-1 opacity-70 flex items-center gap-2">
          Assistant
          <span className="inline-flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </span>
        </div>
        {text ? (
          <div
            className="text-sm prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Thinking...</p>
        )}
      </div>
    </div>
  )
}

export function BrainstormDialog({
  isOpen,
  onClose,
  messages,
  isStreaming,
  streamingText,
  provider,
  onProviderChange,
  onSendMessage,
  onClearConversation,
  onSaveMessage,
  onRetryMessage,
  error,
  providerHealth,
  systemPrompt,
}: BrainstormDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return
    const content = inputValue.trim()
    setInputValue("")
    await onSendMessage(content)
  }, [inputValue, isStreaming, onSendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  // Check if provider is available
  const isProviderAvailable =
    provider === "ollama"
      ? providerHealth?.ollama?.ok ?? true
      : provider === "openrouter"
        ? providerHealth?.openrouter?.ok ?? true
        : providerHealth?.claude?.ok ?? true

  // Disable provider change after first message
  const canChangeProvider = messages.length === 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Brainstorm</h2>
            {/* Provider selector */}
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
              disabled={!canChangeProvider || isStreaming}
              className="text-sm border border-input rounded-md px-2 py-1 bg-background disabled:opacity-50"
            >
              <option value="claude" disabled={!providerHealth?.claude?.ok}>
                Claude {providerHealth?.claude?.ok ? "" : "(offline)"}
              </option>
              <option value="ollama" disabled={!providerHealth?.ollama?.ok}>
                Ollama {providerHealth?.ollama?.ok ? "" : "(offline)"}
              </option>
              <option value="openrouter" disabled={!providerHealth?.openrouter?.ok}>
                OpenRouter {providerHealth?.openrouter?.ok ? "" : "(offline)"}
              </option>
            </select>
            {/* System prompt indicator */}
            {systemPrompt && (
              <span
                className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                title={systemPrompt}
              >
                System Prompt Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearConversation}
              disabled={messages.length === 0 && !streamingText}
            >
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">
                Your context blocks are included automatically.
                <br />
                Messages you save will become blocks.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCopy={() => {}}
              onSave={(zone) => onSaveMessage(message.id, zone)}
              onRetry={() => onRetryMessage(message.id)}
              isStreaming={isStreaming}
            />
          ))}

          {isStreaming && <StreamingMessage text={streamingText} />}

          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Ctrl+Enter to send)"
              rows={2}
              disabled={isStreaming || !isProviderAvailable}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming || !isProviderAvailable}
              className="self-end"
            >
              {isStreaming ? "Sending..." : "Send"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ctrl+Enter to send, Esc to close
          </p>
        </div>
      </div>
    </div>
  )
}
