import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { parseSkillMd, SkillParseError } from "@/lib/skills/parser"
import type { Zone } from "@/components/dnd"
import { parseSkillDirectory } from "@/lib/skills/directoryParser"
import type { ParsedContextMap } from "@/lib/skills/contextMapParser"
import JSZip from "jszip"

export interface ImportResult {
  skillName: string
  referenceCount: number
}

export interface PendingProjectImport {
  skillName: string
  skillDescription?: string
  skillContent: string
  contextMap: ParsedContextMap
  files: { path: string; content: string }[]
  sourceType: "upload" | "url"
  sourceRef: string
}

interface UseSkillImportOptions {
  sessionId: Id<"sessions">
  onSuccess?: (skillName: string, referenceCount?: number) => void
  onError?: (error: string) => void
}

export function useSkillImport({
  sessionId,
  onSuccess,
  onError,
}: UseSkillImportOptions) {
  const [isImporting, setIsImporting] = useState(false)
  const [pendingProjectImport, setPendingProjectImport] = useState<PendingProjectImport | null>(null)
  const importSkill = useMutation(api.skills.importSkill)
  const importSkillWithRefs = useMutation(api.skills.importSkillWithReferences)
  const importAsProject = useMutation(api.contextMapImport.importAsProject)

  const importFromContent = useCallback(
    async (
      raw: string,
      sourceType: "upload" | "url",
      sourceRef: string,
      fallbackName?: string,
      zone?: Zone
    ) => {
      setIsImporting(true)
      try {
        const parsed = parseSkillMd(raw, fallbackName)
        await importSkill({
          sessionId,
          content: parsed.content,
          metadata: {
            skillName: parsed.metadata.skillName,
            skillDescription: parsed.metadata.skillDescription,
            disableModelInvocation: parsed.metadata.disableModelInvocation,
            argumentHint: parsed.metadata.argumentHint,
            sourceType,
            sourceRef,
          },
          zone,
        })
        onSuccess?.(parsed.metadata.skillName, 0)
      } catch (err) {
        const msg =
          err instanceof SkillParseError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Import failed"
        onError?.(msg)
      } finally {
        setIsImporting(false)
      }
    },
    [sessionId, importSkill, onSuccess, onError]
  )

  const importFromZip = useCallback(
    async (file: File) => {
      setIsImporting(true)
      try {
        const zip = await JSZip.loadAsync(file)
        const files = new Map<string, string>()

        // Find the root: ZIP may contain a top-level directory wrapper
        const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir)
        const prefix = detectRootPrefix(paths)

        for (const [filePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue
          const relativePath = prefix ? filePath.slice(prefix.length) : filePath
          if (!relativePath) continue
          const content = await zipEntry.async("string")
          files.set(relativePath, content)
        }

        const parsed = parseSkillDirectory(files, file.name.replace(/\.zip$/i, ""))

        // Multi-context context-map → defer to project import confirmation
        if (parsed.contextMap && parsed.contextMap.contexts.length > 1) {
          setPendingProjectImport({
            skillName: parsed.skill.metadata.skillName,
            skillDescription: parsed.skill.metadata.skillDescription,
            skillContent: parsed.skill.content,
            contextMap: parsed.contextMap,
            files: Array.from(files.entries()).map(([path, content]) => ({ path, content })),
            sourceType: "upload",
            sourceRef: file.name,
          })
          setIsImporting(false)
          return
        }

        // Simple import (no context-map or single context)
        if (parsed.references.length > 0) {
          await importSkillWithRefs({
            sessionId,
            skill: {
              content: parsed.skill.content,
              metadata: {
                skillName: parsed.skill.metadata.skillName,
                skillDescription: parsed.skill.metadata.skillDescription,
                disableModelInvocation: parsed.skill.metadata.disableModelInvocation,
                argumentHint: parsed.skill.metadata.argumentHint,
                sourceType: "upload",
                sourceRef: file.name,
              },
            },
            references: parsed.references.map((r) => ({
              content: r.content,
              filename: r.filename,
              zone: r.zone,
              relativePath: r.relativePath,
            })),
          })
        } else {
          await importSkill({
            sessionId,
            content: parsed.skill.content,
            metadata: {
              skillName: parsed.skill.metadata.skillName,
              skillDescription: parsed.skill.metadata.skillDescription,
              disableModelInvocation: parsed.skill.metadata.disableModelInvocation,
              argumentHint: parsed.skill.metadata.argumentHint,
              sourceType: "upload",
              sourceRef: file.name,
            },
          })
        }

        onSuccess?.(parsed.skill.metadata.skillName, parsed.references.length)
      } catch (err) {
        const msg =
          err instanceof SkillParseError
            ? err.message
            : err instanceof Error
              ? err.message
              : "ZIP import failed"
        onError?.(msg)
      } finally {
        setIsImporting(false)
      }
    },
    [sessionId, importSkill, importSkillWithRefs, onSuccess, onError]
  )

  const importFromFile = useCallback(
    async (file: File, zone?: Zone) => {
      if (file.name.toLowerCase().endsWith(".zip")) {
        await importFromZip(file)
        return
      }
      const raw = await file.text()
      await importFromContent(
        raw,
        "upload",
        file.name,
        file.name.replace(/\.md$/, ""),
        zone
      )
    },
    [importFromContent, importFromZip]
  )

  const importFromUrl = useCallback(
    async (url: string) => {
      setIsImporting(true)
      try {
        const rawUrl = normalizeGitHubUrl(url)
        const response = await fetch(rawUrl)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`
          )
        }
        const raw = await response.text()
        // Reset isImporting so importFromContent can manage it
        setIsImporting(false)
        await importFromContent(raw, "url", url)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "URL import failed"
        onError?.(msg)
        setIsImporting(false)
      }
    },
    [importFromContent, onError]
  )

  const confirmProjectImport = useCallback(async () => {
    if (!pendingProjectImport) return
    setIsImporting(true)
    try {
      await importAsProject({
        sessionId,
        skillName: pendingProjectImport.skillName,
        skillDescription: pendingProjectImport.skillDescription,
        skillContent: pendingProjectImport.skillContent,
        contexts: pendingProjectImport.contextMap.contexts.map((c) => ({
          key: c.key,
          label: c.label,
          permanent: c.permanent,
          stable: c.stable,
          working: c.working,
        })),
        files: pendingProjectImport.files,
        sourceType: pendingProjectImport.sourceType,
        sourceRef: pendingProjectImport.sourceRef,
      })
      const count = pendingProjectImport.contextMap.contexts.length
      setPendingProjectImport(null)
      onSuccess?.(pendingProjectImport.skillName, count)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Project import failed"
      onError?.(msg)
    } finally {
      setIsImporting(false)
    }
  }, [pendingProjectImport, sessionId, importAsProject, onSuccess, onError])

  const cancelProjectImport = useCallback(() => {
    setPendingProjectImport(null)
  }, [])

  return {
    importFromFile,
    importFromUrl,
    importFromContent,
    isImporting,
    pendingProjectImport,
    confirmProjectImport,
    cancelProjectImport,
  }
}

/**
 * Detect if all files in a ZIP share a common root directory prefix.
 * e.g. ["my-skill/SKILL.md", "my-skill/references/a.md"] → "my-skill/"
 */
function detectRootPrefix(paths: string[]): string {
  if (paths.length === 0) return ""
  const first = paths[0]
  const slashIdx = first.indexOf("/")
  if (slashIdx === -1) return ""
  const candidate = first.slice(0, slashIdx + 1)
  if (paths.every((p) => p.startsWith(candidate))) return candidate
  return ""
}

/**
 * Convert GitHub directory/blob URLs to raw content URLs.
 */
function normalizeGitHubUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === "github.com") {
      const pathParts = u.pathname.split("/")
      const blobIndex = pathParts.indexOf("blob")
      if (blobIndex !== -1) {
        pathParts.splice(blobIndex, 1)
        return `https://raw.githubusercontent.com${pathParts.join("/")}`
      }
      const treeIndex = pathParts.indexOf("tree")
      if (treeIndex !== -1) {
        pathParts.splice(treeIndex, 1)
        const newPath = pathParts.join("/")
        return `https://raw.githubusercontent.com${newPath}/SKILL.md`
      }
    }
    return url
  } catch {
    return url
  }
}
