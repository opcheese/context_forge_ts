import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { dialogOverlay, dialogContent } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { DebouncedButton } from "@/components/ui/debounced-button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Message, Provider, Zone } from "@/hooks/useBrainstorm"
import { SKILLS } from "@/lib/llm/skills"
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { MarkdownComponents } from '@/components/MarkdownComponents';
import { SubscriptionUsage } from '@/components/SubscriptionUsage';
import { OpenRouterCost } from '@/components/OpenRouterCost';
import breaks from 'remark-breaks';


interface BrainstormDialogProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  hasUnsavedContent?: boolean
  isStreaming: boolean
  streamingText: string
  provider: Provider
  onProviderChange: (provider: Provider) => void
  onSendMessage: (content: string) => Promise<void>
  onClearConversation: () => void
  onSaveMessage: (messageId: string, zone: Zone) => Promise<void>
  onRetryMessage: (messageId: string) => Promise<void>
  onEditMessage: (messageId: string, newContent: string) => Promise<void>
  error: string | null
  providerHealth?: {
    ollama: { ok: boolean } | null
    claude: { ok: boolean; disabled?: boolean } | null
    openrouter: { ok: boolean } | null
  }
  systemPrompt?: string
  // Claude Code agent behavior toggle
  disableAgentBehavior?: boolean
  onDisableAgentBehaviorChange?: (value: boolean) => void
  // Prevent self-talk toggle
  preventSelfTalk?: boolean
  onPreventSelfTalkChange?: (value: boolean) => void
  // Stop streaming
  onStopStreaming: () => void
  // Model selection (Claude provider)
  model?: string | null
  onModelChange?: (model: string | null) => void
  // Ephemeral skills
  activeSkills?: Record<string, boolean>
  onToggleSkill?: (skillId: string) => void
  // OpenRouter session cost
  openrouterSessionCost?: number
}

