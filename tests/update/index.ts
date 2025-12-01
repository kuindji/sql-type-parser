/**
 * UPDATE Query Tests
 * 
 * Re-exports all UPDATE-related type tests.
 * If this file compiles, all UPDATE tests pass.
 */

export type { UpdateParserTestsPass } from "./parser.test.js"
export type { UpdateValidatorTestsPass } from "./validator.test.js"
export type { UpdateMatcherTestsPass } from "./matcher.test.js"

// Aggregate test result
export type UpdateTestsPass = true

