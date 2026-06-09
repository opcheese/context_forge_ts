import { pullWithProvider, getProviderSettings } from "./adapter"
import { stripFrontmatter } from "./markdown"

export interface SyncChange {
  blockId: string
  currentContent: string
  remoteContent: string
  path: string
}

export interface SyncResult {
  changes: SyncChange[]
  notFound: string[]
}

export async function checkForUpdates(
  syncMapping: {
    provider: "github" | "gitlab"
    repoUrl: string
    branch: string
  },
  syncBlocks: Array<{
    blockId: string
    path: string
    rejectedRemoteContent?: string
  }>,
  convexBlocks: Array<{ _id: string; content: string }>
): Promise<SyncResult> {
  if (syncBlocks.length === 0) return { changes: [], notFound: [] }

  const settings = getProviderSettings(syncMapping.provider)
  const pat = settings.getPat()
  if (!pat) throw new Error(`${syncMapping.provider === "github" ? "GitHub" : "GitLab"} PAT not configured`)

  const paths = syncBlocks.map((b) => b.path)

  const { files: remoteFiles, notFound } = await pullWithProvider(syncMapping.provider, {
    repoUrl: syncMapping.repoUrl,
    pat,
    branch: syncMapping.branch,
    paths,
  })

  const remoteByPath = new Map(remoteFiles.map((f) => [f.path, f]))
  const convexByBlockId = new Map(convexBlocks.map((b) => [b._id, b]))

  const changes: SyncChange[] = []
  const yieldedPaths = new Set<string>()

  for (const syncBlock of syncBlocks) {
    if (yieldedPaths.has(syncBlock.path)) continue

    const remote = remoteByPath.get(syncBlock.path)
    if (!remote) continue

    const remoteBody = stripFrontmatter(remote.content)
    const convexBlock = convexByBlockId.get(syncBlock.blockId)
    if (!convexBlock) continue

    if (remoteBody.trim() === convexBlock.content.trim()) continue
    if (syncBlock.rejectedRemoteContent === remoteBody) continue

    yieldedPaths.add(syncBlock.path)
    changes.push({
      blockId: syncBlock.blockId,
      currentContent: convexBlock.content,
      remoteContent: remoteBody,
      path: syncBlock.path,
    })
  }

  return { changes, notFound }
}
