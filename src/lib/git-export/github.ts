export interface GitFile {
  path: string
  content: string
}

export interface PushResult {
  repoUrl: string
  commitSha: string
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
  if (!match) throw new Error(`Invalid GitHub repo URL: ${repoUrl}`)
  return { owner: match[1], repo: match[2] }
}

async function ghFetch(
  pat: string,
  path: string,
  options: RequestInit & { allow404?: boolean } = {}
): Promise<Response> {
  const { allow404, ...fetchOptions } = options
  let res: Response
  try {
    res = await fetch(`https://api.github.com${path}`, {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(fetchOptions.headers ?? {}),
      },
    })
  } catch {
    throw new Error("GitHub: request failed — check your PAT and repository access (possibly 403 Forbidden)")
  }
  if (!res.ok && !(allow404 && res.status === 404)) {
    let message = `GitHub: error ${res.status}`
    try {
      const data = await res.clone().json()
      if (typeof data.message === "string") message = `GitHub: ${data.message} (${res.status})`
    } catch {
      // fall back to status-only message
    }
    throw new Error(message)
  }
  return res
}

export interface PullResult {
  files: Array<{ path: string; content: string; sha: string }>
  notFound: string[]
}

export async function pushFiles(params: {
  repoUrl: string
  pat: string
  branch: string
  files: GitFile[]
  commitMessage: string
}): Promise<PushResult> {
  const { owner, repo } = parseRepoUrl(params.repoUrl)
  const base = `/repos/${owner}/${repo}`

  // Verify repo is accessible (throws with clear error if URL is wrong or no access)
  await ghFetch(params.pat, base)

  // Try to get existing branch ref; 404 here means empty repo or new branch
  let latestCommitSha: string | null = null
  let baseTreeSha: string | null = null

  const refRes = await fetch(`https://api.github.com${base}/git/refs/heads/${params.branch}`, {
    headers: {
      Authorization: `Bearer ${params.pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })

  if (refRes.ok) {
    const refData = await refRes.json()
    latestCommitSha = refData.object.sha as string

    const commitRes = await ghFetch(params.pat, `${base}/git/commits/${latestCommitSha}`)
    const commitData = await commitRes.json()
    baseTreeSha = commitData.tree.sha as string
  } else if (refRes.status !== 404) {
    const body = await refRes.text()
    throw new Error(`GitHub API ${refRes.status}: ${body}`)
  }
  // 404 → branch doesn't exist yet, will create root commit below

  // Create blobs for all files
  const treeItems = await Promise.all(
    params.files.map(async (file) => {
      const blobRes = await ghFetch(params.pat, `${base}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
      })
      const blob = await blobRes.json()
      return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha as string }
    })
  )

  // Create tree (on top of base tree if branch exists, or fresh tree for empty repo)
  const treeBody: Record<string, unknown> = { tree: treeItems }
  if (baseTreeSha) treeBody.base_tree = baseTreeSha

  const treeRes = await ghFetch(params.pat, `${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify(treeBody),
  })
  const tree = await treeRes.json()

  // Create commit (with parent if branch exists, or root commit for empty repo)
  const newCommitRes = await ghFetch(params.pat, `${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: params.commitMessage,
      tree: tree.sha,
      parents: latestCommitSha ? [latestCommitSha] : [],
    }),
  })
  const newCommit = await newCommitRes.json()

  // Update existing branch ref or create new one
  if (latestCommitSha) {
    await ghFetch(params.pat, `${base}/git/refs/heads/${params.branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha, force: true }),
    })
  } else {
    await ghFetch(params.pat, `${base}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${params.branch}`, sha: newCommit.sha }),
    })
  }

  return {
    repoUrl: `https://github.com/${owner}/${repo}`,
    commitSha: newCommit.sha as string,
  }
}

export async function pullFiles(params: {
  repoUrl: string
  pat: string
  branch?: string
  paths: string[]
}): Promise<PullResult> {
  const { owner, repo } = parseRepoUrl(params.repoUrl)

  type Item = { found: true; path: string; content: string; sha: string } | { found: false; path: string }

  const results = await Promise.allSettled(
    params.paths.map(async (filePath): Promise<Item> => {
      const ref = params.branch ? `?ref=${encodeURIComponent(params.branch)}` : ""
      const encodedPath = filePath.split("/").map(encodeURIComponent).join("/")
      const res = await ghFetch(params.pat, `/repos/${owner}/${repo}/contents/${encodedPath}${ref}`, {
        allow404: true,
      })
      if (res.status === 404) return { found: false, path: filePath }
      const data = await res.json()
      const base64 = (data.content as string).replace(/\n/g, "")
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      return { found: true, path: filePath, content: new TextDecoder("utf-8").decode(bytes), sha: data.sha as string }
    })
  )

  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
  const fulfilled = results.filter((r): r is PromiseFulfilledResult<Item> => r.status === "fulfilled")

  if (fulfilled.length === 0 && rejected.length > 0) {
    throw rejected[0].reason
  }

  return {
    files: fulfilled.filter((r) => r.value.found).map((r) => {
      const v = r.value as { found: true; path: string; content: string; sha: string }
      return { path: v.path, content: v.content, sha: v.sha }
    }),
    notFound: fulfilled.filter((r) => !r.value.found).map((r) => r.value.path),
  }
}

export async function listDirectory(params: {
  repoUrl: string
  pat: string
  branch: string
  dirPath: string
}): Promise<Array<{ name: string; path: string }>> {
  const { owner, repo } = parseRepoUrl(params.repoUrl)
  const encodedDir = params.dirPath.split("/").map(encodeURIComponent).join("/")
  const ref = `?ref=${encodeURIComponent(params.branch)}`
  const res = await ghFetch(
    params.pat,
    `/repos/${owner}/${repo}/contents/${encodedDir}${ref}`,
    { allow404: true }
  )
  if (res.status === 404) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return (data as Array<{ type: string; name: string; path: string }>)
    .filter((item) => item.type === "file")
    .map((item) => ({ name: item.name, path: item.path }))
}

export async function checkConnection(pat: string): Promise<{ login: string }> {
  const res = await ghFetch(pat, "/user")
  const data = await res.json()
  return { login: data.login as string }
}

export async function checkRepo(pat: string, repoUrl: string): Promise<void> {
  const { owner, repo } = parseRepoUrl(repoUrl)
  const res = await ghFetch(pat, `/repos/${owner}/${repo}`)
  const data = await res.json()
  if (data.permissions && data.permissions.push === false && data.permissions.admin === false) {
    throw new Error(`GitHub: read-only access to ${owner}/${repo} — push permission required`)
  }
}
