/**
 * Skills — import SKILL.md files as skill blocks.
 *
 * Mutations receive pre-parsed data (content + metadata).
 * The parser lives in src/lib/skills/parser.ts and is NOT imported here.
 */

import { mutation, internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { zoneValidator, type Zone } from "./lib/validators"
import { countTokens, DEFAULT_TOKEN_MODEL } from "./lib/tokenizer"
import { requireSessionAccess } from "./lib/auth"

const skillMetadataArg = v.object({
  skillName: v.string(),
  skillDescription: v.optional(v.string()),
  disableModelInvocation: v.optional(v.boolean()),
  argumentHint: v.optional(v.string()),
  sourceType: v.union(v.literal("local"), v.literal("upload"), v.literal("url")),
  sourceRef: v.optional(v.string()),
  parentSkillName: v.optional(v.string()),
})

export async function getNextPosition(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  zone: Zone
): Promise<number> {
  const lastBlock = await ctx.db
    .query("blocks")
    .withIndex("by_session_zone", (q) => q.eq("sessionId", sessionId).eq("zone", zone))
    .order("desc")
    .first()
  return lastBlock ? lastBlock.position + 1 : 0
}

export async function insertSkillBlock(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"sessions">
    content: string
    metadata: {
      skillName: string
      skillDescription?: string
      disableModelInvocation?: boolean
      argumentHint?: string
      sourceType: "local" | "upload" | "url"
      sourceRef?: string
      parentSkillName?: string
    }
    zone?: Zone
  }
) {
  const zone = args.zone ?? "STABLE"
  const position = await getNextPosition(ctx, args.sessionId, zone)
  const now = Date.now()
  const tokens = countTokens(args.content)

  await ctx.db.patch(args.sessionId, { updatedAt: now })

  return await ctx.db.insert("blocks", {
    sessionId: args.sessionId,
    content: args.content,
    type: "skill",
    zone,
    position,
    createdAt: now,
    updatedAt: now,
    tokens,
    originalTokens: tokens,
    tokenModel: DEFAULT_TOKEN_MODEL,
    metadata: {
      skillName: args.metadata.skillName,
      skillDescription: args.metadata.skillDescription,
      disableModelInvocation: args.metadata.disableModelInvocation,
      argumentHint: args.metadata.argumentHint,
      sourceType: args.metadata.sourceType,
      sourceRef: args.metadata.sourceRef,
      parentSkillName: args.metadata.parentSkillName,
    },
  })
}

export async function insertReferenceBlock(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"sessions">
    content: string
    filename: string
    zone: Zone
    relativePath: string
    parentSkillName: string
    sourceType: "local" | "upload" | "url"
  }
) {
  const position = await getNextPosition(ctx, args.sessionId, args.zone)
  const now = Date.now()
  const tokens = countTokens(args.content)

  return await ctx.db.insert("blocks", {
    sessionId: args.sessionId,
    content: args.content,
    type: "reference",
    zone: args.zone,
    position,
    createdAt: now,
    updatedAt: now,
    tokens,
    originalTokens: tokens,
    tokenModel: DEFAULT_TOKEN_MODEL,
    metadata: {
      skillName: args.filename,
      parentSkillName: args.parentSkillName,
      sourceType: args.sourceType,
      sourceRef: args.relativePath,
    },
  })
}

const referenceArg = v.object({
  content: v.string(),
  filename: v.string(),
  zone: zoneValidator,
  relativePath: v.string(),
})

/**
 * Import a parsed skill as a block.
 * Called from client-side (file upload / URL import).
 */
export const importSkill = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    metadata: skillMetadataArg,
    zone: v.optional(zoneValidator),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    return await insertSkillBlock(ctx, {
      sessionId: args.sessionId,
      content: args.content,
      metadata: args.metadata,
      zone: args.zone as Zone | undefined,
    })
  },
})

/**
 * Internal version for use by Node actions (bypasses auth).
 */
export const importSkillInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    metadata: skillMetadataArg,
    zone: v.optional(zoneValidator),
  },
  handler: async (ctx, args) => {
    return await insertSkillBlock(ctx, {
      sessionId: args.sessionId,
      content: args.content,
      metadata: args.metadata,
      zone: args.zone as Zone | undefined,
    })
  },
})

/**
 * Import a skill with its reference files as separate blocks.
 * Called from client-side (ZIP upload / directory import).
 */
export const importSkillWithReferences = mutation({
  args: {
    sessionId: v.id("sessions"),
    skill: v.object({
      content: v.string(),
      metadata: skillMetadataArg,
      zone: v.optional(zoneValidator),
    }),
    references: v.array(referenceArg),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const skillId = await insertSkillBlock(ctx, {
      sessionId: args.sessionId,
      content: args.skill.content,
      metadata: args.skill.metadata,
      zone: args.skill.zone as Zone | undefined,
    })

    const refIds: Id<"blocks">[] = []
    for (const ref of args.references) {
      const refId = await insertReferenceBlock(ctx, {
        sessionId: args.sessionId,
        content: ref.content,
        filename: ref.filename,
        zone: ref.zone as Zone,
        relativePath: ref.relativePath,
        parentSkillName: args.skill.metadata.skillName,
        sourceType: args.skill.metadata.sourceType as "local" | "upload" | "url",
      })
      refIds.push(refId)
    }

    return { skillId, referenceIds: refIds }
  },
})

/**
 * Internal version of batch import (bypasses auth, for Node actions).
 */
export const importSkillWithReferencesInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    skill: v.object({
      content: v.string(),
      metadata: skillMetadataArg,
      zone: v.optional(zoneValidator),
    }),
    references: v.array(referenceArg),
  },
  handler: async (ctx, args) => {
    const skillId = await insertSkillBlock(ctx, {
      sessionId: args.sessionId,
      content: args.skill.content,
      metadata: args.skill.metadata,
      zone: args.skill.zone as Zone | undefined,
    })

    const refIds: Id<"blocks">[] = []
    for (const ref of args.references) {
      const refId = await insertReferenceBlock(ctx, {
        sessionId: args.sessionId,
        content: ref.content,
        filename: ref.filename,
        zone: ref.zone as Zone,
        relativePath: ref.relativePath,
        parentSkillName: args.skill.metadata.skillName,
        sourceType: args.skill.metadata.sourceType as "local" | "upload" | "url",
      })
      refIds.push(refId)
    }

    return { skillId, referenceIds: refIds }
  },
})