// Message bubble component
function MessageBubble({
  message,
  onCopy,
  onSave,
  onRetry,
  onEdit,
  isStreaming,
}: {
  message: Message
  onCopy: () => void
  onSave: (zone: Zone) => void
  onRetry: () => void
  onEdit: (newContent: string) => void
  isStreaming: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  
  const handleCopy = () => {
    if (!navigator.clipboard) {
      const textArea = document.createElement('textarea');
      textArea.value = message.content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    } else {
      navigator.clipboard.writeText(message.content);
      }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onCopy()
  }


  const handleEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(editContent.trim())
    }
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleEdit()
    } else if (e.key === "Escape") {
      setEditContent(message.content)
      setIsEditing(false)
    }
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
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-full min-w-[300px] rounded border border-input bg-background px-2 py-1 text-sm text-foreground resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditContent(message.content); setIsEditing(false) }}
                className="h-6 px-2 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={!editContent.trim() || editContent === message.content}
                className="h-6 px-2 text-xs"
              >
                Send
              </Button>
            </div>
          </div>
        ) : isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[gfm, breaks]}
              components={MarkdownComponents}
            >
              {message.content || 'No answer'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex gap-1 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2 text-xs"
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          {isUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isStreaming}
              className="h-6 px-2 text-xs"
            >
              Edit
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs",
                  message.savedAsBlockId && "text-green-600"
                )}
              >
                {message.savedAsBlockId ? "Saved" : "Save"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={8}>
              <DropdownMenuLabel className="text-xs">Save to zone:</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onSave("WORKING")}>Working</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSave("STABLE")}>Stable</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSave("PERMANENT")}>Permanent</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      )}
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
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={[gfm, breaks]}
                components={MarkdownComponents}
              >
                {text || 'No answer.'}
              </ReactMarkdown>
          </div>
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
  hasUnsavedContent = false,
  isStreaming,
  streamingText,
  provider,
  onProviderChange,
  onSendMessage,
  onClearConversation,
  onSaveMessage,
  onRetryMessage,
  onEditMessage,
  error,
  providerHealth,
  systemPrompt,
  disableAgentBehavior = true,
  onDisableAgentBehaviorChange,
  preventSelfTalk = true,
  onPreventSelfTalkChange,
  onStopStreaming,
  model,
  onModelChange,
  activeSkills,
  onToggleSkill,
  openrouterSessionCost,
}: BrainstormDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const [showCloseWarning, setShowCloseWarning] = useState(false)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Check if user is near bottom of scroll
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    // Consider "near bottom" if within 100px of bottom
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(nearBottom)
  }, [])

  // Auto-scroll only if user is near bottom
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, streamingText, autoScroll])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Warn on browser refresh/close if there's unsaved content
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContent && isOpen) {
        e.preventDefault()
        e.returnValue = "" // Required for Chrome
        return "" // Required for some browsers
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedContent, isOpen])

  // Handle close request (from Escape key or close button)
  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedContent) {
      setShowCloseWarning(true)
    } else {
      onClose()
    }
  }, [hasUnsavedContent, onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault()
        handleCloseRequest()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleCloseRequest])

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

  // Auto-expand textarea as user types
  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    const maxHeight = 200
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  }, [inputValue])

  // Auto-switch away from disabled/unavailable provider
  useEffect(() => {
    if (!providerHealth) return
    const current = providerHealth[provider]
    // If current provider's health is known and it's not ok (or disabled), switch to first available
    if (current !== null && current !== undefined && (!current.ok || ('disabled' in current && current.disabled))) {
      if (providerHealth.ollama?.ok) {
        onProviderChange("ollama")
      } else if (providerHealth.openrouter?.ok) {
        onProviderChange("openrouter")
      }
      // If nothing available, stay put — user will see offline indicators
    }
  }, [providerHealth, provider, onProviderChange])

  // Check if provider is available
  // Be optimistic while health checks are pending - allow input immediately
  const isProviderAvailable =
    provider === "ollama"
      ? providerHealth?.ollama?.ok ?? true
      : provider === "openrouter"
        ? providerHealth?.openrouter?.ok ?? true
        : providerHealth?.claude === null || providerHealth?.claude === undefined
          ? true // Optimistic: allow input while health check is pending
          : providerHealth.claude.ok && !providerHealth.claude.disabled

  // Disable provider change after first message
  const canChangeProvider = messages.length === 0

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={dialogOverlay.initial}
      animate={dialogOverlay.animate}
      exit={dialogOverlay.exit}
      transition={dialogOverlay.transition}
    >
      <motion.div
        className="bg-background border border-border rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col"
        initial={dialogContent.initial}
        animate={dialogContent.animate}
        exit={dialogContent.exit}
        transition={dialogContent.transition}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border space-y-2">
          {/* Row 1: Title + provider + model + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Brainstorm</h2>
              {/* Provider selector */}
              <select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value as Provider)}
                disabled={!canChangeProvider || isStreaming}
                className="text-sm border border-input rounded-md px-2 py-1 bg-background disabled:opacity-50"
              >
                {!providerHealth?.claude?.disabled && (
                  <option value="claude" disabled={!providerHealth?.claude?.ok}>
                    Claude {providerHealth?.claude?.ok ? "" : "(offline)"}
                  </option>
                )}
                <option value="ollama" disabled={!providerHealth?.ollama?.ok}>
                  Ollama {providerHealth?.ollama?.ok ? "" : "(offline)"}
                </option>
                <option value="openrouter" disabled={!providerHealth?.openrouter?.ok}>
                  OpenRouter {providerHealth?.openrouter?.ok ? "" : "(offline)"}
                </option>
              </select>
              {/* Model selector (Claude provider only) */}
              {provider === "claude" && onModelChange && !providerHealth?.claude?.disabled && (
                <select
                  value={model ?? ""}
                  onChange={(e) => onModelChange(e.target.value || null)}
                  disabled={!canChangeProvider || isStreaming}
                  className="text-sm border border-input rounded-md px-2 py-1 bg-background disabled:opacity-50 max-w-[200px]"
                >
                  <option value="">Default (Opus)</option>
                  <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
                  <option value="claude-opus-4-6">Opus 4.6</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
                </select>
              )}
              {/* Claude subscription usage */}
              {provider === "claude" && !providerHealth?.claude?.disabled && (
                <SubscriptionUsage enabled={provider === "claude"} />
              )}
              {/* OpenRouter session cost */}
              {provider === "openrouter" && openrouterSessionCost != null && (
                <OpenRouterCost sessionCost={openrouterSessionCost} />
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
              <Button variant="ghost" size="sm" onClick={() => {
                if (isStreaming) {
                  onStopStreaming()
                }
                handleCloseRequest()
              }}>
                Close
              </Button>
            </div>
          </div>
          {/* Row 2: Toggles + context badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Claude toggles */}
            {provider === "claude" && onDisableAgentBehaviorChange && !providerHealth?.claude?.disabled && (
              <label
                className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                title="When enabled, appends instructions to prevent Claude from pretending to have tool access"
              >
                <input
                  type="checkbox"
                  checked={disableAgentBehavior}
                  onChange={(e) => onDisableAgentBehaviorChange(e.target.checked)}
                  disabled={!canChangeProvider || isStreaming}
                  className="rounded border-input"
                />
                <span className="text-muted-foreground">No tools</span>
              </label>
            )}
            {provider === "claude" && onPreventSelfTalkChange && !providerHealth?.claude?.disabled && (
              <label
                className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                title="When enabled, prevents the model from simulating user messages and continuing the conversation with itself"
              >
                <input
                  type="checkbox"
                  checked={preventSelfTalk}
                  onChange={(e) => onPreventSelfTalkChange(e.target.checked)}
                  disabled={!canChangeProvider || isStreaming}
                  className="rounded border-input"
                />
                <span className="text-muted-foreground">No self-talk</span>
              </label>
            )}
            {/* System prompt indicator */}
            {systemPrompt && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                title={systemPrompt}
              >
                System Prompt Active
              </span>
            )}
            {/* Active skills chips */}
            {activeSkills && onToggleSkill && Object.entries(activeSkills).map(([skillId, enabled]) => {
              const skill = SKILLS[skillId]
              if (!skill) return null
              return (
                <span
                  key={skillId}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors",
                    enabled
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "bg-muted text-muted-foreground line-through"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggleSkill(skillId)}
                    className="rounded border-input h-3 w-3"
                  />
                  <span
                    onClick={() => setExpandedSkill(expandedSkill === skillId ? null : skillId)}
                    title="Click to preview skill content"
                  >
                    {skill.label}
                  </span>
                </span>
              )
            })}
          </div>
        </div>

        {/* Expanded skill preview */}
        {expandedSkill && SKILLS[expandedSkill] && (
          <div className="mx-4 mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 max-h-[200px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {SKILLS[expandedSkill].label}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={() => setExpandedSkill(null)}
              >
                Close
              </Button>
            </div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
              {SKILLS[expandedSkill].content}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">
                Your context blocks are included automatically.
                <br />
                Messages you save will become blocks.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                AI responses may be inaccurate. Verify before relying on them.
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
              onEdit={(newContent) => onEditMessage(message.id, newContent)}
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
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Ctrl+Enter to send)"
              rows={3}
              disabled={isStreaming || !isProviderAvailable}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none disabled:opacity-50 min-h-[80px] max-h-[200px] overflow-y-auto"
            />
            {isStreaming ? (
              <Button
                variant="destructive"
                onClick={onStopStreaming}
                className="self-end"
              >
                Stop
              </Button>
            ) : (
              <DebouncedButton
                onClick={handleSend}
                disabled={!inputValue.trim() || !isProviderAvailable}
                className="self-end"
                debounceMs={300}
              >
                Send
              </DebouncedButton>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ctrl+Enter to send, Esc to close · AI responses may be inaccurate
          </p>
        </div>
      </motion.div>

      {/* Unsaved content warning dialog */}
      <ConfirmDialog
        open={showCloseWarning}
        onOpenChange={setShowCloseWarning}
        title="Discard conversation?"
        description="You have unsaved messages. Are you sure you want to close? Your conversation will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep open"
        destructive={true}
        onConfirm={() => {
          setShowCloseWarning(false)
          onClearConversation()
          onClose()
        }}
      />
    </motion.div>
      )}
    </AnimatePresence>
  )
}
