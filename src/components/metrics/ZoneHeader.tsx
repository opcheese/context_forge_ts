/**
 * Zone header component displaying token usage and budget progress.
 */

import { motion } from "framer-motion"
import { springs } from "@/lib/motion"
import { AnimatedNumber } from "@/components/ui/animated"
import { cn } from "@/lib/utils"
import { Minimize2 } from "lucide-react"

interface ZoneHeaderProps {
  zone: string
  blockCount: number
  tokens: number
  budget: number
  onCompress?: () => void
  isCompressing?: boolean
  linkButton?: React.ReactNode
}

// Format large numbers with K suffix
const formatTokens = (n: number): string => {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`
  }
  return Math.round(n).toLocaleString()
}

export function ZoneHeader({
  zone,
  blockCount,
  tokens,
  budget,
  onCompress,
  isCompressing,
  linkButton,
}: ZoneHeaderProps) {
  const percentUsed = Math.round((tokens / budget) * 100)
  const isWarning = percentUsed > 80 && percentUsed <= 95
  const isDanger = percentUsed > 95

  return (
    <div className="space-y-1.5">
      {/* Row 1: Zone name + block count + compress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{zone}</h3>
          <span className="text-xs text-muted-foreground">
            {blockCount} {blockCount === 1 ? "block" : "blocks"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onCompress && blockCount > 1 && (
            <button
              onClick={onCompress}
              disabled={isCompressing}
              className="px-1.5 py-0.5 text-[10px] rounded border border-input hover:bg-muted disabled:opacity-50 flex items-center gap-1"
              title="Compress all blocks in this zone"
            >
              <Minimize2 className="w-2.5 h-2.5" />
              {isCompressing ? "..." : "Compress"}
            </button>
          )}
          {linkButton}
        </div>
      </div>
      {/* Row 2: Full-width progress bar + token stats */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full",
              isDanger
                ? "bg-destructive"
                : isWarning
                  ? "bg-yellow-500"
                  : "bg-primary"
            )}
            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
            transition={springs.gentle}
          />
        </div>
        <span
          className={cn(
            "text-[11px] font-mono text-muted-foreground whitespace-nowrap",
            isDanger && "text-destructive",
            isWarning && "text-yellow-600 dark:text-yellow-500"
          )}
        >
          <AnimatedNumber value={tokens} format={formatTokens} /> / {formatTokens(budget)}
        </span>
        <span
          className={cn(
            "text-[11px] font-mono w-8 text-right tabular-nums",
            isDanger && "text-destructive",
            isWarning && "text-yellow-600 dark:text-yellow-500"
          )}
        >
          <AnimatedNumber value={percentUsed} format={(n) => `${Math.round(n)}%`} />
        </span>
      </div>
    </div>
  )
}
