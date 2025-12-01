/**
 * INSERT Query Tests
 * 
 * Re-exports all INSERT-related type tests.
 * If this file compiles, all INSERT tests pass.
 */

export type { InsertParserTestsPass } from "./parser.test.js"
export type { InsertValidatorTestsPass } from "./validator.test.js"
export type { InsertMatcherTestsPass } from "./matcher.test.js"

// Aggregate test result
export type InsertTestsPass = true

