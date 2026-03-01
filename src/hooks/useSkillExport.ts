/**
 * Hook for exporting sessions and projects as skill ZIP packages.
 *
 * Single session: SKILL.md + references/{zone}/
 * Project: SKILL.md + references/ + context-map.yaml
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
import * as yaml from "js-yaml"
import { useState, useCallback } from "react"

interface ExportBlock {
  _id: string
  content: string
  type: string
  zone: string
  position: number
  metadata?: {
    skillName?: string
    skillDescription?: string
    disableModelInvocation?: boolean
    argumentHint?: string
    sourceType?: string
    sourceRef?: string
    parentSkillName?: string
  }
}

interface UseSkillExportOptions {
  sessionId: Id<"sessions"> | undefined
  projectId?: Id<"projects"> | null
}

/**
 * Add blocks to a ZIP as references/{zone}/{filename}.md
 * Returns the mapping of block → file path for context-map generation.
 */
function addBlocksToZip(
  zip: JSZip,
  blocks: ExportBlock[],
  usedFilenames: Set<string>
): Map<string, string> {
  const blockPathMap = new Map<string, string>()

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const zone = block.zone.toLowerCase()

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

    const filePath = `references/${zone}/${filename}`
    zip.file(filePath, block.content)
    blockPathMap.set(block._id, filePath)
  }

  return blockPathMap
}

function generateSkillMd(
  skillBlocks: ExportBlock[],
  fallbackName: string,
  referencePaths: string[] = []
): string {
  let name: string
  let desc: string
  let body: string

  let disableModelInvocation: boolean | undefined
  let argumentHint: string | undefined

  if (skillBlocks.length > 0) {
    const skill = skillBlocks[0]
    name = skill.metadata?.skillName || fallbackName
    desc = skill.metadata?.skillDescription || ""
    body = skill.content
    disableModelInvocation = skill.metadata?.disableModelInvocation
    argumentHint = skill.metadata?.argumentHint
  } else {
    name = fallbackName
    desc = "Exported from ContextForge"
    body = "This skill was exported from a ContextForge session."
  }

  let frontmatter = `---\nname: "${name}"\ndescription: "${desc}"`
  if (disableModelInvocation === true) frontmatter += `\ndisable-model-invocation: true`
  if (argumentHint) frontmatter += `\nargument-hint: "${argumentHint}"`
  frontmatter += `\n---`

  let result = `${frontmatter}\n\n${body}`

  if (referencePaths.length > 0) {
    result += "\n\n## Supporting files\n\n"
    for (const path of referencePaths) {
      result += `- [${path}](${path})\n`
    }
  }

  return result
}

export function useSkillExport({ sessionId, projectId: explicitProjectId }: UseSkillExportOptions) {
  const sessionData = useQuery(
    api.skillExport.getExportData,
    sessionId ? { sessionId } : "skip"
  )

  // Auto-detect project from session if not explicitly provided
  const projectId = explicitProjectId ?? sessionData?.session.projectId ?? null
  const projectData = useQuery(
    api.skillExport.getProjectExportData,
    projectId ? { projectId } : "skip"
  )
  const [isExporting, setIsExporting] = useState(false)

  const isProject = !!projectId && !!projectData

  const exportSessionAsZip = useCallback(async () => {
    if (!sessionData) return
    setIsExporting(true)

    try {
      const zip = new JSZip()
      const { session, blocks } = sessionData

      const skillBlocks = blocks.filter((b) => b.type === "skill")
      const otherBlocks = blocks.filter((b) => b.type !== "skill")

      const usedFilenames = new Set<string>()
      const blockPathMap = addBlocksToZip(zip, otherBlocks, usedFilenames)
      const referencePaths = Array.from(blockPathMap.values())

      zip.file(
        "SKILL.md",
        generateSkillMd(skillBlocks, session.name || "Exported Skill", referencePaths)
      )

      const blob = await zip.generateAsync({ type: "blob" })
      const zipName = sanitizeFilename(
        skillBlocks[0]?.metadata?.skillName || session.name || "skill-export"
      )
      saveAs(blob, `${zipName}.zip`)
    } finally {
      setIsExporting(false)
    }
  }, [sessionData])

  const exportProjectAsZip = useCallback(async () => {
    if (!projectData) return
    setIsExporting(true)

    try {
      const zip = new JSZip()
      const { project, steps } = projectData

      // Collect all skill blocks across steps (use first one found)
      const allSkillBlocks: ExportBlock[] = []
      for (const step of steps) {
        allSkillBlocks.push(...step.blocks.filter((b) => b.type === "skill"))
      }

      // Deduplicate blocks by content across steps, track paths per step
      const contentToPath = new Map<string, string>()
      const usedFilenames = new Set<string>()
      const stepBlockPaths: Array<{
        stepName: string
        permanent: string[]
        stable: string[]
        working: string[]
      }> = []

      for (const step of steps) {
        const nonSkillBlocks = step.blocks.filter((b) => b.type !== "skill")
        const stepPaths = { permanent: [] as string[], stable: [] as string[], working: [] as string[] }

        for (let i = 0; i < nonSkillBlocks.length; i++) {
          const block = nonSkillBlocks[i]
          const zoneKey = block.zone.toLowerCase() as "permanent" | "stable" | "working"

          // Deduplicate: same content only written once to ZIP
          const existing = contentToPath.get(block.content)
          if (existing) {
            stepPaths[zoneKey].push(existing)
            continue
          }

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

          const filePath = `references/${zoneKey}/${filename}`
          zip.file(filePath, block.content)
          contentToPath.set(block.content, filePath)
          stepPaths[zoneKey].push(filePath)
        }

        stepBlockPaths.push({
          stepName: step.session.name || `Step ${step.session.stepNumber + 1}`,
          ...stepPaths,
        })
      }

      // Write SKILL.md with all reference file paths
      const referencePaths = Array.from(new Set(contentToPath.values()))
      zip.file(
        "SKILL.md",
        generateSkillMd(allSkillBlocks, project.name || "Exported Project", referencePaths)
      )

      // Generate context-map.yaml
      const contextMapObj: Record<string, any> = { contexts: {} }
      for (let i = 0; i < stepBlockPaths.length; i++) {
        const step = stepBlockPaths[i]
        const key = sanitizeFilename(step.stepName) || `step-${i + 1}`
        const ctx: Record<string, any> = { label: step.stepName }
        if (step.permanent.length > 0) ctx.permanent = step.permanent
        if (step.stable.length > 0) ctx.stable = step.stable
        if (step.working.length > 0) ctx.working = step.working
        if (i > 0) ctx.depends_on = [sanitizeFilename(stepBlockPaths[i - 1].stepName) || `step-${i}`]
        contextMapObj.contexts[key] = ctx
      }

      zip.file("context-map.yaml", yaml.dump(contextMapObj, { lineWidth: -1 }))

      const blob = await zip.generateAsync({ type: "blob" })
      const zipName = sanitizeFilename(project.name || "project-export")
      saveAs(blob, `${zipName}.zip`)
    } finally {
      setIsExporting(false)
    }
  }, [projectData])

  const exportAsZip = isProject ? exportProjectAsZip : exportSessionAsZip

  const blockCount = isProject
    ? projectData?.steps.reduce((sum, s) => sum + s.blocks.length, 0) ?? 0
    : sessionData?.blocks.length ?? 0

  const isReady = isProject
    ? !!projectData && (projectData.steps.length > 0)
    : !!sessionData && sessionData.blocks.length > 0

  return {
    exportAsZip,
    isExporting,
    isReady,
    isProject,
    blockCount,
    stepCount: projectData?.steps.length ?? 0,
  }
}
