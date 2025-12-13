/**
 * Conditional SQL Tests Index
 *
 * Export type tests to ensure they compile.
 */

// Type-level tests (compile-time only)
export type { ConditionalTypesTestsPass } from "./types.test.js";
export type { ConditionalMatcherTestsPass } from "./matcher.test.js";

// Runtime tests are run by bun test

