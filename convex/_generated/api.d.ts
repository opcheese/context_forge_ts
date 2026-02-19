/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as claudeNode from "../claudeNode.js";
import type * as compression from "../compression.js";
import type * as context from "../context.js";
import type * as contextMapImport from "../contextMapImport.js";
import type * as counters from "../counters.js";
import type * as features from "../features.js";
import type * as generations from "../generations.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_contentHash from "../lib/contentHash.js";
import type * as lib_context from "../lib/context.js";
import type * as lib_featureFlags from "../lib/featureFlags.js";
import type * as lib_langfuse from "../lib/langfuse.js";
import type * as lib_resolve from "../lib/resolve.js";
import type * as lib_skills from "../lib/skills.js";
import type * as lib_tokenizer from "../lib/tokenizer.js";
import type * as lib_validators from "../lib/validators.js";
import type * as marketplace from "../marketplace.js";
import type * as metrics from "../metrics.js";
import type * as migrations from "../migrations.js";
import type * as projects from "../projects.js";
import type * as sessions from "../sessions.js";
import type * as skillExport from "../skillExport.js";
import type * as skills from "../skills.js";
import type * as skillsNode from "../skillsNode.js";
import type * as snapshots from "../snapshots.js";
import type * as templates from "../templates.js";
import type * as testing from "../testing.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  blocks: typeof blocks;
  claudeNode: typeof claudeNode;
  compression: typeof compression;
  context: typeof context;
  contextMapImport: typeof contextMapImport;
  counters: typeof counters;
  features: typeof features;
  generations: typeof generations;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/contentHash": typeof lib_contentHash;
  "lib/context": typeof lib_context;
  "lib/featureFlags": typeof lib_featureFlags;
  "lib/langfuse": typeof lib_langfuse;
  "lib/resolve": typeof lib_resolve;
  "lib/skills": typeof lib_skills;
  "lib/tokenizer": typeof lib_tokenizer;
  "lib/validators": typeof lib_validators;
  marketplace: typeof marketplace;
  metrics: typeof metrics;
  migrations: typeof migrations;
  projects: typeof projects;
  sessions: typeof sessions;
  skillExport: typeof skillExport;
  skills: typeof skills;
  skillsNode: typeof skillsNode;
  snapshots: typeof snapshots;
  templates: typeof templates;
  testing: typeof testing;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
