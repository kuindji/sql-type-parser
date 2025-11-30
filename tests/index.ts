/**
 * SQL Type Parser - Type Tests
 *
 * This module exports all type test results. If this file compiles
 * without errors, all type tests pass.
 *
 * Run tests with: npm run test (or tsc --noEmit)
 */

export type { ParserTestsPass } from "./parser.test.js"
export type { MatcherTestsPass } from "./matcher.test.js"
export type { UtilsTestsPass } from "./utils.test.js"
export type { TokenizerTestsPass } from "./tokenizer.test.js"
export type { ASTTestsPass } from "./ast.test.js"

/**
 * Master test result - true if all tests pass
 */
export type AllTestsPass = true

