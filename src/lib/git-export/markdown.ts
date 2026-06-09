import { extractBlockTitle, sanitizeFilename } from "@/lib/skills/titleExtractor"

export { sanitizeFilename } from "@/lib/skills/titleExtractor"
export { uniqueFilename } from "@/lib/skills/titleExtractor"

export function renderBlockToMarkdown(block: {
  _id: string
  content: string
  type: string
}, _sessionName: string): string {
  return block.content
}

export function renderAnchorJson(anchor: {
  blockId: string
  path: string
  exportedAt: string
}): string {
  return JSON.stringify(anchor, null, 2)
}

const TYPE_DIR: Record<string, string> = {
  entry_brief: "entry-briefs",
  assistant_message: "assistant-messages",
  user_message: "user-messages",
  note: "notes",
  document: "documents",
  guideline: "guidelines",
  template: "templates",
  reference: "references",
  instruction: "instructions",
  system_prompt: "system-prompts",
  persona: "personas",
  framework: "frameworks",
  code: "code",
  skill: "skills",
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content
  const afterOpenMarker = content.indexOf("\n", 3)
  if (afterOpenMarker === -1) return content
  const closeMarker = content.indexOf("\n---", afterOpenMarker)
  if (closeMarker === -1) return content
  return content.slice(closeMarker + 4).trimStart()
}

export function buildBaseFilePath(params: {
  content: string
  blockType: string
  typeIndex: number
  folder: string
}): string {
  const { content, blockType, typeIndex, folder } = params

  const title = extractBlockTitle(content, blockType, typeIndex)
  const base = sanitizeFilename(title)
  const dir = TYPE_DIR[blockType] ?? blockType.replace(/_/g, "-") + "s"
  const prefix = folder.trim().replace(/\/$/, "")

  return prefix ? `${prefix}/${dir}/${base}` : `${dir}/${base}`
}
