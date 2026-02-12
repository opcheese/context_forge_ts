/**
 * Export Skill Dialog — download session as a skill ZIP package.
 */

import { Button } from "@/components/ui/button"
import { X, Download, Package } from "lucide-react"
import { useSkillExport } from "@/hooks/useSkillExport"
import type { Id } from "../../../convex/_generated/dataModel"

interface ExportSkillDialogProps {
  isOpen: boolean
  onClose: () => void
  sessionId: Id<"sessions">
}

export function ExportSkillDialog({
  isOpen,
  onClose,
  sessionId,
}: ExportSkillDialogProps) {
  const { exportAsZip, isExporting, isReady, blockCount } = useSkillExport({
    sessionId,
  })

  if (!isOpen) return null

  const handleExport = async () => {
    await exportAsZip()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold">Export as Skill</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Export this session as a Claude Code-compatible skill package (.zip).
          </p>

          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Blocks:</span>
              <span className="font-medium">{blockCount}</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2.5">
            The ZIP will contain:
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li>SKILL.md — skill definition with frontmatter</li>
              <li>references/permanent/ — permanent zone blocks</li>
              <li>references/stable/ — stable zone blocks</li>
              <li>references/working/ — working zone blocks</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 flex justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!isReady || isExporting}>
            <Download className="w-4 h-4 mr-1" />
            {isExporting ? "Exporting..." : "Download ZIP"}
          </Button>
        </div>
      </div>
    </div>
  )
}
