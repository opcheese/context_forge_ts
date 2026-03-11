import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { springs } from "@/lib/motion"
import { useMemory } from "@/hooks/useMemory"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, X, Search, Pin } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"

interface MemoryDrawerProps {
  projectId: Id<"projects"> | undefined
  sessionId: Id<"sessions"> | undefined
  pinnedMemories?: Id<"memoryEntries">[]
}

export function MemoryDrawer({ projectId, sessionId, pinnedMemories }: MemoryDrawerProps) {
  const [state, setState] = useState<"collapsed" | "peek" | "full">("collapsed")
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const memory = useMemory(projectId, sessionId)
  const pinnedSet = useMemo(
    () => new Set(pinnedMemories ?? []),
    [pinnedMemories]
  )

  // Don't render if no project linked
  if (!projectId) return null

  const totalEntries = memory.entries.length

  // Filter entries for full view
  const filteredEntries = useMemo(() => {
    let filtered = memory.entries
    if (typeFilter) {
      filtered = filtered.filter((e) => e.type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [memory.entries, typeFilter, searchQuery])

  // Type summary for peek view
  const typeSummary = useMemo(() => {
    if (!memory.schema?.types) return []
    return memory.schema.types.map((t) => ({
      ...t,
      count: memory.countsByType[t.name] ?? 0,
    }))
  }, [memory.schema, memory.countsByType])

  return (
    <>
      {/* Collapsed bar */}
      {state === "collapsed" && totalEntries > 0 && (
        <motion.div
          initial={{ y: 48 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 h-10 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-center cursor-pointer z-30 hover:bg-accent/50 transition-colors"
          onClick={() => setState("peek")}
        >
          <ChevronUp className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {totalEntries} memor{totalEntries === 1 ? "y" : "ies"}
          </span>
        </motion.div>
      )}

      {/* Peek / Full drawer */}
      <AnimatePresence>
        {(state === "peek" || state === "full") && (
          <>
            {/* Backdrop (full only) */}
            {state === "full" && (
              <motion.div
                className="fixed inset-0 bg-black/20 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setState("collapsed")}
              />
            )}

            {/* Drawer */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-xl z-40 flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0, height: state === "peek" ? 200 : "50vh" }}
              exit={{ y: "100%" }}
              transition={springs.smooth}
            >
              {/* Handle bar + controls */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Memory ({totalEntries})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {state === "peek" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("full")}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  )}
                  {state === "full" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("peek")}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("collapsed")}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Peek: type summary */}
              {state === "peek" && (
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {typeSummary.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => {
                        setTypeFilter(t.name)
                        setState("full")
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-accent/50 transition-colors"
                      style={{ borderColor: t.color + "40" }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">({t.count})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full: search + filter + entry list */}
              {state === "full" && (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Search + filter bar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search memories..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
                      />
                    </div>
                    {/* Type filter pills */}
                    <div className="flex gap-1 overflow-x-auto">
                      <button
                        onClick={() => setTypeFilter(null)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                          !typeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                      >
                        All
                      </button>
                      {typeSummary.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => setTypeFilter(typeFilter === t.name ? null : t.name)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                            typeFilter === t.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t.icon} {t.name} ({t.count})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entry list */}
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry._id}
                        className="group rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                                {entry.type}
                              </span>
                              <span className="text-sm font-medium truncate">
                                {entry.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {entry.content}
                            </p>
                            {entry.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {entry.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-accent"
                                    onClick={() => setSearchQuery(tag)}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {memory.togglePin && (
                            <button
                              onClick={() => memory.togglePin!(entry._id)}
                              className={cn(
                                "shrink-0 p-1 rounded hover:bg-accent",
                                pinnedSet.has(entry._id) ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                              )}
                              title={pinnedSet.has(entry._id) ? "Unpin" : "Pin to this session"}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredEntries.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        {searchQuery || typeFilter ? "No matching entries" : "No memory entries yet"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
