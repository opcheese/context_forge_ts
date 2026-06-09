import type { GitFile, PushResult, PullResult } from "./github"

function parseRepoUrl(repoUrl: string): { host: string; encodedPath: string; repoUrl: string } {
  const match = repoUrl.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/)
  if (!match) throw new Error(`Invalid GitLab repo URL: ${repoUrl}`)
  return {
    host: match[1],
    encodedPath: encodeURIComponent(match[2]),
    repoUrl: `https://${match[1]}/${match[2]}`,
  }
}

async function glFetch(
  pat: string,
  url: string,
  options: RequestInit & { allow404?: boolean } = {}
): Promise<Response> {
  const { allow404, ...fetchOptions } = options
  let res: Response
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers: {
        "PRIVATE-TOKEN": pat,
        "Content-Type": "application/json",
        ...(fetchOptions.headers ?? {}),
      },
    })
  } catch {
    throw new Error("GitLab: request failed — check your PAT and repository access (possibly 403 Forbidden)")
  }
  if (!res.ok && !(allow404 && res.status === 404)) {
    let message = `GitLab: error ${res.status}`
    try {
      const data = await res.clone().json()
      if (typeof data.message === "string") message = `GitLab: ${data.message} (${res.status})`
      else if (typeof data.error === "string") message = `GitLab: ${data.error} (${res.status})`
    } catch {
      // fall back to status-only message
    }
    throw new Error(message)
  }
  return res
}

async function fileExists(
  pat: string,
  apiBase: string,
  encodedPath: string,
  filePath: string,
  branch: string
): Promise<boolean> {
  const encodedFilePath = encodeURIComponent(filePath)
  const res = await fetch(
    `${apiBase}/projects/${encodedPath}/repository/files/${encodedFilePath}?ref=${branch}`,
    { headers: { "PRIVATE-TOKEN": pat } }
  )
  return res.ok
}

export async function pushFiles(params: {
  repoUrl: string
  pat: string
  branch: string
  files: GitFile[]
  commitMessage: string
}): Promise<PushResult> {
  const { host, encodedPath, repoUrl: normalizedUrl } = parseRepoUrl(params.repoUrl)
  const apiBase = `https://${host}/api/v4`

  // Verify repo is accessible
  await glFetch(params.pat, `${apiBase}/projects/${encodedPath}`)

  // Check which files already exist (parallel)
  const existsFlags = await Promise.all(
    params.files.map((f) =>
      fileExists(params.pat, apiBase, encodedPath, f.path, params.branch)
    )
  )

  const actions = params.files.map((file, i) => ({
    action: existsFlags[i] ? "update" : "create",
    file_path: file.path,
    content: file.content,
    encoding: "text",
  }))

  const res = await glFetch(
    params.pat,
    `${apiBase}/projects/${encodedPath}/repository/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        branch: params.branch,
        commit_message: params.commitMessage,
        actions,
      }),
    }
  )

  const data = await res.json()

  return {
    repoUrl: normalizedUrl,
    commitSha: data.id as string,
  }
}

export async function pullFiles(params: {
  repoUrl: string
  pat: string
  branch: string
  paths: string[]
}): Promise<PullResult> {
  const { host, encodedPath } = parseRepoUrl(params.repoUrl)
  const apiBase = `https://${host}/api/v4`

  type Item = { found: true; path: string; content: string; sha: string } | { found: false; path: string }

  const results = await Promise.allSettled(
    params.paths.map(async (filePath): Promise<Item> => {
      const encodedFilePath = encodeURIComponent(filePath)
      const res = await glFetch(
        params.pat,
        `${apiBase}/projects/${encodedPath}/repository/files/${encodedFilePath}?ref=${encodeURIComponent(params.branch)}`,
        { allow404: true }
      )
      if (res.status === 404) return { found: false, path: filePath }
      const data = await res.json()
      const base64 = (data.content as string).replace(/\n/g, "")
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      return { found: true, path: filePath, content: new TextDecoder("utf-8").decode(bytes), sha: data.blob_id as string }
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
  const { host, encodedPath } = parseRepoUrl(params.repoUrl)
  const apiBase = `https://${host}/api/v4`
  const encodedDir = encodeURIComponent(params.dirPath)
  const res = await glFetch(
    params.pat,
    `${apiBase}/projects/${encodedPath}/repository/tree?path=${encodedDir}&ref=${encodeURIComponent(params.branch)}&per_page=100`,
    { allow404: true }
  )
  if (res.status === 404) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return (data as Array<{ type: string; name: string; path: string }>)
    .filter((item) => item.type === "blob")
    .map((item) => ({ name: item.name, path: item.path }))
}

export async function checkConnection(pat: string, instanceUrl: string): Promise<{ login: string }> {
  const apiBase = instanceUrl.replace(/\/$/, "")
  const res = await glFetch(pat, `${apiBase}/api/v4/user`)
  const data = await res.json()
  return { login: data.username as string }
}

export async function checkRepo(pat: string, repoUrl: string): Promise<void> {
  const { host, encodedPath } = parseRepoUrl(repoUrl)
  const res = await glFetch(pat, `https://${host}/api/v4/projects/${encodedPath}`)
  const data = await res.json()
  const projectLevel = (data.permissions?.project_access?.access_level as number | undefined) ?? 0
  const groupLevel = (data.permissions?.group_access?.access_level as number | undefined) ?? 0
  const effectiveLevel = Math.max(projectLevel, groupLevel)
  // Developer (30) is minimum for push; Reporter (20) and Guest (10) are read-only
  if (effectiveLevel >= 1 && effectiveLevel < 30) {
    throw new Error("GitLab: read-only access to repository — Developer role or higher required")
  }
}
