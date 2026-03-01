"use node"

/**
 * Node.js action for scanning local SKILL.md files.
 * Feature-gated: only works when SKILL_SCAN_ENABLED=true.
 *
 * NOTE: Contains an inline parser that mirrors src/lib/skills/parser.ts.
 * Keep both in sync if the frontmatter format evolves.
 */

import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { isSkillScanEnabled } from "./lib/featureFlags"

interface DiscoveredReference {
  filename: string
  content: string
  zone: string
  relativePath: string
  tokenEstimate: number
}

interface DiscoveredSkill {
  name: string
  description: string
  content: string
  folderPath: string
  tokenEstimate: number
  references: DiscoveredReference[]
  contextMapYaml?: string
  contextCount?: number
}

/**
 * Determine zone from a reference file's relative path within references/.
 */
function zoneFromRefPath(relativePath: string): string {
  const lower = relativePath.toLowerCase()
  if (lower.startsWith("permanent/") || lower.startsWith("permanent\\")) return "PERMANENT"
  if (lower.startsWith("working/") || lower.startsWith("working\\")) return "WORKING"
  if (lower.startsWith("stable/") || lower.startsWith("stable\\")) return "STABLE"
  return "STABLE"
}

/**
 * Recursively read .md files from a directory, returning paths relative to baseDir.
 */
function readMdFilesRecursive(dir: string, baseDir: string): { relativePath: string; content: string }[] {
  const results: { relativePath: string; content: string }[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...readMdFilesRecursive(fullPath, baseDir))
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      const relativePath = path.relative(baseDir, fullPath).split(path.sep).join("/")
      results.push({ relativePath, content: fs.readFileSync(fullPath, "utf-8") })
    }
  }
  return results
}

/**
 * Scan a directory for SKILL.md files and their references.
 */
export const scanFolder = action({
  args: {
    folderPath: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    skills: DiscoveredSkill[]
    error?: string
  }> => {
    if (!isSkillScanEnabled()) {
      return { skills: [], error: "Skill folder scanning is disabled" }
    }

    const targetPath = args.folderPath || path.join(os.homedir(), ".claude", "skills")

    if (!fs.existsSync(targetPath)) {
      return { skills: [], error: `Folder not found: ${targetPath}` }
    }

    const skills: DiscoveredSkill[] = []

    const entries = fs.readdirSync(targetPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillDir = path.join(targetPath, entry.name)
      const skillMdPath = path.join(skillDir, "SKILL.md")
      if (!fs.existsSync(skillMdPath)) continue

      const raw = fs.readFileSync(skillMdPath, "utf-8")
      const parsed = parseSkillMdInline(raw, entry.name)
      if (!parsed) continue

      // Scan references/ subdirectory
      const refsDir = path.join(skillDir, "references")
      const refFiles = readMdFilesRecursive(refsDir, refsDir)
      const references: DiscoveredReference[] = refFiles
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
        .map((f) => ({
          filename: path.basename(f.relativePath),
          content: f.content,
          zone: zoneFromRefPath(f.relativePath),
          relativePath: `references/${f.relativePath}`,
          tokenEstimate: Math.ceil(f.content.length / 4),
        }))

      // Check for context-map.yaml
      const contextMapPath = path.join(skillDir, "context-map.yaml")
      let contextMapYaml: string | undefined
      let contextCount: number | undefined
      if (fs.existsSync(contextMapPath)) {
        contextMapYaml = fs.readFileSync(contextMapPath, "utf-8")
        // Quick count of contexts via label occurrences
        const matches = contextMapYaml.match(/^\s+label:/gm)
        contextCount = matches?.length || 0
      }

      skills.push({
        name: parsed.skillName,
        description: parsed.skillDescription,
        content: parsed.content,
        folderPath: skillDir,
        tokenEstimate: Math.ceil(parsed.content.length / 4),
        references,
        contextMapYaml,
        contextCount,
      })
    }

    return { skills }
  },
})

/**
 * Import selected skills from a scan result into a session.
 */
export const importFromScan = action({
  args: {
    sessionId: v.id("sessions"),
    skills: v.array(
      v.object({
        content: v.string(),
        skillName: v.string(),
        skillDescription: v.optional(v.string()),
        folderPath: v.string(),
        references: v.optional(
          v.array(
            v.object({
              filename: v.string(),
              content: v.string(),
              zone: v.string(),
              relativePath: v.string(),
            })
          )
        ),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ imported: number; references: number }> => {
    let imported = 0
    let totalRefs = 0
    for (const skill of args.skills) {
      const refs = skill.references ?? []
      if (refs.length > 0) {
        await ctx.runMutation(internal.skills.importSkillWithReferencesInternal, {
          sessionId: args.sessionId,
          skill: {
            content: skill.content,
            metadata: {
              skillName: skill.skillName,
              skillDescription: skill.skillDescription,
              sourceType: "local" as const,
              sourceRef: skill.folderPath,
            },
          },
          references: refs.map((r) => ({
            content: r.content,
            filename: r.filename,
            zone: r.zone as "PERMANENT" | "STABLE" | "WORKING",
            relativePath: r.relativePath,
          })),
        })
        totalRefs += refs.length
      } else {
        await ctx.runMutation(internal.skills.importSkillInternal, {
          sessionId: args.sessionId,
          content: skill.content,
          metadata: {
            skillName: skill.skillName,
            skillDescription: skill.skillDescription,
            sourceType: "local" as const,
            sourceRef: skill.folderPath,
          },
        })
      }
      imported++
    }
    return { imported, references: totalRefs }
  },
})

// Inline parser — mirrors src/lib/skills/parser.ts without importing it.
function parseSkillMdInline(
  raw: string,
  fallbackName: string
): {
  content: string
  skillName: string
  skillDescription: string
  disableModelInvocation?: boolean
  argumentHint?: string
} | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("---")) return null
  const closingIndex = trimmed.indexOf("---", 3)
  if (closingIndex === -1) return null

  const frontmatter = trimmed.slice(3, closingIndex).trim()
  const body = trimmed.slice(closingIndex + 3).trim()

  const fields: Record<string, string> = {}
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim().toLowerCase()
    let value = line.slice(colonIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[key] = value
  }

  const name = fields["name"]
  if (!name) return null

  return {
    content: body,
    skillName: name,
    skillDescription: fields["description"] || fallbackName,
    disableModelInvocation:
      fields["disable-model-invocation"] === "true" ? true : undefined,
    argumentHint: fields["argument-hint"] || undefined,
  }
}
