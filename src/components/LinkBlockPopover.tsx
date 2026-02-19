import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { getBlockTypeMetadata } from "@/lib/blockTypes"
import { cn } from "@/lib/utils"

interface LinkBlockPopoverProps {
  sessionId: Id<"sessions">
  zone: "PERMANENT" | "STABLE" | "WORKING"
  children: React.ReactNode
}

export function LinkBlockPopover({ sessionId, zone, children }: LinkBlockPopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"sessions"> | null>(null)
  const sessions = useQuery(api.sessions.list)
  const selectedBlocks = useQuery(
    api.blocks.list,
    selectedSessionId ? { sessionId: selectedSessionId } : "skip"
  )
  const createLinked = useMutation(api.blocks.createLinked)

  const otherSessions = sessions?.filter((s) => s._id !== sessionId) ?? []
  const filteredSessions = search
    ? otherSessions.filter((s) => (s.name ?? "").toLowerCase().includes(search.toLowerCase()))
    : otherSessions

  const allBlocks = selectedBlocks ?? []

  const handleLink = async (refBlockId: Id<"blocks">) => {
    await createLinked({ sessionId, refBlockId, zone })
    setOpen(false)
    setSelectedSessionId(null)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) {
        setSelectedSessionId(null)
        setSearch("")
      }
    }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {!selectedSessionId ? (
          <div className="p-2 space-y-1">
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredSessions.map((s) => (
                <button
                  key={s._id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent truncate"
                  onClick={() => setSelectedSessionId(s._id)}
                >
                  {s.name ?? "Untitled"}
                </button>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No other sessions
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <button
              className="text-xs text-muted-foreground hover:text-foreground mb-1"
              onClick={() => { setSelectedSessionId(null); setSearch("") }}
            >
              &larr; Back to sessions
            </button>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {allBlocks.map((b) => {
                const typeMeta = getBlockTypeMetadata(b.type)
                const firstLine = b.content.split("\n")[0]?.slice(0, 60) ?? ""
                return (
                  <button
                    key={b._id}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-1.5"
                    onClick={() => handleLink(b._id)}
                  >
                    <span className={cn("shrink-0 rounded px-1 py-0.5 text-[9px] font-medium", typeMeta.color)}>
                      {typeMeta.displayName}
                    </span>
                    <span className="text-xs truncate text-foreground">{firstLine || "(empty)"}</span>
                  </button>
                )
              })}
              {allBlocks.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No blocks in this session
                </p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
