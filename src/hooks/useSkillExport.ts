/**
 * Hook for exporting a session as a skill ZIP package.
 *
 * Generates SKILL.md from skill block (or fallback), organizes
 * remaining blocks into references/{zone}/, and downloads as ZIP.
 */

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import {
  extractBlockTitle,
  sanitizeFilename,
  uniqueFilename,
} from "@/lib/skills/titleExtractor"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import { useState, useCallback } from "react"

interface UseSkillExportOptions {
  sessionId: Id<"sessions"> | undefined
}

export function useSkillExport({ sessionId }: UseSkillExportOptions) {
  const data = useQuery(
    api.skillExport.getExportData,
    sessionId ? { sessionId } : "skip"
  )
  const [isExporting, setIsExporting] = useState(false)

  const exportAsZip = useCallback(async () => {
    if (!data) return
    setIsExporting(true)

    try {
      const zip = new JSZip()
      const { session, blocks } = data

      // Find skill block(s)
      const skillBlocks = blocks.filter((b) => b.type === "skill")
      const otherBlocks = blocks.filter((b) => b.type !== "skill")

      // Generate SKILL.md
      let skillMd: string
      if (skillBlocks.length > 0) {
        const skill = skillBlocks[0]
        const name =
          skill.metadata?.skillName || session.name || "Exported Skill"
        const desc = skill.metadata?.skillDescription || ""
        skillMd = `---\nname: "${name}"\ndescription: "${desc}"\n---\n\n${skill.content}`
      } else {
        // Fallback: create minimal SKILL.md from session name
        const name = session.name || "Exported Skill"
        skillMd = `---\nname: "${name}"\ndescription: "Exported from ContextForge"\n---\n\nThis skill was exported from a ContextForge session.`
      }
      zip.file("SKILL.md", skillMd)

      // Add other blocks as references/{zone}/{filename}.md
      const usedFilenames = new Set<string>()
      for (let i = 0; i < otherBlocks.length; i++) {
        const block = otherBlocks[i]
        const zone = block.zone.toLowerCase()

        // Use metadata skillName (original filename) if available, otherwise extract
        let baseName: string
        if (block.metadata?.skillName) {
          baseName = sanitizeFilename(
            block.metadata.skillName.replace(/\.md$/i, "")
          )
        } else {
          const title = extractBlockTitle(block.content, block.type, i)
          baseName = sanitizeFilename(title)
        }

        const filename = uniqueFilename(baseName, ".md", usedFilenames)
        usedFilenames.add(filename)

        zip.file(`references/${zone}/${filename}`, block.content)
      }

      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" })
      const zipName = sanitizeFilename(
        skillBlocks[0]?.metadata?.skillName || session.name || "skill-export"
      )
      saveAs(blob, `${zipName}.zip`)
    } finally {
      setIsExporting(false)
    }
  }, [data])

  return {
    exportAsZip,
    isExporting,
    isReady: !!data && data.blocks.length > 0,
    blockCount: data?.blocks.length ?? 0,
  }
}
