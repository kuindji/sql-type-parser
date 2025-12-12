/**
 * SELECT Builder Tests Index
 *
 * Re-exports all builder test modules for compilation verification.
 * If this file compiles without errors, all type-level tests pass.
 */

// Type-level tests (compile-time assertions)
export type { StateTestsPass } from "./state.test.js";

// Runtime tests are automatically discovered by bun test
// via the .test.ts files in this directory
