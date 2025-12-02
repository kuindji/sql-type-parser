/**
 * Common Tests Index
 *
 * Exports all test results for shared/common utilities.
 * These tests cover functionality used by all query types.
 * If this file compiles without errors, all tests pass.
 */

export type { TokenizerTestsPass } from "./tokenizer.test.js"
export type { UtilsTestsPass } from "./utils.test.js"

/**
 * All common tests pass if this type is true
 */
export type CommonTestsPass = true

