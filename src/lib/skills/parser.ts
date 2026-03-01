/**
 * SKILL.md parser — zero-dependency, pure function.
 * Parses YAML frontmatter and markdown body from SKILL.md files.
 *
 * NOTE: A simplified copy of this parsing logic exists in convex/skillsNode.ts
 * for server-side use. Keep both in sync if the frontmatter format evolves.
 */

export interface SkillMetadata {
  skillName: string
  skillDescription: string
  disableModelInvocation?: boolean
  argumentHint?: string
}

export interface ParsedSkill {
  content: string
  metadata: SkillMetadata
}

export class SkillParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SkillParseError"
  }
}

/**
 * Parse a SKILL.md file content string into structured skill data.
 *
 * @param raw - Raw file content
 * @param fallbackName - Optional fallback for description (e.g., filename)
 * @returns ParsedSkill with content and metadata
 * @throws SkillParseError if frontmatter is missing or name is not found
 */
export function parseSkillMd(raw: string, fallbackName?: string): ParsedSkill {
  const trimmed = raw.trim()

  if (!trimmed.startsWith("---")) {
    throw new SkillParseError(
      "Not a valid SKILL.md: missing frontmatter (expected --- at start)"
    )
  }

  const closingIndex = trimmed.indexOf("---", 3)
  if (closingIndex === -1) {
    throw new SkillParseError(
      "Not a valid SKILL.md: missing closing --- delimiter"
    )
  }

  const frontmatterBlock = trimmed.slice(3, closingIndex).trim()
  const body = trimmed.slice(closingIndex + 3).trim()

  // Parse simple key: value pairs from frontmatter
  const fields: Record<string, string> = {}
  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim().toLowerCase()
    let value = line.slice(colonIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[key] = value
  }

  const name = fields["name"]
  if (!name) {
    throw new SkillParseError(
      "Not a valid SKILL.md: missing required 'name' field in frontmatter"
    )
  }

  const description = fields["description"] || fallbackName || ""

  const disableModelInvocation =
    fields["disable-model-invocation"] === "true" ? true : undefined
  const argumentHint = fields["argument-hint"] || undefined

  return {
    content: body,
    metadata: {
      skillName: name,
      skillDescription: description,
      ...(disableModelInvocation !== undefined && { disableModelInvocation }),
      ...(argumentHint !== undefined && { argumentHint }),
    },
  }
}
