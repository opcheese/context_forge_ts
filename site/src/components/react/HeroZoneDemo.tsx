import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "../../lib/motion"
import { AnimatedNumber } from "./AnimatedNumber"

type ZoneKey = "permanent" | "stable" | "working"

interface DemoBlock {
  id: string
  label: string
  tokens: number
  zone: ZoneKey
}

const INITIAL_BLOCKS: DemoBlock[] = [
  { id: "b1", label: "System role", tokens: 120, zone: "permanent" },
  { id: "b2", label: "Project brief", tokens: 340, zone: "stable" },
  { id: "b3", label: "Style guide", tokens: 210, zone: "stable" },
  { id: "b4", label: "Current draft", tokens: 185, zone: "working" },
]

const ZONES: { key: ZoneKey; label: string; color: string }[] = [
  { key: "permanent", label: "Permanent", color: "border-blue-500/30 bg-blue-500/5 dark:bg-blue-400/5" },
  { key: "stable", label: "Stable", color: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-400/5" },
  { key: "working", label: "Working", color: "border-amber-500/30 bg-amber-500/5 dark:bg-amber-400/5" },
]

export function HeroZoneDemo() {
  const [blocks, setBlocks] = useState<DemoBlock[]>(INITIAL_BLOCKS)

  const zoneRefs = {
    permanent: useRef<HTMLDivElement>(null),
    stable: useRef<HTMLDivElement>(null),
    working: useRef<HTMLDivElement>(null),
  }

  const getZoneTokens = useCallback(
    (zone: ZoneKey) => blocks.filter((b) => b.zone === zone).reduce((sum, b) => sum + b.tokens, 0),
    [blocks],
  )

  const handleDragEnd = useCallback(
    (blockId: string, _event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => {
      const { x, y } = info.point

      for (const [zone, ref] of Object.entries(zoneRefs)) {
        const rect = ref.current?.getBoundingClientRect()
        if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, zone: zone as ZoneKey } : b)))
          return
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ZONES.map((zone) => (
          <div
            key={zone.key}
            ref={zoneRefs[zone.key]}
            className={`rounded-xl border-2 border-dashed p-4 sm:p-5 ${zone.color} transition-colors min-h-[120px]`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {zone.label}
              </div>
              <div className="text-xs text-muted-foreground/60 tabular-nums">
                <AnimatedNumber value={getZoneTokens(zone.key)} /> tok
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {blocks
                .filter((b) => b.zone === zone.key)
                .map((block) => (
                  <motion.div
                    key={block.id}
                    drag
                    dragSnapToOrigin
                    dragMomentum={false}
                    onDragEnd={(event, info) => handleDragEnd(block.id, event as MouseEvent, info)}
                    whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    whileHover={{ scale: 1.04, y: -1 }}
                    transition={springs.snappy}
                    className="cursor-grab active:cursor-grabbing select-none px-3 py-1.5 rounded-lg text-sm font-medium bg-foreground/[0.07] dark:bg-foreground/[0.1] border border-border/50 hover:border-border hover:shadow-sm"
                  >
                    <span className="mr-1.5 text-muted-foreground/40">⠿</span>
                    {block.label}
                  </motion.div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/40 mt-3 text-center">
        Drag blocks between zones to see how context is organized
      </p>
    </div>
  )
}
