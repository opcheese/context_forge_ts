/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as blocks from "../blocks.js";
import type * as claudeNode from "../claudeNode.js";
import type * as counters from "../counters.js";
import type * as generations from "../generations.js";
import type * as http from "../http.js";
import type * as lib_context from "../lib/context.js";
import type * as lib_ollama from "../lib/ollama.js";
import type * as sessions from "../sessions.js";
import type * as snapshots from "../snapshots.js";
import type * as testing from "../testing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  blocks: typeof blocks;
  claudeNode: typeof claudeNode;
  counters: typeof counters;
  generations: typeof generations;
  http: typeof http;
  "lib/context": typeof lib_context;
  "lib/ollama": typeof lib_ollama;
  sessions: typeof sessions;
  snapshots: typeof snapshots;
  testing: typeof testing;
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
