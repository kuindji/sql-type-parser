/**
 * DELETE Query Tests
 * 
 * Re-exports all DELETE-related type tests.
 * If this file compiles, all DELETE tests pass.
 */

export type { DeleteParserTestsPass } from "./parser.test.js"
export type { DeleteValidatorTestsPass } from "./validator.test.js"
export type { DeleteMatcherTestsPass } from "./matcher.test.js"

// Aggregate test result
export type DeleteTestsPass = true

