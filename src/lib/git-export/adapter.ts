import type { GitFile, PushResult, PullResult } from "./github"
import { pushFiles as ghPush, pullFiles as ghPull, listDirectory as ghListDir } from "./github"
import { pushFiles as glPush, pullFiles as glPull, listDirectory as glListDir } from "./gitlab"
import { github, gitlab } from "./settings"

export type GitProviderType = "github" | "gitlab"

export function getProviderSettings(provider: GitProviderType) {
  return provider === "github" ? github : gitlab
}

export async function pushWithProvider(
  provider: GitProviderType,
  params: {
    repoUrl: string
    pat: string
    branch: string
    files: GitFile[]
    commitMessage: string
  }
): Promise<PushResult> {
  return provider === "github" ? ghPush(params) : glPush(params)
}

export type { PullResult }

export async function pullWithProvider(
  provider: GitProviderType,
  params: {
    repoUrl: string
    pat: string
    branch: string
    paths: string[]
  }
): Promise<PullResult> {
  return provider === "github"
    ? ghPull({ repoUrl: params.repoUrl, pat: params.pat, paths: params.paths, branch: params.branch })
    : glPull(params)
}

