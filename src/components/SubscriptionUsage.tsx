import { cn } from "@/lib/utils"
import { useSubscriptionUsage } from "@/hooks/useSubscriptionUsage"

interface SubscriptionUsageProps {
  enabled: boolean
}

export function SubscriptionUsage({ enabled }: SubscriptionUsageProps) {
  const { fiveHour, sevenDay, loading, error } = useSubscriptionUsage(enabled)

  if (!enabled) return null

  if (loading) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground animate-pulse">
        5h: …
      </span>
    )
  }

  if (error) {
    return (
      <span
        className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
        title={`Usage unavailable: ${error}`}
      >
        5h: --
      </span>
    )
  }

  const u5 = fiveHour.utilization
  const isWarning = u5 >= 70 && u5 < 90
  const isDanger = u5 >= 90

  const tooltip = [
    `5-hour: ${u5.toFixed(1)}%${fiveHour.resetsAt ? ` (resets ${fiveHour.resetsIn})` : ""}`,
    `7-day: ${sevenDay.utilization.toFixed(1)}%${sevenDay.resetsAt ? ` (resets ${sevenDay.resetsIn})` : ""}`,
  ].join("\n")

  if (isDanger) {
    return (
      <span
        className={cn(
          "text-xs px-2 py-1 rounded-full font-medium",
          "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
          "ring-1 ring-red-300 dark:ring-red-700"
        )}
        title={tooltip}
      >
        5h: {Math.round(u5)}% · {fiveHour.resetsIn} | 7d: {Math.round(sevenDay.utilization)}%
      </span>
    )
  }

  if (isWarning) {
    return (
      <span
        className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
        title={tooltip}
      >
        5h: {Math.round(u5)}% · {fiveHour.resetsIn}
      </span>
    )
  }

  return (
    <span
      className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
      title={tooltip}
    >
      5h: {Math.round(u5)}%
    </span>
  )
}
